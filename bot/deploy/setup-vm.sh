#!/usr/bin/env bash
# Installation du bot sur la machine Google Cloud (Debian 12), à lancer UNE fois depuis le terminal SSH :
#   bash ~/tsukuyomi-hub/bot/deploy/setup-vm.sh
# Installe Node.js, les dépendances, demande le jeton Discord, puis lance le bot comme service
# (il redémarre tout seul en cas de plantage et au redémarrage de la machine).
set -euo pipefail

BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE=tsukuyomi-bot

echo "== Mémoire d'appoint (la machine gratuite n'a que 1 Go de RAM)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "== Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version

echo "== Dépendances du bot"
cd "$BOT_DIR"
npm ci --omit=dev

if [ ! -f .env ]; then
  echo "== Réglages (fichier $BOT_DIR/.env, lisible par vous seul)"
  read -rsp "Jeton du bot Discord (rien ne s'affiche pendant la saisie) : " TOKEN; echo
  read -rp "Rôle autorisé à modifier les données [Éditeur HUB] : " ROLE
  read -rp "Salon du build guide [build-guide] : " CHANNEL
  umask 077
  cat > .env <<ENV
DISCORD_TOKEN=$TOKEN
EDITOR_ROLE=${ROLE:-Éditeur HUB}
CHANNEL_BUILD_GUIDE=${CHANNEL:-build-guide}
ENV
  # Pas de clé de compte de service ici : la machine utilise le compte de service qui lui est attaché.
fi

echo "== Service systemd"
sudo tee /etc/systemd/system/$SERVICE.service >/dev/null <<UNIT
[Unit]
Description=Bot Discord Tsukuyomi HUB
After=network-online.target
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$BOT_DIR
ExecStart=$(command -v npm) start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now $SERVICE
sleep 5
sudo systemctl --no-pager status $SERVICE | head -n 12
echo
echo "Installé. Journal en direct : sudo journalctl -u $SERVICE -f"
