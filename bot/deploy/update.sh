#!/usr/bin/env bash
# Mise à jour du bot après un « git push » : à lancer depuis le terminal SSH de la machine.
#   bash ~/tsukuyomi-hub/bot/deploy/update.sh
set -euo pipefail
BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BOT_DIR/.."
git pull --ff-only
cd "$BOT_DIR"
npm ci --omit=dev
sudo systemctl restart tsukuyomi-bot
sleep 5
sudo systemctl --no-pager status tsukuyomi-bot | head -n 12
