import type { BotProfile, FieldDefinition } from "../../domain/entities/BotProfile.js";
import type { ITemplateEngine, TemplateContext } from "../../domain/ports/ITemplateEngine.js";

export class DynamicHtmlFormatter implements ITemplateEngine {
  public static escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private resolveContextValue(context: TemplateContext | undefined, tokenPath: string): string {
    if (!context) return "";

    const parts = tokenPath.split(".");
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return "";
      }
      current = (current as Record<string, unknown>)[part];
    }

    if (current === null || current === undefined) {
      return "";
    }

    return DynamicHtmlFormatter.escapeHtml(String(current));
  }

  private interpolateTemplate(template: string, context?: TemplateContext): string {
    // Reemplaza tokens {{path.to.var}} con escaping de HTML del valor
    let rendered = template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, tokenPath: string) => {
      return this.resolveContextValue(context, tokenPath);
    });

    // Limpieza de paréntesis o corchetes vacíos resultantes de tokens ausentes, ej: " ()"
    rendered = rendered.replace(/\s*\(\s*\)/g, "");

    return rendered.trim();
  }

  private renderField(field: FieldDefinition, value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (field.type === "string[]") {
      const items = Array.isArray(value) ? value : [value];
      const validItems = items
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0);

      if (validItems.length === 0) {
        return null;
      }

      const bulletLines = validItems.map(
        (item) => `• ${DynamicHtmlFormatter.escapeHtml(item)}`
      );

      return `<b>${DynamicHtmlFormatter.escapeHtml(field.label)}:</b>\n${bulletLines.join("\n")}`;
    }

    if (field.type === "string") {
      const text = String(value).trim();
      if (!text) {
        return null;
      }
      return `<b>${DynamicHtmlFormatter.escapeHtml(field.label)}:</b>\n${DynamicHtmlFormatter.escapeHtml(text)}`;
    }

    if (field.type === "number" || field.type === "boolean") {
      return `<b>${DynamicHtmlFormatter.escapeHtml(field.label)}:</b> ${String(value)}`;
    }

    return null;
  }

  public render(
    profile: BotProfile,
    payload: Record<string, unknown>,
    context?: TemplateContext
  ): string {
    const sections: string[] = [];

    // 1. Encabezado interpolado
    const header = this.interpolateTemplate(profile.headerTemplate, context);
    if (header) {
      sections.push(header);
    }

    // 2. Renderizado de campos dinámicos
    const fieldBlocks: string[] = [];
    for (const field of profile.fields) {
      const value = payload[field.key];
      const renderedField = this.renderField(field, value);
      if (renderedField) {
        fieldBlocks.push(renderedField);
      }
    }

    if (fieldBlocks.length > 0) {
      sections.push(fieldBlocks.join("\n\n"));
    }

    // 3. Pie de página interpolado (si existe)
    if (profile.footerTemplate) {
      const footer = this.interpolateTemplate(profile.footerTemplate, context);
      if (footer) {
        sections.push(footer);
      }
    }

    return sections.join("\n\n");
  }
}
