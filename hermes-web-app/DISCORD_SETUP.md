# Discord To Hermes Dashboard

This folder now supports a shared local backend:

- Dashboard reads from `GET /api/state`.
- Dashboard writes to `POST /api/state`.
- Discord bridge can send raw text to `POST /api/brain-dump`.
- Shared data is stored in `data/hermes-state.json`.

## Run Hermes API + Dashboard

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\server.ps1 -Port 4181
```

Open:

```text
http://127.0.0.1:4181/
```

## Test Discord-Style Input Without Discord

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:4181/api/brain-dump `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"text":"FIN301 มีงานกลุ่มส่งศุกร์หน้า ต้องทำ slide ยังไม่ได้เริ่ม","source":"manual-test"}'
```

The dashboard refreshes from the API every 4 seconds.

## Connect An Existing Discord Bot

Use `discord-bridge.example.js` as the bridge. It expects:

- `DISCORD_TOKEN`: your bot token.
- `HERMES_API_URL`: defaults to `http://127.0.0.1:4181/api/brain-dump`.
- `DISCORD_CHANNEL_ID`: optional, restricts capture to one channel.

The example captures messages that start with:

```text
hermes FIN301 มีงานส่งศุกร์หน้า
```

or DMs sent to the bot.

Do not commit your Discord token to GitHub.

## Windows PowerShell Bridge

If Node.js is not installed, use the PowerShell bridge:

```powershell
$env:DISCORD_TOKEN = "paste_your_bot_token_here"
powershell -NoProfile -ExecutionPolicy Bypass -File .\discord-bridge.ps1 -HermesApiUrl "http://127.0.0.1:4183/api/brain-dump"
```

Optional: restrict capture to one Discord channel:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\discord-bridge.ps1 -DiscordChannelId "your_channel_id"
```

Messages must start with:

```text
hermes FIN301 มีงานกลุ่มส่งศุกร์หน้า ต้องทำ slide ยังไม่ได้เริ่ม
```

Recommended daily-use mode:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\discord-bridge.ps1 -ReplyMode short
```

Discord replies only:

```text
บันทึกแล้ว ดูใน Dashboard
```

Use Discord for capture and the Dashboard/Codex Hermes Agent for planning.

Other reply modes:

```powershell
# No Discord reply, dashboard only
powershell -NoProfile -ExecutionPolicy Bypass -File .\discord-bridge.ps1 -ReplyMode silent

# More detailed Discord confirmation
powershell -NoProfile -ExecutionPolicy Bypass -File .\discord-bridge.ps1 -ReplyMode detail
```
