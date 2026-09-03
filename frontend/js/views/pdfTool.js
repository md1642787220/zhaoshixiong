/* ============================================================
 * views/pdfTool.js - 单个 PDF 工具操作页
 * 通用渲染：上传区 + 参数表单（由 data/pdfTools.js 的 params 定义）
 * 提交：POST /api/pdf/:action  （后端已实现，支持 JSON/download 或 PDF/ZIP 文件流）
 * ============================================================ */
import { getPdfTool, getPdfCategory } from '../data/pdfTools.js';
import { icon } from '../components/icon.js';
import { esc, setStatus, toast, downloadBlob } from '../utils.js';
import { processPdfWs } from '../api/pdfWs.js';
import { processPdfHttp } from '../api/pdfHttp.js';
import { Dropzone } from '../components/dropzone.js';

// 通过 WebSocket 走实时进度的动作（其余动作仍用 REST）
const WS_ACTIONS = ['convert-office'];

// 收集表单中的非文件参数（供 WebSocket 透传给 worker）
function collectParams(form, tool) {
  const params = {};
  form.querySelectorAll('input[name]:not([type="file"]), select[name], textarea[name]')
    .forEach((el) => {
      if (el.type === 'checkbox') params[el.name] = el.checked ? '1' : '0';
      else if (el.value !== '') params[el.name] = el.value;
    });
  return params;
}

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
    case 'position-picker':
      // 上传 PDF 后自动加载预览；可拖动签名 + 右下角手柄/滚轮调大小
      inner = `<div class="position-picker" data-param="${p.name}">
        <div class="preview-stage" style="display:none;position:relative;margin-top:0;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;background:#fff;touch-action:none;">
          <img class="page-img" alt="PDF 页面预览" style="display:block;width:100%;user-select:none;-webkit-user-drag:none;">
          <img class="sig-overlay" alt="签名" style="display:none;position:absolute;cursor:move;user-select:none;-webkit-user-drag:none;border:1px dashed var(--primary);">
          <div class="resize-handle" title="拖动调整大小" style="display:none;position:absolute;right:-2px;bottom:-2px;width:14px;height:14px;background:var(--primary);border:2px solid #fff;border-radius:3px;cursor:nwse-resize;z-index:2;"></div>
        </div>
      </div>`;
      break;
    case 'signature-pad':
      // 画板（清空按钮保留，提示文案去掉以更简洁）
      inner = `<div class="signature-pad" data-param="${p.name}">
        <canvas width="500" height="160" style="display:block;width:100%;max-width:520px;height:160px;border:1px dashed var(--border-strong);border-radius:var(--radius);background:#fff;cursor:crosshair;touch-action:none;"></canvas>
        <div style="margin-top:8px;display:flex;gap:10px;align-items:center;">
          <button type="button" class="btn btn-ghost btn-sm" data-action="clear-pad">清空画板</button>
        </div>
      </div>`;
      break;
    case 'switch':
      inner = `<label class="switch"><input id="${id}" name="${p.name}" type="checkbox" value="1"><span></span></label>`;
      break;
    default:
      inner = `<input id="${id}" name="${p.name}" class="input">`;
  }
  const label = p.type === 'switch'
    ? `<label class="field-label-inline" for="${id}">${esc(p.label)}</label>`
    : p.type === 'signature-pad' ? ''
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

/**
 * 手写签名工具的额外交互：画板鼠标/触屏绘制、上传签名图缩略图预览。
 * 非 sign 工具直接 return，不影响其他工具。
 */
/**
 * 签名位置可视化：把 PDF 目标页渲染成 PNG 作为背景，用户在其上拖动签名，
 * 拖动结果实时换算成 x / y 百分比并同步回范围滑块（提交时直接用滑块的值）。
 *
 * 坐标映射（与 worker security.py::sign 的 rect 计算严格对应）：
 *   worker: Rect(pageW*x, pageH*(1-y), pageW*x + pageW*scale, pageH*(1-y) + pageH*scale)
 *   => left% = x*100,  top% = (y - scale)*100,  width% = scale*100,  height% = scale*100
 */
