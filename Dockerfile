# Multi-stage Dockerfile for NestJS API
# Stage 1: Base - Alpine Node with pnpm
FROM node:20-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm@10.6.5

WORKDIR /app

# Stage 2: Dependencies - Install production dependencies only
FROM base AS dependencies

# Copy package files
COPY package.json pnpm-lock.yaml ./

COPY prisma ./prisma

# Install production dependencies with frozen lockfile
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Stage 3: Build - Install all dependencies and build
FROM base AS build

# Copy package files
COPY package.json pnpm-lock.yaml ./

COPY prisma ./prisma

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile

# Copy source code and configuration
COPY . .

# Generate Prisma client
RUN pnpm exec prisma generate

# Build TypeScript application
RUN pnpm run build

# Stage 4: Production - Minimal runtime image
FROM base AS production

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create non-root user (standard node user)
USER node

WORKDIR /app

# Copy production dependencies from dependencies stage
COPY --from=build --chown=node:node /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build --chown=node:node /app/dist ./dist

# Copy Prisma schema and generated client
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma

# Copy package.json for version info
COPY --chown=node:node package.json ./

# Expose port
EXPOSE 3000

# Health check using /health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application (migrations removed - run separately)
CMD ["node", "dist/src/main"] 