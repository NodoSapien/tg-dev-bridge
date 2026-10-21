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
  public static readonly MAX_TELEGRAM_MESSAGE_LENGTH = 4096;
  public static readonly SAFE_CUTOFF_LENGTH = 3900;
  private static readonly REQUEST_TIMEOUT_MS = 10000;

  constructor(private readonly config?: AppConfig) {}

  public static sanitizeSensitiveText(text: string, botToken?: string): string {
    let sanitized = text.replace(/\/bot[0-9]{8,11}:[a-zA-Z0-9_-]{30,36}/g, "/bot[REDACTED_BOT_TOKEN]");
    sanitized = sanitized.replace(/\b[0-9]{8,11}:[a-zA-Z0-9_-]{30,36}\b/g, "[REDACTED_BOT_TOKEN]");
    if (botToken && botToken.trim()) {
      sanitized = sanitized.replaceAll(botToken.trim(), "[REDACTED_BOT_TOKEN]");
    }
    return sanitized;
  }

  public static truncateHtmlMessage(html: string, maxLen = TelegramAdapter.SAFE_CUTOFF_LENGTH): string {
    if (html.length <= TelegramAdapter.MAX_TELEGRAM_MESSAGE_LENGTH) {
      return html;
    }

    // Cortar en un espacio en blanco anterior al límite seguro
    let cutPoint = html.lastIndexOf(" ", maxLen);
    if (cutPoint === -1 || cutPoint < maxLen / 2) {
      cutPoint = maxLen;
    }

    let truncated = html.slice(0, cutPoint);

    // Si el corte quedó dentro de una etiqueta HTML (ej. <code o <b), eliminar la etiqueta rota
    const lastOpen = truncated.lastIndexOf("<");
    const lastClose = truncated.lastIndexOf(">");
    if (lastOpen > lastClose) {
      truncated = truncated.slice(0, lastOpen);
    }

    // Cerrar etiquetas abiertas comunes en Telegram HTML (b, code, i, pre)
    const openTags = ["b", "code", "i", "pre", "u", "s"];
    for (const tag of openTags) {
      const openMatches = (truncated.match(new RegExp(`<${tag}\\b[^>]*>`, "gi")) || []).length;
      const closeMatches = (truncated.match(new RegExp(`</${tag}>`, "gi")) || []).length;
      if (openMatches > closeMatches) {
        truncated += `</${tag}>`.repeat(openMatches - closeMatches);
      }
    }

    return `${truncated}\n\n<i>[... reporte truncado automáticamente por límite de Telegram]</i>`;
  }

  public async sendMessage(
    htmlText: string,
    credentials: ResolvedTelegramCredentials
  ): Promise<void> {
    const safeHtml = TelegramAdapter.truncateHtmlMessage(htmlText);
    const endpoint = `https://api.telegram.org/bot${credentials.botToken}/sendMessage`;

    const body: Record<string, unknown> = {
      chat_id: credentials.chatId,
      text: safeHtml,
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
        signal: AbortSignal.timeout(TelegramAdapter.REQUEST_TIMEOUT_MS),
      });
    } catch (networkError) {
      const rawMsg = networkError instanceof Error ? networkError.message : String(networkError);
      const safeMsg = TelegramAdapter.sanitizeSensitiveText(rawMsg, credentials.botToken);
      throw new TelegramError(`Fallo de red o timeout al contactar Telegram Bot API: ${safeMsg}`);
    }

    let responseData: TelegramApiResponse | null = null;
    try {
      responseData = (await response.json()) as TelegramApiResponse;
    } catch {
      // Ignorar si el cuerpo de respuesta no es JSON válido
    }

    if (!response.ok || (responseData && !responseData.ok)) {
      const rawDescription =
        responseData?.description ||
        `Telegram API respondió con estado HTTP ${response.status} (${response.statusText})`;
      const safeDescription = TelegramAdapter.sanitizeSensitiveText(rawDescription, credentials.botToken);

      throw new TelegramError(safeDescription, {
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
