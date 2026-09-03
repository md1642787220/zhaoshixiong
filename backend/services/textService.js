/* ============================================================
 * services/textService.js - 文本提取业务逻辑
 * 职责：从 PDF / TXT / MD / CSV / JSON 中提取纯文本。
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { BadRequestError } = require('../core/errors');

const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json'];

/**
 * 创建文本提取服务
 * @param {{logger: object}} deps
 */
function createTextService({ logger } = {}) {
  /**
   * 提取文本
   * @param {{filePath: string, originalName: string}} params
   * @returns {Promise<{text: string, pages?: number}>}
   */
  async function extract({ filePath, originalName }) {
    if (!filePath) throw new BadRequestError('请选择文件');

    const ext = path.extname(originalName || '').toLowerCase();

    if (ext === '.pdf') {
      return extractFromPdf(filePath);
    }
    if (TEXT_EXTENSIONS.includes(ext)) {
      return { text: fs.readFileSync(filePath, 'utf8') };
    }
    throw new BadRequestError('暂仅支持 PDF / TXT / MD / CSV / JSON 文件');
  }

  /** PDF 文本提取（延迟加载 pdf-parse） */
  async function extractFromPdf(filePath) {
    // eslint-disable-next-line global-require
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    try {
      const data = await pdfParse(fs.readFileSync(filePath));
      return { text: (data.text || '').trim(), pages: data.numpages };
    } catch (err) {
      if (logger) logger.warn(`PDF 文本提取失败: ${err.message}`);
      throw new Error('文本提取失败：' + (err.message || err));
    }
  }

  return { extract };
}

module.exports = { createTextService };
