#!/usr/bin/env node

import { Command } from "commander";
import { ProfileLoader } from "../../infrastructure/config/ProfileLoader.js";
import { LocalGitAdapter } from "../../infrastructure/git/LocalGitAdapter.js";
import { DynamicHtmlFormatter } from "../../infrastructure/telegram/DynamicHtmlFormatter.js";
import { TelegramAdapter } from "../../infrastructure/telegram/TelegramAdapter.js";
import { PublishReportUseCase } from "../../application/use-cases/PublishReportUseCase.js";
import { SecurityError } from "../../shared/errors/SecurityError.js";
import { executeInitBot } from "./commands/initBot.js";
import type { BotProfile } from "../../domain/entities/BotProfile.js";

function toKebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8").trim()));
    process.stdin.on("error", (err) => reject(err));
  });
}

function extractEarlyProfileName(args: string[]): string {
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--profile" || args[i] === "-P") && args[i + 1]) {
      return args[i + 1]!;
    }
  }
  return process.env["BOT_PROFILE"] || "dev-update";
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("tg-dev-bridge")
    .description("Motor de ChatOps extensible para bots y reportes de desarrollo en Telegram")
    .version("1.0.0", "-v, --cli-version", "Muestra la versión instalada de tg-dev-bridge");

  // Subcomando de scaffolding: init
  program
    .command("init <nombre>")
    .description("Crea un nuevo perfil de bot a partir de una plantilla")
    .option("-p, --preset <preset>", "Plantilla base: dev-update, release-notes, bug-report, custom", "dev-update")
    .action(async (nombre: string, cmdOpts: { preset?: string }) => {
      await executeInitBot(nombre, cmdOpts);
      process.exit(0);
    });

  // Si el usuario ejecuta "init", dejamos que Commander maneje ese comando
  if (process.argv[2] === "init") {
    await program.parseAsync(process.argv);
    return;
  }

  // Cargar perfil para el modo de publicación
  const profileName = extractEarlyProfileName(process.argv);
  let profile: BotProfile;
  try {
    profile = ProfileLoader.load(profileName);
  } catch (error) {
    console.error(`❌ Error al cargar perfil: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  program
    .option("-P, --profile <nombre>", "Perfil de bot a ejecutar (busca en profiles/<nombre>.json)", profileName)
    .option("--stdin", "Leer el payload estructurado en formato JSON desde stdin")
    .option("-a, --author <name>", "Sobrescribir el autor de Git detectado");

  // Si es el perfil original dev-update, registrar flags canónicos para retrocompatibilidad
  if (profile.botId === "dev-tracker" || profile.botId === "dev-update") {
    program
      .option("-d, --done <items...>", "Lista de cambios realizados en la sesión")
      .option("-n, --next <items...>", "Lista de siguientes pasos a realizar")
      .option("-b, --blocker <items...>", "Lista de dudas o bloqueos pendientes");
  }

  // Inyección dinámica de flags según los campos del perfil
  for (const field of profile.fields) {
    const flagName = toKebabCase(field.key);
    const flagDef =
      field.type === "string[]"
        ? `--${flagName} <items...>`
        : field.type === "boolean"
          ? `--${flagName}`
          : `--${flagName} <val>`;

    // Evitar colisión si ya fue agregado en el bloque de retrocompatibilidad
    if (
      (flagName === "completed-changes" && (profile.botId === "dev-tracker" || profile.botId === "dev-update")) ||
      (flagName === "next-steps" && (profile.botId === "dev-tracker" || profile.botId === "dev-update")) ||
      (flagName === "blockers" && (profile.botId === "dev-tracker" || profile.botId === "dev-update"))
    ) {
      continue;
    }

    program.option(flagDef, field.description);
  }

  program.action(async () => {
    const options = program.opts<Record<string, unknown>>();

    let payload: Record<string, unknown> = {};

    const shouldUseStdin = Boolean(
      options["stdin"] || (!process.stdin.isTTY && process.argv.length <= 3)
    );

    if (shouldUseStdin) {
      const rawStdin = await readStdin();
      if (!rawStdin) {
        console.error("❌ Error: No se recibió contenido JSON en stdin.");
        process.exit(1);
      }
      try {
        payload = JSON.parse(rawStdin) as Record<string, unknown>;
      } catch {
        console.error("❌ Error: El contenido de stdin no es un JSON válido.");
        process.exit(1);
      }
    } else {
      // Mapear opciones de Commander al payload del perfil
      for (const field of profile.fields) {
        const kebab = toKebabCase(field.key);
        const camel = field.key;

        if (options[camel] !== undefined) {
          payload[field.key] = options[camel];
        } else if (options[kebab] !== undefined) {
          payload[field.key] = options[kebab];
        } else if (camel === "completedChanges" && options["done"] !== undefined) {
          payload["completedChanges"] = options["done"];
        } else if (camel === "nextSteps" && options["next"] !== undefined) {
          payload["nextSteps"] = options["next"];
        } else if (camel === "blockers" && options["blocker"] !== undefined) {
          payload["blockers"] = options["blocker"];
        }
      }
    }

    // Soporte para sobrescribir autor si vino por flag
    const customAuthor = options["author"] ? String(options["author"]) : undefined;

    try {
      const gitAdapter = new LocalGitAdapter();
      // Si viene customAuthor, envolver para devolverlo en el contexto Git
      const gitContextProvider = customAuthor
        ? {
            getContext: () => {
              const ctx = gitAdapter.getContext();
              return { ...ctx, author: customAuthor };
            },
          }
        : gitAdapter;

      const formatter = new DynamicHtmlFormatter();
      const telegramAdapter = new TelegramAdapter();
      const useCase = new PublishReportUseCase(gitContextProvider, formatter, telegramAdapter);

      const result = await useCase.execute(profile, payload);

      if (!result.success) {
        if (result.error instanceof SecurityError) {
          console.error(`\n🛡️ BLOQUEO DE SEGURIDAD (DLP):\n${result.error.message}\n`);
        } else {
          console.error(`❌ Error al publicar en Telegram: ${result.error.message}`);
        }
        process.exit(1);
      }

      console.log(`🚀 Reporte publicado con éxito en Telegram! [Bot: ${result.data.botId} | Tool: ${result.data.toolName}]`);
      process.exit(0);
    } catch (error) {
      if (error instanceof SecurityError) {
        console.error(`\n🛡️ BLOQUEO DE SEGURIDAD:\n${error.message}\n`);
        process.exit(1);
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error fatal: ${message}`);
      process.exit(1);
    }
  });

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error("❌ Error inesperado:", err);
  process.exit(1);
});
