    FROM node:22-alpine AS builder

    WORKDIR /app
    
    COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
    RUN npm ci --omit=dev
    
    COPY . .
    
    RUN npm run build
    
    FROM node:22-alpine AS runner
    
    WORKDIR /app
    
    COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
    RUN npm ci --omit=dev
    
    COPY --from=builder /app/dist ./dist
    COPY --from=builder /app/.nitro ./nitro
    
    EXPOSE 3003
    ENV NODE_ENV=production
    ENV PORT=3003
    
    CMD ["node", "./nitro/server/index.mjs"]
    