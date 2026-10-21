# tg-dev-bridge 🚀

Herramienta de **ChatOps** desacoplada (servidor **MCP** y **CLI**) diseñada para servir como puente de comunicación directo entre agentes de desarrollo en terminal (**Claude Code**, **OpenCode**, **AgU**) y el grupo de Telegram de tu equipo o startup.

Al terminar una tarea, el agente invoca esta herramienta para publicar un reporte estructurado y seguro en HTML con el autor, repositorio, rama, commit, cambios completados, próximos pasos y bloqueos pendientes.

---

## 🏛️ Arquitectura

El proyecto sigue estrictamente los principios de **Clean Architecture (Hexagonal / Ports & Adapters)**:

```text
src/
├── domain/                      # Núcleo de negocio inmutable (sin dependencias externas)
│   ├── entities/DevUpdate.ts    # Entidad inmutable del reporte con validaciones
│   └── ports/                   # Contratos de interfaces
│       ├── INotificationService.ts
│       └── IGitContextProvider.ts
│
├── application/                 # Casos de uso y DTOs
│   ├── dtos/PublishDevUpdateDTO.ts
│   └── use-cases/PublishDevUpdateUseCase.ts
│
├── infrastructure/              # Adaptadores de tecnología concreta
│   ├── config/env.ts            # Validación con Zod (.env local o global)
│   ├── git/LocalGitAdapter.ts   # Contexto Git con child_process seguro y fallbacks
│   └── telegram/
│       ├── MessageFormatter.ts  # Formateo y sanitización estricta de HTML
│       └── TelegramAdapter.ts   # Cliente HTTP nativo (fetch) para Telegram API
│
├── presentation/                # Interfaces de entrada (Dual Mode)
│   ├── cli/index.ts             # Binario ejecutable con commander (flags o stdin)
│   └── mcp/server.ts            # Servidor MCP stdio (@modelcontextprotocol/sdk)
│
└── shared/                      # Tipos, errores y utilitarios transversales
    ├── errors/
    └── types/Result.ts
```

---

## ⚙️ Configuración y Variables de Entorno

Crea un archivo `.env` en el directorio donde ejecutes la herramienta o de forma global en `~/.config/tg-dev-bridge/.env`:

```bash
# Telegram Bot Token (creado con @BotFather)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# ID del grupo o supergrupo de Telegram
TELEGRAM_CHAT_ID=-1001234567890

# Opcional: ID de tema/topic si el supergrupo tiene foros activados
TELEGRAM_THREAD_ID=42

# Opcional: Nombre de autor de fallback si Git no tiene configurado user.name
DEV_NAME=Developer
```

---

## 📦 Instalación y Setup

### 1. Requisitos
- Node.js >= 20.0.0
- `pnpm` >= 9.0.0

### 2. Instalar y Compilar
```bash
pnpm install
pnpm run build
```

### 3. Enlace Global para Terminal (OpenCode, AgU, Git Hooks)
Para que el comando `tg-dev-bridge` esté disponible globalmente en tu terminal:

```bash
pnpm link --global
```

Ahora puedes probarlo desde cualquier directorio:
```bash
tg-dev-bridge --help
```

---

## 🤖 Registro en Claude Code (MCP Server)

Para registrar el servidor MCP de `tg-dev-bridge` en **Claude Code** y que pueda invocar la herramienta `send_dev_update` automáticamente:

```bash
claude mcp add tg-dev-bridge node /ruta/absoluta/a/tg-dev-bridge/dist/presentation/mcp/server.js
```

O si usas el archivo de configuración `~/.claude/claude_desktop_config.json` o `~/.config/claude/config.json`:

```json
{
  "mcpServers": {
    "tg-dev-bridge": {
      "command": "node",
      "args": ["/ruta/absoluta/a/tg-dev-bridge/dist/presentation/mcp/server.js"],
      "env": {
        "TELEGRAM_BOT_TOKEN": "tu_token",
        "TELEGRAM_CHAT_ID": "-1001234567890"
      }
    }
  }
}
```

---

## 🖥️ Uso desde Terminal (CLI)

### Con flags individuales
```bash
tg-dev-bridge \
  -d "Refactorizado módulo de autenticación" "Añadidas pruebas unitarias" \
  -n "Implementar refresh token" "Actualizar documentación de API" \
  -b "Pendiente definir tiempo de expiración del JWT"
```

### Vía JSON con piping (stdin)
```bash
echo '{
  "completedChanges": ["Setup de base de datos", "Migraciones iniciales"],
  "nextSteps": ["Crear endpoints de usuarios"]
}' | tg-dev-bridge --stdin
```

---

## 💬 Formato del Mensaje en Telegram

El mensaje generado y enviado a Telegram luce así:

```html
🚀 <b>Actualización de Desarrollo</b> | <code>mi-proyecto</code>
👤 <b>Dev:</b> Juan Pérez | 🌿 <b>Rama:</b> <code>feature/auth</code> (<code>a1b2c3d</code>)

✅ <b>Cambios realizados:</b>
• Refactorizado módulo de autenticación
• Añadidas pruebas unitarias

⏭️ <b>Siguientes pasos:</b>
• Implementar refresh token
• Actualizar documentación de API

⚠️ <b>Bloqueos / Notas:</b>
• Pendiente definir tiempo de expiración del JWT
```

---

## 📋 Reglas para Agentes

Revisa [`CLAUDE.md`](./CLAUDE.md) y [`.agent-rules.md`](./.agent-rules.md) para ver las directivas listas para copiar y pegar en los repositorios de tu equipo.
