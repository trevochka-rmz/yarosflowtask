FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3003
ENV PORT=3003

# Запускаем в режиме разработки
CMD ["npm", "run", "dev"]