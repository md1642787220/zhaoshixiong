# ============================================================
# shixiong 开发环境一键搭建（Windows / PowerShell）
#
# 用法（项目根目录执行）：
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-dev.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-dev.ps1 -NoStart   # 只装依赖不启动
#
# 流程：1 环境依赖检查 → 2 国内镜像源配置 → 3 依赖安装 → 4 启动与验证
# 脚本可重复执行：已完成的步骤自动跳过。
# ============================================================
param(
  [switch]$NoStart,     # 只搭建环境，不启动服务
  [switch]$Reinstall    # 强制重装依赖
)

$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backend = Join-Path $root 'backend'
$worker  = Join-Path $root 'pdf-worker'
$logDir  = Join-Path $env:TEMP 'shixiong-dev'

$NPM_MIRROR = 'https://registry.npmmirror.com'
$PIP_MIRROR = 'https://pypi.tuna.tsinghua.edu.cn/simple'
$PIP_HOST   = 'pypi.tuna.tsinghua.edu.cn'

function Info($m) { Write-Host "[*]  $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "[!]  $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "[X]  $m" -ForegroundColor Red }

function Test-Http($url, $timeoutSec = 3) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSec
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}

# ---------- 定位 Node / Python（PATH 里没有时用托管运行时兜底） ----------
function Resolve-Node {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    (Join-Path $env:USERPROFILE '.workbuddy\binaries\node\versions\current\node.exe'),
    (Join-Path $env:ProgramFiles 'nodejs\node.exe')
  )
  $candidates += @(Get-ChildItem (Join-Path $env:USERPROFILE '.workbuddy\binaries\node\versions\*\node.exe') -ErrorAction SilentlyContinue |
                   Sort-Object FullName -Descending | ForEach-Object { $_.FullName })
  foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
  return $null
}

function Resolve-Python {
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $p = Get-ChildItem (Join-Path $env:USERPROFILE '.workbuddy\binaries\python\versions\*\python.exe') -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
  if ($p) { return $p.FullName }
  return $null
}

Write-Host "`n===== 1/4 环境依赖检查 =====" -ForegroundColor White

$node = Resolve-Node
if (-not $node) {
  Fail ' 未找到 Node.js（需要 >= 16，推荐 20/22）。请安装后重试：https://nodejs.org/zh-cn/download'
  exit 1
}
$nodeDir = Split-Path -Parent $node
$env:PATH = "$nodeDir;$env:PATH"        # 让后续 npm 可用
$nodeVer = (& $node -v).Trim()
$npmVer  = (& (Join-Path $nodeDir 'npm.cmd') -v).Trim()
if ([int]($nodeVer.TrimStart('v').Split('.')[0]) -lt 16) {
  Fail " Node 版本过低：$nodeVer（需要 >= 16）"; exit 1
}
Ok " Node.js $nodeVer  /  npm $npmVer    ($node)"

$venvPy = Join-Path $worker '.venv\Scripts\python.exe'
if (-not (Test-Path $venvPy)) {
  $sysPy = Resolve-Python
  if (-not $sysPy) {
    Fail ' 未找到 Python（需要 >= 3.10，推荐 3.11/3.12/3.13）。请安装后重试：https://www.python.org/downloads/'
    exit 1
  }
  Info " 系统 Python：$sysPy"
} else {
  Ok " pdf-worker 虚拟环境已存在：.venv"
}

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpeg) { Ok " ffmpeg 已安装（音频/视频提取可用）" }
else { Warn ' 未检测到 ffmpeg —— 音频提取/视频剪辑功能会降级提示，其余功能不受影响（可选安装）' }

Write-Host "`n===== 2/4 国内镜像源配置 =====" -ForegroundColor White

$npmrc = Join-Path $backend '.npmrc'
if (-not (Test-Path $npmrc)) {
  Set-Content -Path $npmrc -Encoding ASCII -Value @(
    '# npm mirror for faster install (npmmirror)',
    "registry=$NPM_MIRROR",
    'fund=false'
  )
  Ok " 已生成 backend/.npmrc（registry=$NPM_MIRROR）"
} else {
  Ok " backend/.npmrc 已存在，跳过"
}

if (Test-Path $venvPy) {
  & $venvPy -m pip config set global.index-url $PIP_MIRROR | Out-Null
  & $venvPy -m pip config set global.trusted-host $PIP_HOST  | Out-Null
  Ok " 已写入 pip 镜像源（$PIP_MIRROR）"
} else {
  Info ' 虚拟环境尚未创建，pip 镜像源将在创建后写入'
}

Write-Host "`n===== 3/4 依赖安装 =====" -ForegroundColor White

