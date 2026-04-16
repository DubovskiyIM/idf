#!/usr/bin/env bash
# IDF — деплой прототипа на VPS.
#
# Использование (из корня репо):
#   ./deploy/deploy.sh           # rsync + build + up
#   ./deploy/deploy.sh logs      # tail logs main контейнера
#   ./deploy/deploy.sh restart   # docker compose restart на VPS
#
# Требования:
#   - sshpass установлен локально
#   - .env содержит SERVER_USER, SERVER_IP
#   - pwd.txt содержит SSH-пароль (одна строка)
#   - На VPS: Ubuntu 24.04, docker + docker-compose-plugin установлены,
#     nginx уже работает (см. deploy/nginx-app.conf для server-блока).

set -euo pipefail

cd "$(dirname "$0")/.."

# --- Загрузка credentials ---------------------------------------------------
SERVER_USER=$(awk -F= '/^SERVER_USER=/{print $2}' .env)
SERVER_IP=$(awk -F= '/^SERVER_IP=/{print $2}' .env)
export SSHPASS=$(tr -d '\n' < pwd.txt)

REMOTE="${SERVER_USER}@${SERVER_IP}"
APP_DIR="/opt/idf"

ssh_run() {
  sshpass -e ssh -o ConnectTimeout=10 -o ServerAliveInterval=15 "$REMOTE" "$@"
}

rsync_push() {
  sshpass -e rsync -az --delete \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' \
    --exclude='pwd.txt' \
    --exclude='.env' \
    --exclude='docs/superpowers' \
    -e "ssh -o StrictHostKeyChecking=accept-new" \
    ./ "${REMOTE}:${APP_DIR}/"
}

case "${1:-up}" in
  up)
    echo "==> mkdir ${APP_DIR} on VPS"
    ssh_run "mkdir -p ${APP_DIR}"

    echo "==> rsync repo → VPS:${APP_DIR}"
    rsync_push

    echo "==> docker compose build (multi-stage, может занять 3-5 мин)"
    ssh_run "cd ${APP_DIR} && docker compose build"

    echo "==> docker compose up -d"
    ssh_run "cd ${APP_DIR} && docker compose up -d"

    echo "==> docker compose ps"
    ssh_run "cd ${APP_DIR} && docker compose ps"

    echo "==> health check на 127.0.0.1:3001"
    ssh_run "curl -sf -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3001/ || echo 'main not yet ready'"
    ;;

  logs)
    ssh_run "cd ${APP_DIR} && docker compose logs --tail=100 -f main"
    ;;

  restart)
    ssh_run "cd ${APP_DIR} && docker compose restart"
    ;;

  down)
    ssh_run "cd ${APP_DIR} && docker compose down"
    ;;

  ps)
    ssh_run "cd ${APP_DIR} && docker compose ps"
    ;;

  *)
    echo "Unknown command: $1"
    echo "Usage: $0 [up|logs|restart|down|ps]"
    exit 1
    ;;
esac
