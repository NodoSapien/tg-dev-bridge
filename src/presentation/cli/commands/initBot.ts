import fs from "node:fs";
import path from "node:path";
import { ProfileLoader } from "../../../infrastructure/config/ProfileLoader.js";
import { type BotProfile } from "../../../domain/entities/BotProfile.js";

const PRESET_CUSTOM: BotProfile = {
  botId: "custom-bot",
  toolName: "send_custom_notification",
  toolDescription: "Notificación personalizada para Telegram",
  telegram: {
    tokenEnvVar: "TELEGRAM_BOT_TOKEN",
    chatIdEnvVar: "TELEGRAM_CHAT_ID",
  },
  contextProviders: {
    includeGitInfo: true,
    includeTimestamp: true,
  },
  fields: [
    {
      key: "title",
      label: "📌 Título",
      type: "string",
      required: true,
      description: "Título principal de la notificación",
    },
    {
      key: "details",
      label: "📝 Detalles",
      type: "string[]",
      required: true,
      description: "Lista de detalles o puntos a informar",
    },
    {
      key: "extraNotes",
      label: "💡 Notas adicionales",
      type: "string",
      required: false,
      description: "Información contextual complementaria",
    },
  ],
  headerTemplate: "📢 <b>Notificación</b> | <code>{{git.repo}}</code>\n🌿 <b>Rama:</b> <code>{{git.branch}}</code>",
};

export async function executeInitBot(
  rawName: string,
  options: { preset?: string | undefined }
): Promise<void> {
  const botId = rawName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!botId) {
    console.error("❌ Error: Debe proporcionar un nombre válido para el bot (en formato kebab-case, ej. qa-alert).");
    process.exit(1);
  }

  const presetName = options.preset || "dev-update";
  let baseProfile: BotProfile;

  try {
    if (presetName === "custom") {
      baseProfile = { ...PRESET_CUSTOM };
    } else {
      baseProfile = ProfileLoader.load(presetName);
    }
  } catch {
    console.warn(`⚠️ Preset '${presetName}' no encontrado. Usando preset 'dev-update' por defecto.`);
    baseProfile = ProfileLoader.load("dev-update");
  }

  const newProfile: BotProfile = {
    ...baseProfile,
    botId,
    toolName: `send_${botId.replace(/-/g, "_")}`,
    toolDescription: `Herramienta de reporte para el bot ${botId}`,
  };

  const targetDir = path.resolve(process.cwd(), "profiles");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetFile = path.resolve(targetDir, `${botId}.json`);
  if (fs.existsSync(targetFile)) {
    console.error(`❌ Error: Ya existe un perfil en '${targetFile}'.`);
    process.exit(1);
  }

  fs.writeFileSync(targetFile, JSON.stringify(newProfile, null, 2), "utf-8");

  console.log(`\n🎉 ¡Bot '${botId}' creado con éxito en: profiles/${botId}.json!`);
  console.log("\n📋 Próximos pasos de integración:\n");
  console.log(`1️⃣ Para invocarlo desde CLI en terminal:`);
  console.log(`   tg-bridge --profile ${botId} --help\n`);
  console.log(`2️⃣ Para registrarlo como MCP Server en Claude Code:`);
  console.log(`   claude mcp add ${botId} node $(pwd)/dist/presentation/mcp/server.js --profile ${botId}\n`);
  console.log(`3️⃣ O agrégalo a tu claude_desktop_config.json:`);
  console.log(
    JSON.stringify(
      {
        mcpServers: {
          [botId]: {
            command: "node",
            args: ["./dist/presentation/mcp/server.js", "--profile", botId],
          },
        },
      },
      null,
      2
    )
  );
  console.log("");
}
