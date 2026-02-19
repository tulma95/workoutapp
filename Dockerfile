# Stage 1: Install all dependencies (cached by lockfile)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

# Stage 2: Build backend and frontend
FROM deps AS build
COPY tsconfig.base.json ./
COPY backend/tsconfig.json backend/
COPY backend/src/ backend/src/
COPY backend/prisma/ backend/prisma/
COPY backend/prisma.config.ts backend/
COPY frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.node.json frontend/
COPY frontend/src/ frontend/src/
COPY frontend/public/ frontend/public/
COPY frontend/index.html frontend/vite.config.ts frontend/
RUN cd backend && npx prisma generate
RUN npm run build -w backend
RUN npm run build -w frontend

# Stage 3: Production image
FROM node:22-alpine AS production
WORKDIR /app

# Install production dependencies only (includes prisma CLI for migrations)
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev

# Copy built backend
COPY --from=build /app/backend/dist/ backend/dist/

# Copy generated Prisma client
COPY --from=build /app/backend/src/generated/ backend/src/generated/

# Copy Prisma schema, migrations, and config for migrate deploy
COPY backend/prisma/ backend/prisma/
COPY backend/prisma.config.ts backend/

# Copy built frontend static files
COPY --from=build /app/frontend/dist/ frontend/dist/

COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

ENTRYPOINT ["/app/docker-entrypoint.sh"]
