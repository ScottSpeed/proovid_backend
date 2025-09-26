#!/usr/bin/env bash
set -euo pipefail

# install-config.sh
# Installs a local config file to /etc/proov/config.json
# Usage: sudo ./install-config.sh [path/to/config.json]

SRC="${1:-./config.json}"
DST_DIR="/etc/proov"
DST="$DST_DIR/config.json"

if [ ! -f "$SRC" ]; then
  echo "Source config not found: $SRC"
  exit 1
fi

echo "Installing $SRC -> $DST"
sudo mkdir -p "$DST_DIR"
sudo cp "$SRC" "$DST"
sudo chown root:root "$DST"
sudo chmod 0644 "$DST"

echo "Installed. You can override with CONFIG_FILE=/path/to/file when starting the app."
