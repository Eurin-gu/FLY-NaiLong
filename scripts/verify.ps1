#requires -Version 5.1
<#
  Orchestrates a full production verification on Windows.

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1

  Chromium refuses to start when Node spawns it under a restricted job object
  (its Mojo channels need named pipes), so the browser and the production
  server are started here with Start-Process and the Node verifier attaches
  over CDP. Everything is torn down on exit.

  Pure ASCII on purpose: Windows PowerShell 5.1 mis-decodes UTF-8 script files
  that have no byte-order mark.
#>
[CmdletBinding()]
param(
  [int]$Port = 8080,
  [int]$CdpPort = 9222,
  [string]$Edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  [switch]$SkipBuild,
  [switch]$CaptureOg
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force -Path (Join-Path $root "output\verify") | Out-Null

function Stop-Tree([System.Diagnostics.Process]$Process) {
  if ($null -eq $Process) { return }
  try { & taskkill.exe /PID $Process.Id /T /F *> $null } catch {}
}

if (-not $SkipBuild) {
  Write-Host "Building..." -ForegroundColor Cyan
  & node scripts/build.mjs
  if ($LASTEXITCODE -ne 0) { throw "build failed" }
}

if (-not (Test-Path $Edge)) {
  $candidates = @(
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
  )
  $Edge = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $Edge) { throw "No Chromium-based browser found. Pass -Edge with a path." }
}

$profile = Join-Path $root ".tmp-verify-profile"
if (Test-Path $profile) { Remove-Item $profile -Recurse -Force }
New-Item -ItemType Directory -Path $profile | Out-Null

$server = $null
$browser = $null
$exit = 1

try {
  Write-Host "Starting production server on port $Port ..." -ForegroundColor Cyan
  $server = Start-Process -FilePath "node" `
    -ArgumentList @("server.mjs", "--port", $Port, "--host", "127.0.0.1") `
    -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $root "output\verify\server.log") `
    -RedirectStandardError (Join-Path $root "output\verify\server.err.log")

  Write-Host "Starting browser with CDP on port $CdpPort ..." -ForegroundColor Cyan
  $browser = Start-Process -FilePath $Edge -PassThru -WindowStyle Hidden -ArgumentList @(
    "--headless=new", "--disable-gpu", "--mute-audio", "--hide-scrollbars",
    "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
    "--remote-debugging-port=$CdpPort", "--remote-allow-origins=*",
    "--user-data-dir=$profile", "about:blank"
  )

  $deadline = (Get-Date).AddSeconds(40)
  $up = $false
  while ((Get-Date) -lt $deadline) {
    try {
      $null = Invoke-WebRequest "http://127.0.0.1:$CdpPort/json/version" -UseBasicParsing -TimeoutSec 2
      $up = $true; break
    } catch { Start-Sleep -Milliseconds 400 }
  }
  if (-not $up) { throw "browser did not expose CDP on port $CdpPort" }

  $deadline = (Get-Date).AddSeconds(25)
  while ((Get-Date) -lt $deadline) {
    try { $null = Invoke-WebRequest "http://127.0.0.1:$Port/healthz" -UseBasicParsing -TimeoutSec 2; break }
    catch { Start-Sleep -Milliseconds 300 }
  }

  $env:BASE_URL = "http://127.0.0.1:$Port"
  $env:CDP_URL = "http://127.0.0.1:$CdpPort"
  $verifyArgs = @("scripts/verify.mjs")
  if ($CaptureOg) { $verifyArgs += "--capture-og" }
  & node @verifyArgs
  $exit = $LASTEXITCODE
}
finally {
  Stop-Tree $browser
  Stop-Tree $server
  if (Test-Path $profile) { Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue }
}

exit $exit
