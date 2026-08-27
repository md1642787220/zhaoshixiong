#!/usr/bin/env bash
# ============================================================
# Stirling-PDF 一键部署脚本（用于云服务器 Linux）
# 功能：自动安装 Docker（如未安装）→ 拉取镜像 → 启动容器
# 用法：在服务器上执行  bash deploy-stirling.sh
# ============================================================
set -euo pipefail

# ---------- 可配置项 ----------
PORT="${STIRLING_PORT:-8080}"          # 对外端口
IMAGE="${STIRLING_IMAGE:-docker.stirlingpdf.com/stirlingtools/stirling-pdf:latest}"
# 镜像拉取慢时，可改用备选源（二选一）：
#   IMAGE="ghcr.io/stirling-tools/stirling-pdf:latest"
# 或给 Docker 配置国内镜像加速器（见脚本末尾注释）
# ------------------------------

echo "[1/4] 检测 Docker..."
if command -v docker >/dev/null 2>&1; then
  echo "      已安装：$(docker --version)"
else
  echo "      未安装，开始自动安装 Docker..."
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
  elif command -v dnf >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
  else
    echo "      无法识别的系统，请手动安装 Docker 后重试"; exit 1
  fi
fi

echo "[2/4] 启动 Docker 服务..."
if command -v systemctl >/dev/null 2>&1; then
  systemctl enable --now docker >/dev/null 2>&1 || systemctl start docker
else
  service docker start >/dev/null 2>&1 || true
fi

echo "[3/4] 启动 Stirling-PDF 容器..."
# 已存在同名容器则先移除
docker rm -f stirling-pdf >/dev/null 2>&1 || true

mkdir -p ./stirling-data/tessdata ./stirling-data/configs ./stirling-data/logs ./stirling-data/pipeline

docker run -d \
  --name stirling-pdf \
  --restart unless-stopped \
  -p "${PORT}:8080" \
  -v "$(pwd)/stirling-data/tessdata:/usr/share/tessdata" \
  -v "$(pwd)/stirling-data/configs:/configs" \
  -v "$(pwd)/stirling-data/logs:/logs" \
  -v "$(pwd)/stirling-data/pipeline:/pipeline" \
  -e SECURITY_ENABLELOGIN=false \
  "${IMAGE}"

echo "[4/4] 等待服务就绪..."
for i in $(seq 1 60); do
  if curl -sf "http://localhost:${PORT}/" >/dev/null 2>&1; then
    echo "      Stirling-PDF 已就绪"
    break
  fi
  printf '.'
  sleep 3
done
echo ""

PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "你的公网IP")
echo "=========================================================="
echo " 部署完成！"
echo "   内网访问：http://localhost:${PORT}"
echo "   公网访问：http://${PUBLIC_IP}:${PORT}"
echo "   后端 STIRLING_API_URL 应配置为：http://${PUBLIC_IP}:${PORT}"
echo "   ⚠️  请在云服务商「安全组 / 防火墙」放行 ${PORT} 端口"
echo "=========================================================="
echo ""
echo "常用命令："
echo "  查看日志   docker logs -f stirling-pdf"
echo "  停止/启动  docker stop/start stirling-pdf"
echo "  更新版本   docker pull ${IMAGE} && bash deploy-stirling.sh"
echo ""
echo "【可选】国内镜像加速器（拉取慢时配置，二选一）："
echo "  echo '{\"registry-mirrors\":[\"https://docker.m.daocloud.io\",\"https://dockerproxy.com\"]}' | sudo tee /etc/docker/daemon.json && sudo systemctl restart docker"
