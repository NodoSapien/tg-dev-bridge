export class TelegramError extends Error {
  public readonly statusCode?: number | undefined;
  public readonly telegramErrorCode?: number | undefined;

  constructor(
    message: string,
    options?: { statusCode?: number | undefined; telegramErrorCode?: number | undefined }
  ) {
    super(message);
    this.name = "TelegramError";
    this.statusCode = options?.statusCode;
    this.telegramErrorCode = options?.telegramErrorCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
