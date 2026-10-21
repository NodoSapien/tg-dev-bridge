import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";
import type { TelegramProfileConfig } from "../../domain/entities/BotProfile.js";
import type { ResolvedTelegramCredentials } from "../../domain/ports/IDynamicNotificationService.js";
import { ConfigError } from "../../shared/errors/ConfigError.js";

function ensureEnvLoaded(): void {
  const localEnvPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath });
  }

  const globalConfigPath = path.resolve(os.homedir(), ".config", "tg-dev-bridge", ".env");
  if (fs.existsSync(globalConfigPath)) {
    dotenv.config({ path: globalConfigPath });
  }
}

export class TelegramProfileResolver {
  public static resolve(
    config: TelegramProfileConfig,
    envSource: NodeJS.ProcessEnv = process.env
  ): ResolvedTelegramCredentials {
    ensureEnvLoaded();

    const tokenVar = config.tokenEnvVar || "TELEGRAM_BOT_TOKEN";
    const chatIdVar = config.chatIdEnvVar || "TELEGRAM_CHAT_ID";

    const botToken = envSource[tokenVar]?.trim();
    if (!botToken) {
      throw new ConfigError(
        `Falta la variable de entorno '${tokenVar}' requerida para el bot token de Telegram.`,
        "MISSING_TELEGRAM_TOKEN"
      );
    }

    const chatId = envSource[chatIdVar]?.trim();
    if (!chatId) {
      throw new ConfigError(
        `Falta la variable de entorno '${chatIdVar}' requerida para el chat ID de Telegram.`,
        "MISSING_TELEGRAM_CHAT_ID"
      );
    }

    let threadId: number | undefined;
    if (config.threadIdEnvVar) {
      const rawThread = envSource[config.threadIdEnvVar]?.trim();
      if (rawThread) {
        const parsed = Number(rawThread);
        if (Number.isNaN(parsed)) {
          throw new ConfigError(
            `La variable de entorno '${config.threadIdEnvVar}' debe ser un número válido.`,
            "INVALID_THREAD_ID"
          );
        }
        threadId = parsed;
      }
    } else if (envSource["TELEGRAM_THREAD_ID"]?.trim()) {
      const parsed = Number(envSource["TELEGRAM_THREAD_ID"].trim());
      if (!Number.isNaN(parsed)) {
        threadId = parsed;
      }
    }

    return {
      botToken,
      chatId,
      threadId,
    };
  }
}
