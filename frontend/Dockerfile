FROM node:22-slim AS base
RUN corepack enable pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Development target
FROM base AS dev
EXPOSE 3000
CMD ["pnpm", "dev"]

# Production target
FROM base AS prod
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
