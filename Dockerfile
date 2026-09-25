FROM node:22-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci && mkdir -p /opt/starboard-node_modules && cp -a node_modules/. /opt/starboard-node_modules/ && cp package-lock.json /opt/starboard-package-lock.json

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build npm run build && rm -rf .next/cache

FROM base AS runner
ENV NODE_ENV=production
RUN groupadd --system starboard && useradd --system --gid starboard --create-home starboard
COPY --from=deps --chown=starboard:starboard /app/node_modules ./node_modules
COPY --from=builder --chown=starboard:starboard /app/package.json ./package.json
COPY --from=builder --chown=starboard:starboard /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=starboard:starboard /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=starboard:starboard /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=starboard:starboard /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=starboard:starboard /app/.next ./.next
COPY --from=builder --chown=starboard:starboard /app/public ./public
COPY --from=builder --chown=starboard:starboard /app/prisma ./prisma
COPY --from=builder --chown=starboard:starboard /app/src ./src
COPY --from=builder --chown=starboard:starboard /app/scripts/bootstrap-admin.cjs ./scripts/bootstrap-admin.cjs
COPY --from=builder --chown=starboard:starboard /app/tsconfig.json ./tsconfig.json
USER starboard
EXPOSE 3000
CMD ["sh", "-c", "npm run prisma:deploy && exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port 3000"]
