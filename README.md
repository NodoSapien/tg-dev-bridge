# tg-dev-bridge 🚀 (Bot Factory & Template Engine)

Puente de **ChatOps** desacoplado y extensible (**CLI + MCP Server**) diseñado para conectar agentes de desarrollo en terminal (**Claude Code**, **OpenCode**, **AgU**) y pipelines de CI/CD con grupos de Telegram.

Evolucionado como **Template Engine & Bot Factory**: permite crear e instanciar nuevos bots (para reportes de desarrollo, anuncios de versiones, alertas de incidentes, QA o distintos clientes) mediante archivos declarativos JSON en `profiles/`, sin tocar una sola línea del core.

---

## 🏛️ Patrones y Arquitectura

Diseñado bajo **Clean Architecture** y principios **SOLID** (especialmente *Open/Closed Principle*):

```text
profiles/                               # Perfiles declarativos de bots
├── dev-update.json                     # Bot de reporte de tareas de desarrollo (default)
├── release-notes.json                  # Bot de anuncios de despliegues y versiones
└── bug-report.json                     # Bot de alertas de incidentes / errores

src/
├── domain/                             # Entidades puras y contratos
│   ├── entities/BotProfile.ts          # Esquemas Zod y tipos del perfil y campos
│   ├── entities/DevUpdate.ts           # Entidad inmutable de desarrollo
│   └── ports/                          # Puertos (Strategy Pattern)
│       ├── ITemplateEngine.ts          # Contrato del motor de renderizado
│       ├── IDynamicNotificationService.ts # Envío con credenciales dinámicas
│       ├── INotificationService.ts
│       └── IGitContextProvider.ts
│
├── application/                        # Casos de uso
│   ├── use-cases/PublishReportUseCase.ts # Orquestador genérico por perfil
│   └── use-cases/PublishDevUpdateUseCase.ts # Retrocompatibilidad
│
├── infrastructure/                     # Adaptadores de tecnología
│   ├── config/ProfileLoader.ts         # Factory/Loader de perfiles locales o empaquetados
│   ├── config/TelegramProfileResolver.ts # Resolución de tokens por perfil
│   ├── git/LocalGitAdapter.ts          # Contexto seguro de Git (repo, branch, hash, author)
│   └── telegram/
│       ├── DynamicHtmlFormatter.ts     # Template Engine nativo con sanitización HTML
│       └── TelegramAdapter.ts          # Cliente HTTP nativo con fetch
│
└── presentation/                       # Interfaces dinámicas (Dual Mode)
    ├── cli/
    │   ├── index.ts                    # CLI con inyección dinámica de flags
    │   └── commands/initBot.ts         # Scaffolding de nuevos bots
    └── mcp/server.ts                   # Servidor MCP stdio con Dynamic Schema Injection
```

---

## ⚡ Setup Rápido (En 1 Minuto)

### 1. Clonar y configurar
```bash
git clone <tu-repo> tg-dev-bridge
cd tg-dev-bridge
./scripts/setup-template.sh
```

El script verificará Node 20+, instalará dependencias con `pnpm`, compilará el código y enlazará globalmente los comandos `tg-bridge` y `tg-dev-bridge`.

### 2. Configurar variables de entorno (`.env`)
Edita tu `.env` (o crea un archivo global en `~/.config/tg-dev-bridge/.env`):

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=-1001234567890

# Opcional: ID de Topic en supergrupos con foros
TELEGRAM_THREAD_ID=42
```

---

## 🛠️ Cómo Crear un Nuevo Bot (`tg-bridge init`)

Para generar un nuevo perfil de bot en segundos:

```bash
tg-bridge init deploy-alert --preset release-notes
```

Presets disponibles:
- `dev-update` — Reportes de tareas completadas y próximos pasos.
- `release-notes` — Versión, highlights, breaking changes y enlace de despliegue.
- `bug-report` — Severidad, resumen, pasos para reproducir y mitigación.
- `custom` — Plantilla genérica editable con título, detalles y notas.

El comando creará `profiles/deploy-alert.json`. Puedes personalizar los campos y la plantilla según tus necesidades.

---

## 🤖 Registro en Claude Code (MCP Server Dinámico)

Cada perfil puede registrarse como un servidor MCP independiente. Claude Code leerá el esquema dinámicamente y sabrá con qué campos invocarlo:

### Bot de Desarrollo (default):
```bash
claude mcp add dev-tracker node /ruta/a/tg-dev-bridge/dist/presentation/mcp/server.js
```

### Bot de Notas de Versión:
```bash
claude mcp add release-bot node /ruta/a/tg-dev-bridge/dist/presentation/mcp/server.js --profile release-notes
```

### O en tu `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "tg-release": {
      "command": "node",
      "args": ["/ruta/a/tg-dev-bridge/dist/presentation/mcp/server.js", "--profile", "release-notes"]
    }
  }
}
```

---

## 🖥️ Uso desde Terminal (CLI)

### 1. Bot por defecto (`dev-update`)
```bash
tg-bridge \
  -d "Implementado sistema de perfiles" "Añadido comando init" \
  -n "Configurar alertas de CI/CD"
```

### 2. Bot de Notas de Versión (`release-notes`)
```bash
tg-bridge --profile release-notes \
  --version "v2.0.0" \
  --highlights "Template engine nativo" "Soporte multi-perfil" \
  --deploy-url "https://github.com/usuario/repo"
```

### 3. Vía JSON por `stdin`
```bash
cat << 'EOF' | tg-bridge --profile bug-report --stdin
{
  "severity": "Crítico",
  "summary": "Falla en procesamiento de pagos con tarjeta",
  "stepsToReproduce": ["Intentar checkout con tarjeta", "Error 500 en /api/charge"]
}
EOF
```

---

## 📂 Anatomía de un Archivo de Perfil (`profiles/*.json`)

```json
{
  "botId": "mi-bot",
  "toolName": "send_mi_notificacion",
  "toolDescription": "Envía una notificación personalizada a Telegram",
  "telegram": {
    "tokenEnvVar": "TELEGRAM_BOT_TOKEN",
    "chatIdEnvVar": "TELEGRAM_CHAT_ID",
    "threadIdEnvVar": "TELEGRAM_THREAD_ID"
  },
  "contextProviders": {
    "includeGitInfo": true,
    "includeTimestamp": true
  },
  "fields": [
    {
      "key": "titulo",
      "label": "📌 Título",
      "type": "string",
      "required": true,
      "description": "Título del aviso"
    },
    {
      "key": "detalles",
      "label": "📝 Puntos clave",
      "type": "string[]",
      "required": true,
      "description": "Lista de viñetas"
    }
  ],
  "headerTemplate": "🚀 <b>{{titulo}}</b> | <code>{{git.repo}}</code>\n🌿 <b>Rama:</b> <code>{{git.branch}}</code> ({{git.shortHash}})"
}
```

---

## 🌟 Cómo Usarlo como GitHub Template

1. En GitHub, ve a **Settings** de tu repositorio y activa la casilla **"Template repository"**.
2. **Opción A (Monorepo de Bots):** Mantén este repo como centro de ChatOps de tu startup, agregando perfiles en `profiles/` para cada canal o propósito.
3. **Opción B (Repositorio independiente):** Haz clic en **"Use this template"** en GitHub para crear repositorios aislados para clientes o proyectos específicos.
