#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "../../infrastructure/config/env.js";
import { LocalGitAdapter } from "../../infrastructure/git/LocalGitAdapter.js";
import { TelegramAdapter } from "../../infrastructure/telegram/TelegramAdapter.js";
import { PublishDevUpdateUseCase } from "../../application/use-cases/PublishDevUpdateUseCase.js";

async function runMcpServer(): Promise<void> {
  const server = new McpServer({
    name: "tg-dev-bridge",
    version: "1.0.0",
  });

  server.tool(
    "send_dev_update",
    "Publica un reporte estructurado de desarrollo (cambios realizados, siguientes pasos y bloqueos) en el grupo de Telegram del equipo.",
    {
      completedChanges: z
        .array(z.string().min(1, "El cambio no puede estar vacío"))
        .min(1, "Debe proveer al menos un cambio realizado")
        .describe("Lista de cambios implementados en la sesión de trabajo"),
      nextSteps: z
        .array(z.string().min(1, "El siguiente paso no puede estar vacío"))
        .min(1, "Debe proveer al menos un siguiente paso")
        .describe("Lista de qué tareas o pasos siguen a continuación"),
      blockers: z
        .array(z.string().min(1, "El bloqueo no puede estar vacío"))
        .optional()
        .describe("Dudas, blockers o notas que requieran atención de otro miembro"),
      customAuthor: z
        .string()
        .optional()
        .describe("Sobrescribe el autor de Git si se desea especificar otro nombre"),
    },
    async (args) => {
      try {
        const config = loadConfig();
        const gitAdapter = new LocalGitAdapter();
        const telegramAdapter = new TelegramAdapter(config);
        const useCase = new PublishDevUpdateUseCase(gitAdapter, telegramAdapter);

        const result = await useCase.execute({
          completedChanges: args.completedChanges,
          nextSteps: args.nextSteps,
          blockers: args.blockers,
          customAuthor: args.customAuthor,
        });

        if (!result.success) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Error al publicar el reporte en Telegram: ${result.error.message}`,
              },
            ],
          };
        }

        const update = result.data;
        return {
          content: [
            {
              type: "text" as const,
              text: `✅ Reporte de desarrollo publicado con éxito en Telegram.\n• Repositorio: ${update.repoName}\n• Rama: ${update.branch}\n• Autor: ${update.author}\n• Cambios: ${update.completedChanges.length}\n• Próximos pasos: ${update.nextSteps.length}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Fallo inesperado al ejecutar send_dev_update: ${message}`,
            },
          ],
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("tg-dev-bridge MCP Server corriendo en stdio");
}

runMcpServer().catch((error) => {
  console.error("Error crítico al iniciar tg-dev-bridge MCP Server:", error);
  process.exit(1);
});
