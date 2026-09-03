# 启动 PDF Worker（uvicorn，端口 8000）
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
# 优先使用本机已安装的 Python（自动探测 .workbuddy 运行时，否则回退 PATH 中的 python）
$py = Get-ChildItem "$env:USERPROFILE\.workbuddy\binaries\python\versions\*\python.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $py) {
  $p = Get-Command python -ErrorAction SilentlyContinue
  if (-not $p) { Write-Error "未找到 Python，请先安装 Python 3.11+"; exit 1 }
  $py = $p.Source
} else {
  $py = $py.FullName
}
Set-Location $root
Write-Host "Starting pdf-worker (uvicorn :8000) using $py"
& $py -m uvicorn main:app --host 127.0.0.1 --port 8000
