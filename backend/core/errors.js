/* ============================================================
 * core/errors.js - 错误定义
 * 职责：定义业务错误类型，携带 HTTP 状态码与错误码，
 *       由统一错误中间件转换为响应，避免各处散落 res.status()。
 * ============================================================ */

/** 应用基础错误 */
class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 请求参数错误 400 */
class BadRequestError extends AppError {
  constructor(message = '请求参数有误', details) {
    super(message, { status: 400, code: 'BAD_REQUEST', details });
  }
}

/** 资源不存在 404 */
class NotFoundError extends AppError {
  constructor(message = '资源不存在', details) {
    super(message, { status: 404, code: 'NOT_FOUND', details });
  }
}

/** 依赖的外部引擎/服务不可用 503 */
class EngineUnavailableError extends AppError {
  constructor(engine, details) {
    super(`需要服务端安装 ${engine}，当前环境未提供`, {
      status: 503,
      code: 'ENGINE_UNAVAILABLE',
      details: { engine, ...details },
    });
    this.engine = engine;
  }
}

/** 上游服务调用失败 502 */
class UpstreamError extends AppError {
  constructor(message, details) {
    super(message, { status: 502, code: 'UPSTREAM_ERROR', details });
  }
}

/** 功能尚未实现 / 开发中 501 */
class NotImplementedError extends AppError {
  constructor(message = '该功能尚未实现', details) {
    super(message, { status: 501, code: 'NOT_IMPLEMENTED', details });
  }
}

module.exports = {
  AppError,
  BadRequestError,
  NotFoundError,
  EngineUnavailableError,
  UpstreamError,
  NotImplementedError,
};
