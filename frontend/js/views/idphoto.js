/* ============================================================
 * views/idphoto.js - 寸照编辑器
 * 上传照片 → 按证件照规格裁剪 → 换底色 → 下载单张 / 生成排版打印图。
 * 全部在浏览器本地用 Canvas 完成，不依赖后端。
 *
 * 尺寸换算、网格排版、容差抠图、JPEG DPI 写入等核心算法
 * 全部来自 core/idphotoCore.js（移植自开源项目 photo-tool）。
 * ============================================================ */
import { toolPage } from './toolLayout.js';
import { Dropzone } from '../components/dropzone.js';
import { downloadBlob, setStatus, stripExt, fmtSize } from '../utils.js';
import {
  SPECS, DPIS, PAPERS, BACKGROUNDS, SIZE_LIMITS, DEFAULT_GAP_MM, DEFAULT_DPI,
  mmToPx, planLayout, cellAt, sizeTagOf, clampNum, replaceBackground, patchJpegDpi,
  searchJpegQuality,
} from '../core/idphotoCore.js';

/** 由 { key: {name} } 或 { key: '文本' } 生成 <option> 列表 */
function options(map) {
  return Object.entries(map)
    .map(([k, v]) => `<option value="${k}">${typeof v === 'string' ? v : v.name}</option>`)
    .join('');
}

