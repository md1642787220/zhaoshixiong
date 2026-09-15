/* ============================================================
 * infrastructure/pdfWorkerLauncher.js - 本地 PDF Worker 自动启动
 * 随 Node 后端按需拉起 pdf-worker（uvicorn），并把地址写入
 * process.env.PDF_WORKER_URL，供随后加载的配置读取。
 * 仅用于本地开发/单机部署；容器编排场景已配置 PDF_WORKER_URL，
 * 默认（auto）不会重复启动。
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

/** 探测 pdf-worker 使用的 Python 解释器：优先虚拟环境，其次 PATH */
function resolvePython(dir, custom) {
  if (custom) return custom;
  const win = process.platform === 'win32';
  const candidates = win
    ? [path.join(dir, '.venv', 'Scripts', 'python.exe'), path.join(dir, 'venv', 'Scripts', 'python.exe')]
    : [path.join(dir, '.venv', 'bin', 'python'), path.join(dir, 'venv', 'bin', 'python')];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return win ? 'python' : 'python3';
}

/** 将子进程输出逐行转发到后端日志（带 [pdf-worker] 前缀） */
function forwardOutput(stream, logger, fallbackLevel) {
  if (!stream) return;
  if (!logger) { stream.resume(); return; }
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => {
    const text = line.trim();
    if (!text) return;
    // uvicorn 的常规 INFO 走 stderr，按内容纠正级别，避免全部显示为 warn
    let level = fallbackLevel;
    if (/\b(error|traceback|critical|fatal|warning)\b/i.test(text)) level = 'warn';
    else if (/\binfo\b/i.test(text)) level = 'info';
    logger[level](`[pdf-worker] ${text}`);
  });
}

/** 单次健康检查 */
async function isHealthy(url, timeoutMs = 1200) {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
}

/** 轮询等待 worker 就绪 */
async function waitHealthy(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isHealthy(url)) return true;
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

/**
 * 按需启动本地 PDF Worker
 * @param {{config: object, logger: object}} params
 * @returns {Promise<{url: string, reused?: boolean, stop?: Function}|null>}
 */
async function maybeLaunchPdfWorker({ config, logger } = {}) {
  const cfg = (config && config.pdfWorker) || {};
  const mode = String(cfg.autostart || process.env.PDF_WORKER_AUTOSTART || 'auto').toLowerCase();
  if (mode === 'false' || mode === '0' || mode === 'off') return null;

  const hasExternal = Boolean(cfg.url || process.env.PDF_WORKER_URL);
  if (hasExternal && mode !== 'true') {
    if (logger) logger.info('已配置 PDF_WORKER_URL，跳过本地 PDF Worker 自动启动');
    return null;
  }

  const port = cfg.port || 8000;
  const dir = cfg.dir || path.join(__dirname, '..', '..', 'pdf-worker');
  const url = `http://127.0.0.1:${port}`;

  // 已在运行则直接复用
  if (await isHealthy(url)) {
    if (!process.env.PDF_WORKER_URL) process.env.PDF_WORKER_URL = url;
    if (logger) logger.info(`检测到 PDF Worker 已在运行，直接复用 ${url}`);
    return { url, reused: true };
  }

  if (!fs.existsSync(dir)) {
    if (logger) logger.warn(`未找到 pdf-worker 目录（${dir}），跳过自动启动`);
    return null;
  }

  const python = resolvePython(dir, cfg.python);
  if (logger) logger.info(`正在启动本地 PDF Worker：${python}（端口 ${port}）`);

  const child = spawn(
    python,
    ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(port), '--ws-max-size', '200000000'],
    { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
  let spawnError = null;
  child.on('error', (e) => { spawnError = e; });
  // worker 的 stdout/stderr 转发到后端日志，便于排查
  forwardOutput(child.stdout, logger, 'info');
  forwardOutput(child.stderr, logger, 'warn');

  const ready = await waitHealthy(url, 45000);
  if (!ready) {
    if (logger) logger.warn(`PDF Worker 启动失败或超时${spawnError ? `（${spawnError.message}）` : ''}，PDF 引擎类工具将降级`);
    try { child.kill(); } catch { /* ignore */ }
    return null;
  }

  process.env.PDF_WORKER_URL = url;
  if (logger) logger.info(`本地 PDF Worker 已就绪：${url}`);

  return {
    url,
    stop() { try { child.kill(); } catch { /* ignore */ } },
  };
}

module.exports = { maybeLaunchPdfWorker };
