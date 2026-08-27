/* ============================================================
 * lib/stirling.js - Stirling-PDF 转发层
 *
 * 用途：当后端配置了 STIRLING_API_URL 时，把「需引擎」的 PDF
 *       功能转发到独立部署的 Stirling-PDF 实例（云服务器）。
 *       未配置时，这些功能继续返回本机降级提示（免费层）。
 *
 * 环境变量：
 *   STIRLING_API_URL   Stirling-PDF 服务地址，如 http://10.0.0.5:8080
 *   STIRLING_TIMEOUT   转发超时（毫秒），默认 60000
 *
 * Stirling-PDF 约定（通用）：
 *   POST {base}/api/v1/convert/{...}       multipart: fileInput=文件
 *   其它端点多为 POST {base}/api/v1/{...}   multipart: fileInput
 * ============================================================ */
const fs = require('fs');
const path = require('path');

let FormData, fetchImpl;
try {
  FormData = require('form-data');
  fetchImpl = require('node-fetch');
} catch { /* 依赖未装时禁用转发 */ }

const BASE = process.env.STIRLING_API_URL || '';
const TIMEOUT = parseInt(process.env.STIRLING_TIMEOUT, 10) || 60000;

/** 是否启用转发 */
function enabled() {
  return !!(BASE && FormData && fetchImpl);
}

/**
 * action → Stirling-PDF 端点映射
 * 值：{ path: '相对路径（不含 /api/v1 前缀也可）', method?: 'POST' }
 * 注意：Stirling-PDF 端点随版本可能变化，此处集中维护，便于云服务器实测后微调。
 */
const ACTION_MAP = {
  /* 转换 */
  'convert-office': {
    path: (params) => {
      const t = (params && params.target || 'docx').toLowerCase();
      if (t === 'xlsx') return '/api/v1/convert/pdf/xlsx';
      if (t === 'pptx') return '/api/v1/convert/pdf/presentation';
      return '/api/v1/convert/pdf/word';
    },
    paramsMap: { target: 'outputFormat' },
    defaults: { pageNumbers: 'all' },
  },
  'to-pdf':          { path: '/api/v1/convert/file/pdf', drop: ['engine'] },
  'to-pdfa':         {
    path: '/api/v1/convert/pdf/pdfa',
    paramsMap: { level: 'outputFormat' },
    valueMap: { level: { 'PDF/A-1b': 'pdfa-1b', 'PDF/A-2b': 'pdfa-2b', 'PDF/A-3b': 'pdfa-3b' } },
  },
  'html-to-pdf':     { path: '/api/v1/convert/html/pdf' },
  'to-presentation': { path: '/api/v1/convert/pdf/presentation', paramsMap: { format: 'outputFormat' } },
  'to-image':        {
    path: '/api/v1/convert/pdf/img',
    paramsMap: { format: 'imageFormat' },
    valueMap: { single: { '1': 'single', '0': 'multiple' } },
    defaults: { pageNumbers: 'all', singleOrMultiple: 'multiple', colorType: 'color' },
  },
  /* 安全 */
  'remove-password': { path: '/api/v1/security/remove-password' },
  'cert-sign':       { path: '/api/v1/security/cert-sign' },
  'remove-cert-sign':{ path: '/api/v1/security/remove-cert-sign' },
  'validate-signature': { path: '/api/v1/security/validate-signature' },
  'redact':          { path: '/api/v1/security/redact' },
  /* 高级 */
  'show-js':         { path: '/api/v1/misc/show-javascript' },
  'scanner-split':   { path: '/api/v1/misc/auto-split-pdf' },
  'unlock-forms':    { path: '/api/v1/misc/unlock-pdf-forms' },
  /* 其他 */
  'ocr':             { path: '/api/v1/misc/ocr-pdf' },
  'single-large-page': { path: '/api/v1/general/pdf-to-single-page' },
};

/**
 * 转发请求到 Stirling-PDF
 * @param {string} action  与后端一致的工具 action
 * @param {Buffer[]} files 上传的文件（取第一个作为 fileInput）
 * @param {object} params  表单参数
 * @returns {Promise<{ok:boolean, buffer?:Buffer, contentType?:string, filename?:string, message?:string, status?:number}>}
 */
async function forward(action, files, params = {}) {
  if (!enabled()) {
    return { ok: false, message: 'Stirling-PDF 转发未启用（未配置 STIRLING_API_URL）' };
  }
  const map = ACTION_MAP[action];
  if (!map) {
    return { ok: false, message: `action「${action}」未配置 Stirling 转发端点` };
  }
  if (!files || !files.length) {
    return { ok: false, message: '缺少上传文件' };
  }

  const targetPath = typeof map.path === 'function' ? map.path(params) : map.path;
  const url = BASE.replace(/\/$/, '') + targetPath;
  const first = files[0];
  const buf = Buffer.isBuffer(first) ? first : (first && first.buf);
  if (!buf) return { ok: false, message: '缺少上传文件' };
  const filename = (first && first.name) || 'input.pdf';
  const mime = (first && first.mimetype) || 'application/pdf';

  // 参数映射（字段名转换、值转换、丢弃多余参数、补默认值）
  const mappedParams = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (map.drop && map.drop.includes(k)) return;
    const newKey = (map.paramsMap && map.paramsMap[k]) || k;
    let newVal = v;
    if (map.valueMap && map.valueMap[k]) {
      const vm = map.valueMap[k];
      newVal = vm[String(v)] !== undefined ? vm[String(v)] : (vm[v] !== undefined ? vm[v] : v);
    }
    mappedParams[newKey] = newVal;
  });
  if (map.defaults) {
    Object.entries(map.defaults).forEach(([k, v]) => {
      if (mappedParams[k] === undefined) mappedParams[k] = v;
    });
  }

  const form = new FormData();
  form.append('fileInput', buf, { filename, contentType: mime });
  Object.entries(mappedParams).forEach(([k, v]) => form.append(k, String(v)));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      signal: ctrl.signal,
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, status: res.status, message: `Stirling-PDF 返回错误（${res.status}）：${errText.slice(0, 300)}` };
    }
    if (contentType.includes('application/json')) {
      const json = await res.json().catch(() => ({}));
      // Stirling 某些端点返回 JSON（如 compare 返回文本差异）
      return { ok: true, json, contentType };
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const cd = res.headers.get('content-disposition') || '';
    const m = cd.match(/filename="?([^";]+)"?/);
    return { ok: true, buffer, contentType, filename: m ? m[1] : 'result' };
  } catch (e) {
    return { ok: false, message: `转发 Stirling-PDF 失败：${e.name === 'AbortError' ? '超时' : (e.message || e)}` };
  } finally {
    clearTimeout(timer);
  }
}

/** 判断某 action 是否走 Stirling 转发 */
function isForwardable(action) {
  return Object.prototype.hasOwnProperty.call(ACTION_MAP, action);
}

module.exports = { enabled, forward, isForwardable, ACTION_MAP, BASE };
