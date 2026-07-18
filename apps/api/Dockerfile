# syntax=docker/dockerfile:1
#
# API image (NestJS) for Render. Multi-stage pnpm/Turbo monorepo build.
#
# Migrations do NOT run here — they run as a CD step (GitHub Actions) against the
# owner connection before this image is deployed (see docs/deployment-plan.md
# §5/§8). This keeps the runtime lean and the two-role split (ADR-004) clean.
#
# Debian (bookworm) base is deliberate: Prisma's default query engine targets
# debian-openssl-3.0.x, so building and running on the same glibc/OpenSSL base
# avoids engine-mismatch surprises (an Alpine/musl base would need extra config).

# ---- base -------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
# OpenSSL + CA certs for the Prisma engine and TLS to Postgres/Redis.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# ---- build ------------------------------------------------------------------
FROM base AS build
# Copy the whole workspace: pnpm needs the full topology (all package.json +
# lockfile) to resolve workspace links, and Turbo needs the sources to build
# api's dependency graph (@workspace/database → @workspace/api → api).
COPY . .
RUN pnpm install --frozen-lockfile
# Build api and everything it depends on. packages/database's `prebuild` runs
# `db:generate` (prisma generate) automatically, so the client is present.
RUN pnpm exec turbo run build --filter=api

# ---- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
# Carry the built workspace (dist + node_modules incl. the generated Prisma
# client + engine). Image-size trimming (pnpm deploy + a pinned Prisma output
# dir) is a later optimization; correctness first for the UAT foundation.
COPY --from=build /app /app
WORKDIR /app/apps/api
# Render provides PORT at runtime; main.ts binds 0.0.0.0:$PORT.
EXPOSE 3000
CMD ["node", "dist/main"]
