#!/usr/bin/env bash
# Chạy trên server khi GitHub Actions SSH vào bằng deploy key (.github/workflows/ci-cd.yml).
# Trong ~/.ssh/authorized_keys, key đó chỉ được chạy: cd ~/MessengerAI && git pull && ./deploy.sh
# stdin là một dòng "<tài khoản GitHub> <token>" để đăng nhập GHCR trong lúc kéo image.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="sudo docker compose -f docker-compose.prod.yml"
APP_SERVICES="backend skyoffice-server skyoffice-client frontend"

read -r GHCR_USER GHCR_TOKEN
echo "$GHCR_TOKEN" | sudo docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
trap 'sudo docker logout ghcr.io >/dev/null' EXIT

$COMPOSE pull $APP_SERVICES
$COMPOSE up -d --remove-orphans
sudo docker image prune -af >/dev/null
$COMPOSE ps --format "table {{.Service}}\t{{.Status}}"