function setupPositionPicker(form, tool, dz) {
  if (tool.action !== 'sign') return;
  const picker = form.querySelector('.position-picker');
  if (!picker) return;

  const loadBtn = picker.querySelector('[data-action="load-preview"]');
  const stage = picker.querySelector('.preview-stage');
  const pageImg = picker.querySelector('.page-img');
  const sig = picker.querySelector('.sig-overlay');
  const rangeX = form.querySelector('[name="x"]');
  const rangeY = form.querySelector('[name="y"]');
  const rangeScale = form.querySelector('[name="scale"]');

  const num = (el, dflt) => (el ? parseFloat(el.value) : dflt);
  // 同步滑块数值与其回显（range 右侧的 <output class="range-val">）
  function setRange(el, val) {
    if (!el) return;
    el.value = val;
    const out = el.parentElement && el.parentElement.querySelector('.range-val');
    if (out) out.textContent = val;
  }
  // 依据当前 x / y / scale 把签名摆到预览图对应位置
  function placeSignature() {
    const x = num(rangeX, 70) / 100;
    const y = num(rangeY, 10) / 100;
    const s = num(rangeScale, 20) / 100;
    sig.style.left = `${x * 100}%`;
    sig.style.top = `${(y - s) * 100}%`;
    sig.style.width = `${s * 100}%`;
    sig.style.height = `${s * 100}%`;
  }

  /** 取当前签名图（手绘画板导出 / 已上传文件）的 objectURL */
  async function signatureURL() {
    const modeSel = form.querySelector('select[name="mode"]');
    const mode = modeSel ? modeSel.value : 'upload';
    if (mode === 'draw') {
      const pad = form.querySelector('.signature-pad canvas');
      if (!pad || !pad._hasDrawn || !pad._hasDrawn()) return null;
      const blob = await pad.toBlobP();
      return blob ? URL.createObjectURL(blob) : null;
    }
    const fi = form.querySelector('input[type="file"][name="signFile"]');
    const f = fi && fi.files && fi.files[0];
    return f ? URL.createObjectURL(f) : null;
  }

  /** 加载预览：上传 PDF 后自动触发；签名/页码/模式变化时也会重载 */
  async function loadPreview() {
    const files = dz && dz.getFiles ? dz.getFiles() : [];
    if (!files.length) return;
    const url = await signatureURL();
    if (!url) return; // 签名未就绪，等后续 change 事件再试

    // 「所在页」可能填 "1,3" 之类，取第一个数字
    const pageInput = form.querySelector('[name="page"]');
    const raw = pageInput ? String(pageInput.value || '').trim() : '';
    const m = raw.match(/\d+/);
    const pageNo = m ? m[0] : '1';

    const fd = new FormData();
    fd.append('file', files[0]);
    fd.append('page', pageNo);
    fd.append('scale', '1.5');
    try {
      const res = await fetch('/api/pdf/render-page', { method: 'POST', body: fd });
      if (!res.ok) return;
      const blob = await res.blob();
      pageImg.src = URL.createObjectURL(blob);
      sig.src = url;
      await new Promise((r) => { pageImg.onload = r; pageImg.onerror = r; });
      stage.style.display = '';
      sig.style.display = '';
      const handleEl = picker.querySelector('.resize-handle');
      if (handleEl) handleEl.style.display = '';
      placeSignature();
    } catch {}
  }

  // 上传/删除 PDF 时自动加载预览
  if (dz && dz.onChange) dz.onChange(loadPreview);
  // 模式 / 签名图上传 / 页码变化时重新加载
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (!t) return;
    if (t.name === 'mode' || t.name === 'signFile' || t.name === 'page') loadPreview();
  });
  // 画板画完时刷新（先上传 PDF 后才画的场景）
  const pad = form.querySelector('.signature-pad canvas');
  if (pad) pad._onEndRefresh = loadPreview;

  // 拖动签名（鼠标 + 触屏）
  let dragging = false, startX = 0, startY = 0, originLeft = 0, originTop = 0;
  function onDown(e) {
    if (!sig.style.display || sig.style.display === 'none') return;
    e.preventDefault();
    dragging = true;
    const p = (e.touches && e.touches[0]) || e;
    startX = p.clientX; startY = p.clientY;
    originLeft = parseFloat(sig.style.left) || 0;
    originTop = parseFloat(sig.style.top) || 0;
  }
  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const p = (e.touches && e.touches[0]) || e;
    const rect = stage.getBoundingClientRect();
    const dx = ((p.clientX - startX) / rect.width) * 100;
    const dy = ((p.clientY - startY) / rect.height) * 100;
    let left = Math.min(100, Math.max(0, originLeft + dx));
    let top = Math.min(100, Math.max(0, originTop + dy));
    sig.style.left = `${left}%`;
    sig.style.top = `${top}%`;
    // 拖动结果换算回 x / y（y 从底部起算，需加上签名自身高度占比）
    const s = num(rangeScale, 20) / 100;
    setRange(rangeX, Math.round(Math.min(90, left)));
    setRange(rangeY, Math.round(Math.min(90, (top / 100 + s) * 100)));
  }
  function onUp() { dragging = false; }
  sig.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  sig.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);

  // —— 右下角手柄：等比缩放大小 ——
  const handle = picker.querySelector('.resize-handle');
  if (handle) {
    let rDrag = false, rStartX = 0, rStartScale = 0;
    function hDown(e) {
      e.preventDefault(); e.stopPropagation();
      rDrag = true;
      const p = (e.touches && e.touches[0]) || e;
      rStartX = p.clientX;
      rStartScale = num(rangeScale, 20);
    }
    function hMove(e) {
      if (!rDrag) return;
      e.preventDefault();
      const p = (e.touches && e.touches[0]) || e;
      const rect = stage.getBoundingClientRect();
      const ds = ((p.clientX - rStartX) / rect.width) * 100;
      const ns = Math.max(5, Math.min(50, Math.round(rStartScale + ds)));
      setRange(rangeScale, ns);
      placeSignature();
    }
    function hUp() { rDrag = false; }
    handle.addEventListener('mousedown', hDown);
    window.addEventListener('mousemove', hMove);
    window.addEventListener('mouseup', hUp);
    handle.addEventListener('touchstart', hDown, { passive: false });
    window.addEventListener('touchmove', hMove, { passive: false });
  }

  // —— 滚轮：在签名上滚动调整大小（不需要按钮/手柄也能改） ——
  sig.addEventListener('wheel', (e) => {
    if (sig.style.display === 'none') return;
    e.preventDefault();
    const cur = num(rangeScale, 20);
    const ns = Math.max(5, Math.min(50, cur + (e.deltaY < 0 ? 2 : -2)));
    setRange(rangeScale, ns);
    placeSignature();
  }, { passive: false });

  // 缩放/位置滑块变化时，签名大小与位置同步更新
  [rangeX, rangeY, rangeScale].forEach(el => {
    if (el) el.addEventListener('input', placeSignature);
  });
}

