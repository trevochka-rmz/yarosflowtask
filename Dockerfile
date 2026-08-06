FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/.output ./.output

EXPOSE 3003
ENV NODE_ENV=production
ENV PORT=3003

CMD ["node", ".output/server/index.mjs"]