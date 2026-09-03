/* ============================================================
 * views/pdfTool.js - 单个 PDF 工具操作页
 * 通用渲染：上传区 + 参数表单（由 data/pdfTools.js 的 params 定义）
 * 提交：POST /api/pdf/:action  （后端已实现，支持 JSON/download 或 PDF/ZIP 文件流）
 * ============================================================ */
import { getPdfTool, getPdfCategory } from '../data/pdfTools.js';
import { icon } from '../components/icon.js';
import { esc, setStatus, toast } from '../utils.js';
import { Dropzone } from '../components/dropzone.js';

/** 渲染某个参数控件 */
function renderParam(p, prefix = '') {
  const id = prefix + p.name;
  let inner = '';
  switch (p.type) {
    case 'select':
      inner = `<select id="${id}" name="${p.name}" class="input">
        ${p.options.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}
      </select>`;
      break;
    case 'text':
    case 'password':
    case 'url':
      inner = `<input id="${id}" name="${p.name}" type="${p.type === 'password' ? 'password' : 'text'}"
        class="input" placeholder="${esc(p.placeholder || '')}" value="${esc(p.value || '')}">`;
      break;
    case 'number':
    case 'range':
      inner = `<input id="${id}" name="${p.name}" type="${p.type}" class="input"
        min="${p.min ?? ''}" max="${p.max ?? ''}" step="${p.step ?? ''}" value="${p.value ?? ''}">
        ${p.type === 'range' ? `<output class="range-val">${esc(p.value ?? p.min ?? '')}</output>` : ''}`;
      break;
    case 'textarea':
      inner = `<textarea id="${id}" name="${p.name}" class="input" rows="4"
        placeholder="${esc(p.placeholder || '')}"></textarea>`;
      break;
    case 'color':
      inner = `<input id="${id}" name="${p.name}" type="color" class="input input-color" value="${esc(p.value || '#000000')}">`;
      break;
    case 'file':
      inner = `<input id="${id}" name="${p.name}" type="file" class="input" accept="${esc(p.accept || '*')}">`;
      break;
    case 'switch':
      inner = `<label class="switch"><input id="${id}" name="${p.name}" type="checkbox" value="1"><span></span></label>`;
      break;
    default:
      inner = `<input id="${id}" name="${p.name}" class="input">`;
  }
  const label = p.type === 'switch'
    ? `<label class="field-label-inline" for="${id}">${esc(p.label)}</label>`
    : `<label class="field-label" for="${id}">${esc(p.label)}</label>`;
  return `<div class="field ${p.type === 'switch' ? 'field-switch' : ''}" data-param="${p.name}">${label}${inner}</div>`;
}

/** 生成参数表单 HTML（含条件显示逻辑占位） */
function renderForm(tool) {
  if (!tool.params || !tool.params.length) {
    return `<p class="form-empty">该工具无需额外参数，上传文件后直接处理。</p>`;
  }
  return tool.params.map(p => renderParam(p)).join('');
}

