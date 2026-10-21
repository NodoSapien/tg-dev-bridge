import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BotProfileSchema, type BotProfile } from "../../domain/entities/BotProfile.js";
import { ConfigError } from "../../shared/errors/ConfigError.js";

export class ProfileLoader {
  private static getPackageProfilesDir(): string {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    // En dist/ o src/, la raíz del proyecto está dos niveles arriba
    return path.resolve(currentDir, "../../../profiles");
  }

  public static resolveProfilePath(profileName: string): string {
    // 1. Si es una ruta absoluta o relativa existente directa
    if (fs.existsSync(profileName) && fs.statSync(profileName).isFile()) {
      return path.resolve(profileName);
    }

    const cleanName = profileName.replace(/\.json$/, "");

    // 2. Buscar en ./profiles/<cleanName>.json desde el cwd
    const localProfilePath = path.resolve(process.cwd(), "profiles", `${cleanName}.json`);
    if (fs.existsSync(localProfilePath)) {
      return localProfilePath;
    }

    // 3. Buscar ./bot.config.json en el cwd si se busca default
    if (cleanName === "default" || cleanName === "bot.config") {
      const localBotConfig = path.resolve(process.cwd(), "bot.config.json");
      if (fs.existsSync(localBotConfig)) {
        return localBotConfig;
      }
    }

    // 4. Buscar en la carpeta profiles/ del paquete instalado
    const packageProfilePath = path.resolve(this.getPackageProfilesDir(), `${cleanName}.json`);
    if (fs.existsSync(packageProfilePath)) {
      return packageProfilePath;
    }

    throw new ConfigError(
      `No se encontró el perfil de bot '${profileName}'.\nBuscado en:\n  - ${localProfilePath}\n  - ${packageProfilePath}`,
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
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        for (const file of fs.readdirSync(dir)) {
          if (file.endsWith(".json")) {
            profileNames.add(path.basename(file, ".json"));
          }
        }
      }
    };

    checkDir(path.resolve(process.cwd(), "profiles"));
    checkDir(this.getPackageProfilesDir());

    return Array.from(profileNames).sort();
  }
}
