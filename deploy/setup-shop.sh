#!/usr/bin/env bash
# Российский сервер: МАГАЗИН (сайт + заказы + оплата).
# Запуск от root на чистой Ubuntu 24.04:
#   bash setup-shop.sh <домен> <ссылка на репозиторий GitHub>
# Пример:
#   bash setup-shop.sh baza-r-com.ru https://github.com/bazarcom/baza-r-com.git
set -euo pipefail
DOMAIN="${1:?Укажите домен, например baza-r-com.ru}"
REPO="${2:?Укажите ссылку на репозиторий GitHub}"
APP=/opt/shop
export DEBIAN_FRONTEND=noninteractive

echo "==> 1/6 Ставим git, curl и Caddy (он даёт https-замочек)"
apt-get update -q
apt-get install -yq git curl ca-certificates caddy

echo "==> 2/6 Ставим Node.js 22"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -yq nodejs
fi

echo "==> 3/6 Скачиваем сайт из GitHub"
id shop >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/shop --shell /usr/sbin/nologin shop
if [ -d "$APP/.git" ]; then
  runuser -u shop -- git -C "$APP" pull -q --ff-only
else
  mkdir -p "$APP" && chown shop:shop "$APP"
  runuser -u shop -- git clone -q "$REPO" "$APP"
fi
mkdir -p "$APP/data"
if [ ! -f "$APP/.env" ]; then
  if [ -f "$APP/.env.example" ]; then cp "$APP/.env.example" "$APP/.env"; else touch "$APP/.env"; fi
  if grep -q '^SITE_URL=' "$APP/.env"; then sed -i "s#^SITE_URL=.*#SITE_URL=https://$DOMAIN#" "$APP/.env"; else echo "SITE_URL=https://$DOMAIN" >> "$APP/.env"; fi
fi
chown -R shop:shop "$APP"
chmod 600 "$APP/.env"

echo "==> 4/6 Автозапуск магазина (перезапустится сам после сбоя или перезагрузки)"
cat > /etc/systemd/system/shop.service <<UNIT
[Unit]
Description=Магазин $DOMAIN
After=network-online.target

[Service]
User=shop
WorkingDirectory=$APP
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now shop
systemctl restart shop

echo "==> 5/6 Домен и https"
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN, www.$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy

echo "==> 6/6 Автообновление: каждые 2 минуты проверяем GitHub"
cat > /usr/local/bin/shop-update <<'UPD'
#!/bin/sh
cd /opt/shop || exit 0
runuser -u shop -- git fetch -q origin || exit 0
if [ "$(runuser -u shop -- git rev-parse HEAD)" != "$(runuser -u shop -- git rev-parse '@{u}')" ]; then
  runuser -u shop -- git pull -q --ff-only && systemctl restart shop && echo "$(date '+%F %T') сайт обновлён" >> /var/log/shop-update.log
fi
UPD
chmod +x /usr/local/bin/shop-update
echo "*/2 * * * * root /usr/local/bin/shop-update" > /etc/cron.d/shop-update

IP="$(curl -fsS4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
cat <<DONE

==================================================
 Магазин установлен.
 1) В reg.ru → домен $DOMAIN → DNS-серверы и управление зоной:
      A-запись  @    →  $IP
      A-запись  www  →  $IP
    Через 5–30 минут сайт откроется на https://$DOMAIN
 2) Ключи бота и банка:  nano $APP/.env
    после правки:        systemctl restart shop
 3) Проверка:            https://$DOMAIN/api/health
 Журнал магазина:        journalctl -u shop -f
==================================================
DONE
