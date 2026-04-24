$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $Root ".codex-runtime\launcher"
$BuildLogPath = Join-Path $RuntimeDir "build.log"
$BackendLogPath = Join-Path $RuntimeDir "backend.log"
$FrontendLogPath = Join-Path $RuntimeDir "frontend.log"
$LauncherLogPath = Join-Path $RuntimeDir "launcher.log"
$BackendPidPath = Join-Path $RuntimeDir "backend-process.pid"
$FrontendPidPath = Join-Path $RuntimeDir "frontend-process.pid"

$BackendHost = if ($env:ARIAD_BACKEND_HOST) { $env:ARIAD_BACKEND_HOST } else { "127.0.0.1" }
$BackendPort = if ($env:ARIAD_BACKEND_PORT) { $env:ARIAD_BACKEND_PORT } else { "3001" }
$FrontendHost = if ($env:ARIAD_FRONTEND_HOST) { $env:ARIAD_FRONTEND_HOST } else { "127.0.0.1" }
$FrontendPort = if ($env:ARIAD_FRONTEND_PORT) { $env:ARIAD_FRONTEND_PORT } else { "5173" }
$BackendHealthUrl = "http://${BackendHost}:${BackendPort}/api/health"
$ServiceUrl = "http://${FrontendHost}:${FrontendPort}/service.html"
$FrontendOrigin = "http://${FrontendHost}:${FrontendPort}"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Write-LauncherLog {
  param([string] $Message)

  $Line = "[{0}] {1}" -f (Get-Date).ToString("s"), $Message
  Write-Host $Line
  Add-Content -LiteralPath $LauncherLogPath -Value $Line
}

function Test-UrlReady {
  param([string] $Url)

  try {
    $Response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
    return $Response.StatusCode -ge 200 -and $Response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Wait-ForUrl {
  param(
    [string] $Url,
    [string] $Label,
    [int] $Attempts = 90
  )

  Write-LauncherLog "Waiting for $Label at $Url"

  for ($Index = 0; $Index -lt $Attempts; $Index += 1) {
    if (Test-UrlReady $Url) {
      Write-LauncherLog "$Label responded at $Url"
      return $true
    }

    Start-Sleep -Seconds 1
  }

  return $false
}

function Show-LogTail {
  param(
    [string] $Label,
    [string] $Path
  )

  if (Test-Path $Path) {
    Write-Host ""
    Write-Host "===== $Label log tail ====="
    Get-Content -LiteralPath $Path -Tail 30
    Write-Host "==========================="
    Write-Host ""
  }
}

function Ensure-Build {
  $DistServicePath = Join-Path $Root "frontend\dist\service.html"

  if ((Test-Path $DistServicePath) -and $env:ARIAD_FORCE_BUILD -ne "1") {
    Write-LauncherLog "Reusing the existing frontend build."
    return
  }

  if ($env:ARIAD_SKIP_BUILD -eq "1") {
    throw "ARIAD_SKIP_BUILD=1 but frontend/dist/service.html is missing."
  }

  Write-LauncherLog "Building ARIAD..."
  & yarn.cmd build 2>&1 | Tee-Object -FilePath $BuildLogPath

  if ($LASTEXITCODE -ne 0) {
    throw "Build failed. Check $BuildLogPath"
  }

  if (-not (Test-Path $DistServicePath)) {
    throw "Build completed, but frontend/dist/service.html is missing."
  }

  Write-LauncherLog "Build completed."
}

function Start-LoggedCommand {
  param(
    [string] $Name,
    [string] $CommandLine,
    [string] $PidPath
  )

  Write-LauncherLog "Starting $Name process..."
  $Process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $CommandLine" -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath $PidPath -Value $Process.Id
  Write-LauncherLog "$Name bootstrap pid: $($Process.Id)"
  return $Process
}

Write-LauncherLog "ARIAD local launcher starting..."
Write-LauncherLog "Root: $Root"
Write-LauncherLog "Backend health: $BackendHealthUrl"
Write-LauncherLog "Service URL: $ServiceUrl"
Write-LauncherLog "Logs: $RuntimeDir"

Ensure-Build

$StartedBackend = $false
$StartedFrontend = $false

if (Test-UrlReady $BackendHealthUrl) {
  Write-LauncherLog "Backend is already running."
} else {
  $BackendCommand = 'cd /d "{0}" && set "PORT={1}" && set "FRONTEND_ORIGIN={2}" && yarn.cmd node backend/dist/server.js >> "{3}" 2>&1' -f $Root, $BackendPort, $FrontendOrigin, $BackendLogPath
  Start-LoggedCommand -Name "backend" -CommandLine $BackendCommand -PidPath $BackendPidPath | Out-Null
  $StartedBackend = $true
}

if (-not (Wait-ForUrl -Url $BackendHealthUrl -Label "backend")) {
  Show-LogTail -Label "Backend" -Path $BackendLogPath
  throw "Backend did not become ready. Check $BackendLogPath"
}

if (Test-UrlReady $ServiceUrl) {
  Write-LauncherLog "Frontend service is already running."
} else {
  $FrontendCommand = 'cd /d "{0}" && set "ARIAD_BACKEND_HOST={1}" && set "ARIAD_BACKEND_PORT={2}" && set "ARIAD_FRONTEND_HOST={3}" && set "ARIAD_FRONTEND_PORT={4}" && yarn.cmd node frontend/scripts/serve-dist.mjs >> "{5}" 2>&1' -f $Root, $BackendHost, $BackendPort, $FrontendHost, $FrontendPort, $FrontendLogPath
  Start-LoggedCommand -Name "frontend" -CommandLine $FrontendCommand -PidPath $FrontendPidPath | Out-Null
  $StartedFrontend = $true
}

if (-not (Wait-ForUrl -Url $ServiceUrl -Label "frontend service")) {
  Show-LogTail -Label "Frontend" -Path $FrontendLogPath
  throw "Frontend service did not become ready. Check $FrontendLogPath"
}

Write-LauncherLog "ARIAD is ready."
Write-LauncherLog "Open this URL: $ServiceUrl"

if ($env:ARIAD_NO_BROWSER -eq "1") {
  Write-LauncherLog "Browser launch skipped because ARIAD_NO_BROWSER=1"
} else {
  Write-LauncherLog "Opening the live service in the default browser..."
  Start-Process $ServiceUrl | Out-Null
}

if ($env:ARIAD_EXIT_ON_READY -eq "1") {
  Write-LauncherLog "Exit-on-ready requested. Launcher will exit now."
  exit 0
}

if (-not $StartedBackend -and -not $StartedFrontend) {
  Write-LauncherLog "Both services were already running. Launcher will exit now."
  exit 0
}

Write-LauncherLog "Services are running in the background."
Write-LauncherLog "If something looks wrong, inspect launcher.log, backend.log, and frontend.log."
