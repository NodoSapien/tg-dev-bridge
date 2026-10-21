# 🤖 Protocolo Operativo para Agentes de IA (Claude Code, OpenCode, AgU, Cursor)

Este archivo contiene el contexto mandatorio para cualquier agente de inteligencia artificial que opere dentro de este repositorio o en proyectos que utilicen `tg-dev-bridge` como puente de ChatOps hacia Telegram.

---

## 🎯 1. Propósito del Proyecto
`tg-dev-bridge` es un motor extensible (**CLI + MCP Server**) diseñado para que agentes de desarrollo publiquen automáticamente reportes estructurados y sanitizados en Telegram cuando concluyen tareas, lanzan versiones o reportan incidentes.

Opera bajo **Clean Architecture** y principios **Open/Closed**: agregar un nuevo bot nunca requiere tocar código fuente en `src/`, solo crear o editar perfiles JSON en `profiles/`.

---

## ⛔ 2. Reglas Innegociables de Ingeniería (Zero Tolerance)

1. **Gestor de paquetes obligatorio:** Usa **exclusivamente `pnpm`**.
   - ✅ `pnpm install`, `pnpm run build`, `pnpm run typecheck`, `pnpm run test:security`
   - ❌ **TERMINANTEMENTE PROHIBIDO:** `npm`, `npx`, `yarn`.
2. **DLP Estricto (Data Loss Prevention):**
   - El sistema cuenta con un interceptor activo (`SecretRedactor`) que analiza todo el payload antes de enviarlo.
   - **NUNCA** incluyas claves API, tokens de GitHub (`ghp_`), OpenAI (`sk-`), AWS keys (`AKIA`), JWTs, URLs de base de datos con contraseñas o claves privadas en `completedChanges`, `nextSteps` ni en ningún campo.
   - Si la herramienta responde con `🛡️ BLOQUEO DE SEGURIDAD (DLP)`, **no intentes evadir el filtro**: reescribe tu reporte eliminando la credencial expuesta.
3. **Calidad de Tipos:** TypeScript configurado en `"strict": true` con `"exactOptionalPropertyTypes": true`. No uses `any`.

---

## 🧭 3. Árbol de Decisión de Perfiles

Identifica la situación actual y usa el perfil correspondiente:

| Situación | Perfil Activo | Herramienta MCP | Comando CLI |
|---|---|---|---|
| **Terminaste un feature, bugfix o refactor** | `dev-update` *(Default)* | `send_dev_update` | `tg-bridge -d "..." -n "..."` |
| **Se preparó o desplegó una nueva versión** | `release-notes` | `send_release_notes` | `tg-bridge --profile release-notes --version "..." --highlights "..."` |
| **Detectaste un fallo crítico o bloqueo** | `bug-report` | `send_bug_report` | `tg-bridge --profile bug-report --severity "..." --summary "..."` |
| **El usuario pide crear un bot nuevo** | N/A | Subcomando CLI | `tg-bridge init <nombre> --preset <preset>` |

---

## 📋 4. Protocolo al Concluir una Tarea

Cuando el usuario te indique que concluyas una tarea o des por terminada una sesión de trabajo:

### Paso 1: Deducir los cambios completados (`completedChanges`)
- Revisa los archivos que modificaste en la sesión mediante `git status` o el historial de cambios.
- Resume en viñetas técnicas claras y concisas lo implementado (sin incluir secretos).

### Paso 2: Deducir los siguientes pasos (`nextSteps`)
- Inspecciona si existe un archivo `TODO.md`, `ROADMAP.md` o el spec entregado por el usuario.
- Si existen tareas pendientes, toma las siguientes inmediatas.
- Si no hay archivo de tareas, deduce lógicamente las siguientes mejoras necesarias o pasos de verificación.

### Paso 3: Identificar bloqueos (`blockers` - opcional)
- Si requieres confirmación del usuario, una clave externa o una decisión de diseño pendiente, repórtala en `blockers`.

### Paso 4: Notificar al equipo

#### Opción A: Vía MCP Tool (Recomendado si Claude Code tiene la herramienta registrada)
```json
{
  "completedChanges": [
    "Implementado el motor de plantillas DynamicHtmlFormatter",
    "Añadido escáner DLP SecretRedactor con modo estricto"
  ],
  "nextSteps": [
    "Ejecutar suite de tests con pnpm run test:security",
    "Crear tag de versión v2.0.0"
  ],
  "blockers": []
}
```

#### Opción B: Vía CLI en terminal
```bash
tg-bridge \
  -d "Implementado el motor de plantillas DynamicHtmlFormatter" "Añadido escáner DLP SecretRedactor" \
  -n "Ejecutar suite de tests con pnpm run test:security" "Crear tag v2.0.0"
```

*Nota:* No calcules la rama, el commit ni el autor; `tg-bridge` los deduce automáticamente de Git de forma segura.

---

## 🧪 5. Scripts de Validación del Repositorio

Antes de declarar cualquier cambio en este código como completado, ejecuta:

```bash
# 1. Comprobación estricta de tipos
pnpm run typecheck

# 2. Compilación de artefactos en dist/
pnpm run build

# 3. Suite completa de seguridad (DLP, Path Traversal, Redaction, Zod Limits)
pnpm run test:security
```
