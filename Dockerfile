# ---- Build stage: admin panel ----
FROM node:20-alpine AS admin-build
WORKDIR /app
COPY src/admin/package.json src/admin/pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY src/admin/ ./
RUN pnpm build

# ---- Build stage: server ----
FROM node:20-alpine AS server-build
WORKDIR /app
COPY src/server/package.json src/server/pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY src/server/ ./
RUN pnpm build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV DB_TYPE=sqlite
ENV PORT=8080

# Install production dependencies for server
COPY src/server/package.json src/server/pnpm-lock.json* ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

# Copy server build output
COPY --from=server-build /app/.output ./.output

# Copy admin build output (served at /admin/)
COPY --from=admin-build /app/dist ./admin-dist

# Copy data directory (for SQLite persistence)
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

CMD ["node", ".output/server/index.mjs"]
