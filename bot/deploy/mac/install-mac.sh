#!/usr/bin/env bash
# Lance le bot automatiquement sur ce Mac : au démarrage de la session, relancé s'il s'arrête,
# et le Mac ne se met pas en veille tant qu'il tourne et qu'il est branché.
#   bash bot/deploy/mac/install-mac.sh      (à relancer sans risque après un changement de chemin de Node)
set -euo pipefail

LABEL=com.tsukuyomi.bot
BOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
NPM="$(command -v npm)"
NODE_DIR="$(dirname "$(command -v node)")"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/tsukuyomi-bot.log"

[ -f "$BOT_DIR/.env" ] || { echo "Fichier $BOT_DIR/.env introuvable (jeton Discord, clé Firebase)."; exit 1; }

[ -d "$BOT_DIR/node_modules" ] || (cd "$BOT_DIR" && npm install --no-audit --no-fund)

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <!-- caffeinate -is : pas de veille automatique tant que le bot tourne (sur secteur pour -s). -->
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string><string>-is</string>
    <string>$NPM</string><string>start</string>
  </array>
  <key>WorkingDirectory</key><string>$BOT_DIR</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$NODE_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST

echo "== Démarrage"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 8
tail -n 5 "$LOG"
echo
echo "Installé. Journal : tail -f $LOG"
