# ============================================================
# shixiong PDF Worker —— Windows 一键环境搭建与启动 (PowerShell)
# 功能：创建虚拟环境、用国内镜像源安装依赖、启动 FastAPI 服务
# 用法： 右键“使用 PowerShell 运行”，或在该目录执行  .\setup.ps1
# ============================================================
$ErrorActionPreference = "Stop"

$py = "python"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { $py = "python3" }
Write-Host ">> 使用 Python: $py" -ForegroundColor Cyan

# 1) 创建虚拟环境
if (-not (Test-Path "venv")) {
    & $py -m venv venv
}

# 2) 升级 pip 并安装依赖（清华镜像源加速）
& venv\Scripts\python.exe -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple
& venv\Scripts\python.exe -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

Write-Host ">> 依赖安装完成。" -ForegroundColor Green

# 3) 启动服务（--workers 控制并发进程数，按需调整）
$env:PDF_WORKER_PORT = "8000"
& venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
