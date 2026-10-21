# -------------------------------------------------------------
# Stage 1: Build & Type Compilation
# -------------------------------------------------------------
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN pnpm install --frozen-lockfile

COPY src/ ./src/
RUN pnpm run build

# -------------------------------------------------------------
# Stage 2: Hardened Rootless Production Runtime (CWE-250)
# -------------------------------------------------------------
FROM node:20-alpine AS runner

# Git es necesario para LocalGitAdapter en tiempo de ejecución
RUN apk add --no-cache git && \
    corepack enable && \
    corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY profiles/ ./profiles

# Permisos estrictos para el usuario no privilegiado 'node'
RUN chown -R node:node /app

USER node

ENV NODE_ENV=production

ENTRYPOINT ["node", "./dist/presentation/cli/index.js"]
CMD ["--help"]
