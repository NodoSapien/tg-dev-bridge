import { z } from "zod";
import type { BotProfile } from "../../domain/entities/BotProfile.js";
import type { IGitContextProvider } from "../../domain/ports/IGitContextProvider.js";
import type { ITemplateEngine, TemplateContext } from "../../domain/ports/ITemplateEngine.js";
import type { IDynamicNotificationService } from "../../domain/ports/IDynamicNotificationService.js";
import { TelegramProfileResolver } from "../../infrastructure/config/TelegramProfileResolver.js";
import { type Result, ok, err } from "../../shared/types/Result.js";

export interface PublishedReportResult {
  readonly botId: string;
  readonly toolName: string;
  readonly renderedHtml: string;
  readonly context: TemplateContext;
}

export class PublishReportUseCase {
  constructor(
    private readonly gitContextProvider: IGitContextProvider,
    private readonly templateEngine: ITemplateEngine,
    private readonly notificationService: IDynamicNotificationService
  ) {}

  public static buildZodSchemaForProfile(profile: BotProfile): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const field of profile.fields) {
      let fieldSchema: z.ZodTypeAny;

      switch (field.type) {
        case "string[]":
          fieldSchema = z.array(z.string().min(1, `El valor en ${field.label} no puede estar vacío`));
          if (field.required) {
            fieldSchema = (fieldSchema as z.ZodArray<z.ZodString>).min(1, `Debe proveer al menos un elemento para ${field.label}`);
          }
          break;
        case "number":
          fieldSchema = z.coerce.number();
          break;
        case "boolean":
          fieldSchema = z.coerce.boolean();
          break;
        case "string":
        default:
          fieldSchema = z.string();
          if (field.required) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, `${field.label} no puede estar vacío`);
          }
          break;
      }

      if (!field.required) {
        fieldSchema = fieldSchema.optional();
      }

      shape[field.key] = fieldSchema;
    }

    return z.object(shape);
  }

  public async execute(
    profile: BotProfile,
    rawPayload: Record<string, unknown>
  ): Promise<Result<PublishedReportResult, Error>> {
    try {
      // 1. Validar dinámicamente según el esquema del perfil
      const schema = PublishReportUseCase.buildZodSchemaForProfile(profile);
      const parseResult = schema.safeParse(rawPayload);

      if (!parseResult.success) {
        const issues = parseResult.error.issues
          .map((i) => `• ${i.path.join(".") || "campo"}: ${i.message}`)
          .join("\n");
        return err(new Error(`Validación fallida para el perfil '${profile.botId}':\n${issues}`));
      }

      const validatedPayload = parseResult.data;

      // 2. Construir contexto (Git + Timestamp)
      const context: TemplateContext = {};

      if (profile.contextProviders.includeGitInfo) {
        const git = this.gitContextProvider.getContext();
        context.git = {
          repo: git.repoName,
          branch: git.branch,
          author: git.author,
          shortHash: git.shortHash,
        };
      }

      if (profile.contextProviders.includeTimestamp) {
        const now = new Date();
        context.timestamp = `${now.toISOString().replace("T", " ").substring(0, 19)} UTC`;
      }

      // 3. Renderizar HTML con el motor de plantillas
      const renderedHtml = this.templateEngine.render(profile, validatedPayload, context);

      // 4. Resolver credenciales de Telegram para este perfil
      const credentials = TelegramProfileResolver.resolve(profile.telegram);

      // 5. Enviar mensaje a Telegram
      await this.notificationService.sendMessage(renderedHtml, credentials);

      return ok({
        botId: profile.botId,
        toolName: profile.toolName,
        renderedHtml,
        context,
      });
    } catch (error) {
      if (error instanceof Error) {
        return err(error);
      }
      return err(new Error(String(error)));
    }
  }
}
