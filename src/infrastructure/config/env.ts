import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";
import { z } from "zod";
import { ConfigError } from "../../shared/errors/ConfigError.js";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z
    .string({
      required_error: "TELEGRAM_BOT_TOKEN es requerido para autenticarse con Telegram API",
    })
    .min(1, "TELEGRAM_BOT_TOKEN no puede estar vacío"),
  TELEGRAM_CHAT_ID: z
    .string({
      required_error: "TELEGRAM_CHAT_ID es requerido para identificar el grupo de destino",
    })
    .min(1, "TELEGRAM_CHAT_ID no puede estar vacío"),
  TELEGRAM_THREAD_ID: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === "") return undefined;
      const parsed = Number(val);
      if (Number.isNaN(parsed)) {
        throw new Error("TELEGRAM_THREAD_ID debe ser un número válido");
      }
      return parsed;
    }),
  DEV_NAME: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;

function loadEnvFiles(): void {
  // 1. Cargar .env en el directorio actual (o cwd de ejecución)
  const localEnvPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath });
  }

  // 2. Si faltan variables clave, intentar cargar ~/.config/tg-dev-bridge/.env como fallback global
  if (!process.env["TELEGRAM_BOT_TOKEN"] || !process.env["TELEGRAM_CHAT_ID"]) {
    const globalConfigPath = path.resolve(os.homedir(), ".config", "tg-dev-bridge", ".env");
    if (fs.existsSync(globalConfigPath)) {
      dotenv.config({ path: globalConfigPath });
    }
  }
}

export function loadConfig(overrideEnv?: Record<string, string | undefined>): AppConfig {
  if (cachedConfig && !overrideEnv) {
    return cachedConfig;
  }

  loadEnvFiles();

  const source = overrideEnv ?? process.env;
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `• ${err.path.join(".")}: ${err.message}`)
      .join("\n");
    throw new ConfigError(
      `Error de configuración en variables de entorno:\n${formattedErrors}`,
      "INVALID_CONFIG"
    );
  }

  if (!overrideEnv) {
    cachedConfig = result.data;
  }

  return result.data;
}
