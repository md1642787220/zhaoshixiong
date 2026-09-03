/* ============================================================
 * api/client.js - HTTP 请求封装
 * ============================================================ */
import { API, API_BASE } from '../core/config.js';

function url(path) {
  return API + API_BASE + path;
}

/** JSON 请求：非 2xx 时抛出后端返回的 message */
export async function apiJson(path, options) {
  const res = await fetch(url(path), options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `请求失败（${res.status}）`);
  return data;
}

/** 文件上传（multipart）：返回 Blob（用于下载结果文件） */
export async function postFileForBlob(path, file, extra) {
  const fd = new FormData();
  fd.append('file', file);
  Object.entries(extra || {}).forEach(([k, v]) => fd.append(k, v));
  const res = await fetch(url(path), { method: 'POST', body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `请求失败（${res.status}）`);
  }
  return res.blob();
}

/** 文件上传（multipart）：返回 JSON */
export async function postFileForJson(path, file, extra) {
  const fd = new FormData();
  fd.append('file', file);
  Object.entries(extra || {}).forEach(([k, v]) => fd.append(k, v));
  return apiJson(path, { method: 'POST', body: fd });
}
