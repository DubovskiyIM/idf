#!/usr/bin/env bash
set -e

if [ ! -d "$HOME/.claude" ]; then
  echo "ERROR: $HOME/.claude не существует. Сначала выполни 'claude login' на хосте."
  exit 1
fi

echo "=== IDF Studio ==="
echo "GUI:      http://localhost:4000/studio.html"
echo "Vite HMR: http://localhost:5174/studio.html"
echo "Terminal: docker exec -it idf-studio bash"
echo "Stop:     docker compose -f docker-compose.studio.yml down"
echo

docker compose -f docker-compose.studio.yml up --build "$@"
