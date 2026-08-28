#!/bin/bash
# 后台构建 backend
cd /opt/shixiong
nohup docker compose build --progress=plain backend > /tmp/build.log 2>&1 &
echo STARTED