function setupSignatureFeatures(form, tool, dz = null) {
  if (tool.action !== 'sign') return;

  // —— 画板（手绘）——
  const pad = form.querySelector('.signature-pad canvas');
  if (pad) {
    const ctx = pad.getContext('2d');
    let drawing = false, hasDrawn = false, lastX = 0, lastY = 0;
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f2937';

    // 手绘效果预览：画完后显示裁剪结果，让 x / y / scale 滑块有参照
    const preview = document.createElement('img');
    preview.className = 'signature-preview';
    preview.alt = '签名效果预览';
    preview.style.cssText = 'max-height:72px;margin-top:8px;display:none;border:1px solid var(--border);border-radius:var(--radius-sm);background:#fff;';
    pad.parentElement.appendChild(preview);

    /**
     * 裁掉画布四周的透明区域，只保留笔迹所在的紧凑范围。
     * 关键：若不裁剪，导出的图含大片空白，签名放上 PDF 后会被空白稀释得又小又偏，
     * 导致 scale / 位置滑块调不准。
     */
    function trimCanvas(src) {
      const w = src.width, h = src.height;
      const data = src.getContext('2d').getImageData(0, 0, w, h).data;
      let top = -1, bottom = -1, left = w, right = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 10) { // alpha 阈值：有笔迹
            if (top === -1) top = y;
            bottom = y;
            if (x < left) left = x;
            if (x > right) right = x;
          }
        }
      }
      if (top === -1) return null; // 空画布
      const p = 6; // 四周留白，避免笔迹被切边
      const sx = Math.max(0, left - p), sy = Math.max(0, top - p);
      const tw = Math.min(w - sx, right - left + 1 + p * 2);
      const th = Math.min(h - sy, bottom - top + 1 + p * 2);
      const out = document.createElement('canvas');
      out.width = tw; out.height = th;
      out.getContext('2d').drawImage(src, sx, sy, tw, th, 0, 0, tw, th);
      return out;
    }

    function refreshPreview() {
      const t = trimCanvas(pad);
      if (t) { preview.src = t.toDataURL('image/png'); preview.style.display = ''; }
      else { preview.removeAttribute('src'); preview.style.display = 'none'; }
    }
    function pos(e) {
      const r = pad.getBoundingClientRect();
      const p = (e.touches && e.touches[0]) || e;
      return {
        x: (p.clientX - r.left) * (pad.width / r.width),
        y: (p.clientY - r.top) * (pad.height / r.height),
      };
    }
    function start(e) {
      e.preventDefault();
      drawing = true; hasDrawn = true;
      const p = pos(e); lastX = p.x; lastY = p.y;
      ctx.beginPath(); ctx.moveTo(lastX, lastY);
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = pos(e);
      ctx.lineTo(p.x, p.y); ctx.stroke();
      lastX = p.x; lastY = p.y;
    }
    function end() {
      if (!drawing) return;
      drawing = false;
      refreshPreview(); // 每次画完更新预览
      // 画板完成时通知位置定位刷新（先上传 PDF 后才画的情形）
      if (typeof pad._onEndRefresh === 'function') pad._onEndRefresh();
    }
    pad.addEventListener('mousedown', start);
    pad.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    pad.addEventListener('touchstart', start, { passive: false });
    pad.addEventListener('touchmove', move, { passive: false });
    pad.addEventListener('touchend', end);
    const clearBtn = form.querySelector('.signature-pad [data-action="clear-pad"]');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, pad.width, pad.height); hasDrawn = false;
      preview.removeAttribute('src'); preview.style.display = 'none';
    });
    // 给 submit 阶段用：判断是否画过 / 导出「裁剪后」的 PNG Blob
    pad._hasDrawn = () => hasDrawn;
    pad.toBlobP = () => new Promise((res) => {
      const t = trimCanvas(pad);
      if (!t) return res(null);
      t.toBlob((b) => res(b), 'image/png');
    });
  }

  // —— 可视化定位：加载页面预览 + 拖动签名 ——
  setupPositionPicker(form, tool, dz);

  // —— 上传签名图：缩略图预览（不需 PDF.js，至少能看着签名本身调位置）——
  const fi = form.querySelector('input[type="file"][name="signFile"]');
  if (fi) {
    const field = fi.closest('.field');
    const img = document.createElement('img');
    img.className = 'signature-preview';
    img.alt = '签名预览';
    img.style.cssText = 'max-height:72px;margin-top:8px;display:none;border:1px solid var(--border);border-radius:var(--radius-sm);background:#fff;';
    if (field) field.appendChild(img);
    fi.addEventListener('change', () => {
      const f = fi.files && fi.files[0];
      if (f) { img.src = URL.createObjectURL(f); img.style.display = ''; }
      else { img.removeAttribute('src'); img.style.display = 'none'; }
    });
  }
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
        <div class="progress" id="progress-${tool.id}" hidden>
          <div class="progress-bar"><span></span></div>
          <div class="progress-tip" id="progress-tip-${tool.id}">等待开始…</div>
        </div>
        <div class="status" id="status-${tool.id}"></div>
      </form>
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
    const MAX_SIZE = 30 * 1024 * 1024;
    const dz = Dropzone(dzEl, {
      multiple: !!tool.multi,
      // 默认只收 PDF；需要其他输入的工具（图片转 PDF 等）在 data/pdfTools.js 里用 accept 覆盖
      accept: tool.accept || '.pdf',
      label: tool.dzLabel
        || (tool.multi ? '拖入多个 PDF / 点击选择（合并、叠加等）' : '拖入 PDF 文件 / 点击选择'),
      maxSize: MAX_SIZE,
      onError: (file, msg) => { toast(msg); setStatus(statusEl, 'err', msg); },
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

    /* 4) 签名画板 / 上传预览 / 可视化定位（仅手写签名工具） */
    setupSignatureFeatures(form, tool, dz);

    /* 4.5) 签名工具左右两栏：左 = 签名准备（画板/上传/方式/页码），右 = 预览 + 位置/大小 */
    if (tool.action === 'sign') {
      const fields = form.querySelector('.form-fields');
      if (fields) {
        const left = document.createElement('div');
        left.className = 'sign-col sign-left';
        const right = document.createElement('div');
        right.className = 'sign-col sign-right';
        const leftNames = new Set(['mode', 'signaturePad', 'signFile', 'page']);
        const rightNames = new Set(['positionPicker', 'x', 'y', 'scale']);
        fields.querySelectorAll('[data-param]').forEach(el => {
          const n = el.getAttribute('data-param');
          if (leftNames.has(n)) left.appendChild(el);
          else if (rightNames.has(n)) right.appendChild(el);
        });
        fields.classList.add('sign-layout');
        fields.appendChild(left);
        fields.appendChild(right);
      }
    }

    /* 5) 提交 */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const files = dz.getFiles();
      if (!files.length) { toast('请先上传文件'); setStatus(statusEl, 'err', '请先上传文件'); return; }

      // 文件大小限制兜底校验（与后端一致：30MB；正常情况下 Dropzone 已在上传时拦截）
      const tooBig = files.find((f) => f.size > MAX_SIZE);
      if (tooBig) {
        const msg = `文件「${tooBig.name}」(${Math.round(tooBig.size / 1024 / 1024 * 10) / 10}MB) 超过 30MB 限制，请压缩或拆分后重试。`;
        toast(msg);
        setStatus(statusEl, 'err', msg);
        return;
      }

      // WebSocket 实时进度通道（目前支持 PDF→Word）
      if (WS_ACTIONS.includes(tool.action)) {
        const progressEl = document.getElementById('progress-' + tool.id);
        const bar = progressEl.querySelector('.progress-bar > span');
        const tip = document.getElementById('progress-tip-' + tool.id);
        progressEl.hidden = false;
        btn.disabled = true;
        setStatus(statusEl, 'processing', '正在上传并转换…');

        // 大文件走 HTTP 高速通道（流式上传/返回，内存占用低、不易断开）
        const useHttp = files[0].size > 5 * 1024 * 1024;
        const onProgress = (p) => {
          let pct = 0;
          if (p.pageTotal) pct = Math.round((p.page / p.pageTotal) * 100);
          else if (p.stageTotal) pct = Math.round((p.stage / p.stageTotal) * 100);
          else if (typeof p.percent === 'number') pct = p.percent;
          bar.style.width = pct + '%';
          let label = p.message || '处理中';
          if (useHttp && p.percent === 100) label = '上传完成，正在服务器端转换…';
          else if (pct) label += `  ${pct}%`;
          tip.textContent = label;
        };
        try {
          const { blob, filename } = useHttp
            ? await processPdfHttp(tool.action, files[0], collectParams(form, tool), onProgress)
            : await processPdfWs(tool.action, files[0], collectParams(form, tool), onProgress);
          downloadBlob(blob, filename);
          bar.style.width = '100%';
          tip.textContent = '完成';
          setStatus(statusEl, 'ok', '处理完成，已开始下载');
        } catch (err) {
          setStatus(statusEl, 'err', err.message || '处理失败');
        } finally {
          btn.disabled = false;
        }
        return;
      }

      const fd = new FormData();
      files.forEach(f => fd.append('file', f));
      // 额外单文件参数（证书、附件、印章、背景等）
      form.querySelectorAll('input[type="file"][name]').forEach(el => {
        if (el.files && el.files[0]) fd.append(el.name, el.files[0]);
      });
      // 手写签名（画板模式）：把 canvas 导出为 PNG 作为 signFile 提交
      if (tool.action === 'sign') {
        const modeSel = form.querySelector('select[name="mode"]');
        const mode = modeSel ? modeSel.value : '';
        if (mode === 'draw') {
          const pad = form.querySelector('.signature-pad canvas');
          if (!pad || !pad._hasDrawn || !pad._hasDrawn()) {
            toast('请先在画板上签名'); btn.disabled = false; return;
          }
          const blob = await pad.toBlobP();
          if (!blob) { toast('生成签名图失败'); btn.disabled = false; return; }
          fd.append('signFile', blob, 'signature.png');
        }
      }
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
