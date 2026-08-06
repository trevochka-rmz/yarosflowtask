FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Отладка
RUN echo "=== Что в .output ===" && ls -la .output || echo "Нет .output"
RUN echo "=== Что в dist ===" && ls -la dist || echo "Нет dist"

FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app ./

EXPOSE 3003
ENV NODE_ENV=production
ENV PORT=3003

# Универсальный запуск
CMD ["sh", "-c", "if [ -f .output/server/index.mjs ]; then node .output/server/index.mjs; else echo '❌ Сервер не найден!'; exit 1; fi"]