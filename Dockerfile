# ---- Build stage: monorepo workspace ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm via corepack (version from root package.json)
RUN corepack enable

# Copy workspace config and lockfile first for layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY src/server/package.json src/server/
COPY src/admin/package.json src/admin/

# Install all dependencies (devDeps needed for build)
RUN pnpm install --frozen-lockfile

# Copy full source tree
COPY . .

# Build packages
RUN pnpm --filter takoio-admin build
RUN pnpm --filter takoio-server build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV DB_TYPE=sqlite
ENV PORT=8080

RUN corepack enable

# Copy workspace manifest and lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY src/server/package.json src/server/

# Install production-only dependencies via workspace filter
RUN pnpm install --frozen-lockfile --prod --filter takoio-server...

# Copy build outputs from builder stage
COPY --from=builder /app/src/server/.output ./.output
COPY --from=builder /app/src/admin/dist ./admin-dist

# SQLite data persistence
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

CMD ["node", ".output/server/index.mjs"]
