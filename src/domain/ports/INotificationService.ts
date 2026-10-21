import type { DevUpdate } from "../entities/DevUpdate.js";

export interface INotificationService {
  sendDevUpdate(update: DevUpdate): Promise<void>;
}
