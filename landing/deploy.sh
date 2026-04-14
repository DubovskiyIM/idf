#!/usr/bin/env bash
# ============================================================
# IDF landing — one-command deploy
# ============================================================
# Usage:   ./deploy.sh
# Требует: ssh-доступ по ключу к VPS (без пароля)
# Переменные ниже → замени на свои
# ============================================================

set -euo pipefail

# ─── Конфигурация ───────────────────────────────────────────
VPS_USER="root"
VPS_HOST="YOUR_VPS_IP_OR_HOSTNAME"   # например 185.x.x.x или vps.example.com
VPS_PATH="/var/www/idf-landing"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

# Что НЕ загружаем (конфиги и скрипты — не public)
EXCLUDES=(
  "--exclude=nginx.conf"
  "--exclude=deploy.sh"
  "--exclude=.DS_Store"
  "--exclude=*.md"
)

# ─── Проверки ───────────────────────────────────────────────
if [[ "$VPS_HOST" == "YOUR_VPS_IP_OR_HOSTNAME" ]]; then
  echo "❌ Отредактируй VPS_HOST в deploy.sh"
  exit 1
fi

if ! command -v rsync >/dev/null; then
  echo "❌ rsync не найден (brew install rsync)"
  exit 1
fi

# ─── Деплой ─────────────────────────────────────────────────
echo "📤 Загружаю файлы на ${VPS_USER}@${VPS_HOST}:${VPS_PATH}"

rsync -avz --delete "${EXCLUDES[@]}" \
  "${LOCAL_DIR}/" \
  "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"

echo ""
echo "🔄 Перезагружаю nginx"
ssh "${VPS_USER}@${VPS_HOST}" 'nginx -t && systemctl reload nginx'

echo ""
echo "✓ Готово. Открой: https://YOUR_DOMAIN.RU"
