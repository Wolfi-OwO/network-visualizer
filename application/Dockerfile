# ═══════════════════════════════════════════════════════════════════════════
# BUILD STAGE — compiles the TypeScript backend and installs dependencies
# ═══════════════════════════════════════════════════════════════════════════
FROM node:22-alpine AS build
WORKDIR /app

# Copy package.json + package-lock.json first so npm ci gets cached
# and isn't re-run on every code change (layer caching)
COPY package*.json ./
RUN npm ci

# Copy TypeScript config and source files
COPY tsconfig.json ./
COPY server.ts ./
COPY src ./src

# Compile TypeScript to JavaScript (output typically lands in /app/dist)
RUN npm run build

# ═══════════════════════════════════════════════════════════════════════════
# RUNTIME STAGE — slim image containing only the compiled output + prod deps
# ═══════════════════════════════════════════════════════════════════════════
FROM node:22-alpine AS runtime
WORKDIR /app

# Put Node into production mode (e.g. Express optimizations, no debug logging)
ENV NODE_ENV=production

# Copy dependency manifests again, to install ONLY production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Bring the compiled backend over from the build stage (no source code in the final image)
COPY --from=build /app/dist ./dist

# Pre-built frontend (produced by the separate CI "client" job, downloaded into the
# build context). The backend serves it as static files + SPA fallback.
COPY client/dist ./client/dist

# ═══════════════════════════════════════════════════════════════════════════
# OCI IMAGE METADATA — build args with defaults, overridable via --build-arg
# ═══════════════════════════════════════════════════════════════════════════

# Image version (e.g. from a git tag/release)
ARG APP_VERSION=0.0.0-dev
# Short git commit hash, identifies the exact source state
ARG VCS_REF=unknown
# Timestamp of the image build (ISO 8601, passed in by CI)
ARG BUILD_DATE
# Human-readable display name of the app
ARG APP_TITLE="NetViz"
# Short description of what the app does
ARG APP_DESCRIPTION="Enterprise network visualizer & packet simulator"
# Publisher/organization
ARG APP_VENDOR="Woofi-Developments"
# Author(s) of the application
ARG APP_AUTHORS="Woofi-Developments"
# Project/documentation URL
ARG APP_URL="https://github.com/Wolfi-OwO/routing-visualizer"
# Source code repository URL
ARG APP_SOURCE="https://github.com/Wolfi-OwO/routing-visualizer"
# License of the application (SPDX identifier)
ARG APP_LICENSES="MIT"

# LABELs write the above ARGs into the image as standard OCI metadata
# (readable e.g. via `docker inspect` or registries/dashboards)
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

# ═══════════════════════════════════════════════════════════════════════════
# RUNTIME CONFIG
# ═══════════════════════════════════════════════════════════════════════════

# Set production mode
ENV NODE_ENV=production
ENV PORT=8080
ENV BINDADDRESS=0.0.0.0

# Healthcheck — periodically verifies the app is responsive
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node lib/health-checks.js || exit 1

# Set user to node -> no admin user needed
USER node

# Expose port
EXPOSE 8080

# Graceful shutdown signal
STOPSIGNAL SIGINT

# Startup command: run the compiled server from dist/
CMD ["node", "dist/server.js"]