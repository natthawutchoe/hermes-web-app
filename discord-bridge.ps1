param(
  [string]$HermesApiUrl = "http://127.0.0.1:4183/api/brain-dump",
  [string]$HermesAppKey = $env:HERMES_APP_KEY,
  [string]$CapturePrefix = "hermes",
  [string]$DiscordChannelId = "",
  [string]$ReplyMode = "short",
  [switch]$NoReply
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:DISCORD_TOKEN)) {
  throw "Missing DISCORD_TOKEN. Set it first, for example: `$env:DISCORD_TOKEN = 'your_bot_token'"
}

$token = $env:DISCORD_TOKEN
$gatewayUrl = "wss://gateway.discord.gg/?v=10&encoding=json"
$script:sequence = $null
$script:heartbeatTimer = $null

function ConvertTo-CompactJson($value) {
  return $value | ConvertTo-Json -Depth 20 -Compress
}

function Send-DiscordGatewayMessage($socket, $payload) {
  $json = ConvertTo-CompactJson $payload
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $segment = [ArraySegment[byte]]::new($bytes)
  $socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
}

function Receive-DiscordGatewayMessage($socket) {
  $buffer = New-Object byte[] 65536
  $stream = [System.IO.MemoryStream]::new()

  do {
    $segment = [ArraySegment[byte]]::new($buffer)
    $result = $socket.ReceiveAsync($segment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
      Write-Warning "Discord Gateway closed connection: $($socket.CloseStatus) $($socket.CloseStatusDescription)"
      return $null
    }
    $stream.Write($buffer, 0, $result.Count)
  } while (-not $result.EndOfMessage)

  return [System.Text.Encoding]::UTF8.GetString($stream.ToArray())
}

function Send-DiscordReply($channelId, $content) {
  if ($NoReply) {
    return "skipped"
  }
  $body = @{ content = $content } | ConvertTo-Json -Compress
  try {
    Invoke-RestMethod `
      -Uri "https://discord.com/api/v10/channels/$channelId/messages" `
      -Method Post `
      -Headers @{ Authorization = "Bot $token" } `
      -ContentType "application/json; charset=utf-8" `
      -Body $body | Out-Null
    return "sent"
  } catch {
    Write-Warning "Synced to Hermes, but could not reply in Discord. Check Send Messages permission for this channel."
    Write-Warning $_.Exception.Message
    return "failed"
  }
}

function Send-BrainDumpToHermes($text, $source) {
  $body = @{
    text = $text
    source = $source
  } | ConvertTo-Json -Compress
  $headers = @{}
  if (-not [string]::IsNullOrWhiteSpace($HermesAppKey)) {
    $headers["x-hermes-key"] = $HermesAppKey
  }

  return Invoke-RestMethod `
    -Uri $HermesApiUrl `
    -Method Post `
    -Headers $headers `
    -ContentType "application/json; charset=utf-8" `
    -Body $body
}

Add-Type -AssemblyName System.Net.Http
$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$socket.ConnectAsync([Uri]$gatewayUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

Write-Host "Connected to Discord Gateway."

while ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
  $raw = Receive-DiscordGatewayMessage $socket
  if ($null -eq $raw) { break }

  $packet = $raw | ConvertFrom-Json
  if ($packet.s -ne $null) {
    $script:sequence = $packet.s
  }

  switch ([int]$packet.op) {
    10 {
      $interval = [int]$packet.d.heartbeat_interval
      $script:heartbeatTimer = [System.Threading.Timer]::new(
        [System.Threading.TimerCallback]{
          param($state)
          try {
            $heartbeat = @{ op = 1; d = $script:sequence }
            Send-DiscordGatewayMessage $state $heartbeat
          } catch {
            Write-Warning "Heartbeat failed: $($_.Exception.Message)"
          }
        },
        $socket,
        $interval,
        $interval
      )

      $intents = 1 + 512 + 4096 + 32768
      $identify = @{
        op = 2
        d = @{
          token = $token
          intents = $intents
          properties = @{
            '$os' = "windows"
            '$browser' = "hermes-dashboard-bridge"
            '$device' = "hermes-dashboard-bridge"
          }
        }
      }

      Send-DiscordGatewayMessage $socket $identify
      Write-Host "Identified as Hermes Discord bridge. Waiting for messages that start with '$CapturePrefix '."
    }

    0 {
      if ($packet.t -ne "MESSAGE_CREATE") { continue }

      $message = $packet.d
      if ($message.author.bot) { continue }
      if (-not [string]::IsNullOrWhiteSpace($DiscordChannelId) -and $message.channel_id -ne $DiscordChannelId) { continue }

      $content = [string]$message.content
      $prefixPattern = "^\s*$([regex]::Escape($CapturePrefix))\s+"
      if ($content -notmatch $prefixPattern) { continue }

      $brainDump = [regex]::Replace($content, $prefixPattern, "", "IgnoreCase").Trim()
      if ([string]::IsNullOrWhiteSpace($brainDump)) { continue }

      try {
        $source = "discord:$($message.channel_id)"
        $result = Send-BrainDumpToHermes $brainDump $source
        $task = $result.task
        if ($ReplyMode -eq "silent") {
          $replyStatus = "skipped"
          Write-Host "Added to Hermes: $($task.courseCode) - $($task.title) ($($task.due)) [Discord reply: skipped]"
          continue
        }

        if ($ReplyMode -eq "detail") {
          $reply = "Added to Hermes: $($task.courseCode) - $($task.title) ($($task.due))"
        } else {
          $reply = "Saved to Hermes. See Dashboard."
        }
        $replyStatus = Send-DiscordReply $message.channel_id $reply
        Write-Host "$reply [Discord reply: $replyStatus]"
      } catch {
        Write-Warning "Could not sync Discord message to Hermes: $($_.Exception.Message)"
        Send-DiscordReply $message.channel_id "Hermes saw it, but could not sync it to the dashboard yet."
      }
    }
  }
}

if ($script:heartbeatTimer) {
  $script:heartbeatTimer.Dispose()
}

Write-Host "Discord Gateway connection closed."