function body() {
  return `
  <div class="idp-controls">
    <div class="field idp-spec-field">
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
    <div class="field">
      <label>输出大小上限</label>
      <select id="idp-size" class="input"
              title="生成的证件照超过该体积时自动压缩：先降 JPEG 质量（像素尺寸不变），仍超标才缩小尺寸">${options(SIZE_LIMITS)}</select>
      <div class="idp-size-custom" id="idp-size-kb-wrap" hidden>
        <input type="number" id="idp-size-kb" class="input"
               min="5" max="10240" step="1" value="100" title="自定义输出大小上限（KB）">
        <span class="idp-unit">KB</span>
      </div>
    </div>
  </div>

  <details class="idp-adv">
    <summary class="idp-adv-summary">高级设置（尺寸 / 排版 / 输出）</summary>
    <div class="idp-adv-grid">
      <div class="field" id="idp-cw-wrap" hidden>
        <label>自定义尺寸（宽 × 高 mm）</label>
        <div class="idp-pair">
          <input type="number" id="idp-cw" class="input" min="10" max="200" step="1" value="25">
          <span class="idp-x">×</span>
          <input type="number" id="idp-ch" class="input" min="10" max="200" step="1" value="35">
        </div>
      </div>
      <div class="field" id="idp-pw-wrap" hidden>
        <label>自定义纸张（宽 × 高 mm）</label>
        <div class="idp-pair">
          <input type="number" id="idp-pw" class="input" min="20" max="1000" step="1" value="102">
          <span class="idp-x">×</span>
          <input type="number" id="idp-ph" class="input" min="20" max="1000" step="1" value="152">
        </div>
      </div>
      <div class="field">
        <label>照片 DPI</label>
        <select id="idp-dpi" class="input">${options(DPIS)}</select>
      </div>
      <div class="field">
        <label>照片间距（mm）</label>
        <input type="number" id="idp-gap" class="input" min="0" max="20" step="0.5" value="${DEFAULT_GAP_MM}">
      </div>
      <div class="field">
        <label>输出格式</label>
        <select id="idp-fmt" class="input">
          <option value="jpeg">JPEG（体积小）</option>
          <option value="png">PNG（无损，较大）</option>
        </select>
      </div>
    </div>
  </details>

  <div class="idp-stage" id="idp-stage">
    <div id="idp-drop"></div>
    <canvas id="idp-canvas" class="idp-canvas" hidden></canvas>
    <p class="idp-tip" id="idp-tip" hidden>
      在照片上拖动可调整位置，松手后应用抠图；换底色请配合「抠图容差」微调
      <button type="button" class="idp-replace" id="idp-replace">更换照片</button>
    </p>
  </div>

  <div class="idp-actions">
    <button class="btn btn-primary" id="idp-download" disabled>下载寸照</button>
    <button class="btn" id="idp-sheet" disabled>生成排版图</button>
    <select id="idp-paper" class="input idp-paper">${options(PAPERS)}</select>
  </div>

  <div class="idp-info" id="idp-info"></div>

  <div class="idp-sheet-wrap" id="idp-sheet-wrap" hidden>
    <img id="idp-sheet-img" class="idp-sheet-img" alt="排版预览">
    <div class="idp-sheet-actions">
      <button class="btn btn-primary" id="idp-sheet-save">下载排版图</button>
      <span class="idp-sheet-info" id="idp-sheet-info"></span>
    </div>
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
    const stage = document.getElementById('idp-stage');
    const dropHost = document.getElementById('idp-drop');
    const tip = document.getElementById('idp-tip');
    const replaceBtn = document.getElementById('idp-replace');
    const specSel = document.getElementById('idp-spec');
    const bgSel = document.getElementById('idp-bg');
    const tolInput = document.getElementById('idp-tol');
    const tolVal = document.getElementById('idp-tol-val');
    const zoomInput = document.getElementById('idp-zoom');
    const zoomVal = document.getElementById('idp-zoom-val');
    const paperSel = document.getElementById('idp-paper');
    const dpiSel = document.getElementById('idp-dpi');
    const gapInput = document.getElementById('idp-gap');
    const fmtSel = document.getElementById('idp-fmt');
    const cwWrap = document.getElementById('idp-cw-wrap');
    const pwWrap = document.getElementById('idp-pw-wrap');
    const cwInput = document.getElementById('idp-cw');
    const chInput = document.getElementById('idp-ch');
    const pwInput = document.getElementById('idp-pw');
    const phInput = document.getElementById('idp-ph');
    const infoEl = document.getElementById('idp-info');
    const downBtn = document.getElementById('idp-download');
    const sheetBtn = document.getElementById('idp-sheet');
    const sheetWrap = document.getElementById('idp-sheet-wrap');
    const sheetImg = document.getElementById('idp-sheet-img');
    const sheetSaveBtn = document.getElementById('idp-sheet-save');
    const sheetInfoEl = document.getElementById('idp-sheet-info');
    const sizeSel = document.getElementById('idp-size');
    const sizeKbInput = document.getElementById('idp-size-kb');
    const sizeKbWrap = document.getElementById('idp-size-kb-wrap');
    const status = document.getElementById('idp-status');

    let img = null;      // 已载入的照片
    let srcName = '';    // 原始文件名（用于输出命名）
    let zoom = 1;        // 缩放倍数
    let ox = 0, oy = 0;  // 位置偏移（以输出画布像素为单位）
    let frame = 0;
    let sheetUrl = null;
    let lastCut = null;  // 最近一次换底的统计结果（用于界面反馈）
    let sheetBlob = null;  // 排版图结果：先预览、确认后再下载
    let sheetName = '';
    let sheetStale = false; // 排版参数改动后，预览即失效

    const dpi = () => Number(dpiSel.value) || DEFAULT_DPI;
    const bgRgb = () => BACKGROUNDS[bgSel.value].rgb;

    /** 当前照片规格（毫米）：预设表或自定义输入 */
    function specMm() {
      const s = SPECS[specSel.value];
      if (s.mm) return s.mm;
      return [
        clampNum(cwInput.value, 10, 200, 25),
        clampNum(chInput.value, 10, 200, 35),
      ];
    }

    /** 当前纸张规格（毫米）：预设表或自定义输入 */
    function paperMm() {
      const p = PAPERS[paperSel.value];
      if (p.mm) return p.mm;
      return [
        clampNum(pwInput.value, 20, 1000, 102),
        clampNum(phInput.value, 20, 1000, 152),
      ];
    }

    /** 当前规格的像素尺寸 */
    function specPx() {
      const [w, h] = specMm();
      return { w: mmToPx(w, dpi()), h: mmToPx(h, dpi()) };
    }

    /** 当前「输出大小上限」（字节；0 表示不压缩） */
    function currentSizeLimit() {
      const preset = SIZE_LIMITS[sizeSel.value];
      if (!preset || preset.bytes === 0) return 0;
      if (preset.bytes !== null) return preset.bytes;
      return clampNum(sizeKbInput.value, 5, 10240, 100) * 1024;
    }

    /** 当前排版方案（核心算法在 idphotoCore.planLayout） */
    function currentPlan() {
      return planLayout({
        photoMm: specMm(),
        paperMm: paperMm(),
        gapMm: clampNum(gapInput.value, 0, 20, DEFAULT_GAP_MM),
        dpi: dpi(),
      });
    }

    /** 换底结果说明：让「有没有效果、为什么没效果」一眼可见 */
    function cutoutNote() {
      const rgb = bgRgb();
      if (!rgb) return '背景底色为「保留原背景」，不会做换底';
      if (!lastCut) return '';
      const pct = Math.round(lastCut.ratio * 100);
      if (lastCut.ratio < 0.02) {
        return `未识别到可替换的背景（容差 ${tolInput.value} 偏低或背景太复杂）：调高「抠图容差」，或改用背景干净的照片`;
      }
      const b = lastCut.bg || [0, 0, 0];
      const diff = Math.sqrt((b[0] - rgb[0]) ** 2 + (b[1] - rgb[1]) ** 2 + (b[2] - rgb[2]) ** 2);
      if (diff < 25) {
        return `原背景与所选底色很接近，换底后视觉上几乎无变化（已处理 ${pct}% 区域）`;
      }
      return `已换底：替换 ${pct}% 区域（容差 ${tolInput.value}）`;
    }

    /** 任一排版参数变动后，已有预览即视为过期，避免下载到旧图 */
    function markSheetStale() {
      if (sheetWrap.hidden || sheetStale || !sheetBlob) return;
      sheetStale = true;
      sheetSaveBtn.disabled = true;
      sheetInfoEl.textContent = '排版参数已变更，当前预览已过期，请重新点「生成排版图」';
    }

    /** 底部信息行：规格像素 + 排版张数 + 换底结果 */
    function updateInfo() {
      if (!img) { infoEl.textContent = ''; return; }
      const { w, h } = specPx();
      const p = currentPlan();
      infoEl.textContent = [
        `规格 ${w}×${h}px（${specMm().join('×')}mm @ ${dpi()}dpi）`,
        `${PAPERS[paperSel.value].name} 可排 ${p.cols} 列 × ${p.rows} 行 = ${p.count} 张`,
        cutoutNote(),
      ].filter(Boolean).join(' · ');
    }

    /** 空态显示「拖入照片 / 点击选择」，载入后改为显示画布预览 */
    function syncStage() {
      const loaded = !!img;
      dropHost.hidden = loaded;
      canvas.hidden = !loaded;
      tip.hidden = !loaded;
    }

    /** 按当前变换把照片以 cover 方式绘制到目标区域（等效 Pillow 居中裁剪 + 缩放） */
    function paint(ctx, w, h) {
      const s = Math.max(w / img.width, h / img.height) * zoom;
      const dw = img.width * s;
      const dh = img.height * s;
      ctx.drawImage(img, (w - dw) / 2 + ox, (h - dh) / 2 + oy, dw, dh);
    }

    /** 在给定 ctx 上绘制一张完整寸照；返回换底统计（未换底时返回 null） */
    function paintPhoto(ctx, w, h, withCutout) {
      const rgb = bgRgb();
      ctx.fillStyle = rgb ? `rgb(${rgb.join(',')})` : '#ffffff';
      ctx.fillRect(0, 0, w, h);
      paint(ctx, w, h);
      if (!rgb || !withCutout) return null;
      const id = ctx.getImageData(0, 0, w, h);
      const res = replaceBackground(id, rgb, Number(tolInput.value));
      ctx.putImageData(id, 0, 0);
      return res;
    }

    /** 生成一张独立的寸照画布 */
    function buildPhoto(withCutout = true) {
      const { w, h } = specPx();
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
        syncStage();
        if (!img) { updateInfo(); return; }
        const { w, h } = specPx();
        canvas.width = w;
        canvas.height = h;
        const cut = paintPhoto(canvas.getContext('2d'), w, h, withCutout);
        // 拖动/滑动过程中的快速预览不做换底，保留上一次的统计结果
        if (withCutout) lastCut = cut;
        updateInfo();
      });
    }

    /**
     * 画布编码为 Blob：JPEG 会按 photo-tool 的做法写入 DPI 密度信息
     * @param {HTMLCanvasElement} target
     * @param {'jpeg'|'png'} fmt
     * @param {number} [quality]  JPEG 质量
     * @param {number} [dpiValue] 写入 JPEG 的打印密度
     */
    function canvasToBlob(target, fmt, quality = 0.95, dpiValue = dpi()) {
      return new Promise((resolve) => {
        const done = async (blob) => {
          if (!blob || fmt === 'png') { resolve(blob); return; }
          try {
            const buf = await blob.arrayBuffer();
            patchJpegDpi(buf, dpiValue);
            resolve(new Blob([buf], { type: 'image/jpeg' }));
          } catch { resolve(blob); }
        };
        if (fmt === 'png') target.toBlob(done, 'image/png');
        else target.toBlob(done, 'image/jpeg', quality);
      });
    }

    /** 只测量体积（不写 DPI），供压缩时反复试算 */
    function measureJpegSize(target, quality) {
      return new Promise((resolve) => {
        target.toBlob((blob) => resolve(blob ? blob.size : Infinity), 'image/jpeg', quality);
      });
    }

    /** 按比例缩小画布（质量已到下限仍超标时使用） */
    function downscaleCanvas(src, scale) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(src.width * scale));
      c.height = Math.max(1, Math.round(src.height * scale));
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, c.width, c.height);
      return c;
    }

    /**
     * 压缩到目标体积以内：
     *   1) 先二分 JPEG 质量（像素尺寸不变，优先保画质）；
     *   2) 质量降到下限仍超标时，再逐级缩小尺寸重试。
     * 缩小尺寸会同步换算 DPI，避免打印物理尺寸被谎报。
     * @param {number} targetBytes
     */
    async function compressPhoto(targetBytes) {
      const full = buildPhoto(true);
      const baseDpi = dpi();
      let scale = 1;
      let result = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const src = scale === 1 ? full : downscaleCanvas(full, scale);
        const found = await searchJpegQuality({
          measureSize: (q) => measureJpegSize(src, q),
          targetBytes,
        });
        const blob = await canvasToBlob(src, 'jpeg', found.quality, Math.max(1, Math.round(baseDpi * scale)));
        result = { blob, quality: found.quality, scale, width: src.width, height: src.height };
        if (blob && blob.size <= targetBytes) break;
        if (scale <= 0.5) break;
        scale *= 0.8;
      }
      return result;
    }

    /** 载入/清除照片 */
    function loadFile(file) {
      if (!file) {
        img = null;
        srcName = '';
        downBtn.disabled = true;
        sheetBtn.disabled = true;
        sheetWrap.hidden = true;
        setStatus(status, '', '');
        infoEl.textContent = '';
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
        srcName = stripExt(file.name) || '照片';
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

    /* ---------- 上传区（直接并入下方预览框） ---------- */
    const dz = Dropzone(dropHost, {
      accept: 'image/*',
      label: '拖入照片 / 点击选择',
    });
    dz.onChange((files) => loadFile(files[files.length - 1] || null));

    // 已载入照片时：用「更换照片」按钮选新图，或直接把新图拖到预览框上替换
    replaceBtn.addEventListener('click', () => {
      dropHost.querySelector('.dz-input')?.click();
    });
    const innerDropzone = dropHost.querySelector('.dropzone');
    const markDrag = (on) => innerDropzone && innerDropzone.classList.toggle('drag', on);
    ['dragover', 'dragenter'].forEach((ev) => stage.addEventListener(ev, (e) => {
      if (!img) return;              // 空态交给 Dropzone 组件自己处理
      e.preventDefault();
      markDrag(true);
    }));
    stage.addEventListener('dragleave', () => { if (img) markDrag(false); });
    stage.addEventListener('drop', (e) => {
      if (!img) return;              // 空态交给 Dropzone 组件自己处理
      e.preventDefault();
      markDrag(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) dz.add([f]);            // 仍走上传区，保证类型校验与跨页面登记一致
    });

    // 跨页面复用：若全局已有图片文件，直接载入
    const existing = dz.getFiles();
    if (existing.length) loadFile(existing[existing.length - 1]);
    else render(false);

    /* ---------- 参数调整 ---------- */
    // 选了「自定义尺寸 / 自定义纸张」时才显示对应输入框
    const syncCustom = () => {
      cwWrap.hidden = SPECS[specSel.value].mm !== null;
      pwWrap.hidden = PAPERS[paperSel.value].mm !== null;
    };
    syncCustom();

    // 选了「自定义 KB」时才显示数值输入框
    const syncSizeCustom = () => {
      sizeKbWrap.hidden = SIZE_LIMITS[sizeSel.value].bytes !== null;
    };
    syncSizeCustom();
    sizeSel.addEventListener('change', syncSizeCustom);

    // 任何参数变动都让已生成的排版预览失效，避免下载到过期结果
    const panelEl = canvas.closest('.tool-panel') || document.body;
    panelEl.addEventListener('change', markSheetStale);
    panelEl.addEventListener('input', markSheetStale);

    specSel.addEventListener('change', () => { syncCustom(); render(true); });
    bgSel.addEventListener('change', () => render(true));
    tolInput.addEventListener('input', () => {
      tolVal.textContent = tolInput.value;
      render(true);
    });

    [cwInput, chInput].forEach((el) => el.addEventListener('change', () => render(true)));
    [pwInput, phInput].forEach((el) => el.addEventListener('change', () => {
      syncCustom(); updateInfo();
    }));
    paperSel.addEventListener('change', () => { syncCustom(); updateInfo(); });
    dpiSel.addEventListener('change', () => render(true));
    gapInput.addEventListener('change', updateInfo);

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
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      render(true);
      markSheetStale();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    /* ---------- 下载单张（支持把生成的证件照压到指定大小以内） ---------- */
    downBtn.addEventListener('click', async () => {
      if (!img) return;
      const limit = currentSizeLimit();
      let fmt = fmtSel.value;

      // PNG 没有质量旋钮，无法靠压缩达标；限制体积时自动改用 JPEG
      if (limit && fmt === 'png') {
        fmt = 'jpeg';
        fmtSel.value = 'jpeg';
      }

      const { w, h } = specPx();
      const name = `${srcName}_${sizeTagOf(specSel.value, specMm())}`;

      if (!limit) {
        setStatus(status, 'processing', '正在生成寸照…');
        const blob = await canvasToBlob(buildPhoto(true), fmt);
        if (!blob) { setStatus(status, 'err', '导出失败，请重试或更换浏览器'); return; }
        downloadBlob(blob, `${name}.${fmt === 'png' ? 'png' : 'jpg'}`);
        setStatus(status, 'ok',
          `已生成 ${w}×${h}px（${fmt.toUpperCase()} ${fmtSize(blob.size)} @ ${dpi()}dpi）并开始下载`);
        return;
      }

      setStatus(status, 'processing', `正在压缩到 ${fmtSize(limit)} 以内…`);
      const res = await compressPhoto(limit);
      if (!res || !res.blob) { setStatus(status, 'err', '压缩失败，请重试或更换浏览器'); return; }

      downloadBlob(res.blob, `${name}.jpg`);
      if (res.blob.size <= limit) {
        const sizeNote = res.scale < 1
          ? `，并缩小尺寸至 ${res.width}×${res.height}px`
          : '，像素尺寸未变';
        setStatus(status, 'ok',
          `已压缩至 ${fmtSize(res.blob.size)}（质量 ${res.quality.toFixed(2)}${sizeNote}）并开始下载`);
      } else {
        setStatus(status, 'warn',
          `已尽力压缩到 ${fmtSize(res.blob.size)}，仍超过 ${fmtSize(limit)}`
          + `（已缩小尺寸至 ${res.width}×${res.height}px）：建议放宽限制，或换一张细节更少的照片`);
      }
    });

    /* ---------- 生成排版打印图 ---------- */
    sheetBtn.addEventListener('click', async () => {
      if (!img) return;
      setStatus(status, 'processing', '正在生成排版图…');
      const photo = buildPhoto(true);
      const plan = currentPlan();
      const fmt = fmtSel.value;

      const c = document.createElement('canvas');
      c.width = plan.paperW;
      c.height = plan.paperH;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, plan.paperW, plan.paperH);

      let placed = 0;
      for (let r = 0; r < plan.rows; r++) {
        for (let i = 0; i < plan.cols; i++) {
          const pos = cellAt(plan, i, r);
          if (!pos) continue;               // 超出纸面不粘贴（photo-tool 的边界校验）
          ctx.drawImage(photo, pos.x, pos.y);
          placed++;
        }
      }

      const blob = await canvasToBlob(c, fmt);
      if (!blob) { setStatus(status, 'err', '导出失败，请重试或更换浏览器'); return; }

      // 只生成预览、不自动下载：确认无误后再点「下载排版图」
      const paperName = PAPERS[paperSel.value].name.replace(/[（(].*$/, '');
      sheetBlob = blob;
      sheetName = `${srcName}_${sizeTagOf(specSel.value, specMm())}_排版_${placed}张.${fmt === 'png' ? 'png' : 'jpg'}`;
      sheetStale = false;
      sheetSaveBtn.disabled = false;

      if (sheetUrl) URL.revokeObjectURL(sheetUrl);
      sheetUrl = URL.createObjectURL(blob);
      sheetImg.src = sheetUrl;
      sheetWrap.hidden = false;
      sheetInfoEl.textContent =
        `${paperName} · ${plan.paperW}×${plan.paperH}px @ ${dpi()}dpi · `
        + `${plan.cols} 列 × ${plan.rows} 行 共 ${placed} 张 · ${fmt.toUpperCase()} ${fmtSize(blob.size)}`;

      setStatus(status, 'ok',
        `排版图已生成（${plan.cols} 列 × ${plan.rows} 行 共 ${placed} 张），`
        + '确认下方预览无误后，点「下载排版图」保存');
    });

    /* ---------- 下载排版图（预览确认后手动触发） ---------- */
    sheetSaveBtn.addEventListener('click', () => {
      if (!sheetBlob || sheetStale) return;
      downloadBlob(sheetBlob, sheetName);
      setStatus(status, 'ok', `已开始下载：${sheetName}（${fmtSize(sheetBlob.size)}）`);
    });

    // 离开页面时释放排版预览 URL
    window.addEventListener('hashchange', () => {
      if (sheetUrl) { URL.revokeObjectURL(sheetUrl); sheetUrl = null; }
      sheetBlob = null;
      sheetStale = true;
    });
  },
};
