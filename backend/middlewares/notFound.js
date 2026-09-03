/* ============================================================
 * middlewares/notFound.js - API 未匹配中间件
 * 职责：所有 /api 下未命中的请求统一返回 JSON 404。
 * ============================================================ */

/**
 * 创建 404 中间件
 * @param {{logger: object}} deps
 */
function createNotFoundMiddleware({ logger } = {}) {
  return function notFoundMiddleware(req, res) {
    if (logger) logger.debug(`接口不存在: ${req.method} ${req.originalUrl}`);
    return res.status(404).json({ message: '接口不存在' });
  };
}

module.exports = { createNotFoundMiddleware };