export default {
  title: 'PDF 工具 · 师兄',
  nav: '/pdf',

  render(params) {
    const tool = getPdfTool(params.toolId);
    if (!tool) {
      return `<div class="page-head"><h1>未找到工具</h1>
        <p class="sub"><a href="#/pdf">返回 PDF 工具</a></p></div>`;
    }
    const cat = getPdfCategory(tool.cat);
    const multiHint = tool.multi ? '可多选文件' : '仅支持单个 PDF 文件';

    return `
    <div class="page-head">
      <div class="breadcrumb">
        <a href="#/pdf">PDF 工具</a> / <a href="#/pdf">${esc(cat ? cat.name : '')}</a> / ${esc(tool.name)}
      </div>
      <h1>${icon(tool.icon, 28)} ${esc(tool.name)}</h1>
      <p class="sub">${esc(tool.desc)}</p>
    </div>

    <div class="pdf-panel card">
      <div id="dz-${tool.id}"></div>

      <form id="form-${tool.id}" class="pdf-form" data-action="${esc(tool.action)}" data-multi="${tool.multi ? 1 : 0}">
        <div class="form-fields">${renderForm(tool)}</div>

        ${tool.hint ? `<div class="form-hint">${icon('info', 16)} ${esc(tool.hint)}</div>` : ''}

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="btn-${tool.id}">
            ${icon('refresh', 16)} 开始处理
          </button>
          <span class="field-hint">${multiHint}</span>
        </div>
        <div class="status" id="status-${tool.id}"></div>
      </form>

      <div class="api-note">
        <b>接口说明：</b>前端已预留 <code>POST /api/pdf/${esc(tool.action)}</code>，
        后端将接收文件与参数并返回处理结果；当前后端开发中，提交会提示“后端待实现”。
      </div>
    </div>`;
  },

  mount(params) {
    const tool = getPdfTool(params.toolId);
    if (!tool) return;
    const dzEl = document.getElementById('dz-' + tool.id);
    const form = document.getElementById('form-' + tool.id);
    const statusEl = document.getElementById('status-' + tool.id);
    const btn = document.getElementById('btn-' + tool.id);

    /* 1) 上传区（单/多文件） */
    const dz = Dropzone(dzEl, {
      multiple: !!tool.multi,
      accept: '.pdf',
      label: tool.multi ? '拖入多个 PDF / 点击选择（合并、叠加等）' : '拖入 PDF 文件 / 点击选择',
    });

    /* 2) 条件字段显隐（when） */
    const applyConditions = () => {
      (tool.params || []).forEach(p => {
        if (!p.when) return;
        const field = form.querySelector(`[data-param="${p.name}"]`);
        if (!field) return;
        const show = Object.entries(p.when).every(([k, v]) => {
          const el = form.querySelector(`[name="${k}"]`);
          if (!el) return false;
          if (el.type === 'checkbox') return el.checked == v;
          return el.value == v;
        });
        field.style.display = show ? '' : 'none';
      });
    };
    form.querySelectorAll('select, input').forEach(el => el.addEventListener('change', applyConditions));
    applyConditions();

    /* 3) range 数值实时回显 */
    form.querySelectorAll('input[type="range"]').forEach(el => {
      const out = el.parentElement.querySelector('.range-val');
      if (out) { out.textContent = el.value; el.addEventListener('input', () => out.textContent = el.value); }
    });

    /* 4) 提交 */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const files = dz.getFiles();
      if (!files.length) { toast('请先上传文件'); setStatus(statusEl, 'err', '请先上传文件'); return; }

      const fd = new FormData();
      files.forEach(f => fd.append('file', f));
      // 额外单文件参数（证书、附件、印章、背景等）
      form.querySelectorAll('input[type="file"][name]').forEach(el => {
        if (el.files && el.files[0]) fd.append(el.name, el.files[0]);
      });
      // 文本/选择/数字/颜色/文本域
      form.querySelectorAll('input[name]:not([type="file"]):not([type="checkbox"]), select[name], textarea[name]')
        .forEach(el => { if (el.value !== '') fd.append(el.name, el.value); });
      // 开关
      form.querySelectorAll('input[type="checkbox"][name]').forEach(el => fd.append(el.name, el.checked ? '1' : '0'));

      setStatus(statusEl, 'processing', '正在提交到后端处理…');
      btn.disabled = true;

      try {
        const res = await fetch(`/api/pdf/${tool.action}`, { method: 'POST', body: fd });
        const ct = (res.headers.get('content-type') || '').toLowerCase();

        // 后端直接返回文件流（PDF / ZIP），立即触发下载
        if (res.ok && (ct.includes('application/pdf') || ct.includes('application/zip'))) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const ext = ct.includes('application/pdf') ? 'pdf' : 'zip';
          const cd = res.headers.get('content-disposition') || '';
          const filename = (cd.match(/filename[^;=\n]*=(['"]?)([^'"\s;]+)\1/) || [])[2] || `result.${ext}`;
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          setStatus(statusEl, 'ok', '处理完成，文件已开始下载');
          return;
        }

        // JSON 响应（download 链接 / 提示信息）
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setStatus(statusEl, 'ok', data.message || '处理完成');
          if (data.download) {
            const a = document.createElement('a');
            a.href = data.download;
            a.download = data.filename || 'result';
            a.click();
          }
        } else {
          // 后端未实现或处理失败
          setStatus(statusEl, 'err',
            data.message || '后端接口尚未实现（/api/pdf/' + tool.action + '）。前端交互已就绪，待后端接入。');
        }
      } catch (err) {
        setStatus(statusEl, 'err', '请求失败：' + err.message + '（后端接口待接入）');
      } finally {
        btn.disabled = false;
      }
    });
  },
};
