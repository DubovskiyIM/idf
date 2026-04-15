# Деплой лендинга на VPS + домен

Пошаговая инструкция для чистого VPS (Ubuntu 22.04 / Debian 12 — самые популярные). Время: **15–20 минут**, включая выдачу SSL.

## Что получится

- `https://YOUR_DOMAIN.RU/` → английский лендинг (`index.html`)
- `https://YOUR_DOMAIN.RU/ru/` → русский лендинг (`index-ru.html`)
- HTTP автоматически редиректит на HTTPS
- Let's Encrypt SSL (бесплатно, автообновление)
- `www.YOUR_DOMAIN.RU` работает так же

---

## Шаг 0. Чек-лист перед началом

- [ ] VPS с Ubuntu 22.04+ или Debian 12 (доступ по SSH)
- [ ] Домен куплен, DNS-панель доступна
- [ ] SSH-ключ уже положен на VPS (чтобы не вводить пароль)
- [ ] Порты **80** и **443** открыты у VPS-провайдера (обычно по умолчанию)

---

## Шаг 1. DNS-записи у регистратора

Зайди в DNS-панель (reg.ru, Timeweb, Beget — интерфейс похожий) и создай **A-записи**:

| Тип | Имя | Значение | TTL |
|---|---|---|---|
| A | `@` | IP твоего VPS | 600 |
| A | `www` | IP твоего VPS | 600 |

Если указано `AAAA` — добавь и IPv6 (`::1` аналогично A-записи, если у VPS есть v6).

**Проверь распространение DNS** (может занять 5–30 минут):
```bash
dig +short YOUR_DOMAIN.RU
# → должен вернуть IP твоего VPS
```

Пока DNS распространяется — делай шаги 2-3.

---

## Шаг 2. Установить nginx + certbot на VPS

Зайди на VPS по SSH:
```bash
ssh root@VPS_IP
```

Установи зависимости:
```bash
apt update && apt install -y nginx certbot python3-certbot-nginx rsync

# Создать директорию под лендинг и webroot для certbot
mkdir -p /var/www/idf-landing /var/www/certbot
chown -R www-data:www-data /var/www/idf-landing
```

Проверь что nginx запустился:
```bash
systemctl status nginx
# Active: active (running) — ok
```

Останься залогиненным на VPS, нужен для шага 4.

---

## Шаг 3. Подготовь deploy-скрипт на локальной машине

На твоей **локальной** машине открой `landing/deploy.sh` и отредактируй:

```bash
VPS_USER="root"                  # или "deploy" если создал отдельного пользователя
VPS_HOST="185.x.x.x"             # IP твоего VPS или vps.example.com
```

Также отредактируй `landing/nginx.conf` — замени `YOUR_DOMAIN.RU` на свой домен:
```bash
# Например, на macOS:
sed -i '' 's/YOUR_DOMAIN.RU/idf-framework.ru/g' landing/nginx.conf
```

Или вручную — 4 вхождения (server_name дважды + ssl_certificate + ssl_certificate_key).

---

## Шаг 4. Положи nginx-конфиг на VPS

**На локальной машине:**
```bash
scp landing/nginx.conf root@VPS_IP:/etc/nginx/sites-available/idf-landing
```

**На VPS:**
```bash
# Активировать конфиг
ln -sf /etc/nginx/sites-available/idf-landing /etc/nginx/sites-enabled/

# Отключить default-сайт (если есть)
rm -f /etc/nginx/sites-enabled/default

# ВАЖНО: пока SSL ещё не выпущен — закомментируй строки ssl_certificate
# Можно временно убрать весь https-блок (lines 26-end до закрывающей })
# Либо используй вариант ниже через certbot --nginx (он сам подправит)

# Проверить синтаксис
nginx -t
# → nginx: configuration file /etc/nginx/nginx.conf test is successful

# Перезапустить
systemctl reload nginx
```

**Альтернатива для шага 4** (рекомендую — проще):

Вместо ручного редактирования SSL-блока — сначала используй **HTTP-only** конфиг, потом certbot сам добавит SSL:

```bash
# На VPS — создать временный HTTP-only конфиг
cat > /etc/nginx/sites-available/idf-landing <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name YOUR_DOMAIN.RU www.YOUR_DOMAIN.RU;
    root /var/www/idf-landing;
    index index.html;

    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location = /ru  { return 301 /ru/; }
    location = /ru/ { try_files /index-ru.html =404; }
    location / { try_files $uri $uri/ =404; }
}
EOF

# Замени YOUR_DOMAIN.RU
sed -i 's/YOUR_DOMAIN.RU/idf-framework.ru/g' /etc/nginx/sites-available/idf-landing

ln -sf /etc/nginx/sites-available/idf-landing /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

---

## Шаг 5. Загрузить лендинг на VPS

На **локальной** машине:
```bash
cd /Users/DubovskiyIM/WebstormProjects/idf
./landing/deploy.sh
```

Проверь: открой `http://YOUR_DOMAIN.RU` — должен показать EN-лендинг. `http://YOUR_DOMAIN.RU/ru/` — RU.

