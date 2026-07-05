# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY docs/ ./docs/
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runtime

WORKDIR /app

# Install system dependencies for Hermes Agent (git + python3 + curl + bash needed by installer)
RUN apk add --no-cache git python3 build-base curl bash

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy built artifacts from build stage
COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/scripts/ ./scripts/
COPY --from=build /app/docs/ ./docs/

# Install Hermes Agent (non-interactive, skip browser setup — installer creates its own venv)
ENV HERMES_HOME=/root/.hermes
RUN curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash -s -- --skip-setup --non-interactive --skip-browser

# ── Local OpenAI-compatible backend, configured entirely from env ──
# Non-secret build defaults (override at build with --build-arg or at run with -e).
# host.docker.internal reaches the host from inside the container (Docker Desktop;
# on Linux add `--add-host=host.docker.internal:host-gateway`).
ARG CUSTOM_BASE_URL=http://host.docker.internal:8080/v1
ARG CUSTOM_MODEL=your-local-model

# Bake Hermes to talk to the custom endpoint — but with NO real secret. The key
# is a mock placeholder here and is injected at runtime by docker-entrypoint.sh.
RUN sed -i 's|provider: "auto"|provider: "custom"|' /root/.hermes/config.yaml && \
    sed -i "s|base_url: \"https://openrouter.ai/api/v1\"|base_url: \"${CUSTOM_BASE_URL}\"|" /root/.hermes/config.yaml && \
    sed -i "s|default: \"anthropic/claude-opus-4.6\"|default: \"${CUSTOM_MODEL}\"|" /root/.hermes/config.yaml && \
    sed -i 's|# api_key: "your-key-here"  # Uncomment to set here instead of .env|api_key: "sk-REPLACE-ME"|' /root/.hermes/config.yaml

# Environment variables
ENV NODE_ENV=production
ENV PORT=3333
ENV T3MP3ST_HOST=0.0.0.0

# T3MP3ST core LLM backend — MOCK placeholders. Override at `docker run` time:
#   docker run -e CUSTOM_BASE_URL=http://192.168.1.10:8080/v1 \
#              -e CUSTOM_MODEL=my-local-model \
#              -e CUSTOM_API_KEY=sk-real-key t3mp3st
# Leave CUSTOM_API_KEY as the placeholder for keyless local servers.
ENV LLM_PROVIDER=custom
ENV CUSTOM_BASE_URL=${CUSTOM_BASE_URL}
ENV CUSTOM_MODEL=${CUSTOM_MODEL}
ENV CUSTOM_API_KEY=sk-REPLACE-ME
# Set to 1 to run a non-blocking endpoint check on startup.
ENV T3MP3ST_VALIDATE_ON_START=0

# Runtime secret injection + optional endpoint check
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose War Room port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3333/').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the server (entrypoint injects the runtime key first)
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
