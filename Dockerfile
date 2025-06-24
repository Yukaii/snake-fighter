# Multi-stage build for Snake Fighter
FROM node:18-alpine AS base

# Install Caddy
RUN apk add --no-cache caddy

# Set work directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lock* ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

FROM base AS build

# Install all dependencies for building
RUN npm ci

# Copy source code
COPY . .

# Build the React frontend
RUN npm run build

FROM base AS production

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./
COPY --from=build /app/package.json ./

# Create Caddy configuration directory
RUN mkdir -p /etc/caddy

# Expose port 80 (Caddy will handle the proxy)
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Default command will be overridden by Zeabur
CMD ["sh", "-c", "node server.js & caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"]