FROM node:20-slim

WORKDIR /app

# Зависимости (cache layer). devDeps нужны для vite build, потом prune.
# @intent-driven/* теперь подтягиваются с публичного npm, отдельный SDK
# build-stage не требуется.
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

# Исходники
COPY . .

# Сборка фронтенда → dist/, который Express отдаст как статику.
RUN npx vite build

# Снять devDeps после сборки.
RUN npm prune --omit=dev

# SQLite в /data (persistent volume на хосте).
ENV IDF_DB_PATH=/data/idf.db
ENV NODE_ENV=production
VOLUME /data

EXPOSE 3001

CMD ["node", "server/index.js"]
