#!/usr/bin/env bash
#
# Первичная настройка сервера под Debian 12/13.
# Запускается один раз на свежей машине от root:
#
#   scp deploy/setup-server.sh root@СЕРВЕР:/tmp/
#   ssh root@СЕРВЕР 'bash /tmp/setup-server.sh budget.example.com you@example.com'
#
# Скрипт идемпотентный: повторный запуск ничего не сломает.

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" ]]; then
  echo "Использование: bash setup-server.sh <домен> [email-для-Let's-Encrypt]" >&2
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "Нужны права root." >&2
  exit 1
fi

APP_DIR=/opt/budget
DATA_DIR=/var/lib/budget
NODE_MAJOR=22

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

log "Обновляю систему"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

log "Ставлю базовые пакеты"
apt-get install -y -qq curl ca-certificates gnupg rsync ufw sqlite3

# ---------- Swap ----------
# На 1 Gb памяти swap нужен как страховка на время npm ci и пиков нагрузки.
if ! swapon --show | grep -q .; then
  log "Создаю swap-файл на 2 Gb"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Свопить только при реальной нехватке — на SSD это дешевле, чем OOM.
  sysctl -w vm.swappiness=10 >/dev/null
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
else
  log "Swap уже настроен, пропускаю"
fi

# ---------- Node.js ----------
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  log "Ставлю Node.js ${NODE_MAJOR} LTS"
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs
fi
log "Node $(node -v), npm $(npm -v)"

# ---------- nginx и certbot ----------
log "Ставлю nginx и certbot"
apt-get install -y -qq nginx certbot python3-certbot-nginx

# ---------- Пользователь и каталоги ----------
if ! id budget >/dev/null 2>&1; then
  log "Создаю системного пользователя budget"
  useradd --system --create-home --home-dir /home/budget --shell /usr/sbin/nologin budget
fi

log "Готовлю каталоги"
mkdir -p "$APP_DIR" "$DATA_DIR/uploads"
chown -R budget:budget "$APP_DIR" "$DATA_DIR"
chmod 750 "$DATA_DIR"

# ---------- nginx site ----------
log "Настраиваю nginx для домена $DOMAIN"
if [[ -f /tmp/nginx.conf ]]; then
  sed "s/DOMAIN/$DOMAIN/g" /tmp/nginx.conf > /etc/nginx/sites-available/budget
else
  echo "Не найден /tmp/nginx.conf — скопируйте deploy/nginx.conf на сервер." >&2
  exit 1
fi

ln -sf /etc/nginx/sites-available/budget /etc/nginx/sites-enabled/budget
rm -f /etc/nginx/sites-enabled/default

# Пока приложение не выложено, отдаём заглушку, чтобы nginx стартовал.
mkdir -p "$APP_DIR/apps/miniapp/dist"
[[ -f "$APP_DIR/apps/miniapp/dist/index.html" ]] || \
  echo '<!doctype html><meta charset="utf-8"><title>Бюджет</title><p>Приложение ещё не выложено.' \
    > "$APP_DIR/apps/miniapp/dist/index.html"
chown -R budget:budget "$APP_DIR"

nginx -t
systemctl reload nginx

# ---------- systemd ----------
log "Ставлю systemd-юниты"
for unit in budget-api budget-bot; do
  if [[ -f "/tmp/${unit}.service" ]]; then
    install -m 644 "/tmp/${unit}.service" "/etc/systemd/system/${unit}.service"
  else
    echo "Не найден /tmp/${unit}.service — скопируйте deploy/${unit}.service на сервер." >&2
    exit 1
  fi
done
systemctl daemon-reload
systemctl enable budget-api budget-bot >/dev/null

# ---------- Файрвол ----------
log "Настраиваю ufw"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

# ---------- HTTPS ----------
log "Получаю сертификат Let's Encrypt"
# Без email сертификат тоже выпускается: автопродление делает systemd-таймер certbot,
# email нужен только для писем о скором истечении.
if [[ -n "$EMAIL" ]]; then
  CERTBOT_EMAIL_ARG=(-m "$EMAIL")
else
  CERTBOT_EMAIL_ARG=(--register-unsafely-without-email)
fi

certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos "${CERTBOT_EMAIL_ARG[@]}" --redirect || {
  echo "Certbot не смог получить сертификат. Проверьте, что A-запись $DOMAIN указывает на этот сервер," >&2
  echo "и повторите: certbot --nginx -d $DOMAIN" >&2
}

cat <<INFO

Сервер готов.

Дальше — с локальной машины:

  1. Создайте /opt/budget/.env (шаблон: deploy/env.production.example)
  2. Выложите приложение:  ./deploy/deploy.sh root@СЕРВЕР

Полезные команды:
  systemctl status budget-api budget-bot
  journalctl -u budget-api -f
  journalctl -u budget-bot -f

INFO
