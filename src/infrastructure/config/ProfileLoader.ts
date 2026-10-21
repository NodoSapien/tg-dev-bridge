import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BotProfileSchema, type BotProfile } from "../../domain/entities/BotProfile.js";
import { ConfigError } from "../../shared/errors/ConfigError.js";
import { SecurityError } from "../../shared/errors/SecurityError.js";

export class ProfileLoader {
  private static readonly SAFE_NAME_REGEX = /^[a-z0-9_-]+$/i;

  private static getPackageProfilesDir(): string {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(currentDir, "../../../profiles");
  }

  public static resolveProfilePath(profileName: string): string {
    const trimmed = profileName.trim();

    // 1. Caso especial seguro: bot.config.json en la raíz del proyecto
    if (trimmed === "bot.config.json" || trimmed === "bot.config" || trimmed === "default") {
      const localBotConfig = path.resolve(process.cwd(), "bot.config.json");
      if (fs.existsSync(localBotConfig)) {
        return fs.realpathSync(localBotConfig);
      }
    }

    const cleanName = trimmed.replace(/\.json$/i, "");

    // 2. Validación estricta contra Path Traversal (CWE-22)
    if (!this.SAFE_NAME_REGEX.test(cleanName)) {
      throw new SecurityError(
        `Intento de Path Traversal bloqueado: El nombre de perfil '${profileName}' contiene caracteres no permitidos. Solo se admiten caracteres alfanuméricos, guiones y guiones bajos.`,
        { code: "PATH_TRAVERSAL_BLOCKED", fieldKey: "profile" }
      );
    }

    // 3. Buscar en ./profiles/<cleanName>.json desde el cwd
    const localProfilesDir = path.resolve(process.cwd(), "profiles");
    const localCandidate = path.resolve(localProfilesDir, `${cleanName}.json`);

    if (fs.existsSync(localCandidate)) {
      const canonicalPath = fs.realpathSync(localCandidate);
      const canonicalDir = fs.existsSync(localProfilesDir) ? fs.realpathSync(localProfilesDir) : localProfilesDir;

      // Verificación de confinamiento de prefijo
      if (canonicalPath.startsWith(canonicalDir + path.sep)) {
        return canonicalPath;
      }
      throw new SecurityError(
        `Violación de confinamiento: El archivo resuelto '${canonicalPath}' escapa del directorio de perfiles permitido.`,
        { code: "PATH_TRAVERSAL_CONFINEMENT_FAILED" }
      );
    }

    // 4. Buscar en la carpeta profiles/ del paquete instalado
    const packageProfilesDir = this.getPackageProfilesDir();
    const packageCandidate = path.resolve(packageProfilesDir, `${cleanName}.json`);

    if (fs.existsSync(packageCandidate)) {
      const canonicalPath = fs.realpathSync(packageCandidate);
      const canonicalPackageDir = fs.existsSync(packageProfilesDir)
        ? fs.realpathSync(packageProfilesDir)
        : packageProfilesDir;

      if (canonicalPath.startsWith(canonicalPackageDir + path.sep)) {
        return canonicalPath;
      }
      throw new SecurityError(
        `Violación de confinamiento: El archivo de paquete resuelto '${canonicalPath}' escapa del directorio permitido.`,
        { code: "PATH_TRAVERSAL_CONFINEMENT_FAILED" }
      );
    }

    throw new ConfigError(
      `No se encontró el perfil de bot '${cleanName}'.\nBuscado en:\n  - ${localCandidate}\n  - ${packageCandidate}`,
      "PROFILE_NOT_FOUND"
    );
  }

  public static load(profileName = "dev-update"): BotProfile {
    const filePath = this.resolveProfilePath(profileName);

    let rawContent: string;
    try {
      rawContent = fs.readFileSync(filePath, "utf-8");
    } catch (readError) {
      throw new ConfigError(
        `Error al leer el archivo de perfil en '${filePath}': ${
          readError instanceof Error ? readError.message : String(readError)
        }`,
        "PROFILE_READ_ERROR"
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch {
      throw new ConfigError(
        `El archivo de perfil en '${filePath}' no contiene un JSON válido.`,
        "PROFILE_JSON_INVALID"
      );
    }

    const validation = BotProfileSchema.safeParse(parsedJson);
    if (!validation.success) {
      const issues = validation.error.issues
        .map((issue) => `• ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new ConfigError(
        `El perfil '${profileName}' no cumple con el esquema requerido:\n${issues}`,
        "PROFILE_VALIDATION_ERROR"
      );
    }

    return validation.data;
  }

  public static listAvailableProfiles(): string[] {
    const profileNames = new Set<string>();

    const checkDir = (dir: string) => {
      try {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
          for (const file of fs.readdirSync(dir)) {
            if (file.endsWith(".json") && this.SAFE_NAME_REGEX.test(file.replace(/\.json$/, ""))) {
              profileNames.add(path.basename(file, ".json"));
            }
          }
        }
      } catch {
        // Ignorar errores de acceso
      }
    };

    checkDir(path.resolve(process.cwd(), "profiles"));
    checkDir(this.getPackageProfilesDir());

    return Array.from(profileNames).sort();
  }
}
