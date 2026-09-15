/* ============================================================
 * views/idphoto.js - 寸照编辑器
 * 上传照片 → 按证件照规格裁剪 → 换底色 → 下载单张 / 生成排版打印图。
 * 全部在浏览器本地用 Canvas 完成，不依赖后端。
 * ============================================================ */
import { toolPage } from './toolLayout.js';
import { Dropzone } from '../components/dropzone.js';
import { downloadBlob, setStatus } from '../utils.js';

/** 常用证件照规格（300dpi，单位：像素） */
const SPECS = {
  '1c':       { name: '一寸（25×35mm）',   w: 295, h: 413 },
  '1c-small': { name: '小一寸（22×32mm）', w: 260, h: 378 },
  '1c-large': { name: '大一寸（33×48mm）', w: 390, h: 567 },
  '2c':       { name: '二寸（35×49mm）',   w: 413, h: 579 },
  '2c-small': { name: '小二寸（35×45mm）', w: 413, h: 531 },
  '2c-large': { name: '大二寸（35×53mm）', w: 413, h: 626 },
  social:     { name: '社保照（26×32mm）', w: 307, h: 378 },
  visa:       { name: '签证（50×50mm）',   w: 590, h: 590 },
};

/** 背景底色：rgb 为 null 表示保留原背景 */
const BACKGROUNDS = {
  keep:  { name: '保留原背景', rgb: null },
  white: { name: '白底', rgb: [255, 255, 255] },
  red:   { name: '红底', rgb: [255, 0, 0] },
  blue:  { name: '蓝底', rgb: [67, 142, 219] },
  gray:  { name: '灰底', rgb: [128, 128, 128] },
};

/** 排版纸张（300dpi） */
const PAPERS = {
  a4:     { name: 'A4 纸（210×297mm）',   w: 2480, h: 3508 },
  photo5: { name: '5 寸相纸（89×127mm）', w: 1050, h: 1500 },
  photo6: { name: '6 寸相纸（102×152mm）', w: 1200, h: 1800 },
};

/** 由 { key: {name} } 生成 <option> 列表 */
function options(map) {
  return Object.entries(map)
    .map(([k, v]) => `<option value="${k}">${v.name}</option>`)
    .join('');
}

/**
 * 换底色：从四边向内做 flood fill，
 * 仅替换「与采样背景色相近且与边缘连通」的区域，避免误伤衣物、发丝。
 * @param {ImageData} imageData
 * @param {number[]} rgb       目标底色
 * @param {number} tolerance   颜色容差（0-255 尺度）
 */
