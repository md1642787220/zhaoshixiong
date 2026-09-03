/* ============================================================
 * core/uploadStore.js - 全局「已上传文件」状态（跨页面共享）
 * 按文件真实类型分组（pdf / txt / video / image ...），
 * 切换页面后同类型文件仍保留并显示，避免重复上传。
 * ============================================================ */
const byType = Object.create(null);   // type -> [{ id, type, name, size, file }]
const listeners = [];
let seq = 0;

function emit() {
  listeners.forEach((fn) => fn(byType));
}

/** 订阅变化，返回取消订阅函数 */
export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

/** 取某类型的已上传文件（返回副本） */
export function getUploaded(type) {
  return (byType[type] || []).slice();
}

/**
 * 登记一个已上传文件
 * @param {string} type  文件类型分组（如 'pdf' / 'txt' / 'video'）
 * @param {File} file
 * @param {{ replace?: boolean }} [opts] replace=true 时清空同类型旧文件（单文件场景）
 */
export function addUploaded(type, file, opts = {}) {
  if (!byType[type]) byType[type] = [];
  const item = { id: ++seq, type, name: file.name, size: file.size, file };
  if (opts.replace) byType[type] = [item];
  else byType[type].push(item);
  emit();
  return item;
}

/** 按 id 移除某类型下的一个文件 */
export function removeUploaded(type, id) {
  if (!byType[type]) return;
  byType[type] = byType[type].filter((it) => it.id !== id);
  if (!byType[type].length) delete byType[type];
  emit();
}

function isWildcard(a) {
  return /\/\*/.test(a || '');
}

/** 从 accept 推导单一类型（用于 *./* 通配或单个扩展名兜底） */
export function deriveType(accept) {
  if (!accept) return 'file';
  const a = String(accept).trim();
  if (a.startsWith('.')) {
    const ext = a.split(',')[0].trim().replace(/^\./, '').toLowerCase();
    return ext || 'file';
  }
  if (isWildcard(a)) return a.split('/')[0].toLowerCase();
  return 'file';
}

/** 给定 accept，返回允许的文件类型集合（Set） */
export function acceptTypes(accept) {
  if (!accept) return new Set(['file']);
  const a = String(accept).trim();
  if (isWildcard(a)) return new Set([deriveType(a)]);
  if (a.startsWith('.')) {
    return new Set(a.split(',').map((s) => s.trim().replace(/^\./, '').toLowerCase()).filter(Boolean));
  }
  return new Set(['file']);
}

/** 由文件本身决定分组类型（通配 accept 下退化为 accept 派生） */
export function typeOfFile(file, accept) {
  if (accept && isWildcard(accept)) return deriveType(accept);
  const name = (file && file.name) || '';
  const m = name.match(/\.([^.]+)$/);
  if (m) return m[1].toLowerCase();
  if (accept) return deriveType(accept);
  return 'file';
}

/** 取与某 accept 兼容的已上传文件（跨类型合并，各类型取最新一个） */
export function getCompatible(accept) {
  const set = acceptTypes(accept);
  const out = [];
  set.forEach((t) => {
    const arr = getUploaded(t);
    if (arr.length) out.push(arr[arr.length - 1]);
  });
  return out;
}
