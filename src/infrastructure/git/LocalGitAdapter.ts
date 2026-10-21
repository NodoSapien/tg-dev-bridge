import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import type { IGitContextProvider, GitContext } from "../../domain/ports/IGitContextProvider.js";

export class LocalGitAdapter implements IGitContextProvider {
  constructor(private readonly workingDir: string = process.cwd()) {}

  private runGit(args: string[]): string | null {
    try {
      const output = execFileSync("git", args, {
        cwd: this.workingDir,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return output.trim();
    } catch {
      return null;
    }
  }

  public getContext(): GitContext {
    return {
      repoName: this.resolveRepoName(),
      branch: this.resolveBranch(),
      author: this.resolveAuthor(),
      shortHash: this.resolveShortHash(),
    };
  }

  private resolveRepoName(): string {
    // 1. Intentar obtener el nombre del remote origin (ej. repo desde git@github.com:org/repo.git)
    const remoteUrl = this.runGit(["remote", "get-url", "origin"]);
    if (remoteUrl) {
      const cleanUrl = remoteUrl.replace(/\.git$/, "");
      const repoFromRemote = cleanUrl.split(/[/:]/).pop();
      if (repoFromRemote && repoFromRemote.trim()) {
        return repoFromRemote.trim();
      }
    }

    // 2. Intentar obtener la raíz del repositorio local
    const rootPath = this.runGit(["rev-parse", "--show-toplevel"]);
    if (rootPath) {
      return path.basename(rootPath);
    }

    // 3. Fallback al nombre del directorio actual
    return path.basename(this.workingDir) || "unknown-repo";
  }

  private resolveBranch(): string {
    const branch = this.runGit(["branch", "--show-current"]);
    if (branch && branch.trim()) {
      return branch.trim();
    }

    // Si está en detached HEAD o sin rama
    const detached = this.runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    if (detached && detached.trim() && detached.trim() !== "HEAD") {
      return detached.trim();
    }

    return "main";
  }

  private resolveAuthor(): string {
    const gitUser = this.runGit(["config", "user.name"]);
    if (gitUser && gitUser.trim()) {
      return gitUser.trim();
    }

    if (process.env["DEV_NAME"] && process.env["DEV_NAME"].trim()) {
      return process.env["DEV_NAME"].trim();
    }

    try {
      const systemUser = os.userInfo().username;
      if (systemUser && systemUser.trim()) {
        return systemUser.trim();
      }
    } catch {
      // Ignorar si userInfo falla en entornos sandbox
    }

    return "Developer";
  }

  private resolveShortHash(): string | undefined {
    const hash = this.runGit(["rev-parse", "--short", "HEAD"]);
    return hash && hash.trim() ? hash.trim() : undefined;
  }
}
