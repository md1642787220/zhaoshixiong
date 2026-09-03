/* ============================================================
 * infrastructure/ffmpeg.js - ffmpeg 外部命令适配
 * 职责：隔离对 ffmpeg 可执行文件的依赖，向上层暴露
 *       isAvailable() 与 run() 两个能力，便于替换或 mock。
 * ============================================================ */
const { execFile } = require('child_process');

const DEFAULT_TIMEOUT = 15 * 60 * 1000; // 15 分钟

/**
 * 创建 ffmpeg 适配器
 * @param {{logger: object, timeout?: number}} deps
 */
function createFfmpeg({ logger, timeout = DEFAULT_TIMEOUT }) {
  let availableCache;

  /** 检测 ffmpeg 是否可用（结果缓存） */
  function isAvailable() {
    if (availableCache !== undefined) return Promise.resolve(availableCache);
    return new Promise((resolve) => {
      execFile('ffmpeg', ['-version'], (err) => {
        availableCache = !err;
        if (logger) logger.debug(`ffmpeg 可用状态: ${availableCache}`);
        resolve(availableCache);
      });
    });
  }

  /**
   * 执行 ffmpeg 命令
   * @param {string[]} args
   * @returns {Promise<void>}
   */
  function run(args) {
    return new Promise((resolve, reject) => {
      execFile(
        'ffmpeg',
        args,
        { timeout, maxBuffer: 10 * 1024 * 1024 },
        (err, _stdout, stderr) => {
          if (err) {
            const tail = (stderr || err.message || '')
              .split('\n')
              .filter(Boolean)
              .slice(-3)
              .join(' ');
            reject(new Error(tail || 'ffmpeg 执行失败'));
            return;
          }
          resolve();
        }
      );
    });
  }

  return { isAvailable, run };
}

module.exports = { createFfmpeg };
