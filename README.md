# Hermes University Agent

Mobile-first personal university dashboard with Discord capture, class schedule, deadlines, and cloud sync.

## Current State

- iPhone-style dashboard UI
- Real class schedule for this term
- Inbox for Thai/English brain dumps
- Deadline extraction from rough text
- Local PowerShell server for offline/local use
- Vercel-ready API routes
- Supabase `hermes_state` table migration
- Discord bridge with optional cloud app key

## Local Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\server.ps1 -Port 4183
```

Open:

```text
http://127.0.0.1:4183/
```

## Supabase

Run `supabase.sql` in the Supabase SQL Editor. It creates:

```text
public.hermes_state
```

RLS is enabled, but no public read/write policy is created. The deployed API must use `SUPABASE_SERVICE_ROLE_KEY` on the server side.

## Vercel Environment

Set these in Vercel Project Settings:

```text
SUPABASE_URL=https://ogwntqeykvzgybwybkpr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
HERMES_APP_KEY=your-long-private-random-string
```

Then open the deployed Hermes app, go to Settings, and paste the same `HERMES_APP_KEY` into `Cloud app key`.

## Discord Cloud Sync

```powershell
$env:DISCORD_TOKEN = "your-discord-bot-token"
$env:HERMES_APP_KEY = "same-long-private-random-string"
powershell -NoProfile -ExecutionPolicy Bypass -File .\discord-bridge.ps1 -HermesApiUrl "https://your-app.vercel.app/api/brain-dump" -ReplyMode silent
```

## Discord Slash Command

This is the recommended daily setup because it does not require Termux, Windows, or a Gateway bridge to stay online.

Set this in Vercel Project Settings:

```text
DISCORD_PUBLIC_KEY=your-discord-application-public-key
```

In Discord Developer Portal, set the Interactions Endpoint URL to:

```text
https://hermes-web-app-gilt.vercel.app/api/discord
```

Then register the `/hermes` command once:

```powershell
$env:DISCORD_TOKEN = "your-discord-bot-token"
$env:DISCORD_APPLICATION_ID = "your-discord-application-id"
$env:DISCORD_GUILD_ID = "optional-test-server-id"
node .\register-discord-command.js
```

Use it in Discord:

```text
/hermes text: FIN301 ส่ง slide วันพุธหน้า
```

## Recommended Launch Order

1. Run `supabase.sql` in Supabase.
2. Push this folder to GitHub branch `app`.
3. Import the GitHub repo into Vercel.
4. Set the three Vercel environment variables.
5. Deploy.
6. Open on iPhone Safari and use Share -> Add to Home Screen.
