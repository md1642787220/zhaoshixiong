/* ============================================================
 * utils.js - 通用工具函数
 * ============================================================ */

/** HTML 转义，防注入 */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** 字节数格式化 */
export function fmtSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  return (bytes / 1024 ** 3).toFixed(2) + ' GB';
}

/** 触发浏览器下载 Blob */
export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** 复制文本到剪贴板（带降级方案） */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/* ============ Toast 轻提示 ============ */
let toastRoot = null;

export function ensureToastRoot() {
  if (!toastRoot) {
    toastRoot = document.createElement('div');
    toastRoot.id = 'toast-root';
    document.body.appendChild(toastRoot);
  }
}

export function toast(msg) {
  ensureToastRoot();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  toastRoot.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 350);
  }, 2400);
}

/* ============ 状态条 ============ */
/**
 * 更新 .status 元素内容
 * @param {HTMLElement} el   状态元素
 * @param {string} state    '' | 'ok' | 'err' | 'processing'
 * @param {string} [msg]    提示文案
 */
export function setStatus(el, state, msg) {
  if (!el) return;
  el.className = 'status ' + state;
  if (state === 'processing') {
    el.innerHTML = '<span class="spinner"></span>' + esc(msg || '处理中，请稍候…');
  } else if (state === 'ok') {
    el.textContent = msg || '处理完成';
  } else if (state === 'err') {
    el.textContent = msg || '处理失败';
  } else {
    el.textContent = '';
  }
}

/** 移除文件扩展名 */
export function stripExt(name) {
  return (name || '').replace(/\.[^.]+$/, '');
}