*Если 502 или 404 — проверь на VPS:* `ls /var/www/idf-landing/` должен содержать `index.html` и `index-ru.html`.

---

## Шаг 6. Выпустить SSL через certbot

**На VPS:**
```bash
certbot --nginx -d YOUR_DOMAIN.RU -d www.YOUR_DOMAIN.RU --email you@example.com --agree-tos --no-eff-email --redirect
```

Что делает:
- Проверит владение доменом через HTTP challenge (файл в `/.well-known/acme-challenge/`)
- Получит сертификат от Let's Encrypt
- Автоматически отредактирует `/etc/nginx/sites-enabled/idf-landing` — добавит `listen 443 ssl`, пути к сертификатам, HTTPS-редирект
- Перезагрузит nginx

После успеха:
```bash
# Теперь замени certbot'овский дефолтный конфиг на наш красивый
# (с gzip, security headers, кэшированием)
scp -F /dev/null landing/nginx.conf root@VPS_IP:/etc/nginx/sites-available/idf-landing
# На VPS:
nginx -t && systemctl reload nginx
```

Проверь: `https://YOUR_DOMAIN.RU` — SSL работает (🔒 в адресной строке).

### Автообновление сертификата

certbot сам создаёт cron/systemd-timer. Проверь:
```bash
systemctl list-timers | grep certbot
# certbot.timer  активен, обновляет за 30 дней до истечения
```

---

## Шаг 7. Обновления лендинга в будущем

После любых правок в `landing/*.html`:
```bash
./landing/deploy.sh
```

rsync пошлёт только изменённые файлы (несколько KB), nginx перезагрузится за секунду.

---

## Troubleshooting

**`dig YOUR_DOMAIN.RU` ничего не возвращает:**
- DNS ещё не распространился (жди 10-30 мин)
- Или ошибка в A-записи (проверь в панели)

**Certbot `connection refused on port 80`:**
- Проверь `ufw status` — должен пропускать 80 и 443 (`ufw allow 80,443/tcp`)
- Проверь что у VPS-провайдера открыты порты (firewall cloud-панели)

**`502 Bad Gateway`:**
- Это nginx пытается куда-то прокси-пасс, но мы статику отдаём. Проверь, что в конфиге нет `proxy_pass`
- `ls /var/www/idf-landing/` — файлы на месте?
- `chown -R www-data:www-data /var/www/idf-landing`

**`ERR_SSL_PROTOCOL_ERROR` после certbot:**
- `nginx -t` покажет проблему конфигурации
- Либо HTTP-only конфиг сломался, либо в nginx.conf остались ссылки на несуществующие сертификаты

**Рус.лендинг не открывается по `/ru/`:**
- Проверь в `/etc/nginx/sites-available/idf-landing` наличие блока `location = /ru/`
- Файл `index-ru.html` должен быть в `/var/www/idf-landing/`

---

## Безопасность (необязательно, но рекомендую)

### Создать не-root пользователя для деплоя

```bash
# На VPS под root:
adduser deploy
usermod -aG www-data deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys

# Дать правки в /var/www/idf-landing без sudo:
chown -R deploy:www-data /var/www/idf-landing
chmod -R g+rwx /var/www/idf-landing

# Обновить deploy.sh: VPS_USER="deploy"
```

### Закрыть root SSH
```bash
sed -i 's/#PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl reload sshd
```

### Включить UFW (firewall)
```bash
ufw allow 22,80,443/tcp
ufw enable
```

### Автообновления безопасности
```bash
apt install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Готовый список команд для копирования

Для быстрого развёртывания (копируй блок, подставляя своё):

```bash
# === На локальной машине ===
DOMAIN="idf-framework.ru"
VPS_IP="185.1.2.3"

# Замени домен в конфиге
sed -i '' "s/YOUR_DOMAIN.RU/$DOMAIN/g" landing/nginx.conf

# Отредактируй deploy.sh (VPS_HOST=$VPS_IP)

# === На VPS (SSH) ===
apt update && apt install -y nginx certbot python3-certbot-nginx rsync
mkdir -p /var/www/idf-landing /var/www/certbot
chown -R www-data:www-data /var/www/idf-landing

# === Локально — первый деплой (с временным HTTP-only конфигом) ===
# (см. шаг 4 альтернатива)
./landing/deploy.sh

# === На VPS — SSL ===
certbot --nginx -d $DOMAIN -d www.$DOMAIN --email ты@example.com --agree-tos --no-eff-email --redirect

# === Локально — загрузка финального nginx.conf с полными security/cache headers ===
scp landing/nginx.conf root@$VPS_IP:/etc/nginx/sites-available/idf-landing
ssh root@$VPS_IP 'nginx -t && systemctl reload nginx'
```

Готово. Открой `https://YOUR_DOMAIN.RU` и `https://YOUR_DOMAIN.RU/ru/`.
