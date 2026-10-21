#!/usr/bin/env bash
set -e

echo "🚀 Inicializando tg-dev-bridge (Bot Factory & Template Engine)..."

# 1. Verificar versión de Node.js (>= 20)
NODE_MAJOR=$(node -v 2>/dev/null | cut -d'.' -f1 | sed 's/v//')
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ Error: Se requiere Node.js v20 o superior. Versión actual: $(node -v 2>/dev/null || echo 'no encontrada')"
  exit 1
fi
echo "✅ Node.js detectado: $(node -v)"

# 2. Verificar pnpm
if ! command -v pnpm &> /dev/null; then
  echo "❌ Error: pnpm no está instalado. Instálalo con: npm install -g pnpm o corepack enable"
  exit 1
fi
echo "✅ pnpm detectado: v$(pnpm -v)"

# 3. Crear .env a partir de .env.example si no existe
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "📄 Creado archivo .env a partir de .env.example (recuerda configurar tus credenciales de Telegram)"
  fi
fi

# 4. Instalar dependencias
echo "📦 Instalando dependencias..."
pnpm install

# 5. Compilar proyecto
echo "🔨 Compilando proyecto TypeScript..."
pnpm run build
chmod +x dist/presentation/cli/index.js dist/presentation/mcp/server.js

# 6. Enlace global
echo "🔗 Enlazando binario globalmente con pnpm..."
pnpm link --global

echo ""
echo "🎉 ¡Setup completado con éxito!"
echo ""
echo "Comandos disponibles:"
echo "  • tg-bridge --help"
echo "  • tg-bridge init <nuevo-bot> --preset <dev-update|release-notes|bug-report|custom>"
echo "  • claude mcp add <nombre> node $(pwd)/dist/presentation/mcp/server.js --profile <nombre>"
echo ""
