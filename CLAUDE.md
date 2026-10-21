# Instrucciones para Agentes de Desarrollo (Claude Code / OpenCode / AgU)

Este repositorio y los proyectos que integran `tg-dev-bridge` operan bajo una **arquitectura multi-bot y template engine** para notificar al equipo en Telegram al concluir tareas, lanzar versiones o reportar incidentes.

---

## 🔔 Perfiles de Bots Disponibles

La herramienta cuenta con perfiles declarativos en `profiles/`:

| Perfil | MCP Tool | CLI Flag | Propósito |
|---|---|---|---|
| `dev-update` (default) | `send_dev_update` | `tg-bridge` (o `--profile dev-update`) | Reporte de cambios y siguientes pasos al terminar una tarea |
| `release-notes` | `send_release_notes` | `tg-bridge --profile release-notes` | Anuncio de nueva versión, novedades y enlaces |
| `bug-report` | `send_bug_report` | `tg-bridge --profile bug-report` | Alerta de incidente o reporte estructurado de bugs |

---

## 🛠️ Modos de Invocación

### 1. Perfil por Defecto: Reporte de Desarrollo (`dev-update`)

#### Vía MCP Tool (Claude Code):
Invoca `send_dev_update`:
```json
{
  "completedChanges": [
    "Implementado el motor de plantillas dinámico DynamicHtmlFormatter",
    "Añadido subcomando de scaffolding init en el CLI"
  ],
  "nextSteps": [
    "Documentar creación de nuevos bots en README.md",
    "Configurar repositorio como GitHub Template"
  ],
  "blockers": []
}
```

#### Vía CLI (Terminal / OpenCode / AgU):
```bash
tg-bridge \
  -d "Implementado motor DynamicHtmlFormatter" "Añadido comando init" \
  -n "Documentar creación de bots" "Configurar GitHub Template"
```

---

### 2. Perfil de Lanzamiento: Notas de Versión (`release-notes`)

#### Vía MCP Tool:
Registrado con `--profile release-notes`, invoca `send_release_notes`:
```json
{
  "version": "v2.0.0",
  "highlights": [
    "Arquitectura extensible con perfiles declarativos",
    "Soporte dinámico para MCP Server y CLI",
    "Comando de scaffolding tg-bridge init"
  ],
  "breakingChanges": [
    "El flag de versión interna de la app ahora es -v, --cli-version para no colisionar con versiones de releases"
  ],
  "deployUrl": "https://github.com/usuario/tg-dev-bridge/releases/tag/v2.0.0"
}
```

#### Vía CLI:
```bash
tg-bridge --profile release-notes \
  --version "v2.0.0" \
  --highlights "Arquitectura extensible de perfiles" "Scaffolding tg-bridge init" \
  --deploy-url "https://github.com/usuario/tg-dev-bridge"
```

---

### 3. Vía JSON directo (stdin)
Cualquier perfil acepta su payload por `stdin`:

```bash
cat << 'EOF' | tg-bridge --profile bug-report --stdin
{
  "severity": "Alta",
  "summary": "Falla de autenticación en endpoints protegidos",
  "stepsToReproduce": ["Enviar token expirado", "Verificar que responde 500 en lugar de 401"]
}
EOF
```

---

## ⚙️ Creación de Nuevos Bots
Para crear un nuevo bot en cualquier proyecto:
```bash
tg-bridge init mi-bot --preset <dev-update|release-notes|bug-report|custom>
```
Esto genera `profiles/mi-bot.json` listo para usar inmediatamente.
