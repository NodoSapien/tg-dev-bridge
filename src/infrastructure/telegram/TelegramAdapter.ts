import type { INotificationService } from "../../domain/ports/INotificationService.js";
import type { DevUpdate } from "../../domain/entities/DevUpdate.js";
import type { AppConfig } from "../config/env.js";
import { MessageFormatter } from "./MessageFormatter.js";
import { TelegramError } from "../../shared/errors/TelegramError.js";

interface TelegramApiResponse {
  readonly ok: boolean;
  readonly description?: string;
  readonly error_code?: number;
}

export class TelegramAdapter implements INotificationService {
  constructor(private readonly config: AppConfig) {}

  public async sendDevUpdate(update: DevUpdate): Promise<void> {
    const messageHtml = MessageFormatter.formatDevUpdate(update);

    const endpoint = `https://api.telegram.org/bot${this.config.TELEGRAM_BOT_TOKEN}/sendMessage`;

    const body: Record<string, unknown> = {
      chat_id: this.config.TELEGRAM_CHAT_ID,
      text: messageHtml,
      parse_mode: "HTML",
    };

    if (this.config.TELEGRAM_THREAD_ID !== undefined) {
      body["message_thread_id"] = this.config.TELEGRAM_THREAD_ID;
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (networkError) {
      throw new TelegramError(
        `Error de red al intentar contactar Telegram Bot API: ${
          networkError instanceof Error ? networkError.message : String(networkError)
        }`
      );
    }

    let responseData: TelegramApiResponse | null = null;
    try {
      responseData = (await response.json()) as TelegramApiResponse;
    } catch {
      // Ignorar si el body no era JSON válido
    }

    if (!response.ok || (responseData && !responseData.ok)) {
      const errorMsg =
        responseData?.description ||
        `Telegram API respondió con estado HTTP ${response.status} (${response.statusText})`;
      throw new TelegramError(errorMsg, {
        statusCode: response.status,
        telegramErrorCode: responseData?.error_code,
      });
    }
  }
}
