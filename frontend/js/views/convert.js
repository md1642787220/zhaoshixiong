/* ============================================================
 * views/convert.js - 格式转换工具
 * ============================================================ */
import { CONVERT_TYPES } from '../data/tools.js';
import { toolsApi } from '../api/tools.js';
import { toolPage } from './toolLayout.js';
import { downloadBlob, copyText, setStatus, toast } from '../utils.js';

const $ = (sel) => document.querySelector(sel);

function body() {
  return `
  <div class="field">
    <label>转换类型</label>
    <select id="cv-type" class="input">
      ${Object.entries(CONVERT_TYPES).map(([v, t]) => `<option value="${v}">${t.label}</option>`).join('')}
    </select>
  </div>
  <div class="field">
    <label>输入内容</label>
    <textarea id="cv-input" class="input mono" rows="9" placeholder="粘贴或输入 Markdown / JSON / CSV 内容…"></textarea>
  </div>
  <button class="btn btn-primary" id="cv-btn">开始转换</button>
  <div class="field" id="cv-result-wrap" style="display:none; margin-top:18px;">
    <label>转换结果
      <button class="linklike" id="cv-copy">复制</button>
      <button class="linklike" id="cv-dl">下载文件</button>
    </label>
    <textarea id="cv-result" class="input mono" rows="9" readonly></textarea>
  </div>
  <div class="status" id="cv-status"></div>`;
}

export default {
  title: '格式转换 · 师兄',
  nav: '/tools',

  render() {
    return toolPage('convert', body());
  },

  mount() {
    const typeSel = $('#cv-type');
    const input = $('#cv-input');
    const btn = $('#cv-btn');
    const wrap = $('#cv-result-wrap');
    const result = $('#cv-result');
    const status = $('#cv-status');

    btn.addEventListener('click', async () => {
      if (!input.value.trim()) {
        setStatus(status, 'err', '请先输入要转换的内容');
        return;
      }
      setStatus(status, 'processing');
      btn.disabled = true;
      try {
        const data = await toolsApi.convert(typeSel.value, input.value);
        result.value = data.result;
        wrap.style.display = '';
        setStatus(status, 'ok', '转换完成');
      } catch (e) {
        setStatus(status, 'err', e.message);
      } finally {
        btn.disabled = false;
      }
    });

    $('#cv-copy').addEventListener('click', async () => {
      if (await copyText(result.value)) toast('已复制到剪贴板');
    });

    $('#cv-dl').addEventListener('click', () => {
      const meta = CONVERT_TYPES[typeSel.value];
      downloadBlob(new Blob([result.value], { type: 'text/plain;charset=utf-8' }), meta.file);
    });
  },
};
