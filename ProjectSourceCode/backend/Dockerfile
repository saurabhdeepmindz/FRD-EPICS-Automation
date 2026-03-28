FROM node:20-alpine AS base

WORKDIR /app

# Dependencies layer
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Development stage (with hot-reload via nest start --watch)
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "start:dev"]

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# Production stage
FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/main"]
