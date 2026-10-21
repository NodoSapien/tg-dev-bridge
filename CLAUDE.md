# Instrucciones para Agentes de Desarrollo (Claude Code / OpenCode / AgU)

Este repositorio y los proyectos que integran `tg-dev-bridge` utilizan un protocolo de **ChatOps automático** para notificar al equipo en Telegram cada vez que se concluye una tarea, feature o refactorización.

---

## 🔔 Protocolo de Notificación al Finalizar Tareas

Cada vez que termines una tarea o el usuario confirme que los cambios son satisfactorios, **debes invocar el reporte de desarrollo** antes de cerrar la sesión o dar por concluido el turno.

### 1. Detección de Información Requerida

Antes de enviar el reporte:
1. **Cambios realizados (`completedChanges`):** Resume en viñetas claras y técnicas lo que acabas de implementar, corregir o refactorizar.
2. **Siguientes pasos (`nextSteps`):** 
   - Revisa si existe un archivo `TODO.md`, `ROADMAP.md` o el spec de la tarea en curso.
   - Si existen tareas pendientes en el archivo de tareas, toma las siguientes inmediatas.
   - Si no existe un archivo de tareas, deduce lógicamente los siguientes pasos en base al contexto o formula las recomendaciones técnicas a seguir.
3. **Bloqueos o notas (`blockers` - opcional):**
   - Si encontraste alguna limitación externa, duda de diseño o decisión pendiente que requiera la intervención de un compañero o del usuario, indícala explícitamente.

---

## 🛠️ Modos de Invocación

### Opción A: Vía MCP Tool (Recomendado para Claude Code)
Invoca la herramienta `send_dev_update` con los siguientes parámetros:

```json
{
  "completedChanges": [
    "Implementada la entidad DevUpdate y puertos de notificación",
    "Agregada validación de variables de entorno con Zod"
  ],
  "nextSteps": [
    "Crear el adaptador de Telegram con fetch nativo",
    "Configurar los comandos CLI con commander"
  ],
  "blockers": [
    "Pendiente confirmar el Chat ID definitivo del grupo de producción"
  ]
}
```

### Opción B: Vía CLI (Para terminales, OpenCode, AgU o scripts Bash)
Si no cuentas con el MCP registrado o estás ejecutando un script de terminal, usa el binario `tg-dev-bridge`:

```bash
tg-dev-bridge \
  -d "Implementada la entidad DevUpdate y puertos de notificación" "Agregada validación con Zod" \
  -n "Crear el adaptador de Telegram con fetch nativo" "Configurar CLI con commander" \
  -b "Pendiente confirmar Chat ID de producción"
```

O enviando un JSON por entrada estándar:

```bash
cat << 'EOF' | tg-dev-bridge --stdin
{
  "completedChanges": [
    "Implementada la entidad DevUpdate",
    "Agregada validación con Zod"
  ],
  "nextSteps": [
    "Crear adaptador Telegram",
    "Configurar CLI"
  ]
}
EOF
```

---

## ⚠️ Reglas Importantes
- **Autodetección:** No es necesario pasar nombre de repositorio, rama ni autor; la herramienta los extrae automáticamente desde Git (`user.name`, `branch --show-current`, `origin`).
- **Sanitización:** Los caracteres `< > & "` se escapan automáticamente en HTML antes de enviarse a Telegram.
- **Credenciales:** La herramienta busca las credenciales en el archivo `.env` del directorio de trabajo o en `~/.config/tg-dev-bridge/.env`.
