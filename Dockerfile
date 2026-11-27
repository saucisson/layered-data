# Multi-stage build for the quarry (server.ts) + built atelier (dist/).
# Runtime binds 127.0.0.1 by default; set HOST=0.0.0.0 only behind an
# authenticated reverse proxy (see docs/deployment.md).

# Dev target (issue #204): full dependencies (vite included), no build —
# the source tree is bind-mounted by docker-compose.dev.yml and the vite
# dev server provides hot reload.
FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
EXPOSE 8791 5173

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/server ./server
COPY --from=build /app/formalisms ./formalisms
COPY server.ts ./
# data/ is runtime state (gitignored) — mount it as a volume. The boot
# mkdirSync calls (server/config.ts) only need the two directories to
# exist, so both are pre-created here with node ownership: the runtime
# never needs write access to its own root filesystem.
RUN mkdir -p /app/data /app/formalisms/users \
    && chown node:node /app/data /app/formalisms/users
EXPOSE 8791
ENV HOST=0.0.0.0
# Uniform rule of 2026-11-27 (layered-data, lisage, petrichor, see
# ADR-0121): a deployed service never runs as root. node:22-alpine
# ships the unprivileged `node` user (uid 1000).
USER node
CMD ["node", "server.ts"]
