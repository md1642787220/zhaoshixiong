const express = require('express');
const path = require('path');
const fs = require('fs');

const toolsRouter = require('./routes/tools');
const learnRouter = require('./routes/learn');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- 基础中间件 ---------- */
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// 跨域支持（支持前后端分离部署）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ---------- API 路由 ---------- */
app.use('/api/tools', toolsRouter);
app.use('/api/learn', learnRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'helper-backend', time: new Date().toISOString() });
});

app.use('/api', (req, res) => res.status(404).json({ message: '接口不存在' }));

/* ---------- 托管前端静态资源（同端口部署时可直接访问） ---------- */
const frontendDir = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get('*', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
}

/* ---------- 全局错误处理 ---------- */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? '文件过大（上限 500MB）'
    : '服务器内部错误：' + (err.message || err);
  res.status(500).json({ message });
});

app.listen(PORT, () => {
  console.log('==================================');
  console.log('  Helper 助手 后端服务已启动');
  console.log(`  站点: http://localhost:${PORT}`);
  console.log(`  API : http://localhost:${PORT}/api/health`);
  console.log('==================================');
});
