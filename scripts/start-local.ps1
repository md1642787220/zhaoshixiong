# Local one-click startup for shixiong (backend + PDF Worker)
# Usage: in PowerShell run  .\scripts\start-local.ps1
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backend   = Join-Path $root 'backend'
$pdfworker = Join-Path $root 'pdf-worker'

# 1) Start Python PDF Worker (using virtualenv)
$venvPy = Join-Path $pdfworker '.venv\Scripts\python.exe'
if (-not (Test-Path $venvPy)) {
  Write-Error "pdf-worker venv not found. Run first: cd pdf-worker; python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple"
  exit 1
}
Start-Process -FilePath $venvPy -ArgumentList "-m","uvicorn","main:app","--host","127.0.0.1","--port","8000","--ws-max-size","200000000" `
  -WorkingDirectory $pdfworker `
  -RedirectStandardOutput (Join-Path $pdfworker 'worker.out.log') `
  -RedirectStandardError  (Join-Path $pdfworker 'worker.err.log')

# 2) Start Node backend (points to local worker)
$env:PDF_WORKER_URL = "http://127.0.0.1:8000"
$env:PORT = "3000"
Start-Process -FilePath "node" -ArgumentList "server.js" `
  -WorkingDirectory $backend `
  -RedirectStandardOutput (Join-Path $backend 'backend.out.log') `
  -RedirectStandardError  (Join-Path $backend 'backend.err.log')

Write-Host "Started:"
Write-Host "  backend     -> http://localhost:3000"
Write-Host "  PDF Worker  -> http://127.0.0.1:8000"
Write-Host "Logs:"
Write-Host "  backend\backend.out.log / backend.err.log"
Write-Host "  pdf-worker\worker.out.log / worker.err.log"
