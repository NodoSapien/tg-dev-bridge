import type { DevUpdate } from "../../domain/entities/DevUpdate.js";

export class MessageFormatter {
  public static escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  public static formatDevUpdate(update: DevUpdate): string {
    const escapedRepo = this.escapeHtml(update.repoName);
    const escapedAuthor = this.escapeHtml(update.author);
    const escapedBranch = this.escapeHtml(update.branch);
    const hashPart = update.shortHash ? ` (<code>${this.escapeHtml(update.shortHash)}</code>)` : "";

    const lines: string[] = [
      `🚀 <b>Actualización de Desarrollo</b> | <code>${escapedRepo}</code>`,
      `👤 <b>Dev:</b> ${escapedAuthor} | 🌿 <b>Rama:</b> <code>${escapedBranch}</code>${hashPart}`,
      "",
      "✅ <b>Cambios realizados:</b>",
      ...update.completedChanges.map((change) => `• ${this.escapeHtml(change)}`),
      "",
      "⏭️ <b>Siguientes pasos:</b>",
      ...update.nextSteps.map((step) => `• ${this.escapeHtml(step)}`),
    ];

    if (update.blockers && update.blockers.length > 0) {
      lines.push("");
      lines.push("⚠️ <b>Bloqueos / Notas:</b>");
      lines.push(...update.blockers.map((blocker) => `• ${this.escapeHtml(blocker)}`));
    }

    return lines.join("\n");
  }
}
