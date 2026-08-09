param(
  [int]$Port = 4181
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $root "data"
$statePath = Join-Path $dataDir "hermes-state.json"

if (-not (Test-Path -LiteralPath $dataDir)) {
  New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
}

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".svg" = "image/svg+xml; charset=utf-8"
}

function Get-DefaultState {
  return [ordered]@{
    settings = [ordered]@{
      hourTarget = 3
      riskWindow = 3
    }
    weekOffset = 0
    courses = @(
      [ordered]@{ id = "c-01132326-65"; code = "01132326-65"; name = "Organization Development"; color = "amber" },
      [ordered]@{ id = "c-03521101-67"; code = "03521101-67"; name = "Sea and Life"; color = "amber" },
      [ordered]@{ id = "c-01132417-65"; code = "01132417-65"; name = "Sustainability Management"; color = "amber" },
      [ordered]@{ id = "c-01132333-65"; code = "01132333-65"; name = "Business Information Systems"; color = "green" },
      [ordered]@{ id = "c-03754221-67"; code = "03754221-67"; name = "Basic English Pronunciation"; color = "green" },
      [ordered]@{ id = "c-01132332-65"; code = "01132332-65"; name = "Quantitative Analysis for Decision Making"; color = "blue" },
      [ordered]@{ id = "c-01362101-67"; code = "01362101-67"; name = "Chinese I"; color = "blue" }
    )
    classes = @(
      [ordered]@{ id = "class-org-dev-tue"; day = "Tue"; dayIndex = 2; start = "13:00"; end = "16:00"; courseCode = "01132326-65"; title = "Organization Development"; room = "10212"; section = "800" },
      [ordered]@{ id = "class-sea-life-wed"; day = "Wed"; dayIndex = 3; start = "09:00"; end = "12:00"; courseCode = "03521101-67"; title = "Sea and Life"; room = "17402"; section = "800" },
      [ordered]@{ id = "class-sustainability-wed"; day = "Wed"; dayIndex = 3; start = "13:00"; end = "16:00"; courseCode = "01132417-65"; title = "Sustainability Management"; room = "27603"; section = "800" },
      [ordered]@{ id = "class-bis-thu"; day = "Thu"; dayIndex = 4; start = "09:00"; end = "12:00"; courseCode = "01132333-65"; title = "Business Information Systems"; room = "27501"; section = "800" },
      [ordered]@{ id = "class-english-thu"; day = "Thu"; dayIndex = 4; start = "13:00"; end = "16:00"; courseCode = "03754221-67"; title = "Basic English Pronunciation"; room = "10207"; section = "800" },
      [ordered]@{ id = "class-quant-fri"; day = "Fri"; dayIndex = 5; start = "09:00"; end = "12:00"; courseCode = "01132332-65"; title = "Quantitative Analysis for Decision Making"; room = "17303"; section = "800" },
      [ordered]@{ id = "class-chinese-fri"; day = "Fri"; dayIndex = 5; start = "13:00"; end = "16:00"; courseCode = "01362101-67"; title = "Chinese I"; room = "17205"; section = "801" }
    )
    tasks = @()
    chat = @(
      [ordered]@{ role = "hermes"; text = "บอกผมแบบรก ๆ ได้เลย เช่น วิชาอะไร มีงานอะไร ส่งเมื่อไหร่ และตอนนี้เริ่มหรือยัง เดี๋ยวผมจัดเป็นแผนให้" }
    )
  }
}

function Read-State {
  if (-not (Test-Path -LiteralPath $statePath)) {
    $default = Get-DefaultState
    Write-State $default
    return $default
  }

  $raw = Get-Content -Encoding UTF8 -LiteralPath $statePath -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return Get-DefaultState
  }
  return $raw | ConvertFrom-Json
}

function Write-State($state) {
  $json = $state | ConvertTo-Json -Depth 16
  Set-Content -Encoding UTF8 -LiteralPath $statePath -Value $json
}

