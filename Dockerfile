# Multi-stage build for the quarry (server.ts) + built atelier (dist/).
# Runtime binds 127.0.0.1 by default; set HOST=0.0.0.0 only behind an
# authenticated reverse proxy (see docs/deployment.md).

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
# data/ is runtime state (gitignored) — mount it as a volume.
RUN mkdir -p /app/data
EXPOSE 8791
ENV HOST=0.0.0.0
CMD ["node", "server.ts"]
