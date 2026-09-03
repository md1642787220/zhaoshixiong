/* ============================================================
 * components/dropzone.js - 拖拽上传组件（支持单文件 / 多文件）
 * 提供两种用法：
 *   1) setupDropzone(...)  低层封装（保留旧调用，用于视频/音频/文本页）
 *   2) Dropzone(zoneEl, opts)  工厂，返回带 getFiles() 的实例
 *
 * 两种用法都会把「已上传文件」登记到全局 uploadStore，
 * 并在上传区明确标注「已上传」徽标；同一文件类型（pdf/txt/video/...）
 * 跨页面共享，切换页面后仍可见、可复用。
 * ============================================================ */
import { esc, fmtSize } from '../utils.js';
import * as uploadStore from '../core/uploadStore.js';

/**
 * 初始化拖拽上传区（低层）
 * @param {HTMLElement} zone     拖拽区元素
 * @param {HTMLInputElement} input 隐藏的 file input
 * @param {HTMLElement} info     文件信息展示元素
 * @param {(picked: File|File[]) => void} onPick 选中回调
 * @param {{ multiple?: boolean, type?: string }} [options]
 */
export function setupDropzone(zone, input, info, onPick, options = {}) {
  const multiple = !!options.multiple;
  input.multiple = multiple;
  const acceptAttr = input.getAttribute('accept');

  const markUploaded = (f) => {
    const t = uploadStore.typeOfFile(f, acceptAttr);
    uploadStore.addUploaded(t, f, { replace: !multiple });
    if (info) {
      info.innerHTML = `✓ 已上传：<b>${esc(f.name)}</b>（${fmtSize(f.size)}）`;
      info.classList.add('uploaded');
    }
  };

  const show = (fileList) => {
    const list = Array.from(fileList || []).filter(Boolean);
    if (!list.length) return;
    if (multiple) { list.forEach(markUploaded); onPick(list); }
    else { const f = list[0]; markUploaded(f); onPick(f); }
  };

  // 跨页面：若全局已有同类型已上传文件，自动回显
  const compat = uploadStore.getCompatible(acceptAttr);
  if (compat.length) show([compat[compat.length - 1].file]);

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files.length) show(input.files); input.value = ''; });
  ['dragover', 'dragenter'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag'); }));
  zone.addEventListener('drop', e => { if (e.dataTransfer.files.length) show(e.dataTransfer.files); });
}

/**
 * 工厂：在给定容器内构建拖拽上传区，返回实例
 * @param {HTMLElement} container  容器
 * @param {{ multiple?: boolean, accept?: string, label?: string }} opts
 * @returns {{ getFiles(): File[], el: HTMLElement, onChange: (fn)=>void, destroy: ()=>void }}
 */
export function Dropzone(container, opts = {}) {
  const multiple = !!opts.multiple;
  const accept = opts.accept || '.pdf';
  const label = opts.label || '拖入文件 / 点击选择';
  const maxSize = opts.maxSize || 0;
  const onError = opts.onError || null;
  const maxSizeHint = maxSize ? ` · 单个文件 ≤ ${fmtSize(maxSize)}` : '';
  const allowed = uploadStore.acceptTypes(accept);
  container.classList.add('dropzone-wrap');
  container.innerHTML = `
    <div class="dropzone" tabindex="0">
      <input type="file" class="dz-input" ${multiple ? 'multiple' : ''} accept="${esc(accept)}" hidden>
      <div class="dz-inner">
        <div class="dz-icon">${esc('↑')}</div>
        <div class="dz-label">${esc(label)}</div>
        <div class="dz-hint">支持 ${esc(accept)}${maxSizeHint}</div>
      </div>
    </div>
    <div class="dz-list"></div>`;

  const zone = container.querySelector('.dropzone');
  const input = container.querySelector('.dz-input');
  const listEl = container.querySelector('.dz-list');
  const listeners = [];
  let unsub = null;
  let errors = [];

  const getFiles = () => {
    const out = [];
    allowed.forEach((t) => uploadStore.getUploaded(t).forEach((it) => out.push(it.file)));
    return out;
  };

  const render = () => {
    // 实例已从文档移除时，自动退订，避免操作脱离的 DOM
    if (!container.isConnected) { if (unsub) unsub(); return; }
    const items = [];
    allowed.forEach((t) => uploadStore.getUploaded(t).forEach((it) => items.push(it)));
    const errHtml = errors.length
      ? `<div class="dz-error">${errors.map((e) => esc(e.msg)).join('<br>')}</div>`
      : '';
    if (!items.length) { listEl.innerHTML = errHtml; return; }
    listEl.innerHTML = errHtml + items.map((it) => `
      <div class="dz-file">
        <span class="dz-badge">已上传</span>
        <span class="dz-name" title="${esc(it.name)}">${esc(it.name)}</span>
        <span class="dz-size">${fmtSize(it.size)}</span>
        <button type="button" class="dz-del" data-type="${esc(it.type)}" data-id="${it.id}" title="移除">×</button>
      </div>`).join('');
    listEl.querySelectorAll('.dz-del').forEach((b) => b.addEventListener('click', () => {
      uploadStore.removeUploaded(b.dataset.type, +b.dataset.id);
      listeners.forEach((fn) => fn(getFiles()));
    }));
  };

  const add = (fileList) => {
    const arr = Array.from(fileList || []).filter(Boolean);
    if (!arr.length) return;
    const accepted = [];
    const rejected = [];
    arr.forEach((f) => {
      if (maxSize && f.size > maxSize) rejected.push(f);
      else accepted.push(f);
    });
    const limitText = maxSize ? fmtSize(maxSize) : '';
    errors = rejected.map((f) => ({
      msg: `文件「${f.name}」(${fmtSize(f.size)}) 超过 ${limitText} 限制，请压缩或拆分后重试。`,
    }));
    if (rejected.length && onError) {
      rejected.forEach((f) => onError(f, `文件「${f.name}」(${fmtSize(f.size)}) 超过 ${limitText} 限制，请压缩或拆分后重试。`));
    }
    accepted.forEach((f) => uploadStore.addUploaded(uploadStore.typeOfFile(f, accept), f, { replace: !multiple }));
    render();
    listeners.forEach((fn) => fn(getFiles()));
  };

  // 初始化即从全局 store 取同类型文件（跨页面预填）
  render();
  unsub = uploadStore.subscribe(() => render());

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files.length) add(input.files); input.value = ''; });
  ['dragover', 'dragenter'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag'); }));
  zone.addEventListener('drop', e => { if (e.dataTransfer.files.length) add(e.dataTransfer.files); });

  return {
    el: zone,
    getFiles,
    onChange: (fn) => listeners.push(fn),
    destroy: () => { if (unsub) unsub(); },
  };
}
