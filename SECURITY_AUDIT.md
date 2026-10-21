# Security Audit & Threat Model Report
**Target Repository:** `tg-dev-bridge` (Enterprise Telegram Bot Engine)  
**Auditor Role:** `ai-first-security-auditor`  
**Date:** Octubre 2026  
**Status:** In Progress (Audit Complete — Remediation in Motion)

---

## 1. Executive Summary

El proyecto `tg-dev-bridge` es una herramienta empresarial de ChatOps utilizada por desarrolladores y agentes de inteligencia artificial (Claude Code, OpenCode, AgU) para publicar reportes de código, lanzamientos y alertas en canales de Telegram. Debido a que opera en entornos con acceso a código propietario, variables de entorno y terminales con privilegios de ejecución, se realizó una auditoría estricta de seguridad bajo la metodología de `ai-first-security-auditor`.

El objetivo de esta auditoría es eliminar los vectores de ataque clásicos en aplicaciones asistidas por IA: exfiltración accidental de secretos (DLP), inyección de comandos en subprocesos, salto de directorios (Path Traversal), exposición de tokens en trazas de error y denegación de servicio por entradas no delimitadas.

---

## 2. CWE / OWASP Risk Matrix

| ID | Severidad | Componente Afectado | Vulnerabilidad & Vector de Ataque | CWE / OWASP | Estrategia de Remediación |
|---|---|---|---|---|---|
| **SEC-01** | **Crítica (P0)** | `src/application/use-cases/` | **Secret Leakage / DLP:** Inclusión inadvertida de API keys, tokens JWT o credenciales de conexión en los resúmenes del agente enviados a Telegram. | **CWE-200** / API3:2023 | Implementar `SecretRedactor` en la capa de dominio con escáner de alta entropía y **modo estricto** (aborta el envío si detecta credenciales). |
| **SEC-02** | **Alta (P1)** | `src/infrastructure/telegram/TelegramAdapter.ts` | **Information Leakage in Error Responses:** Respuestas HTTP fallidas o excepciones de red exponen la URL con el token de BotFather (`/bot<TOKEN>/`). | **CWE-209** / API7:2023 | Interceptor de errores con sanitización a `[REDACTED_BOT_TOKEN]`, `AbortSignal.timeout(10000)` y truncado seguro de mensaje a <4096 caracteres. |
| **SEC-03** | **Alta (P1)** | `src/infrastructure/config/ProfileLoader.ts` | **Path Traversal:** Parámetro `--profile` manipulado con secuencias `../` para acceder o evaluar archivos arbitrarios en el filesystem. | **CWE-22** | Validación estricta con whitelist alfanumérica (`/^[a-z0-9_-]+$/`), confinamiento con `fs.realpathSync` y esquemas Zod con `.strict()`. |
| **SEC-04** | **Media (P2)** | `src/infrastructure/git/LocalGitAdapter.ts` | **Command Injection / Unbounded Execution:** Llamadas a Git sin timeout explícito ni aseguramiento de opciones de proceso. | **CWE-78** | Uso forzado de `execFileSync` con argumentos separados en array, `shell: false`, timeout de 3000ms y `maxBuffer: 1MB`. |
| **SEC-05** | **Media (P2)** | `src/domain/entities/BotProfile.ts` | **Unbounded Input / Memory DoS:** Payloads masivos sin límite de longitud por campo que provocan desbordamiento o rechazo 400 en Telegram. | **CWE-20** / API4:2023 | Validación de límites con Zod: strings acotados (max 1000 caracteres) y arrays limitados (max 20 ítems). |
| **SEC-06** | **Baja (P3)** | `.gitignore` / Contenerización | **Leaked Local Artifacts & Privileged Containers:** Riesgo de commitear perfiles locales con datos sensibles y ausencia de contenedor no privilegiado. | **CWE-250** | Hardening de `.gitignore` para ignorar `profiles/*.local.json` y creación de `Dockerfile` multi-stage rootless (`USER node`). |

---

