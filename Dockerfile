FROM node:20-slim

WORKDIR /app

# Зависимости (кеш слой) — нужны devDependencies для vite build
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

# Исходники
COPY . .

# Сборка фронтенда
RUN npx vite build

# Удаляем devDependencies после сборки
RUN npm prune --omit=dev

# SQLite данные хранятся в /data (persistent volume)
ENV IDF_DB_PATH=/data/idf.db
VOLUME /data

EXPOSE 3001

CMD ["node", "server/index.js"]
