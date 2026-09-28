#!/usr/bin/env bash

set -euo pipefail

HOST="${1:-}"
APP_DIR=/opt/budget

if [[ -z "$HOST" ]]; then
  echo "Использование: ./deploy/deploy.sh user@сервер" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

log "Проверяю типы и тесты"
npm run typecheck
npm run build --workspace=@budget/shared
npm test

log "Собираю"
npm run build

for artifact in packages/shared/dist/index.js apps/api/dist/index.js apps/bot/dist/index.js apps/miniapp/dist/index.html; do
  [[ -f "$artifact" ]] || { echo "Нет артефакта: $artifact" >&2; exit 1; }
done

log "Заливаю на $HOST"

ssh "$HOST" "mkdir -p $APP_DIR/{scripts,packages/shared,apps/api/prisma,apps/bot,apps/miniapp}"

rsync -az package.json package-lock.json "$HOST:$APP_DIR/"

rsync -az --delete scripts/ "$HOST:$APP_DIR/scripts/"

rsync -az packages/shared/package.json "$HOST:$APP_DIR/packages/shared/"
rsync -az --delete packages/shared/dist/ "$HOST:$APP_DIR/packages/shared/dist/"

rsync -az apps/api/package.json "$HOST:$APP_DIR/apps/api/"
rsync -az apps/api/prisma/schema.prisma "$HOST:$APP_DIR/apps/api/prisma/"
rsync -az --delete apps/api/dist/ "$HOST:$APP_DIR/apps/api/dist/"

rsync -az apps/bot/package.json "$HOST:$APP_DIR/apps/bot/"
rsync -az --delete apps/bot/dist/ "$HOST:$APP_DIR/apps/bot/dist/"

rsync -az --delete apps/miniapp/dist/ "$HOST:$APP_DIR/apps/miniapp/dist/"

log "Ставлю зависимости и применяю схему БД"
ssh "$HOST" bash -euo pipefail <<REMOTE
cd $APP_DIR

if [[ ! -f .env ]]; then
  echo "Нет $APP_DIR/.env — скопируйте deploy/env.production.example и заполните." >&2
  exit 1
fi

npm ci --omit=dev --no-audit --no-fund

./node_modules/.bin/prisma generate --schema=apps/api/prisma/schema.prisma
./node_modules/.bin/prisma db push --schema=apps/api/prisma/schema.prisma --skip-generate --accept-data-loss

chown -R budget:budget $APP_DIR
chown -R budget:budget /var/lib/budget

systemctl restart budget-api
sleep 3
systemctl restart budget-bot
REMOTE

log "Проверяю, что поднялось"
ssh "$HOST" bash -euo pipefail <<'REMOTE'
sleep 2
for unit in budget-api budget-bot; do
  state=$(systemctl is-active "$unit" || true)
  printf '  %-12s %s\n' "$unit" "$state"
done
printf '  health       %s\n' "$(curl -s --max-time 5 http://127.0.0.1:3000/health || echo 'нет ответа')"
REMOTE

log "Готово"
echo "Логи:  ssh $HOST journalctl -u budget-api -u budget-bot -f"
