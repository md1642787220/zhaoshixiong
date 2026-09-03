/* ============================================================
 * views/text.js - 文本提取工具
 * ============================================================ */
import { toolsApi } from '../api/tools.js';
import { toolPage } from './toolLayout.js';
import { setupDropzone } from '../components/dropzone.js';
import { icon } from '../components/icon.js';
import { downloadBlob, copyText, setStatus, toast, stripExt } from '../utils.js';

const $ = (sel) => document.querySelector(sel);

function body() {
  return `
  <div class="dropzone" id="tx-drop">
    <span class="dz-icon">${icon('file-text', 32)}${icon('search', 26)}</span>
    <span class="dz-main">拖拽文件到此处，或点击选择</span>
    <span class="dz-sub">支持 PDF / TXT / MD / CSV / JSON，提取纯文本内容</span>
    <input type="file" id="tx-input" accept=".pdf,.txt,.md,.csv,.json" hidden>
  </div>
  <p class="fileinfo" id="tx-info">尚未选择文件</p>
  <button class="btn btn-primary" id="tx-btn" disabled>开始提取文本</button>
  <div class="field" id="tx-result-wrap" style="display:none; margin-top:18px;">
    <label>提取结果
      <button class="linklike" id="tx-copy">复制</button>
      <button class="linklike" id="tx-dl">下载 TXT</button>
    </label>
    <textarea id="tx-result" class="input mono" rows="12" readonly></textarea>
  </div>
  <div class="status" id="tx-status"></div>`;
}

export default {
  title: '文本提取 · 师兄',
  nav: '/tools',

  render() {
    return toolPage('text', body());
  },

  mount() {
    const btn = $('#tx-btn');
    const status = $('#tx-status');
    const wrap = $('#tx-result-wrap');
    const result = $('#tx-result');
    let file = null;

    setupDropzone($('#tx-drop'), $('#tx-input'), $('#tx-info'), f => {
      file = f;
      btn.disabled = false;
    });

    btn.addEventListener('click', async () => {
      if (!file) return;
      setStatus(status, 'processing', '正在提取文本，请稍候…');
      btn.disabled = true;
      try {
        const data = await toolsApi.textExtract(file);
        result.value = data.text || '（未提取到文本内容）';
        wrap.style.display = '';
        const extra = data.pages ? `，共 ${data.pages} 页` : '';
        setStatus(status, 'ok', '提取完成' + extra);
      } catch (e) {
        setStatus(status, 'err', e.message);
      } finally {
        btn.disabled = false;
      }
    });

    $('#tx-copy').addEventListener('click', async () => {
      if (await copyText(result.value)) toast('已复制到剪贴板');
    });

    $('#tx-dl').addEventListener('click', () => {
      const base = file ? (stripExt(file.name) || '提取文本') : '提取文本';
      downloadBlob(new Blob([result.value], { type: 'text/plain;charset=utf-8' }), `${base}.txt`);
    });
  },
};
