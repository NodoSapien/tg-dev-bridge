import { SecretRedactor } from "../src/domain/services/SecretRedactor.js";
import { SecurityError } from "../src/shared/errors/SecurityError.js";
import { ProfileLoader } from "../src/infrastructure/config/ProfileLoader.js";
import { TelegramAdapter } from "../src/infrastructure/telegram/TelegramAdapter.js";
import { LocalGitAdapter } from "../src/infrastructure/git/LocalGitAdapter.js";
import { BotProfileSchema } from "../src/domain/entities/BotProfile.js";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

console.log("\n========================================================");
console.log("🛡️  AI-FIRST SECURITY AUDITOR: VERIFICATION SUITE");
console.log("========================================================\n");

// -----------------------------------------------------------------------------
// SEC-01: DLP / Secret Redaction
// -----------------------------------------------------------------------------
console.log("[1/6] Verificando DLP y Detección de Secretos (SEC-01)...");

const secretsToDetect = [
  { name: "AWS Key", payload: { note: "AKIAIOSFODNN7EXAMPLE" } },
  { name: "GitHub PAT", payload: { note: "ghp_1234567890abcdefghijklmnopqrstuvwxyz" } },
  { name: "OpenAI Key", payload: { note: "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz1234" } },
  { name: "Anthropic Key", payload: { note: "sk-ant-1234567890abcdefghijklmnopqrstuvwxyz1234" } },
  { name: "JWT Token", payload: { note: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozG4B_dummy_signature_token" } },
  { name: "DB URI", payload: { note: "postgres://admin:superSecret123@db.prod.internal:5432/core" } },
  { name: "Private Key", payload: { note: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA..." } },
  { name: "Telegram Token", payload: { note: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456" } },
];

for (const sec of secretsToDetect) {
  let blocked = false;
  try {
    SecretRedactor.assertSafePayload(sec.payload);
  } catch (err) {
    if (err instanceof SecurityError && err.code === "SECRET_LEAK_PREVENTED") {
      blocked = true;
    }
  }
  assert(blocked, `DLP bloqueó con éxito secreto: ${sec.name}`);
}

// -----------------------------------------------------------------------------
// SEC-02: Telegram Token Leak Prevention & Error Sanitization
// -----------------------------------------------------------------------------
console.log("\n[2/6] Verificando Sanitización de Tokens en Errores (SEC-02)...");

const sampleToken = "987654321:XYZabc12345678901234567890abcdefgh";
const rawError = `FetchError: request to https://api.telegram.org/bot${sampleToken}/sendMessage failed, reason: connect ETIMEDOUT`;
const sanitizedError = TelegramAdapter.sanitizeSensitiveText(rawError, sampleToken);

assert(!sanitizedError.includes(sampleToken), "El token de BotFather fue removido de la traza de error");
assert(sanitizedError.includes("[REDACTED_BOT_TOKEN]"), "El placeholder [REDACTED_BOT_TOKEN] fue inyectado correctamente");

// -----------------------------------------------------------------------------
// SEC-03: Path Traversal Protection
// -----------------------------------------------------------------------------
console.log("\n[3/6] Verificando Protección contra Path Traversal (SEC-03)...");

const maliciousProfiles = [
  "../../etc/passwd",
  "/etc/shadow",
  "../secrets",
  "foo/bar",
  "profile;rm -rf /",
  "profile%00",
];

for (const mal of maliciousProfiles) {
  let caught = false;
  try {
    ProfileLoader.resolveProfilePath(mal);
  } catch (err) {
    if (err instanceof SecurityError) {
      caught = true;
    }
  }
  assert(caught, `Path Traversal bloqueado para input: '${mal}'`);
}

// -----------------------------------------------------------------------------
// SEC-04: Subprocess Execution Safety & Timeouts
// -----------------------------------------------------------------------------
console.log("\n[4/6] Verificando Ejecución Segura de Git (SEC-04)...");

const git = new LocalGitAdapter();
const context = git.getContext();
assert(typeof context.repoName === "string" && context.repoName.length > 0, "Git Context resuelto con nombre seguro");
assert(!context.repoName.includes(";") && !context.repoName.includes("&"), "Nombre de repositorio sanitizado sin caracteres de control");

// -----------------------------------------------------------------------------
// SEC-05: Zod Schema Strictness & Length Limits (CWE-20 / CWE-915)
// -----------------------------------------------------------------------------
console.log("\n[5/6] Verificando Límites Zod y Prevención de Prototype Pollution (SEC-05)...");

const validBase = {
  botId: "test-bot",
  toolName: "send_test",
  toolDescription: "Descripción de prueba",
  telegram: {},
  contextProviders: {},
  fields: [
    {
      key: "field1",
      label: "Campo 1",
      type: "string",
      required: true,
      description: "Desc",
    },
  ],
  headerTemplate: "Header",
};

// 1. Inyección de propiedad no autorizada (Mass Assignment)
let extraPropRejected = false;
try {
  BotProfileSchema.parse({
    ...validBase,
    maliciousExtraProperty: "inject",
  });
} catch {
  extraPropRejected = true;
}
assert(extraPropRejected, "Zod Schema rechazó propiedades adicionales (.strict())");

// 2. String desbordado (DoS)
let overflowRejected = false;
try {
  BotProfileSchema.parse({
    ...validBase,
    headerTemplate: "a".repeat(2000), // Max es 1000
  });
} catch {
  overflowRejected = true;
}
assert(overflowRejected, "Zod Schema rechazó string desbordado (>1000 caracteres)");

// -----------------------------------------------------------------------------
// SEC-06: Message Truncation & Tag Closing
// -----------------------------------------------------------------------------
console.log("\n[6/6] Verificando Truncado Seguro de Mensajes a <4096 Chars (SEC-06)...");

const massiveMessage = "<b>Título</b> <code>" + "x".repeat(6000) + "</code>";
const truncatedMsg = TelegramAdapter.truncateHtmlMessage(massiveMessage);

assert(truncatedMsg.length <= 4096, "Mensaje masivo truncado por debajo del límite de 4096 de Telegram");
assert(truncatedMsg.includes("</code>") && truncatedMsg.includes("</b>"), "Etiquetas HTML abiertas fueron cerradas automáticamente");
assert(truncatedMsg.includes("[... reporte truncado automáticamente"), "Aviso de truncado agregado al mensaje");

console.log("\n========================================================");
if (passedTests === totalTests) {
  console.log(`🎉 TODAS LAS PRUEBAS DE SEGURIDAD PASARON (${passedTests}/${totalTests})`);
  console.log("========================================================\n");
} else {
  console.error(`⚠️ FALLARON ALGUNAS PRUEBAS (${passedTests}/${totalTests})`);
  console.log("========================================================\n");
  process.exit(1);
}
