#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

APP_DIR="$HOME/hermes-web-app"
ENV_DIR="$HOME/.config/hermes"
ENV_FILE="$ENV_DIR/hermes.env"
SERVICE_DIR="$PREFIX/var/service/hermes-discord"
RUN_FILE="$SERVICE_DIR/run"
LOG_DIR="$HOME/.local/state/hermes"

REPO_URL="${REPO_URL:-https://github.com/natthawutchoe/hermes-web-app.git}"
HERMES_API_URL="${HERMES_API_URL:-https://hermes-web-app-gilt.vercel.app/api/brain-dump}"
DISCORD_APPLICATION_ID="${DISCORD_APPLICATION_ID:-1535945038268334150}"

echo "== Hermes Termux always-on setup =="
echo

pkg update -y
pkg install -y git nodejs termux-services

mkdir -p "$ENV_DIR" "$LOG_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only
fi

cd "$APP_DIR"

if [ ! -f package-lock.json ]; then
  npm install --package-lock-only
fi
npm install

echo
echo "Paste Discord bot token. Input is hidden."
read -r -s -p "DISCORD_TOKEN: " DISCORD_TOKEN
echo
echo "Paste Hermes Cloud app key. Input is hidden."
read -r -s -p "HERMES_APP_KEY: " HERMES_APP_KEY
echo
read -r -p "Optional Discord server ID for instant /hermes command, blank to skip: " DISCORD_GUILD_ID

cat > "$ENV_FILE" <<EOF
export DISCORD_TOKEN='$DISCORD_TOKEN'
export HERMES_APP_KEY='$HERMES_APP_KEY'
export HERMES_API_URL='$HERMES_API_URL'
export DISCORD_APPLICATION_ID='$DISCORD_APPLICATION_ID'
export DISCORD_GUILD_ID='$DISCORD_GUILD_ID'
EOF
chmod 600 "$ENV_FILE"

if [ -n "$DISCORD_GUILD_ID" ]; then
  echo
  echo "Registering /hermes command for server $DISCORD_GUILD_ID..."
  set +u
  . "$ENV_FILE"
  set -u
  node "$APP_DIR/register-discord-command.js"
fi

mkdir -p "$SERVICE_DIR"
cat > "$RUN_FILE" <<EOF
#!/data/data/com.termux/files/usr/bin/sh
exec 2>&1
termux-wake-lock >/dev/null 2>&1 || true
. "$ENV_FILE"
cd "$APP_DIR"
exec node "$APP_DIR/discord-bridge.example.js"
EOF
chmod +x "$RUN_FILE"

sv-enable hermes-discord
sv up hermes-discord || true

echo
echo "Hermes Discord bridge service is installed."
echo "Status: sv status hermes-discord"
echo "Logs: logcat is not used; run sv down/up or test Discord directly."
echo
echo "Important: Android may still kill Termux unless battery optimization is disabled."
echo "Disable battery optimization for Termux in Android Settings."