function replaceBackground(imageData, rgb, tolerance) {
  const { data, width, height } = imageData;
  const at = (x, y) => (y * width + x) * 4;

  // 以四角像素均值作为背景色样本
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const br = corners.reduce((s, i) => s + data[i], 0) / 4;
  const bg = corners.reduce((s, i) => s + data[i + 1], 0) / 4;
  const bb = corners.reduce((s, i) => s + data[i + 2], 0) / 4;

  const [tr, tg, tb] = rgb;
  const thr2 = tolerance * tolerance;
  const visited = new Uint8Array(width * height);
  const stack = [];

  const matches = (i) => {
    const dr = data[i] - br;
    const dg = data[i + 1] - bg;
    const db = data[i + 2] - bb;
    return dr * dr + dg * dg + db * db <= thr2;
  };

  const push = (x, y) => {
    const idx = y * width + x;
    if (visited[idx] || !matches(idx * 4)) return;
    visited[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }

  while (stack.length) {
    const idx = stack.pop();
    const i = idx * 4;
    data[i] = tr;
    data[i + 1] = tg;
    data[i + 2] = tb;
    data[i + 3] = 255;
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
}

function body() {
  return `
  <div id="idp-drop"></div>

  <div class="idp-controls">
    <div class="field">
      <label>照片规格</label>
      <select id="idp-spec" class="input">${options(SPECS)}</select>
    </div>
    <div class="field">
      <label>背景底色</label>
      <select id="idp-bg" class="input">${options(BACKGROUNDS)}</select>
    </div>
    <div class="field">
      <label>抠图容差 <span class="range-val" id="idp-tol-val">60</span></label>
      <input type="range" id="idp-tol" class="input" min="10" max="150" step="1" value="60">
    </div>
    <div class="field">
      <label>缩放 <span class="range-val" id="idp-zoom-val">1.0×</span></label>
      <input type="range" id="idp-zoom" class="input" min="1" max="3" step="0.01" value="1">
    </div>
  </div>

  <div class="idp-stage">
    <canvas id="idp-canvas" class="idp-canvas"></canvas>
    <p class="idp-tip">在照片上拖动可调整位置，松手后应用抠图；换底色请配合「抠图容差」微调</p>
  </div>

  <div class="idp-actions">
    <button class="btn btn-primary" id="idp-download" disabled>下载寸照</button>
    <button class="btn" id="idp-sheet" disabled>生成排版图</button>
    <select id="idp-paper" class="input idp-paper">${options(PAPERS)}</select>
  </div>

  <div class="idp-sheet-wrap" id="idp-sheet-wrap" hidden>
    <img id="idp-sheet-img" class="idp-sheet-img" alt="排版预览">
  </div>

  <div class="status" id="idp-status"></div>`;
}

export default {
  title: '寸照编辑器 · 师兄',
  nav: '/tools',

  render() {
    return toolPage('idphoto', body());
  },

  mount() {
    const canvas = document.getElementById('idp-canvas');
    const specSel = document.getElementById('idp-spec');
    const bgSel = document.getElementById('idp-bg');
    const tolInput = document.getElementById('idp-tol');
    const tolVal = document.getElementById('idp-tol-val');
    const zoomInput = document.getElementById('idp-zoom');
    const zoomVal = document.getElementById('idp-zoom-val');
    const paperSel = document.getElementById('idp-paper');
    const downBtn = document.getElementById('idp-download');
    const sheetBtn = document.getElementById('idp-sheet');
    const sheetWrap = document.getElementById('idp-sheet-wrap');
    const sheetImg = document.getElementById('idp-sheet-img');
    const status = document.getElementById('idp-status');

    let img = null;      // 已载入的照片
    let zoom = 1;        // 缩放倍数
    let ox = 0, oy = 0;  // 位置偏移（以输出画布像素为单位）
    let frame = 0;
    let sheetUrl = null;

    const spec = () => SPECS[specSel.value];
    const bgRgb = () => BACKGROUNDS[bgSel.value].rgb;

    /** 未选择照片时的占位画面 */
    function showPlaceholder() {
      const { w, h } = spec();
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('请先上传照片', w / 2, h / 2);
    }

    /** 按当前变换把照片以 cover 方式绘制到目标区域 */
    function paint(ctx, w, h) {
      const s = Math.max(w / img.width, h / img.height) * zoom;
      const dw = img.width * s;
      const dh = img.height * s;
      ctx.drawImage(img, (w - dw) / 2 + ox, (h - dh) / 2 + oy, dw, dh);
    }

    /** 在给定 ctx 上绘制一张完整寸照（含换底） */
    function paintPhoto(ctx, w, h, withCutout) {
      const rgb = bgRgb();
      ctx.fillStyle = rgb ? `rgb(${rgb.join(',')})` : '#ffffff';
      ctx.fillRect(0, 0, w, h);
      paint(ctx, w, h);
      if (rgb && withCutout) {
        const id = ctx.getImageData(0, 0, w, h);
        replaceBackground(id, rgb, Number(tolInput.value));
        ctx.putImageData(id, 0, 0);
      }
    }

    /** 生成一张独立的寸照画布 */
    function buildPhoto(withCutout = true) {
      const { w, h } = spec();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      paintPhoto(c.getContext('2d'), w, h, withCutout);
      return c;
    }

    /** 渲染预览（rAF 节流；拖动/滑动时可跳过耗时的抠图） */
    function render(withCutout = true) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!img) { showPlaceholder(); return; }
        const { w, h } = spec();
        canvas.width = w;
        canvas.height = h;
        paintPhoto(canvas.getContext('2d'), w, h, withCutout);
      });
    }

    /** 载入/清除照片 */
    function loadFile(file) {
      if (!file) {
        img = null;
        downBtn.disabled = true;
        sheetBtn.disabled = true;
        sheetWrap.hidden = true;
        setStatus(status, '', '');
        render(false);
        return;
      }
      if (!/^image\//.test(file.type)) {
        setStatus(status, 'err', '请选择图片文件（JPG / PNG 等）');
        return;
      }
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        img = im;
        zoom = 1;
        ox = 0;
        oy = 0;
        zoomInput.value = '1';
        zoomVal.textContent = '1.0×';
        downBtn.disabled = false;
        sheetBtn.disabled = false;
        render(true);
        setStatus(status, 'ok', `已载入照片（${im.width}×${im.height}），拖动可调整位置`);
        URL.revokeObjectURL(url);
      };
      im.onerror = () => {
        URL.revokeObjectURL(url);
        setStatus(status, 'err', '图片加载失败，请更换文件');
      };
      im.src = url;
    }

    /* ---------- 上传区 ---------- */
    const dz = Dropzone(document.getElementById('idp-drop'), {
      accept: 'image/*',
      label: '拖入照片 / 点击选择',
    });
    dz.onChange((files) => loadFile(files[files.length - 1] || null));

    // 跨页面复用：若全局已有图片文件，直接载入
    const existing = dz.getFiles();
    if (existing.length) loadFile(existing[existing.length - 1]);
    else showPlaceholder();

    /* ---------- 参数调整 ---------- */
    specSel.addEventListener('change', () => render(true));
    bgSel.addEventListener('change', () => render(true));
    tolInput.addEventListener('input', () => {
      tolVal.textContent = tolInput.value;
      render(true);
    });

    zoomInput.addEventListener('input', () => {
      zoom = Number(zoomInput.value);
      zoomVal.textContent = zoom.toFixed(1) + '×';
      render(false); // 滑动过程中只做快速预览
    });
    zoomInput.addEventListener('change', () => render(true)); // 松手后再抠图

    /* ---------- 拖动调整位置 ---------- */
    let dragging = false;
    let last = null;

    canvas.addEventListener('pointerdown', (e) => {
      if (!img) return;
      dragging = true;
      last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      ox += (e.clientX - last.x) * (canvas.width / rect.width);
      oy += (e.clientY - last.y) * (canvas.height / rect.height);
      last = { x: e.clientX, y: e.clientY };
      render(false);
    });
    const endDrag = () => { if (dragging) { dragging = false; render(true); } };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    /* ---------- 下载单张 ---------- */
    downBtn.addEventListener('click', () => {
      if (!img) return;
      setStatus(status, 'processing', '正在生成寸照…');
      const { w, h } = spec();
      buildPhoto(true).toBlob((blob) => {
        downloadBlob(blob, `寸照_${w}x${h}.png`);
        setStatus(status, 'ok', `已生成 ${w}×${h} 寸照（PNG）并开始下载`);
      }, 'image/png');
    });

    /* ---------- 生成排版打印图 ---------- */
    sheetBtn.addEventListener('click', () => {
      if (!img) return;
      setStatus(status, 'processing', '正在生成排版图…');
      const photo = buildPhoto(true);
      const paper = PAPERS[paperSel.value];
      const { w: pw, h: ph } = spec();

      const c = document.createElement('canvas');
      c.width = paper.w;
      c.height = paper.h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, paper.w, paper.h);

      const margin = 60;
      const gap = 24;
      const cols = Math.max(1, Math.floor((paper.w - margin * 2 + gap) / (pw + gap)));
      const rows = Math.max(1, Math.floor((paper.h - margin * 2 + gap) / (ph + gap)));
      const totalW = cols * pw + (cols - 1) * gap;
      const totalH = rows * ph + (rows - 1) * gap;
      const startX = (paper.w - totalW) / 2;
      const startY = (paper.h - totalH) / 2;

      for (let r = 0; r < rows; r++) {
        for (let i = 0; i < cols; i++) {
          ctx.drawImage(photo, startX + i * (pw + gap), startY + r * (ph + gap));
        }
      }

      c.toBlob((blob) => {
        downloadBlob(blob, `寸照排版_${pw}x${ph}_${cols * rows}张.jpg`);
        if (sheetUrl) URL.revokeObjectURL(sheetUrl);
        sheetUrl = URL.createObjectURL(blob);
        sheetImg.src = sheetUrl;
        sheetWrap.hidden = false;
        setStatus(status, 'ok', `已生成排版图：${paper.name}，共 ${cols * rows} 张（${cols} 列 × ${rows} 行）`);
      }, 'image/jpeg', 0.92);
    });

    // 离开页面时释放排版预览 URL
    window.addEventListener('hashchange', () => {
      if (sheetUrl) { URL.revokeObjectURL(sheetUrl); sheetUrl = null; }
    });
  },
};
