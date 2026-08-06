FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app ./

EXPOSE 3003
ENV NODE_ENV=production
ENV PORT=3003

# Правильный способ - использовать sh
CMD ["sh", "-c", "node .output/server/index.mjs"]