function Send-Json($context, $payload, [int]$status = 200) {
  $context.Response.StatusCode = $status
  $context.Response.ContentType = "application/json; charset=utf-8"
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 16))
  $context.Response.ContentLength64 = $bytes.Length
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Read-BodyJson($context) {
  $reader = [System.IO.StreamReader]::new($context.Request.InputStream, $context.Request.ContentEncoding)
  $body = $reader.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($body)) {
    return $null
  }
  return $body | ConvertFrom-Json
}

function Days-FromNow([int]$days) {
  return (Get-Date).Date.AddDays($days).AddHours(12)
}

function Parse-DateLoose([string]$text) {
  $now = (Get-Date).Date.AddHours(12)
  $lower = $text.ToLowerInvariant()

  if ($text -match "วันนี้|today") { return $now }
  if ($text -match "พรุ่งนี้|tomorrow") { return $now.AddDays(1) }
  if ($text -match "มะรืน|day after tomorrow") { return $now.AddDays(2) }

  $dayMap = @(
    @{ label = "จันทร์"; day = 1 },
    @{ label = "monday"; day = 1 },
    @{ label = "อังคาร"; day = 2 },
    @{ label = "tuesday"; day = 2 },
    @{ label = "พุธ"; day = 3 },
    @{ label = "wednesday"; day = 3 },
    @{ label = "พฤหัส"; day = 4 },
    @{ label = "thursday"; day = 4 },
    @{ label = "ศุกร์"; day = 5 },
    @{ label = "friday"; day = 5 },
    @{ label = "เสาร์"; day = 6 },
    @{ label = "saturday"; day = 6 },
    @{ label = "อาทิตย์"; day = 0 },
    @{ label = "sunday"; day = 0 }
  )

  foreach ($entry in $dayMap) {
    if ($lower.Contains($entry.label)) {
      $diff = [int]$entry.day - [int]$now.DayOfWeek
      if ($diff -le 0) { $diff += 7 }
      return $now.AddDays($diff)
    }
  }

  $iso = [regex]::Match($text, "\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b")
  if ($iso.Success) {
    return Get-Date -Year ([int]$iso.Groups[1].Value) -Month ([int]$iso.Groups[2].Value) -Day ([int]$iso.Groups[3].Value) -Hour 12
  }

  $short = [regex]::Match($text, "\b(\d{1,2})[/-](\d{1,2})\b")
  if ($short.Success) {
    return Get-Date -Year $now.Year -Month ([int]$short.Groups[2].Value) -Day ([int]$short.Groups[1].Value) -Hour 12
  }

  return $now.AddDays(3)
}

function Ensure-Course($state, [string]$courseCode) {
  foreach ($course in @($state.courses)) {
    if ($course.code -eq $courseCode) { return }
  }
  $aliasName = Get-CourseAliasName $courseCode
  $state.courses += [ordered]@{
    id = "course-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    code = $courseCode
    name = $(if ($aliasName) { $aliasName } elseif ($courseCode -eq "GEN000") { "General Academic Inbox" } else { $courseCode })
    color = "dark"
  }
}

