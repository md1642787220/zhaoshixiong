# ============================================================
# Helper 助手 后端镜像（Node.js + ffmpeg，含前端静态资源托管）
# ============================================================
FROM node:22-slim

# 安装 ffmpeg（音频/视频提取依赖；未安装时相关功能自动降级）
# 先切换为阿里云 apt 源，加速国内下载
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制依赖清单，充分利用 Docker 层缓存
COPY backend/package.json backend/package-lock.json ./backend/
# 使用国内 npm 镜像加速依赖下载
RUN cd backend && npm config set registry https://registry.npmmirror.com && npm ci --omit=dev

# 复制源码（后端 + 前端，后端 server.js 会托管 frontend）
COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
