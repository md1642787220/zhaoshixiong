/* ============================================================
 * config/index.js - 配置管理
 * 职责：集中读取、归一化环境变量，向其他层提供只读配置对象。
 * 其他模块不得直接读取 process.env，必须由此处注入。
 * ============================================================ */
const path = require('path');

/** 字符串转整数，失败时回退 */
function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** 字符串转布尔，支持 1/true/yes/on */
function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

/**
 * 加载配置
 * @param {NodeJS.ProcessEnv} env 环境变量来源（便于测试时注入）
 */
function loadConfig(env = process.env) {
  const rootDir = path.resolve(__dirname, '..', '..');

  return Object.freeze({
    env: env.NODE_ENV || 'development',

    server: Object.freeze({
      port: toInt(env.PORT, 3000),
      host: env.HOST || '0.0.0.0',
    }),

    limits: Object.freeze({
      uploadBytes: toInt(env.UPLOAD_LIMIT_MB, 500) * 1024 * 1024,
      jsonBody: env.JSON_BODY_LIMIT || '20mb',
    }),

    /** 同端口托管前端静态资源 */
    frontend: Object.freeze({
      dir: env.FRONTEND_DIR || path.join(rootDir, 'frontend'),
      enabled: toBool(env.SERVE_FRONTEND, true),
    }),

    /** Python PDF Worker 服务 */
    pdfWorker: Object.freeze({
      url: env.PDF_WORKER_URL || '',
      timeoutMs: toInt(env.PDF_WORKER_TIMEOUT, 120000),
    }),

    log: Object.freeze({
      level: env.LOG_LEVEL || 'info',
    }),
  });
}

module.exports = { loadConfig, toInt, toBool };
