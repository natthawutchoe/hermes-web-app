#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

APP_DIR="$HOME/hermes-web-app"
ENV_FILE="$HOME/.config/hermes/hermes.env"
REMINDER="$APP_DIR/termux/hermes-reminder.js"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Run install-hermes-service.sh first."
  exit 1
fi

if [ ! -f "$REMINDER" ]; then
  echo "Missing $REMINDER. Pull the latest Hermes repo first."
  exit 1
fi

pkg install -y cronie

if ! grep -q "DISCORD_CHANNEL_ID=" "$ENV_FILE"; then
  echo
  read -r -p "Discord channel ID for reminders: " DISCORD_CHANNEL_ID
  echo "export DISCORD_CHANNEL_ID='$DISCORD_CHANNEL_ID'" >> "$ENV_FILE"
fi

if ! grep -q "HERMES_STATE_URL=" "$ENV_FILE"; then
  echo "export HERMES_STATE_URL='https://hermes-web-app-gilt.vercel.app/api/state'" >> "$ENV_FILE"
fi

if ! grep -q "HERMES_REMIND_DAYS=" "$ENV_FILE"; then
  echo "export HERMES_REMIND_DAYS='3'" >> "$ENV_FILE"
fi

mkdir -p "$PREFIX/var/service/crond"
cat > "$PREFIX/var/service/crond/run" <<EOF
#!/data/data/com.termux/files/usr/bin/sh
exec 2>&1
exec crond -f
EOF
chmod +x "$PREFIX/var/service/crond/run"

if [ -f "$PREFIX/etc/profile.d/start-services.sh" ]; then
  set +u
  . "$PREFIX/etc/profile.d/start-services.sh"
  set -u
fi

sv-enable crond >/dev/null 2>&1 || true
sv up crond >/dev/null 2>&1 || true

TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null | grep -v "hermes-reminder.js" > "$TMP_CRON" || true
cat >> "$TMP_CRON" <<EOF
0 8,18 * * * . "$ENV_FILE"; cd "$APP_DIR"; node "$REMINDER" >> "$HOME/.local/state/hermes/reminder.log" 2>&1
EOF
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

echo "Hermes reminders installed."
echo "They run every day at 08:00 and 18:00."
echo "Test now:"
echo ". \"$ENV_FILE\"; cd \"$APP_DIR\"; node \"$REMINDER\""
