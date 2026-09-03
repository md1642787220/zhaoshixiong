# Start PDF Worker (uvicorn, port 8000)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
# Prefer bundled Python runtime, fallback to PATH
$py = Get-ChildItem "$env:USERPROFILE\.workbuddy\binaries\python\versions\*\python.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $py) {
  $p = Get-Command python -ErrorAction SilentlyContinue
  if (-not $p) { Write-Error "Python 3.11+ not found"; exit 1 }
  $py = $p.Source
} else {
  $py = $py.FullName
}
Set-Location $root
Write-Host "Starting pdf-worker (uvicorn :8000) using $py"
& $py -m uvicorn main:app --host 127.0.0.1 --port 8000 --ws-max-size 200000000
