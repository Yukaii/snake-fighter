# Multi-stage build for Snake Fighter
FROM oven/bun:1-alpine AS base

# Install Caddy, Node.js, and debugging tools
RUN apk add --no-cache caddy nodejs curl wget netcat-openbsd htop procps

# Set work directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install production dependencies
RUN bun install --frozen-lockfile --production

FROM base AS build

# Install all dependencies for building
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the React frontend
RUN bun run build

# Debug: List built assets
RUN ls -la dist/assets/

FROM base AS production

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./
COPY --from=build /app/package.json ./

# Create Caddy configuration directory and copy Caddyfile
RUN mkdir -p /etc/caddy
COPY Caddyfile /etc/caddy/Caddyfile

# Expose port 80 (Caddy will handle the proxy)
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Default command will be overridden by Zeabur
CMD ["sh", "-c", "node server.js & sleep 2 && caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"]
