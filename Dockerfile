# ─────────────────────────────────────────────────────────────────
# OpenClaw Learning Assistant — Node.js Runtime Image
# Multistage build: compile dependencies, then run slim image
# ─────────────────────────────────────────────────────────────────

# Builder stage: install dependencies
FROM node:20-alpine AS builder

WORKDIR /build

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (production only).
# The repository currently does not include a lockfile, so npm install is intentional here.
RUN npm install --omit=dev

# Runtime stage
FROM node:20-alpine

LABEL maintainer="openclaw-learning-assistant"
LABEL description="Personalized AI Learning Assistant — Node.js + Telegram + Gemini"

# tini = proper PID 1 / signal forwarding inside Docker
# curl = used by the HEALTHCHECK below
RUN apk add --no-cache tini curl

WORKDIR /app

# Copy installed dependencies from builder
COPY --from=builder /build/node_modules ./node_modules

# Copy application source and config
COPY app.js cli.js ./
COPY lib/ ./lib/
COPY skills/ ./skills/
COPY config/ ./config/

# Persistent data directories (kept alive by Docker named volumes)
RUN mkdir -p /data/memory /data/logs

# Health check: query the health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD sh -c "curl -f http://localhost:${PORT:-3000}/health || exit 1"

# tini as PID 1 so SIGTERM from `docker compose stop` propagates correctly
ENTRYPOINT ["/sbin/tini", "--"]

# Start the Node.js application
CMD ["node", "app.js"]
