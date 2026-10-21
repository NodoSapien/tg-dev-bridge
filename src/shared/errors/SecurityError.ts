export class SecurityError extends Error {
  public readonly code: string;
  public readonly detectedPattern?: string | undefined;
  public readonly fieldKey?: string | undefined;

  constructor(
    message: string,
    options?: { code?: string | undefined; detectedPattern?: string | undefined; fieldKey?: string | undefined }
  ) {
    super(message);
    this.name = "SecurityError";
    this.code = options?.code ?? "SECURITY_VIOLATION";
    this.detectedPattern = options?.detectedPattern;
    this.fieldKey = options?.fieldKey;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
