export class ConfigError extends Error {
  public readonly code: string;

  constructor(message: string, code = "CONFIG_ERROR") {
    super(message);
    this.name = "ConfigError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
