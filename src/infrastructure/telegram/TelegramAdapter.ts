import type { INotificationService } from "../../domain/ports/INotificationService.js";
import type {
  IDynamicNotificationService,
  ResolvedTelegramCredentials,
} from "../../domain/ports/IDynamicNotificationService.js";
import type { DevUpdate } from "../../domain/entities/DevUpdate.js";
import type { AppConfig } from "../config/env.js";
import { MessageFormatter } from "./MessageFormatter.js";
import { TelegramError } from "../../shared/errors/TelegramError.js";

interface TelegramApiResponse {
  readonly ok: boolean;
  readonly description?: string;
  readonly error_code?: number;
}

export class TelegramAdapter implements INotificationService, IDynamicNotificationService {
  constructor(private readonly config?: AppConfig) {}

  public async sendMessage(
    htmlText: string,
    credentials: ResolvedTelegramCredentials
  ): Promise<void> {
    const endpoint = `https://api.telegram.org/bot${credentials.botToken}/sendMessage`;

    const body: Record<string, unknown> = {
      chat_id: credentials.chatId,
      text: htmlText,
      parse_mode: "HTML",
    };

    if (credentials.threadId !== undefined) {
      body["message_thread_id"] = credentials.threadId;
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

  public async sendDevUpdate(update: DevUpdate): Promise<void> {
    if (!this.config) {
      throw new Error("TelegramAdapter fue inicializado sin AppConfig para llamadas estáticas");
    }

    const messageHtml = MessageFormatter.formatDevUpdate(update);
    await this.sendMessage(messageHtml, {
      botToken: this.config.TELEGRAM_BOT_TOKEN,
      chatId: this.config.TELEGRAM_CHAT_ID,
      threadId: this.config.TELEGRAM_THREAD_ID,
    });
  }
}
