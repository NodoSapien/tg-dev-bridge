#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig } from "../../infrastructure/config/env.js";
import { LocalGitAdapter } from "../../infrastructure/git/LocalGitAdapter.js";
import { TelegramAdapter } from "../../infrastructure/telegram/TelegramAdapter.js";
import { PublishDevUpdateUseCase } from "../../application/use-cases/PublishDevUpdateUseCase.js";
import { publishDevUpdateSchema, type PublishDevUpdateInput } from "../../application/dtos/PublishDevUpdateDTO.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8").trim()));
    process.stdin.on("error", (err) => reject(err));
  });
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("tg-dev-bridge")
    .description("Puente de ChatOps para publicar reportes de desarrollo en Telegram")
    .version("1.0.0")
    .option("-d, --done <items...>", "Lista de cambios realizados en la sesión")
    .option("-n, --next <items...>", "Lista de siguientes pasos a realizar")
    .option("-b, --blocker <items...>", "Lista de dudas o bloqueos pendientes")
    .option("-a, --author <name>", "Sobrescribir el autor de Git detectado")
    .option("--stdin", "Leer el payload JSON estructurado desde stdin");

  program.parse(process.argv);
  const options = program.opts<{
    done?: string[];
    next?: string[];
    blocker?: string[];
    author?: string;
    stdin?: boolean;
  }>();

  let inputData: unknown;

  const shouldUseStdin = Boolean(options.stdin || (!process.stdin.isTTY && !options.done && !options.next));

  if (shouldUseStdin) {
    const rawStdin = await readStdin();
    if (!rawStdin) {
      console.error("❌ Error: No se recibió contenido JSON en stdin.");
      process.exit(1);
    }
    try {
      inputData = JSON.parse(rawStdin);
    } catch {
      console.error("❌ Error: El contenido de stdin no es un JSON válido.");
      process.exit(1);
    }
  } else {
    inputData = {
      completedChanges: options.done,
      nextSteps: options.next,
      blockers: options.blocker,
      customAuthor: options.author,
    };
  }

  const parsed = publishDevUpdateSchema.safeParse(inputData);
  if (!parsed.success) {
    console.error("❌ Error de validación en los datos de entrada:");
    for (const issue of parsed.error.issues) {
      console.error(`   • ${issue.path.join(".") || "payload"}: ${issue.message}`);
    }
    console.error("\nUsa 'tg-dev-bridge --help' para ver ejemplos y opciones.");
    process.exit(1);
  }

  const validatedInput: PublishDevUpdateInput = parsed.data;

  try {
    const config = loadConfig();
    const gitAdapter = new LocalGitAdapter();
    const telegramAdapter = new TelegramAdapter(config);
    const useCase = new PublishDevUpdateUseCase(gitAdapter, telegramAdapter);

    const result = await useCase.execute(validatedInput);

    if (!result.success) {
      console.error(`❌ Error al publicar en Telegram: ${result.error.message}`);
      process.exit(1);
    }

    const { repoName, branch, author } = result.data;
    console.log(`🚀 Actualización publicada con éxito en Telegram! [${repoName} | ${branch} | ${author}]`);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error fatal: ${message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Error inesperado:", err);
  process.exit(1);
});
