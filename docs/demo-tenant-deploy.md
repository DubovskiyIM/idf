# Demo-tenant deploy guide

`demo.fold.software` — общий sandbox-tenant под статью. Read-only по умолчанию, mock-LLM, reset каждые 6 часов.

Этот документ — runbook. Код middleware/scripts уже в репо; что нужно сделать на VPS — ниже.

---

## Env vars

| Имя | Значение | Назначение |
|---|---|---|
| `DEMO_MODE` | `1` | Активирует demo-middleware (read-only / rate-limit / SSE cap) |
| `DEMO_CURATOR_TOKEN` | случайная строка ≥32 chars | Bypass read-only через header `X-Demo-Curator-Token` |
| `DEMO_LLM_MOCK` | `1` | Заменяет ClaudeCliProvider на MockClaudeProvider |
| `DEMO_RL_MAX` | `30` *(default)* | Per-IP request limit |
| `DEMO_RL_WINDOW_MS` | `60000` *(default)* | Sliding window для rate-limit |
| `DEMO_SSE_MAX` | `100` *(default)* | Max одновременных SSE-подключений |
| `IDF_DB_PATH` | `/var/lib/idf-demo/idf.db` | Изолированная БД от других planes |
| `PORT` | `3001` | Express bind |

Сгенерировать токен:
```bash
openssl rand -hex 32
```

---

## Локальный smoke-check (на dev-машине)

```bash
DEMO_MODE=1 \
DEMO_CURATOR_TOKEN=test-token \
DEMO_LLM_MOCK=1 \
npm run server

# В другом терминале:
curl -s localhost:3001/api/demo/stats | jq
# → { "enabled": true, "sseActive": 0, "rlBuckets": 0, "config": {...} }

curl -s -X POST localhost:3001/api/effects -H "Content-Type: application/json" -d '{}'
# → 403 demo_read_only

curl -s -X POST localhost:3001/api/effects \
  -H "Content-Type: application/json" \
  -H "X-Demo-Curator-Token: test-token" -d '{}'
# → проходит (хотя сам effect упадёт на валидации — это OK для smoke)

# Rate-limit:
for i in {1..35}; do curl -s -o /dev/null -w "%{http_code}\n" localhost:3001/api/effects/stream; done
# Первые 30 → 200, остальные → 429
```

---

## Subdomain DNS

В DNS-провайдере fold.software:

```
demo  CNAME  vps.intent-design.tech.   # или A-record на VPS IP
```

TTL 300 для быстрых правок при первом запуске.

---

## Option A — systemd на VPS

Префикс пути: `/opt/idf-demo/`. Predполагается отдельный clone репо `intent-driven-software/idf` в этой папке.

```bash
# Клон репо
sudo mkdir -p /opt/idf-demo
sudo git clone https://github.com/intent-driven-software/idf.git /opt/idf-demo/app
cd /opt/idf-demo/app && npm ci && npm run build

# БД и snapshot dir
sudo mkdir -p /var/lib/idf-demo
sudo chown idf:idf /var/lib/idf-demo

# Token секрет
sudo touch /etc/idf-demo.env
sudo chmod 600 /etc/idf-demo.env
```

`/etc/idf-demo.env`:
```env
DEMO_MODE=1
DEMO_CURATOR_TOKEN=<openssl rand -hex 32>
DEMO_LLM_MOCK=1
IDF_DB_PATH=/var/lib/idf-demo/idf.db
PORT=3011
NODE_ENV=production
```

`/etc/systemd/system/idf-demo.service`:
```ini
[Unit]
Description=IDF demo tenant (demo.fold.software)
After=network.target

[Service]
Type=simple
User=idf
WorkingDirectory=/opt/idf-demo/app
EnvironmentFile=/etc/idf-demo.env
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now idf-demo
sudo systemctl status idf-demo
```

---

## Option B — Docker

`Dockerfile.demo` в репо (TODO — сейчас не существует, это next iteration). Пока используй Option A.

---

## nginx vhost

`/etc/nginx/sites-available/demo.fold.software`:

```nginx
server {
    listen 443 ssl http2;
    server_name demo.fold.software;

    ssl_certificate /etc/letsencrypt/live/demo.fold.software/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/demo.fold.software/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3011;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE — отключаем буферизацию
    location ~ ^/api/(effects|meta/llm/runs)/.*/stream {
        proxy_pass http://127.0.0.1:3011;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
        proxy_set_header Host $host;
    }
}

server {
    listen 80;
    server_name demo.fold.software;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/demo.fold.software /etc/nginx/sites-enabled/
sudo certbot --nginx -d demo.fold.software
sudo nginx -t && sudo systemctl reload nginx
```

---

## Reset cron (каждые 6ч)

Принцип: snapshot готовится один раз при initial deploy (после seed); cron восстанавливает.

```bash
# Initial seed: запустить сервер, создать seed effects через scripts/seed-meta.mjs
# (отдельная задача T4), потом dump:
node scripts/snapshot-dump.mjs --out /var/lib/idf-demo/snapshot-baseline.json
```

`/etc/systemd/system/idf-demo-reset.service`:
```ini
[Unit]
Description=Reset IDF demo tenant from baseline snapshot
Requires=idf-demo.service

[Service]
Type=oneshot
User=idf
WorkingDirectory=/opt/idf-demo/app
EnvironmentFile=/etc/idf-demo.env
ExecStartPre=/bin/systemctl stop idf-demo.service
ExecStart=/usr/bin/node scripts/snapshot-restore.mjs --in /var/lib/idf-demo/snapshot-baseline.json
ExecStartPost=/bin/systemctl start idf-demo.service
```

`/etc/systemd/system/idf-demo-reset.timer`:
```ini
[Unit]
Description=Reset IDF demo every 6 hours

[Timer]
OnCalendar=00,06,12,18:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now idf-demo-reset.timer
systemctl list-timers | grep idf-demo
```

Окно downtime при reset: ~3-5 секунд (стоп → restore → старт).

---

## Smoke checklist после deploy

```bash
# 1. Сервер живой
curl -s https://demo.fold.software/api/demo/stats | jq

# 2. /meta route отдаётся (после T4 seed)
curl -s https://demo.fold.software/api/document/meta/backlog_inbox?as=observer | head -50

# 3. Read-only работает
curl -s -X POST https://demo.fold.software/api/effects -H "Content-Type: application/json" -d '{}' | jq
# → demo_read_only

# 4. Mock LLM отвечает
curl -s -X POST https://demo.fold.software/api/meta/llm/synthesize-apply \
  -H "X-Demo-Curator-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patternId":"hub-absorption","candidate":{"id":"hub-absorption"},"domainList":["sales"]}'
# → 202 + runId

# 5. SSE стрим работает
curl -N -s "https://demo.fold.software/api/meta/llm/runs/$RUNID/stream" | head -20
```

---

## Open items для next iteration

- Plausible analytics endpoint в frontend
- Dockerfile.demo вместо systemd
- Per-visitor session token вместо общего bypass — если массово начнут пытаться вандалить
- Snapshot rotation (хранить last 7 dumps на случай regression в seed)
