/* ============================================================
 * components/pdfPreview.js - 轻量 PDF 预览组件
 * 基于浏览器原生 PDF 渲染（<iframe> + Blob URL），零第三方依赖。
 * 上传后自动预览原文件；处理完成后可切换到「处理结果」查看。
 * ============================================================ */
import { esc, downloadBlob } from '../utils.js';
import { icon } from './icon.js';

/**
 * 在容器内创建 PDF 预览
 * @param {HTMLElement} container 容器元素
 * @param {{title?: string}} [opts]
 * @returns {{showFile: Function, showResult: Function, clear: Function, destroy: Function, el: HTMLElement}}
 */
export function PdfPreview(container, opts = {}) {
  const title = opts.title || '预览';

  container.classList.add('pdf-preview');
  container.innerHTML = `
    <div class="pv-head">
      <span class="pv-title">${icon('file', 16)} ${esc(title)}</span>
      <div class="pv-tabs">
        <button type="button" class="pv-tab active" data-src="source" disabled>原文件</button>
        <button type="button" class="pv-tab" data-src="result" disabled>处理结果</button>
      </div>
      <div class="pv-actions">
        <button type="button" class="linklike" data-act="open" disabled>新窗口打开</button>
        <button type="button" class="linklike" data-act="download" disabled>下载</button>
        <button type="button" class="linklike" data-act="toggle">收起</button>
      </div>
    </div>
    <div class="pv-body">
      <div class="pv-empty">上传 PDF 后自动预览，处理结果也会显示在这里</div>
      <iframe class="pv-frame" title="PDF 预览" hidden></iframe>
    </div>`;

  const bodyEl = container.querySelector('.pv-body');
  const frame = container.querySelector('.pv-frame');
  const emptyEl = container.querySelector('.pv-empty');
  const tabs = [...container.querySelectorAll('.pv-tab')];
  const actOpen = container.querySelector('[data-act="open"]');
  const actDown = container.querySelector('[data-act="download"]');
  const actToggle = container.querySelector('[data-act="toggle"]');

  const items = { source: null, result: null }; // 每项：{ blob, name }
  let current = 'source';
  let url = null;

  function revoke() {
    if (url) { URL.revokeObjectURL(url); url = null; }
  }

  /** 切换到某个来源（source / result）并渲染 */
  function activate(src) {
    current = src;
    tabs.forEach(t => {
      const has = Boolean(items[t.dataset.src]);
      t.disabled = !has;
      t.classList.toggle('active', t.dataset.src === src && has);
    });

    const item = items[src];
    revoke();
    if (!item) {
      frame.hidden = true;
      frame.removeAttribute('src');
      emptyEl.hidden = false;
      actOpen.disabled = true;
      actDown.disabled = true;
      return;
    }
    url = URL.createObjectURL(item.blob);
    frame.src = url;
    frame.hidden = false;
    emptyEl.hidden = true;
    actOpen.disabled = false;
    actDown.disabled = false;
  }

  tabs.forEach(t => t.addEventListener('click', () => { if (!t.disabled) activate(t.dataset.src); }));
  actOpen.addEventListener('click', () => { if (url) window.open(url, '_blank'); });
  actDown.addEventListener('click', () => { const it = items[current]; if (it) downloadBlob(it.blob, it.name); });
  actToggle.addEventListener('click', () => {
    const collapsed = bodyEl.hidden = !bodyEl.hidden;
    actToggle.textContent = collapsed ? '展开' : '收起';
  });

  activate('source');

  return {
    /** 显示上传的原文件 */
    showFile(file) {
      items.source = { blob: file, name: file.name || 'document.pdf' };
      activate('source');
    },
    /** 显示处理结果（PDF Blob） */
    showResult(blob, name) {
      items.result = { blob, name: name || 'result.pdf' };
      activate('result');
    },
    /** 清空两者 */
    clear() {
      items.source = null;
      items.result = null;
      activate('source');
    },
    /** 释放对象 URL */
    destroy() { revoke(); },
    el: container,
  };
}
