import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { IGitContextProvider, GitContext } from "../../domain/ports/IGitContextProvider.js";

export class LocalGitAdapter implements IGitContextProvider {
  private readonly safeWorkingDir: string;

  constructor(workingDir: string = process.cwd()) {
    try {
      this.safeWorkingDir = fs.existsSync(workingDir) ? fs.realpathSync(workingDir) : workingDir;
    } catch {
      this.safeWorkingDir = workingDir;
    }
  }

  private runGit(args: string[]): string | null {
    try {
      const output = execFileSync("git", args, {
        cwd: this.safeWorkingDir,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        shell: false,
        timeout: 3000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });

      // Sanitizar caracteres de control o secuencias ANSI
      return output
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .trim();
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
    const remoteUrl = this.runGit(["remote", "get-url", "origin"]);
    if (remoteUrl) {
      const cleanUrl = remoteUrl.replace(/\.git$/, "");
      const repoFromRemote = cleanUrl.split(/[/:]/).pop();
      if (repoFromRemote && repoFromRemote.trim()) {
        const sanitized = repoFromRemote.replace(/[^a-zA-Z0-9_.-]/g, "").trim();
        if (sanitized) return sanitized;
      }
    }

    const rootPath = this.runGit(["rev-parse", "--show-toplevel"]);
    if (rootPath) {
      const base = path.basename(rootPath).replace(/[^a-zA-Z0-9_.-]/g, "").trim();
      if (base) return base;
    }

    const currentBase = path.basename(this.safeWorkingDir).replace(/[^a-zA-Z0-9_.-]/g, "").trim();
    return currentBase || "unknown-repo";
  }

  private resolveBranch(): string {
    const branch = this.runGit(["branch", "--show-current"]);
    if (branch && branch.trim()) {
      return branch.replace(/[^a-zA-Z0-9_./-]/g, "").trim();
    }

    const detached = this.runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    if (detached && detached.trim() && detached.trim() !== "HEAD") {
      return detached.replace(/[^a-zA-Z0-9_./-]/g, "").trim();
    }

    return "main";
  }

  private resolveAuthor(): string {
    const gitUser = this.runGit(["config", "user.name"]);
    if (gitUser && gitUser.trim()) {
      return gitUser.slice(0, 80).trim();
    }

    if (process.env["DEV_NAME"] && process.env["DEV_NAME"].trim()) {
      return process.env["DEV_NAME"].slice(0, 80).trim();
    }

    try {
      const systemUser = os.userInfo().username;
      if (systemUser && systemUser.trim()) {
        return systemUser.slice(0, 80).trim();
      }
    } catch {
      // Ignorar si userInfo falla en sandbox
    }

    return "Developer";
  }

  private resolveShortHash(): string | undefined {
    const hash = this.runGit(["rev-parse", "--short", "HEAD"]);
    if (!hash || !hash.trim()) return undefined;
    const cleanHash = hash.replace(/[^a-f0-9]/gi, "").trim();
    return cleanHash.length >= 4 && cleanHash.length <= 12 ? cleanHash : undefined;
  }
}
