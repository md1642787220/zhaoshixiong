/* ============================================================
 * components/dropzone.js - 拖拽上传组件（支持单文件 / 多文件）
 * 提供两种用法：
 *   1) setupDropzone(...)  低层封装（保留旧调用）
 *   2) Dropzone(zoneEl, opts)  工厂，返回带 getFiles() 的实例
 * ============================================================ */
import { esc, fmtSize } from '../utils.js';

/**
 * 初始化拖拽上传区（低层）
 * @param {HTMLElement} zone     拖拽区元素
 * @param {HTMLInputElement} input 隐藏的 file input
 * @param {HTMLElement} info     文件信息展示元素
 * @param {(picked: File|File[]) => void} onPick 选中回调
 * @param {{ multiple?: boolean }} [options]
 */
export function setupDropzone(zone, input, info, onPick, options = {}) {
  const multiple = !!options.multiple;
  input.multiple = multiple;

  const show = (fileList) => {
    const list = Array.from(fileList || []).filter(Boolean);
    if (!list.length) return;
    if (multiple) onPick(list);
    else {
      const f = list[0];
      info.innerHTML = `已选择：<b>${esc(f.name)}</b>（${fmtSize(f.size)}）`;
      onPick(f);
    }
  };

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
 * @returns {{ getFiles(): File[], el: HTMLElement, onChange: (fn)=>void }}
 */
export function Dropzone(container, opts = {}) {
  const multiple = !!opts.multiple;
  const accept = opts.accept || '.pdf';
  const label = opts.label || '拖入文件 / 点击选择';
  container.classList.add('dropzone-wrap');
  container.innerHTML = `
    <div class="dropzone" tabindex="0">
      <input type="file" class="dz-input" ${multiple ? 'multiple' : ''} accept="${esc(accept)}" hidden>
      <div class="dz-inner">
        <div class="dz-icon">${esc('↑')}</div>
        <div class="dz-label">${esc(label)}</div>
        <div class="dz-hint">支持 ${esc(accept)}</div>
      </div>
    </div>
    <div class="dz-list"></div>`;

  const zone = container.querySelector('.dropzone');
  const input = container.querySelector('.dz-input');
  const listEl = container.querySelector('.dz-list');
  let files = [];
  const listeners = [];

  const render = () => {
    if (!files.length) { listEl.innerHTML = ''; return; }
    listEl.innerHTML = files.map((f, i) => `
      <div class="dz-file">
        <span class="dz-name">${esc(f.name)}</span>
        <span class="dz-size">${fmtSize(f.size)}</span>
        <button type="button" class="dz-del" data-i="${i}" title="移除">×</button>
      </div>`).join('');
    listEl.querySelectorAll('.dz-del').forEach(b => b.addEventListener('click', () => {
      files.splice(+b.dataset.i, 1); render(); listeners.forEach(fn => fn(files));
    }));
  };

  const add = (fileList) => {
    const arr = Array.from(fileList || []).filter(Boolean);
    if (!arr.length) return;
    if (multiple) {
      const names = new Set(files.map(f => f.name + f.size));
      arr.forEach(f => { if (!names.has(f.name + f.size)) files.push(f); });
    } else {
      files = [arr[0]];
    }
    render(); listeners.forEach(fn => fn(files));
  };

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files.length) add(input.files); input.value = ''; });
  ['dragover', 'dragenter'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag'); }));
  zone.addEventListener('drop', e => { if (e.dataTransfer.files.length) add(e.dataTransfer.files); });

  return {
    el: zone,
    getFiles: () => files.slice(),
    onChange: (fn) => listeners.push(fn),
  };
}
