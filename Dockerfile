# Этап 1: Сборка приложения
FROM node:22-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package.json package-lock.json* ./
RUN npm install

# Копируем весь проект и собираем его
COPY . .
RUN npm run build

# Небольшая отладка: проверяем, что действительно создалось
RUN echo "=== Содержимое .output ===" && ls -la .output/ || echo "Папка .output не найдена!"
RUN echo "=== Проверка серверного файла ===" && ls -la .output/server/index.mjs || echo "Файл index.mjs не найден!"

# Этап 2: Легкий образ для запуска
FROM node:22-alpine AS runner

WORKDIR /app

# Копируем только самое необходимое из собранного образа
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.output ./.output

# Открываем порт
EXPOSE 3003

# Переменные окружения
ENV NODE_ENV=production
ENV PORT=3003

# Запускаем сервер
CMD ["node", ".output/server/index.mjs"]