function Get-CourseAliases {
  return @(
    @{ code = "01132326-65"; name = "Organization Development"; terms = @("organization development", "org dev", "องค์การ", "พัฒนาองค์การ") },
    @{ code = "03521101-67"; name = "Sea and Life"; terms = @("sea and life", "ทะเล", "ชีวิตกับทะเล") },
    @{ code = "01132417-65"; name = "Sustainability Management"; terms = @("sustainability", "sustainability management", "ความยั่งยืน") },
    @{ code = "01132333-65"; name = "Business Information Systems"; terms = @("bis", "business information systems", "database", "ระบบสารสนเทศ", "ฐานข้อมูล") },
    @{ code = "03754221-67"; name = "Basic English Pronunciation"; terms = @("english pronunciation", "pronunciation", "อังกฤษ", "การออกเสียง") },
    @{ code = "01132332-65"; name = "Quantitative Analysis for Decision Making"; terms = @("quantitative", "decision making", "quant", "วิเคราะห์เชิงปริมาณ") },
    @{ code = "01362101-67"; name = "Chinese I"; terms = @("chinese", "จีน") },
    @{ code = "FIN000"; name = "Finance"; terms = @("finance", "financial", "ไฟแนนซ์", "การเงิน") },
    @{ code = "ACC000"; name = "Accounting"; terms = @("accounting", "account", "บัญชี") },
    @{ code = "MKT000"; name = "Marketing"; terms = @("marketing", "market", "การตลาด") },
    @{ code = "BIS000"; name = "Business Information Systems"; terms = @("bis", "database", "ระบบสารสนเทศ", "ฐานข้อมูล") },
    @{ code = "ECO000"; name = "Economics"; terms = @("economics", "economic", "econ", "เศรษฐศาสตร์") },
    @{ code = "STA000"; name = "Statistics"; terms = @("statistics", "stats", "stat", "สถิติ") },
    @{ code = "MAT000"; name = "Mathematics"; terms = @("math", "mathematics", "คณิต") },
    @{ code = "ENG000"; name = "English"; terms = @("english", "อังกฤษ") },
    @{ code = "MGT000"; name = "Management"; terms = @("management", "การจัดการ") },
    @{ code = "LAW000"; name = "Law"; terms = @("law", "กฎหมาย") }
  )
}

function Get-CourseAliasName([string]$courseCode) {
  foreach ($alias in Get-CourseAliases) {
    if ($alias.code -eq $courseCode) { return $alias.name }
  }
  return $null
}

function Extract-Course($state, [string]$text) {
  $upper = $text.ToUpperInvariant()
  $kuCode = [regex]::Match($text, "\b\d{8}-\d{2}\b")
  if ($kuCode.Success) {
    return $kuCode.Value
  }

  $codeMatch = [regex]::Match($upper, "\b[A-Z]{2,4}\s?\d{2,4}\b")
  if ($codeMatch.Success) {
    return ($codeMatch.Value -replace "\s+", "")
  }

  foreach ($course in @($state.courses)) {
    if ($upper.Contains($course.code) -or $upper.Contains($course.name.ToUpperInvariant())) {
      return $course.code
    }
  }

  $lower = $text.ToLowerInvariant()
  foreach ($alias in Get-CourseAliases) {
    foreach ($term in $alias.terms) {
      if ($lower.Contains($term.ToLowerInvariant())) { return $alias.code }
    }
  }

  $namedCourse = [regex]::Match($text, "(?:วิชา|class|course)\s*([^\s,，:：]+(?:\s+[^\s,，:：]+)?)", "IgnoreCase")
  if ($namedCourse.Success) {
    $name = $namedCourse.Groups[1].Value.Trim()
    return (($name.ToUpperInvariant() -replace "\s+", "-").Substring(0, [Math]::Min(12, $name.Length)))
  }

  foreach ($hint in @("FIN", "MKT", "BIS", "ACC", "BUS", "ENG", "ECO", "MAT", "STA", "IS")) {
    if ($upper.Contains($hint)) { return "$hint`000" }
  }

  return "GEN000"
}

function Extract-Title([string]$text, [string]$courseCode) {
  $cleaned = $text.Replace($courseCode, "")
  $cleaned = [regex]::Replace($cleaned, "(?:วิชา|class|course)\s*[^\s,，:：]+(?:\s+[^\s,，:：]+)?", " ", "IgnoreCase")
  $cleaned = [regex]::Replace($cleaned, "(วิชา|class|course|มี|ส่ง|due|deadline|ต้อง|ทำ|ยังไม่ได้เริ่ม|not started)", " ", "IgnoreCase")
  $cleaned = [regex]::Replace($cleaned, "\s+", " ").Trim()
  if ([string]::IsNullOrWhiteSpace($cleaned)) { return "Review and organize course task" }
  if ($cleaned.Length -gt 72) { return "$($cleaned.Substring(0, 69))..." }
  return $cleaned
}

