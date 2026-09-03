/* ============================================================
 * middlewares/errorMiddleware.js - 统一错误处理
 * 职责：将业务异常（AppError）与普通异常转换为一致的 JSON 响应，
 *       业务代码无需自行 res.status().json() 处理错误。
 * ============================================================ */

const LIMIT_MESSAGE = '文件过大（上限 500MB）';

/**
 * 创建错误中间件
 * @param {{logger: object}} deps
 */
function createErrorMiddleware({ logger } = {}) {
  // eslint-disable-next-line no-unused-vars
  return function errorMiddleware(err, req, res, next) {
    if (logger) logger.error(`请求失败 ${req.method} ${req.originalUrl}`, err);

    if (res.headersSent) return next(err);

    const status = err.status || 500;
    const code = err.code || 'INTERNAL_ERROR';

    let message;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = LIMIT_MESSAGE;
    } else if (status >= 500) {
      message = '服务器内部错误：' + (err.message || err);
    } else {
      message = err.message || '请求失败';
    }

    return res.status(status).json({ message, code, ...(err.details ? { details: err.details } : {}) });
  };
}

module.exports = { createErrorMiddleware };
