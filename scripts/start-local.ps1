[CmdletBinding()]
param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin', [ValidateRange(1024, 65535)][int]$PostgresPort = 5433,
  [ValidateSet('ticket_management', 'ticket_management_backup_257c1ed7')][string]$LocalDatabase = 'ticket_management',
  [switch]$UseLocalWiseWorkDirectory, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskServer = Join-Path $taskRoot 'server'
$taskClient = Join-Path $taskRoot 'client'
$taskRuntime = Join-Path $taskRoot '.local'
$taskEnvFile = Join-Path $taskServer '.env'
if (!(Test-Path -LiteralPath $taskEnvFile)) { throw 'Missing server/.env. Configure local development first.' }

# Read values as text, never execute environment-file contents.
$taskConfig = @{}
foreach ($taskLine in Get-Content -LiteralPath $taskEnvFile) {
  if ($taskLine -match '^([A-Z_]+)=(.*)$') { $taskConfig[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'") }
}
foreach ($taskKey in @('DATABASE_URL', 'TEST_DATABASE_URL')) {
  $taskUri = [Uri]$taskConfig[$taskKey]
  if (!$taskUri.IsAbsoluteUri -or $taskUri.Host -notin @('localhost', '127.0.0.1', '[::1]')) { throw "$taskKey must point to localhost. Remote database access is blocked." }
  if ($PSBoundParameters.ContainsKey('PostgresPort')) {
    $taskConnection = [UriBuilder]::new($taskUri)
    $taskConnection.Host = '127.0.0.1'
    $taskConnection.Port = $PostgresPort
    $taskConfig[$taskKey] = $taskConnection.Uri.AbsoluteUri
  }
}
if (([Uri]$taskConfig['DATABASE_URL']).AbsolutePath -ne '/ticket_management') { throw 'The base configuration must point to the local ticket_management database.' }
$taskLocalConnection = [UriBuilder]::new([Uri]$taskConfig['DATABASE_URL'])
$taskLocalConnection.Path = $LocalDatabase
$taskConfig['DATABASE_URL'] = $taskLocalConnection.Uri.AbsoluteUri
if (([Uri]$taskConfig['DATABASE_URL']).Port -ne $PostgresPort) { throw "The configured database port must match local PostgreSQL port $PostgresPort." }
if (!$taskConfig['ADMIN_EMAIL'] -or !$taskConfig['ADMIN_PASSWORD']) { throw 'Local admin credentials must be configured in server/.env.' }

# Pin the child processes to local config, even if this shell inherited other credentials.
foreach ($taskKey in $taskConfig.Keys) { [Environment]::SetEnvironmentVariable($taskKey, $taskConfig[$taskKey], 'Process') }
$env:LOCAL_DEVELOPMENT_ONLY = 'true'
$env:LOCAL_WISEWORK_DIRECTORY = ''
$env:LOCAL_WISEWORK_CLIENTS = ''
if ($UseLocalWiseWorkDirectory) {
  $taskDirectory = Join-Path $taskRuntime 'wisework-active-employees.json'
  if (!(Test-Path -LiteralPath $taskDirectory -PathType Leaf)) { throw 'Local WiseWork employee snapshot is missing.' }
  $env:LOCAL_WISEWORK_DIRECTORY = $taskDirectory
  $taskClients = Join-Path $taskRuntime 'wisework-active-clients.json'
  if (Test-Path -LiteralPath $taskClients -PathType Leaf) { $env:LOCAL_WISEWORK_CLIENTS = $taskClients }
}
$env:NODE_ENV = 'development'
$env:PORT = '4000'
$env:BETTER_AUTH_URL = 'http://localhost:4000'
$env:CLIENT_URL = 'http://localhost:5173'
$env:VITE_API_URL = 'http://localhost:5173'
$env:PROXY_TARGET = 'http://127.0.0.1:4000'
foreach ($taskKey in @('HRMS_API_URL','HRMS_API_EMAIL','HRMS_API_PASSWORD','GMAIL_USER','GMAIL_APP_PASSWORD','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN','GMAIL_PUBSUB_TOPIC','GMAIL_PUBSUB_SECRET','WISEWORK_NOTIFICATION_URL','WISEWORK_NOTIFICATION_API_KEY','MOONSHOT_API_KEY','SENTRY_DSN','VITE_SENTRY_DSN')) {
  # An empty inherited value prevents Bun from filling these from another environment file.
  [Environment]::SetEnvironmentVariable($taskKey, '', 'Process')
}

$taskPgCtl = Join-Path $PostgresBin 'pg_ctl.exe'
$taskData = Join-Path $taskRuntime 'postgres'
if (!(Test-Path -LiteralPath $taskPgCtl) -or !(Test-Path -LiteralPath (Join-Path $taskData 'PG_VERSION'))) { throw 'PostgreSQL or the project-owned local cluster is missing. See docs/support-platform-local-upgrade.md.' }
& $taskPgCtl -D $taskData status *> $null
if ($LASTEXITCODE -ne 0) {
  $taskPgLog = Join-Path $taskRuntime "postgres-$PostgresPort.log"
  & $taskPgCtl -D $taskData -l $taskPgLog -o "-h 127.0.0.1 -p $PostgresPort" start
  if ($LASTEXITCODE -ne 0) { throw "Local PostgreSQL could not start. Check $taskPgLog." }
}
$taskPostmaster = Get-Content -LiteralPath (Join-Path $taskData 'postmaster.pid') -TotalCount 4
if ($taskPostmaster[3] -ne [string]$PostgresPort) { throw "The project-owned PostgreSQL cluster is already running on a different port." }

$taskBun = (Get-Command bun -ErrorAction Stop).Source
$taskNode = (Get-Command node -ErrorAction Stop).Source
Push-Location $taskServer
try {
  & $taskNode node_modules/prisma/build/index.js migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'Local migration failed. No application processes were started.' }
  & $taskBun ./prisma/seed.ts
  if ($LASTEXITCODE -ne 0) { throw 'Local seed failed. No application processes were started.' }
} finally { Pop-Location }

foreach ($taskPort in @(4000, 5173)) {
  if (Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction SilentlyContinue) { throw "Port $taskPort is already in use. Stop the previous local application before starting another instance." }
}
$taskBackend = $null
$taskFrontend = $null
try {
  $taskBackend = Start-Process -FilePath $taskBun -ArgumentList './src/index.ts' -WorkingDirectory $taskServer -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRuntime 'backend.log') -RedirectStandardError (Join-Path $taskRuntime 'backend-error.log') -PassThru
  $taskFrontend = Start-Process -FilePath $taskNode -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort') -WorkingDirectory $taskClient -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRuntime 'frontend.log') -RedirectStandardError (Join-Path $taskRuntime 'frontend-error.log') -PassThru
} catch {
  foreach ($taskStarted in @($taskBackend, $taskFrontend)) { if ($null -ne $taskStarted -and !$taskStarted.HasExited) { $taskStarted.Kill() } }
  throw
}
@{ backend = $taskBackend.Id; frontend = $taskFrontend.Id } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRuntime 'app-processes.json')
$taskReady = $false
for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
  try {
    $taskHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/health' -TimeoutSec 2
    $taskPage = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/login' -TimeoutSec 2 -UseBasicParsing
    if ($taskHealth.status -eq 'ok' -and $taskPage.StatusCode -eq 200) { $taskReady = $true; break }
  } catch { Start-Sleep -Milliseconds 500 }
}
if (!$taskReady) {
  foreach ($taskStarted in @($taskBackend, $taskFrontend)) { if ($null -ne $taskStarted -and !$taskStarted.HasExited) { $taskStarted.Kill() } }
  throw 'Application did not become healthy. Inspect .local/backend-error.log and .local/frontend-error.log. The launcher has not contacted any live service.'
}
Write-Host 'Right Tracker is running: http://localhost:5173/login'
Write-Host 'Staff queues: http://localhost:5173/work'
Write-Host 'Local admin credentials are in server/.env. Logs are in .local/.'
if (!$NoBrowser) { Start-Process 'http://localhost:5173/login' -WindowStyle Hidden }
