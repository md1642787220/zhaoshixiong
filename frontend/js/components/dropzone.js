/* ============================================================
 * components/dropzone.js - 拖拽上传组件
 * ============================================================ */
import { esc, fmtSize } from '../utils.js';

/**
 * 初始化拖拽上传区
 * @param {HTMLElement} zone     拖拽区元素
 * @param {HTMLInputElement} input 隐藏的 file input
 * @param {HTMLElement} info     文件信息展示元素
 * @param {(file: File) => void} onPick 选中文件回调
 */
export function setupDropzone(zone, input, info, onPick) {
  const show = (f) => {
    info.innerHTML = `已选择：<b>${esc(f.name)}</b>（${fmtSize(f.size)}）`;
    onPick(f);
  };

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files[0]) show(input.files[0]);
  });

  ['dragover', 'dragenter'].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag'); }));
  zone.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if (f) show(f);
  });
}
