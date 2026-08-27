#!/bin/bash
# 后台构建 backend 并预拉取 Stirling 镜像
cd /opt/helper
nohup docker compose build --progress=plain backend > /tmp/build.log 2>&1 &
nohup docker pull stirlingtools/stirling-pdf:latest > /tmp/pull-stirling.log 2>&1 &
echo STARTED
