/* ============================================================
 * services/mediaService.js - 音视频处理业务逻辑
 * 职责：音频提取、视频截取。依赖（ffmpeg、storage）由外部注入，
 *       便于替换实现或单元测试。
 * ============================================================ */
const { BadRequestError, EngineUnavailableError } = require('../core/errors');

/** 支持 "90"、"01:30"、"00:01:30.5" 等格式，返回秒数；非法返回 null */
function parseTime(t) {
  if (typeof t !== 'string' || !t.trim()) return null;
  if (!/^\d{1,3}(:\d{1,2}){0,2}(\.\d+)?$/.test(t.trim())) return null;
  return t.trim().split(':').reduce((acc, x) => acc * 60 + parseFloat(x), 0);
}

/**
 * 创建媒体服务
 * @param {{ffmpeg: object, storage: object, logger: object}} deps
 */
function createMediaService({ ffmpeg, storage, logger }) {
  /** 服务状态：ffmpeg 可用性 */
  async function status() {
    return { server: 'ok', ffmpeg: await ffmpeg.isAvailable() };
  }

  /**
   * 从视频提取音轨为 MP3
   * @returns {Promise<{filePath: string, filename: string, mime: string}>}
   */
  async function extractAudio({ sourcePath, originalName }) {
    if (!(await ffmpeg.isAvailable())) {
      throw new EngineUnavailableError('ffmpeg');
    }
    const out = storage.tmpFile('.mp3');
    try {
      await ffmpeg.run(['-y', '-i', sourcePath, '-vn', '-acodec', 'libmp3lame', '-b:a', '192k', out]);
      return {
        filePath: out,
        filename: `${baseName(originalName) || 'audio'}-音频.mp3`,
        mime: 'audio/mpeg',
      };
    } catch (err) {
      storage.remove(out);
      throw new Error(`音频提取失败（需服务器安装 ffmpeg）：${err.message}`);
    }
  }

  /**
   * 按起止时间截取视频片段
   * @returns {Promise<{filePath: string, filename: string, mime: string}>}
   */
  async function clipVideo({ sourcePath, originalName, start, end }) {
    if (!(await ffmpeg.isAvailable())) {
      throw new EngineUnavailableError('ffmpeg');
    }
    const startSec = parseTime(start);
    const endSec = parseTime(end);

    if (startSec === null && endSec === null) {
      throw new BadRequestError('请填写开始或结束时间（支持 90 或 00:01:30 格式）');
    }
    if (startSec !== null && endSec !== null && endSec <= startSec) {
      throw new BadRequestError('结束时间必须大于开始时间');
    }

    const ext = (originalName && originalName.match(/\.[^.]+$/)?.[0]) || '.mp4';
    const out = storage.tmpFile(ext);
    try {
      const args = ['-y'];
      if (startSec !== null) args.push('-ss', String(startSec));
      if (endSec !== null) args.push('-to', String(endSec));
      args.push('-i', sourcePath, '-c', 'copy', out);
      await ffmpeg.run(args);
      return {
        filePath: out,
        filename: `${baseName(originalName, ext) || 'video'}-片段${ext}`,
        mime: 'video/mp4',
      };
    } catch (err) {
      storage.remove(out);
      throw new Error(`视频提取失败（需服务器安装 ffmpeg）：${err.message}`);
    }
  }

  function baseName(name, ext = '') {
    if (!name) return '';
    if (ext && name.endsWith(ext)) return name.slice(0, -ext.length);
    return name.replace(/\.[^.]+$/, '');
  }

  if (logger) logger.debug('媒体服务已就绪');

  return { status, extractAudio, clipVideo };
}

module.exports = { createMediaService };
