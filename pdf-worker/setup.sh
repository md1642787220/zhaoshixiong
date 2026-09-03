#!/usr/bin/env bash
# ============================================================
# shixiong PDF Worker —— Linux / macOS 一键环境搭建与启动
# 功能：创建虚拟环境、用国内镜像源安装依赖、启动 FastAPI 服务
# 用法： bash setup.sh
# ============================================================
set -e

PY="${PYTHON:-python3}"
if ! command -v "$PY" >/dev/null 2>&1; then PY=python; fi
echo ">> 使用 Python: $PY ($("$PY" --version 2>&1))"

# 1) 创建虚拟环境
if [ ! -d "venv" ]; then
  "$PY" -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate

# 2) 升级 pip 并安装依赖（清华镜像源加速）
pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

echo ">> 依赖安装完成。"

# 3) 启动服务（--workers 控制并发进程数，按需调整）
export PDF_WORKER_PORT="${PDF_WORKER_PORT:-8000}"
exec uvicorn main:app --host 0.0.0.0 --port "$PDF_WORKER_PORT" --workers 2
