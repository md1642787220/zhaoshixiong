/* ============================================================
 * services/handwritingService.js - 手写体转换（接口占位）
 * 职责：将一段打印体文字转换为手写体图片。
 *       当前后端暂未实现具体转换逻辑，仅预留接口契约，
 *       待服务端具备字体渲染能力后填充 convert()。
 *
 *   convert({ text, style }) -> { filePath, filename, mime }
 *     成功时返回生成的图片文件信息，由路由以文件流响应；
 *     当前实现抛出 NotImplementedError，等待后端逐步落地。
 * ============================================================ */
const { NotImplementedError } = require('../core/errors');

function createHandwritingService({ storage, logger } = {}) {
  /**
   * 将打印体文字转手写体图片
   * @param {{text: string, style?: string}} params
   * @returns {Promise<{filePath: string, filename: string, mime: string}>}
   */
  async function convert({ text, style = 'default' } = {}) {
    if (logger) logger.debug(`手写体转换请求（待实现）: style=${style}, len=${String(text || '').length}`);
    // TODO: 接入字体渲染引擎（如 PIL + 手写字体 / 在线手写 API），
    //   将 text 渲染为图片并写入 storage，返回其路径与下载文件名：
    //   const name = `hw-${Date.now()}.png`;
    //   const filePath = await storage.save(buffer, name); // 或临时文件
    //   return { filePath, filename: name, mime: 'image/png' };
    throw new NotImplementedError('手写体转换功能开发中，敬请期待');
  }

  return { convert };
}

module.exports = { createHandwritingService };
