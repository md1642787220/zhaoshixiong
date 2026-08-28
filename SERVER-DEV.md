# 服务器开发配置指南（VS Code Remote-SSH + Docker）

公网 IP：47.114.101.129  登录名：root  系统：Ubuntu  Docker：已装好

## 一、本机前置（Windows）
- 已安装 OpenSSH 客户端（scp/ssh 可用）
- VS Code 安装扩展：**Remote - SSH**（微软官方）
- 本机 SSH config 已写入（见 ~/.ssh/config）：
  ```
  Host shixiong
      HostName 47.114.101.129
      User root
      Port 22
  ```

## 二、把代码推到服务器（仅首次）
在本机 PowerShell 执行：
```powershell
scp -r C:\Users\Administrator\Downloads\zhaoshixiong root@47.114.101.129:/root/shixiong
```
> 若文件较多较慢，可先打包：
> ```powershell
> cd C:\Users\Administrator\Downloads
> tar czf zhaoshixiong.tar.gz zhaoshixiong
> scp zhaoshixiong.tar.gz root@47.114.101.129:/root/
> ```
> 服务器解包：`cd /root && tar xzf zhaoshixiong.tar.gz`

## 三、VS Code 连接服务器
1. 安装 Remote-SSH 扩展后，按 `F1` → `Remote-SSH: Connect to Host` → 选 `shixiong`
2. 输入 root 密码（或在 config 中追加 `IdentityFile` 改用密钥）
3. 连上后 `文件 → 打开文件夹` → 输入 `/root/shixiong` → 确定
4. 之后文件树、编辑器、终端**全部在服务器上**，可用服务器环境构建

## 四、服务器内构建与测试
在 VS Code 集成终端（已是服务器 shell）执行：
```bash
cd /root/shixiong
docker compose up -d --build        # 构建并启动 backend + pdf-worker
docker compose ps
docker compose logs -f pdf-worker   # 看 Python worker 日志
```

### 验证接口
```bash
# worker 健康检查
curl -s http://127.0.0.1:8000/health
# 后端健康检查（经 Node 转发）
curl -s http://127.0.0.1:3000/api/health
# 能力清单
curl -s http://127.0.0.1:8000/api/pdf/capabilities | head -c 300; echo
```

### 冒烟测试（merge 链路）
```bash
docker exec shixiong-pdf-worker python3 - <<'PY'
import fitz
for i in range(2):
    d=fitz.open(); d.new_page(); d[0].insert_text((50,50),f"page {i}")
    d.save(f"/tmp/t{i}.pdf"); d.close()
print("test pdfs created")
PY

curl -s -F "files=@/tmp/t0.pdf" -F "files=@/tmp/t1.pdf" \
  http://127.0.0.1:3000/api/pdf/merge -o /tmp/merged.pdf
file /tmp/merged.pdf
```

## 五、日常修改流程
- 在 VS Code（连服务器）里改 `pdf-worker/worker/*.py`
- 改完 `docker compose up -d --build pdf-worker` 重新构建验证
- 报错贴回给 AI 协助定位

## 六、端口说明
- 对外访问前端：服务器 3000 端口（Node 后端托管前端 + 转发 PDF 到 worker）
- pdf-worker 对内 8000，无需对外暴露
- 记得在云防火墙/安全组放通 3000（以及你的 SSH 22）
