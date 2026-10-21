import { SecurityError } from "../../shared/errors/SecurityError.js";

export interface SecretPattern {
  readonly name: string;
  readonly regex: RegExp;
}

export interface ScanResult {
  readonly found: boolean;
  readonly patternName?: string | undefined;
  readonly fieldName?: string | undefined;
}

export class SecretRedactor {
  private static readonly PATTERNS: readonly SecretPattern[] = [
    {
      name: "AWS Access Key",
      regex: /\bAKIA[0-9A-Z]{16}\b/,
    },
    {
      name: "GitHub Token (PAT / Fine-Grained / OAuth)",
      regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{60,}|(gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36})\b/,
    },
    {
      name: "Anthropic API Key",
      regex: /\bsk-ant-[a-zA-Z0-9_-]{30,}\b/,
    },
    {
      name: "OpenAI API Key",
      regex: /\bsk-(proj-)?[a-zA-Z0-9_-]{30,}\b/,
    },
    {
      name: "JSON Web Token (JWT)",
      regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
    },
    {
      name: "Database Connection String with Credentials",
      regex: /\b(postgres|postgresql|mysql|mongodb|redis|amqp|mssql):\/\/[^\s:]+:[^\s@]+@[^\s/]+\b/,
    },
    {
      name: "Cryptographic Private Key Header",
      regex: /-----BEGIN ((RSA|EC|DSA|OPENSSH) )?PRIVATE KEY-----/,
    },
    {
      name: "Slack Token",
      regex: /\bxox[baprs]-[0-9]{10,13}-[0-9a-zA-Z-]+/,
    },
    {
      name: "Telegram Bot Token",
      regex: /\b[0-9]{8,11}:[a-zA-Z0-9_-]{35}\b/,
    },
  ];

  public static scanText(text: string): { found: boolean; patternName?: string | undefined } {
    for (const pattern of this.PATTERNS) {
      if (pattern.regex.test(text)) {
        return { found: true, patternName: pattern.name };
      }
    }
    return { found: false };
  }

  public static scanValue(value: unknown, fieldPath = "field"): ScanResult {
    if (typeof value === "string") {
      const result = this.scanText(value);
      if (result.found) {
        return { found: true, patternName: result.patternName, fieldName: fieldPath };
      }
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const itemResult = this.scanValue(value[i], `${fieldPath}[${i}]`);
        if (itemResult.found) {
          return itemResult;
        }
      }
    } else if (value !== null && typeof value === "object") {
      for (const [key, propValue] of Object.entries(value)) {
        const propResult = this.scanValue(propValue, `${fieldPath}.${key}`);
        if (propResult.found) {
          return propResult;
        }
      }
    }

    return { found: false };
  }

  public static assertSafePayload(payload: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(payload)) {
      const scanResult = this.scanValue(value, key);
      if (scanResult.found) {
        throw new SecurityError(
          `DLP Bloqueo de Seguridad: Se detectó una credencial sensible (${scanResult.patternName}) en el campo '${scanResult.fieldName}'. El envío a Telegram fue abortado para prevenir exfiltración de datos.`,
          {
            code: "SECRET_LEAK_PREVENTED",
            detectedPattern: scanResult.patternName,
            fieldKey: scanResult.fieldName,
          }
        );
      }
    }
  }

  public static redact(text: string): string {
    let sanitized = text;
    for (const pattern of this.PATTERNS) {
      sanitized = sanitized.replace(new RegExp(pattern.regex, "g"), "[REDACTED_SECRET]");
    }
    return sanitized;
  }
}
