/* ============================================================
 * core/logger.js - 日志模块
 * 职责：统一日志格式与级别，便于后续替换为文件/Sentry 等实现。
 * ============================================================ */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * 创建日志记录器
 * @param {{level?: string, base?: object, write?: function}} options
 */
function createLogger({ level = 'info', base = {}, write } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const output = write || ((line) => {
    // eslint-disable-next-line no-console
    (LEVELS[level] >= LEVELS.warn ? console.error : console.log)(line);
  });

  function emit(name, message, meta) {
    if ((LEVELS[name] ?? 99) < threshold) return;
    const time = new Date().toISOString();
    const prefix = Object.keys(base).length ? ` ${JSON.stringify(base)}` : '';
    const suffix = meta !== undefined
      ? ` ${meta instanceof Error ? meta.stack || meta.message : JSON.stringify(meta)}`
      : '';
    output(`[${time}] [${name.toUpperCase()}]${prefix} ${message}${suffix}`);
  }

  return {
    debug: (msg, meta) => emit('debug', msg, meta),
    info: (msg, meta) => emit('info', msg, meta),
    warn: (msg, meta) => emit('warn', msg, meta),
    error: (msg, meta) => emit('error', msg, meta),
    /** 派生带固定上下文的子日志器 */
    child(extra) {
      return createLogger({ level, base: { ...base, ...extra }, write });
    },
  };
}

module.exports = { createLogger, LEVELS };