function Infer-Priority([datetime]$dueDate, [string]$text, $state) {
  $days = [math]::Ceiling(($dueDate.Date - (Get-Date).Date).TotalDays)
  if ($text -match "ด่วน|urgent|ยังไม่ได้เริ่ม|not started|สอบ|exam|quiz" -or $days -le 1) {
    return "high"
  }
  if ($days -le [int]$state.settings.riskWindow) {
    return "medium"
  }
  return "low"
}

function New-TaskFromText($state, [string]$text, [string]$source = "discord") {
  $courseCode = Extract-Course $state $text
  Ensure-Course $state $courseCode
  $dueDate = Parse-DateLoose $text
  $priority = Infer-Priority $dueDate $text $state
  $status = "not-started"
  if ($text -match "เสร็จ|done|finished") { $status = "done" }
  elseif ($text -match "ยังไม่ได้เริ่ม|not started") { $status = "not-started" }
  elseif ($text -match "เริ่ม|started|กำลัง") { $status = "in-progress" }

  return [ordered]@{
    id = "task-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    courseCode = $courseCode
    title = Extract-Title $text $courseCode
    due = $dueDate.ToString("yyyy-MM-dd")
    status = $status
    estimate = $(if ($priority -eq "high") { 45 } else { 35 })
    priority = $priority
    source = $source
  }
}

function Handle-Api($context) {
  $path = $context.Request.Url.AbsolutePath
  $method = $context.Request.HttpMethod

  if ($method -eq "OPTIONS") {
    $context.Response.StatusCode = 204
    return $true
  }

  if ($path -eq "/api/state" -and $method -eq "GET") {
    Send-Json $context (Read-State)
    return $true
  }

  if ($path -eq "/api/state" -and $method -eq "POST") {
    $body = Read-BodyJson $context
    if ($null -eq $body) {
      Send-Json $context @{ error = "Missing JSON body" } 400
      return $true
    }
    Write-State $body
    Send-Json $context @{ ok = $true; state = $body }
    return $true
  }

  if ($path -eq "/api/brain-dump" -and $method -eq "POST") {
    $body = Read-BodyJson $context
    if ($null -eq $body -or [string]::IsNullOrWhiteSpace($body.text)) {
      Send-Json $context @{ error = "Missing text" } 400
      return $true
    }

    $state = Read-State
    $source = $(if ($body.source) { [string]$body.source } else { "discord" })
    $task = New-TaskFromText $state ([string]$body.text) $source
    $state.tasks += $task
    $state.chat += [ordered]@{ role = "user"; text = [string]$body.text }
    $state.chat += [ordered]@{
      role = "hermes"
      text = "ผมจับจาก $source ได้ว่าเป็น $($task.courseCode): $($task.title) ส่ง $($task.due) และเพิ่มเข้า Dashboard แล้ว"
    }
    Write-State $state
    Send-Json $context @{ ok = $true; task = $task; state = $state }
    return $true
  }

  return $false
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Hermes server running on http://127.0.0.1:$Port/"

while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    $context.Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $context.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $context.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

    if (Handle-Api $context) {
      continue
    }

    $path = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }
    $relative = $path.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
    $file = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relative))

    if (-not $file.StartsWith($root)) {
      $context.Response.StatusCode = 403
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
    } elseif (Test-Path -LiteralPath $file -PathType Leaf) {
      $extension = [System.IO.Path]::GetExtension($file)
      $context.Response.ContentType = $mime[$extension]
      if (-not $context.Response.ContentType) {
        $context.Response.ContentType = "application/octet-stream"
      }
      $bytes = [System.IO.File]::ReadAllBytes($file)
    } else {
      $context.Response.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
    }

    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    if ($context.Response.OutputStream.CanWrite) {
      Send-Json $context @{ error = $_.Exception.Message } 500
    }
  } finally {
    $context.Response.OutputStream.Close()
  }
}



