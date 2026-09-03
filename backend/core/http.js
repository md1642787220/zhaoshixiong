/* ============================================================
 * core/http.js - HTTP 层通用工具
 * 职责：收敛「响应封装」与「异步错误转发」，
 *       使路由处理函数只关注业务，不被样板代码污染。
 * ============================================================ */

/**
 * 包装异步路由处理函数，自动将异常交给错误中间件
 * @param {(req, res, next) => Promise<any>} handler
 */
function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/** 输出 JSON 成功响应 */
function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, ...data });
}

/** 输出文件下载响应 */
function sendDownload(res, { buffer, filename, contentType = 'application/octet-stream' }) {
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  return res.send(buffer);
}

module.exports = { asyncHandler, ok, sendDownload };
