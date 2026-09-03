/* ============================================================
 * services/convertService.js - 格式转换业务逻辑
 * 职责：Markdown / JSON / CSV 互转，纯函数式，无 HTTP 与文件依赖。
 * ============================================================ */
const { marked } = require('marked');
const { BadRequestError } = require('../core/errors');

/** CSV 文本解析为二维数组 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r[0] || '').trim() !== '');
}

/** 需要转义时加引号 */
function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** JSON 数组 -> CSV */
function jsonToCsv(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new BadRequestError('JSON 格式不合法'); }
  if (!Array.isArray(data) || !data.length) {
    throw new BadRequestError('JSON 顶层需为非空数组（对象列表）');
  }
  if (typeof data[0] !== 'object' || data[0] === null) {
    throw new BadRequestError('数组元素需为对象');
  }
  const keys = [...new Set(data.flatMap((o) => Object.keys(o || {})))];
  return [keys.join(','), ...data.map((o) => keys.map((k) => escapeCsvCell(o?.[k])).join(','))].join('\r\n');
}

/** CSV -> JSON 字符串 */
function csvToJson(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new BadRequestError('CSV 内容为空');
  const header = rows[0].map((h) => h.trim());
  const list = rows
    .slice(1)
    .filter((r) => r.some((c) => c !== ''))
    .map((r) => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = r[i] ?? ''; });
      return obj;
    });
  return JSON.stringify(list, null, 2);
}

/**
 * 创建转换服务
 * @param {{logger: object}} deps
 */
function createConvertService({ logger } = {}) {
  /** 支持的转换类型 */
  const supported = ['md2html', 'json2csv', 'csv2json'];

  /**
   * 执行转换
   * @param {{type: string, content: string}} params
   * @returns {Promise<{result: string}>}
   */
  async function convert({ type, content }) {
    if (typeof content !== 'string' || !content.trim()) {
      throw new BadRequestError('请输入要转换的内容');
    }
    if (!supported.includes(type)) {
      throw new BadRequestError('不支持的转换类型');
    }

    if (logger) logger.debug(`转换请求 type=${type}`);

    if (type === 'md2html') return { result: marked.parse(content, { async: false }) };
    if (type === 'json2csv') return { result: jsonToCsv(content) };
    return { result: csvToJson(content) };
  }

  return { convert, supported };
}

module.exports = { createConvertService };
