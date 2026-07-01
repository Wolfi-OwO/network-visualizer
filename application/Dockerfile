# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY server.ts ./
COPY src ./src
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Pre-built frontend (produced by the CI "client" job and downloaded into the
# build context). The backend serves it as static files + SPA fallback.
COPY client/dist ./client/dist

# ── OpenContainer (OCI) image metadata ────────────────────────────────────────
# Dynamic values are supplied at build time (the CD workflows pass these from the
# release tag + git); the static ones can be overridden with --build-arg too.
ARG APP_VERSION=0.0.0-dev
ARG VCS_REF=unknown
ARG BUILD_DATE
ARG APP_TITLE="NetViz"
ARG APP_DESCRIPTION="Enterprise network visualizer & packet simulator"
ARG APP_VENDOR="Woofi-Developments"
ARG APP_AUTHORS="Woofi-Developments"
ARG APP_URL="https://github.com/Wolfi-OwO/routing-visualizer"
ARG APP_SOURCE="https://github.com/Wolfi-OwO/routing-visualizer"
ARG APP_LICENSES="MIT"
LABEL org.opencontainers.image.title="${APP_TITLE}" \
      org.opencontainers.image.description="${APP_DESCRIPTION}" \
      org.opencontainers.image.vendor="${APP_VENDOR}" \
      org.opencontainers.image.authors="${APP_AUTHORS}" \
      org.opencontainers.image.url="${APP_URL}" \
      org.opencontainers.image.source="${APP_SOURCE}" \
      org.opencontainers.image.licenses="${APP_LICENSES}" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}"

EXPOSE 8080
CMD ["node", "dist/server.js"]