## 3. Deep-Dive de Amenazas y Directivas de Hardening

### A. Data Loss Prevention (DLP) & Exfiltración de Secretos (SEC-01)
- **Amenaza:** Los LLMs pueden extraer accidentalmente contraseñas, connection strings (`postgres://...`), tokens de GitHub (`ghp_...`, `github_pat_...`), OpenAI keys (`sk-proj-...`), AWS access keys (`AKIA...`) o private keys (`-----BEGIN PRIVATE KEY-----`) desde el diff de Git o archivos `.env` y agregarlos en viñetas de cambios o siguientes pasos.
- **Directiva:** Se activa el **Modo Estricto**. `SecretRedactor` evalúa todo string individual o arreglo antes de permitir la construcción del mensaje. Ante la presencia de un patrón sensible, la ejecución se detiene inmediatamente con una excepción tipada (`SecurityError`), impidiendo que el dato salga a la red.

### B. Sanitización de Telegram Bot Token y Timeouts (SEC-02)
- **Amenaza:** Telegram incluye el bot token en la ruta de cada endpoint (`https://api.telegram.org/bot<TOKEN>/sendMessage`). Si la petición falla por DNS, timeout o rechazo del servidor, los objetos `Error` nativos de `fetch` incluyen la URL completa en `error.message`. Si este mensaje se devuelve al MCP o a la consola, el token queda grabado en los logs de la sesión.
- **Directiva:** Todo error capturado en `TelegramAdapter` pasa por una función de ofuscación que sustituye cualquier patrón `/bot[^/]+/` por `/bot[REDACTED_BOT_TOKEN]/`. Se añade un timeout innegociable de 10 segundos vía `AbortSignal.timeout(10000)` para prevenir bloqueos por cuelgue de sockets. Además, se agrega un formateador que asegura que el HTML no sobrepase 4096 caracteres.

### C. Protección de Carga de Perfiles contra Path Traversal (SEC-03)
- **Amenaza:** El argumento `--profile` es una entrada controlada por el usuario o agente. Si se procesa directamente mediante `path.resolve(profileName)`, secuencias como `--profile ../../../etc/shadow` o rutas absolutas pueden causar lectura de archivos inesperados o denegación de servicio si se intentan parsear archivos binarios como JSON.
- **Directiva:**
  1. El nombre del perfil debe cumplir la expresión regular estricta `/^[a-z0-9_-]+$/`.
  2. Toda ruta candidata debe comprobarse con `fs.realpathSync` asegurando que su prefijo pertenezca al directorio autorizado `profiles/` o al directorio del paquete.
  3. Los esquemas Zod de perfiles incorporan `.strict()` para rechazar propiedades no reconocidas.

### D. Ejecución Segura de Git (SEC-04)
- **Amenaza:** Ejecución arbitraria de procesos o bloqueo indefinido de recursos si un subproceso `git` se cuelga esperando credenciales SSH o interactivas.
- **Directiva:** Todas las invocaciones en `LocalGitAdapter` fijan:
  - `shell: false` (inyección de shell imposible).
  - `timeout: 3000` (mata el proceso tras 3 segundos de inactividad).
  - `maxBuffer: 1024 * 1024` (1 MB max de salida para evitar agotamiento de memoria).
  - `stdio: ["ignore", "pipe", "ignore"]` (evita bloqueos interactivos de stdin/stderr).

---

## 4. Plan de Remediación

1. **Tarea 1:** Creación del reporte formal `SECURITY_AUDIT.md` (Completada).
2. **Tarea 2:** Dominio de Seguridad: `SecretRedactor` (DLP estricto) y límites de longitud en Zod.
3. **Tarea 3:** Infraestructura Segura: blindaje de `ProfileLoader`, `LocalGitAdapter` y `TelegramAdapter`.
4. **Tarea 4:** Integración de Seguridad en `PublishReportUseCase` y Capa de Presentación.
5. **Tarea 5:** Hardening de despliegue (`Dockerfile` rootless, `.dockerignore`) y suite de verificación de seguridad.
