import { z } from "zod";

export const FieldTypeSchema = z.enum(["string", "string[]", "number", "boolean"]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const FieldDefinitionSchema = z.object({
  key: z
    .string()
    .min(1, "La clave del campo no puede estar vacía")
    .regex(/^[a-zA-Z0-9_]+$/, "La clave debe ser alfanumérica en camelCase o snake_case"),
  label: z.string().min(1, "La etiqueta visible no puede estar vacía"),
  type: FieldTypeSchema,
  required: z.boolean().default(true),
  description: z.string().min(1, "La descripción del campo es requerida"),
});
export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;

export const TelegramProfileConfigSchema = z.object({
  tokenEnvVar: z.string().default("TELEGRAM_BOT_TOKEN"),
  chatIdEnvVar: z.string().default("TELEGRAM_CHAT_ID"),
  threadIdEnvVar: z.string().optional(),
});
export type TelegramProfileConfig = z.infer<typeof TelegramProfileConfigSchema>;

export const ContextProvidersSchema = z.object({
  includeGitInfo: z.boolean().default(true),
  includeTimestamp: z.boolean().default(true),
});
export type ContextProvidersConfig = z.infer<typeof ContextProvidersSchema>;

export const BotProfileSchema = z.object({
  botId: z
    .string()
    .min(1, "botId no puede estar vacío")
    .regex(/^[a-z0-9-]+$/, "botId debe estar en kebab-case (ej. dev-tracker)"),
  toolName: z
    .string()
    .min(1, "toolName no puede estar vacío")
    .regex(/^[a-z0-9_]+$/, "toolName debe estar en snake_case (ej. send_dev_update)"),
  toolDescription: z.string().min(1, "toolDescription es requerida"),
  telegram: TelegramProfileConfigSchema.default({}),
  contextProviders: ContextProvidersSchema.default({}),
  fields: z.array(FieldDefinitionSchema).min(1, "Debe definir al menos un campo en el perfil"),
  headerTemplate: z.string().min(1, "headerTemplate es requerida"),
  footerTemplate: z.string().optional(),
});
export type BotProfile = z.infer<typeof BotProfileSchema>;
