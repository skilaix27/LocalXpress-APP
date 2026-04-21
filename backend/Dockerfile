# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json ./
RUN npm ci --include=dev

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Stage 2: production image ───────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Persistent upload directory owned by app user
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3001

# Graceful shutdown support
STOPSIGNAL SIGTERM

CMD ["node", "dist/index.js"]
