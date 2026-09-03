# 启动 shixiong 后端，并启用 PDF Worker 的 WebSocket 代理
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:PDF_WORKER_URL = "http://127.0.0.1:8000"
if (-not $env:PORT) { $env:PORT = "3000" }
Write-Host "Starting backend -> http://localhost:$env:PORT  (PDF_WORKER_URL=$env:PDF_WORKER_URL)"
node (Join-Path $root 'server.js')
