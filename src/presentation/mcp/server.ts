#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ProfileLoader } from "../../infrastructure/config/ProfileLoader.js";
import { LocalGitAdapter } from "../../infrastructure/git/LocalGitAdapter.js";
import { DynamicHtmlFormatter } from "../../infrastructure/telegram/DynamicHtmlFormatter.js";
import { TelegramAdapter } from "../../infrastructure/telegram/TelegramAdapter.js";
import { PublishReportUseCase } from "../../application/use-cases/PublishReportUseCase.js";
import { SecurityError } from "../../shared/errors/SecurityError.js";
import type { BotProfile } from "../../domain/entities/BotProfile.js";

function extractProfileName(args: string[]): string {
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--profile" || args[i] === "-P") && args[i + 1]) {
      return args[i + 1]!;
    }
  }
  return process.env["BOT_PROFILE"] || "dev-update";
}

function buildMcpToolShape(profile: BotProfile): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of profile.fields) {
    let fieldZod: z.ZodTypeAny;

    switch (field.type) {
      case "string[]":
        fieldZod = z.array(z.string().min(1)).describe(field.description);
        if (field.required) {
          fieldZod = (fieldZod as z.ZodArray<z.ZodString>).min(1, `Debe incluir al menos un valor en ${field.label}`);
        }
        break;
      case "number":
        fieldZod = z.number().describe(field.description);
        break;
      case "boolean":
        fieldZod = z.boolean().describe(field.description);
        break;
      case "string":
      default:
        fieldZod = z.string().describe(field.description);
        if (field.required) {
          fieldZod = (fieldZod as z.ZodString).min(1, `${field.label} es requerido`);
        }
        break;
    }

    if (!field.required) {
      fieldZod = fieldZod.optional();
    }

    shape[field.key] = fieldZod;
  }

  // Soporte opcional para sobrescribir autor si el usuario o agente lo desea
  shape["customAuthor"] = z
    .string()
    .optional()
    .describe("Opcional: Sobrescribe el autor de Git detectado");

  return shape;
}

async function runMcpServer(): Promise<void> {
  const profileName = extractProfileName(process.argv);
  let profile: BotProfile;

  try {
    profile = ProfileLoader.load(profileName);
  } catch (error) {
    console.error(`Error crítico al cargar perfil '${profileName}':`, error);
    process.exit(1);
  }

  const server = new McpServer({
    name: `tg-bridge-${profile.botId}`,
    version: "1.0.0",
  });

  const toolShape = buildMcpToolShape(profile);

  server.tool(
    profile.toolName,
    profile.toolDescription,
    toolShape,
    async (args) => {
      try {
        const rawArgs = args as Record<string, unknown>;
        const customAuthor = rawArgs["customAuthor"] ? String(rawArgs["customAuthor"]) : undefined;

        const gitAdapter = new LocalGitAdapter();
        const gitContextProvider = customAuthor
          ? {
              getContext: () => {
                const ctx = gitAdapter.getContext();
                return { ...ctx, author: customAuthor };
              },
            }
          : gitAdapter;

        const formatter = new DynamicHtmlFormatter();
        const telegramAdapter = new TelegramAdapter();
        const useCase = new PublishReportUseCase(gitContextProvider, formatter, telegramAdapter);

        const result = await useCase.execute(profile, rawArgs);

        if (!result.success) {
          const isSecurity = result.error instanceof SecurityError;
          const errorHeader = isSecurity
            ? "🛡️ BLOQUEO DE SEGURIDAD (DLP ACTIVADO):"
            : "Error al publicar el reporte en Telegram:";

          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `${errorHeader}\n${result.error.message}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `✅ Reporte publicado exitosamente en Telegram.\n• Bot: ${result.data.botId}\n• Tool: ${result.data.toolName}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Fallo inesperado al ejecutar ${profile.toolName}: ${message}`,
            },
          ],
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`tg-bridge MCP Server corriendo en stdio [Perfil: ${profile.botId} | Tool: ${profile.toolName}]`);
}

runMcpServer().catch((error) => {
  console.error("Error crítico al iniciar tg-bridge MCP Server:", error);
  process.exit(1);
});
