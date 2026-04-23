# apps/worker/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @telemed/shared build
RUN pnpm --filter @telemed/worker build

FROM base AS runner
WORKDIR /app/apps/worker
COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/worker/node_modules /app/apps/worker/node_modules
COPY --from=builder /app/packages/shared/dist /app/packages/shared/dist
COPY --from=builder /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=builder /app/packages/shared/node_modules /app/packages/shared/node_modules

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "--dns-result-order=ipv4first", "dist/index.js"]
