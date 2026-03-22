FROM node:20-alpine

RUN corepack enable

WORKDIR /workspace

# Copy workspace manifests and lockfile first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/types ./packages/types
COPY apps/web ./apps/web

WORKDIR /workspace/apps/web

EXPOSE 3000

CMD ["pnpm", "dev", "--", "--hostname", "0.0.0.0"]
