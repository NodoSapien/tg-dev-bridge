import { DevUpdate } from "../../domain/entities/DevUpdate.js";
import type { IGitContextProvider } from "../../domain/ports/IGitContextProvider.js";
import type { INotificationService } from "../../domain/ports/INotificationService.js";
import type { PublishDevUpdateInput } from "../dtos/PublishDevUpdateDTO.js";
import { type Result, ok, err } from "../../shared/types/Result.js";

export class PublishDevUpdateUseCase {
  constructor(
    private readonly gitContextProvider: IGitContextProvider,
    private readonly notificationService: INotificationService
  ) {}

  public async execute(input: PublishDevUpdateInput): Promise<Result<DevUpdate, Error>> {
    try {
      const gitContext = this.gitContextProvider.getContext();

      const author = input.customAuthor?.trim() || gitContext.author;

      const devUpdate = DevUpdate.create({
        repoName: gitContext.repoName,
        branch: gitContext.branch,
        author,
        shortHash: gitContext.shortHash,
        completedChanges: input.completedChanges,
        nextSteps: input.nextSteps,
        blockers: input.blockers,
      });

      await this.notificationService.sendDevUpdate(devUpdate);

      return ok(devUpdate);
    } catch (error) {
      if (error instanceof Error) {
        return err(error);
      }
      return err(new Error(String(error)));
    }
  }
}
