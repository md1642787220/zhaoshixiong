/* ============================================================
 * wsProxy.js - PDF Worker 的 WebSocket 代理
 * 职责：前端连接 /ws/pdf?action=xxx，Node 透明转发到
 *       Python worker 的 /ws/api/pdf/xxx，双向透传文本(JSON) 与
 *       二进制(文件流)。worker 不可用时向前端回错误 JSON。
 *
 * 说明：worker 与 Node 之间采用统一协议——先发 meta(JSON)，
 *       再发文件二进制(可多帧)，最后发 {"type":"end"}。
 * ============================================================ */
const { WebSocketServer } = require('ws');
const WebSocket = require('ws');

/**
 * 在 Node http server 上挂载 PDF WebSocket 代理
 * @param {http.Server} server
 * @param {{pdfWorkerUrl: string, logger: object}} deps
 */
function attachPdfWs(server, { pdfWorkerUrl, logger } = {}) {
  if (!pdfWorkerUrl) {
    if (logger) logger.warn('未配置 PDF_WORKER_URL，WebSocket 代理未启用');
    return;
  }

  const wss = new WebSocketServer({ server, path: '/ws/pdf' });

  wss.on('connection', (client, req) => {
    const url = new URL(req.url, 'http://localhost');
    const action = url.searchParams.get('action') || '';
    if (!action) {
      client.send(JSON.stringify({ type: 'error', message: '缺少 action 参数' }));
      return client.close();
    }

    // http(s) -> ws(s)
    const wsUrl = `${pdfWorkerUrl.replace(/^http/i, 'ws')}/ws/api/pdf/${encodeURIComponent(action)}`;

    let upstream = null;
    let pending = [];
    let upstreamOpen = false;

    const fail = (msg) => {
      try { client.send(JSON.stringify({ type: 'error', message: msg })); } catch {}
      try { client.close(); } catch {}
    };

    try {
      upstream = new WebSocket(wsUrl);
    } catch (e) {
      return fail(`PDF 引擎连接失败：${e.message}`);
    }

    upstream.on('open', () => {
      upstreamOpen = true;
      for (const chunk of pending) upstream.send(chunk.data, { binary: chunk.binary });
      pending = [];
    });
    upstream.on('message', (data, isBinary) => {
      if (client.readyState === client.OPEN) client.send(data, { binary: isBinary });
    });
    upstream.on('error', (e) => fail(`PDF 引擎错误：${e.message}`));
    upstream.on('close', () => { try { client.close(); } catch {} });

    client.on('message', (data, isBinary) => {
      if (upstreamOpen && upstream.readyState === WebSocket.OPEN) {
        upstream.send(data, { binary: isBinary });
      } else {
        pending.push({ data, binary: isBinary });
      }
    });
    client.on('close', () => { try { upstream.close(); } catch {} });
    client.on('error', () => { try { upstream.close(); } catch {} });
  });

  if (logger) logger.info('已挂载 PDF WebSocket 代理: /ws/pdf');
}

module.exports = { attachPdfWs };
