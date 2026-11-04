#!/usr/bin/env bash
# Arrête le bot et retire son lancement automatique sur ce Mac.
set -euo pipefail
LABEL=com.tsukuyomi.bot
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Bot arrêté et lancement automatique retiré."
