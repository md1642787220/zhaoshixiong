/* ============================================================
 * views/handwriting.js - 手写体转换工具
 * 将一段打印体文字转换为手写体图片（接口已预留，后端逐步实现）。
 *   接口契约：POST /api/tools/handwriting { text, style } -> 手写体图片 Blob
 * ============================================================ */
import { toolsApi } from '../api/tools.js';
import { toolPage } from './toolLayout.js';
import { downloadBlob, setStatus, toast } from '../utils.js';

const MAX = 2000;

function body() {
  return `
  <div class="field">
    <label>手写风格 <span class="f-opt">（后续开放更多风格，目前统一处理）</span></label>
    <select id="hw-style" class="input">
      <option value="default">默认手写体</option>
      <option value="kaishu">楷书</option>
      <option value="xingshu">行书</option>
    </select>
  </div>
  <div class="field">
    <label>输入文字 <span class="req">*</span></label>
    <textarea id="hw-input" class="input" rows="8" maxlength="${MAX}"
      placeholder="输入要转换为手写体的文字，最多 ${MAX} 字…"></textarea>
    <div class="f-hint"><span id="hw-count">0</span> / ${MAX}</div>
  </div>
  <button class="btn btn-primary" id="hw-btn">生成手写体</button>
  <div class="field" id="hw-result-wrap" style="display:none; margin-top:18px;">
    <label>转换结果
      <button class="linklike" id="hw-dl">下载图片</button>
    </label>
    <div class="hw-preview"><img id="hw-img" alt="手写体预览"></div>
  </div>
  <div class="status" id="hw-status"></div>`;
}

export default {
  title: '手写体转换 · 师兄',
  nav: '/tools',

  render() {
    return toolPage('handwriting', body());
  },

  mount() {
    const input = document.getElementById('hw-input');
    const styleSel = document.getElementById('hw-style');
    const btn = document.getElementById('hw-btn');
    const wrap = document.getElementById('hw-result-wrap');
    const img = document.getElementById('hw-img');
    const status = document.getElementById('hw-status');
    const count = document.getElementById('hw-count');
    const dlBtn = document.getElementById('hw-dl');
    let lastUrl = null;

    input.addEventListener('input', () => { count.textContent = input.value.length; });

    btn.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) { setStatus(status, 'err', '请先输入要转换的文字'); return; }
      if (text.length > MAX) { setStatus(status, 'err', `文字不能超过 ${MAX} 字`); return; }
      setStatus(status, 'processing', '正在生成手写体…');
      btn.disabled = true;
      try {
        const { blob, filename } = await toolsApi.handwriting(text, styleSel.value);
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(blob);
        img.src = lastUrl;
        img.dataset.filename = filename;
        wrap.style.display = '';
        setStatus(status, 'ok', '生成完成，可下载图片');
      } catch (e) {
        setStatus(status, 'err', e.message);
      } finally {
        btn.disabled = false;
      }
    });

    dlBtn.addEventListener('click', () => {
      if (lastUrl) downloadBlob(lastUrl, img.dataset.filename || 'handwriting.png');
    });

    // 离开页面时释放预览 URL，避免内存泄漏
    window.addEventListener('hashchange', () => {
      if (lastUrl) { URL.revokeObjectURL(lastUrl); lastUrl = null; }
    });
  },
};
