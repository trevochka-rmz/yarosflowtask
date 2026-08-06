FROM node:22-alpine AS builder

WORKDIR /app

# Копируем зависимости
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm install

# Копируем исходники
COPY . .

# Собираем проект
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

# Копируем зависимости для продакшена
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm install --omit=dev

# Копируем собранные файлы (.output - стандарт Nitro)
COPY --from=builder /app/.output ./.output

EXPOSE 3003
ENV NODE_ENV=production
ENV PORT=3003

CMD ["node", ".output/server/index.mjs"]