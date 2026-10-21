export interface ResolvedTelegramCredentials {
  readonly botToken: string;
  readonly chatId: string;
  readonly threadId?: number | undefined;
}

export interface IDynamicNotificationService {
  sendMessage(
    htmlText: string,
    credentials: ResolvedTelegramCredentials
  ): Promise<void>;
}