# ---- Node 依赖 ----
$nodeModules = Join-Path $backend 'node_modules'
if ((Test-Path $nodeModules) -and (-not $Reinstall)) {
  Ok ' backend/node_modules 已存在，跳过（如需重装加 -Reinstall）'
} else {
  Push-Location $backend
  try {
    if (Test-Path (Join-Path $backend 'package-lock.json')) {
      Info ' npm ci ...'
      & (Join-Path $nodeDir 'npm.cmd') ci --no-audit --no-fund
    } else {
      Info ' npm install ...'
      & (Join-Path $nodeDir 'npm.cmd') install --no-audit --no-fund
    }
    if ($LASTEXITCODE -ne 0) { throw "npm 安装失败（退出码 $LASTEXITCODE）" }
    Ok ' Node 依赖安装完成'
  } finally { Pop-Location }
}

# ---- Python 依赖 ----
if (-not (Test-Path $venvPy)) {
  Info " 创建虚拟环境 pdf-worker/.venv ..."
  & $sysPy -m venv (Join-Path $worker '.venv')
  if (-not (Test-Path $venvPy)) { Fail ' 虚拟环境创建失败'; exit 1 }
}
if ($Reinstall -or -not (Test-Path (Join-Path $worker '.venv\.deps-ok'))) {
  Push-Location $worker
  try {
    Info ' pip install -r requirements.txt（清华镜像源）...'
    & $venvPy -m pip install --upgrade pip --quiet
    & $venvPy -m pip install -r requirements.txt -i $PIP_MIRROR
    if ($LASTEXITCODE -ne 0) { throw "pip 安装失败（退出码 $LASTEXITCODE）" }
    Set-Content -Path (Join-Path $worker '.venv\.deps-ok') -Value (Get-Date -Format 's') -Encoding ASCII
    Ok ' Python 依赖安装完成'
  } finally { Pop-Location }
} else {
  Ok ' Python 依赖已安装，跳过'
}

if ($NoStart) { Write-Host "`n跳过启动（-NoStart）。`n" -ForegroundColor Green; exit 0 }

Write-Host "`n===== 4/4 启动与验证 =====" -ForegroundColor White
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# ---- PDF Worker ----
if (Test-Http 'http://127.0.0.1:8000/health') {
  Ok ' PDF Worker 已在运行（127.0.0.1:8000），复用'
} else {
  Info ' 启动 PDF Worker ...'
  Start-Process -FilePath $venvPy `
    -ArgumentList '-m','uvicorn','main:app','--host','127.0.0.1','--port','8000','--ws-max-size','200000000' `
    -WorkingDirectory $worker -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'worker.out.log') `
    -RedirectStandardError  (Join-Path $logDir 'worker.err.log')
  $ready = $false
  foreach ($i in 1..30) {
    if (Test-Http 'http://127.0.0.1:8000/health') { $ready = $true; break }
    Start-Sleep -Milliseconds 700
  }
  if ($ready) { Ok ' PDF Worker 已就绪' }
  else { Warn " PDF Worker 未就绪，请查看 $logDir\worker.err.log（PDF 引擎类工具会降级）" }
}

# ---- 后端（不设 PDF_WORKER_URL，交给后端自动拉起/复用 worker） ----
if (Test-Http 'http://127.0.0.1:3000/api/health') {
  Ok ' 后端已在运行（127.0.0.1:3000），复用'
} else {
  Info ' 启动后端 ...'
  $env:PORT = '3000'
  Start-Process -FilePath $node -ArgumentList 'server.js' `
    -WorkingDirectory $backend -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'backend.out.log') `
    -RedirectStandardError  (Join-Path $logDir 'backend.err.log')
  $ready = $false
  foreach ($i in 1..30) {
    if (Test-Http 'http://127.0.0.1:3000/api/health') { $ready = $true; break }
    Start-Sleep -Milliseconds 700
  }
  if ($ready) { Ok ' 后端已就绪' } else { Fail " 后端启动失败，请查看 $logDir\backend.err.log"; exit 1 }
}

Write-Host "`n----- 接口验证 -----" -ForegroundColor White
$checks = @(
  @{ name = '后端健康检查';   url = 'http://127.0.0.1:3000/api/health' },
  @{ name = '前端页面托管';   url = 'http://localhost:3000/' },
  @{ name = 'PDF Worker';    url = 'http://127.0.0.1:8000/health' },
  @{ name = 'PDF 能力清单';   url = 'http://127.0.0.1:3000/api/pdf/capabilities' }
)
foreach ($c in $checks) {
  if (Test-Http $c.url) { Ok " $($c.name)  $($c.url)" }
  else { Warn " $($c.name) 不可用：$($c.url)" }
}

Write-Host ''
Write-Host ' 访问地址 : http://localhost:3000' -ForegroundColor Green
Write-Host " 运行日志 : $logDir" -ForegroundColor Green
Write-Host ' 停止服务 : Get-Process node,python -ErrorAction SilentlyContinue | Stop-Process' -ForegroundColor DarkGray
Write-Host ''
