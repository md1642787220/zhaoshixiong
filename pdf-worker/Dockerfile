# ============================================================
# shixiong PDF Worker 镜像（Python + FastAPI + PyMuPDF 等 6 个开源库）
# 构建：docker compose build pdf-worker
# ============================================================
FROM python:3.11-slim

# 国内 apt 镜像源（清华大学 TUNA）
# Debian 12+ 使用 deb822 格式，源文件为 /etc/apt/sources.list.d/debian.sources
RUN sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g; s|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' \
    /etc/apt/sources.list.d/debian.sources

# 系统依赖：LibreOffice（Office 互转）、Tesseract（OCR）、字体（中文）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    tesseract-ocr-chi-tra \
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    poppler-utils \
 && rm -rf /var/lib/apt/lists/*

# 安装 uv（pip 方式，使用国内镜像）
ENV UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ENV UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
RUN pip install --no-cache-dir uv

WORKDIR /app

# 先装依赖（利用层缓存）
COPY pyproject.toml ./
RUN uv venv /opt/venv && \
    uv pip install --python /opt/venv/bin/python -r pyproject.toml

# 复制源码
COPY main.py ./
COPY worker ./worker

ENV PATH="/opt/venv/bin:${PATH}"
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
