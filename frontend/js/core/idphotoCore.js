/* ============================================================
 * core/idphotoCore.js - 寸照核心算法（纯函数，不依赖 DOM / 浏览器）
 *
 * 算法与数据表移植自开源项目 photo-tool（amosli/photo-tool）的 photo_tool.py：
 *   ┌────────────────────────┬──────────────────────────────────────────────┐
 *   │ photo_tool.py          │ 本模块                                        │
 *   ├────────────────────────┼──────────────────────────────────────────────┤
 *   │ SIZE_MAP               │ SPECS（毫米尺寸表，含签证类规格）              │
 *   │ PAPER_SIZES            │ PAPERS（A4 / 6寸 / 4R / 5寸 / 自定义）         │
 *   │ mm_to_px()             │ mmToPx()                                      │
 *   │ cols/rows 计算         │ planLayout()                                  │
 *   │ start_x / start_y 居中 │ planLayout() 返回值                            │
 *   │ 边界校验后 paste        │ 由调用方按 planLayout() 返回值判断              │
 *   │ 容差抠图（GUI 版）      │ replaceBackground()                           │
 *   │ save(..., dpi=(d,d))   │ patchJpegDpi()（浏览器端补写 JFIF 密度）        │
 *   └────────────────────────┴──────────────────────────────────────────────┘
 *
 * 与 photo-tool 的差异：photo-tool 用 Pillow 做居中裁剪 + LANCZOS 缩放；
 * 浏览器端由 Canvas 的 drawImage 实现（等效，且额外支持缩放与拖动取景）。
 * ============================================================ */

/**
 * 证件照规格：mm 为 [宽, 高]（毫米），tag 用于输出文件命名。
 * 覆盖 photo_tool.py 的 SIZE_MAP，并保留本项目既有的社保照等规格。
 */
export const SPECS = {
  '1c':       { name: '一寸（25×35mm）',                            mm: [25, 35], tag: '1inch' },
  '1c-small': { name: '小一寸（22×32mm）',                          mm: [22, 32], tag: '22x32mm' },
  '1c-large': { name: '大一寸（33×48mm）',                          mm: [33, 48], tag: '33x48mm' },
  '2c':       { name: '二寸（35×49mm）',                            mm: [35, 49], tag: '2inch' },
  '2c-small': { name: '小二寸 / 日本·申根·英国·泰国签证（35×45mm）', mm: [35, 45], tag: '35x45mm' },
  '2c-large': { name: '大二寸（35×53mm）',                          mm: [35, 53], tag: '35x53mm' },
  '3c':       { name: '三寸（55×84mm）',                            mm: [55, 84], tag: '3inch' },
  'social':   { name: '社保照（26×32mm）',                          mm: [26, 32], tag: '26x32mm' },
  'ca':       { name: '加拿大签证（35×50mm）',                      mm: [35, 50], tag: '35x50mm' },
  'us':       { name: '美国签证 / 绿卡（51×51mm）',                 mm: [51, 51], tag: '51x51mm' },
  custom:     { name: '自定义尺寸…',                                mm: null,      tag: '' },
};

/** 可选输出 DPI（photo-tool 默认 300） */
export const DPIS = {
  300: '300 dpi（标准打印）',
  350: '350 dpi（高清）',
  600: '600 dpi（冲印级）',
};

/** 排版纸张：mm 为 [宽, 高]，参考 photo_tool.py 的 PAPER_SIZES */
export const PAPERS = {
  a4:     { name: 'A4 纸（210×297mm）',        mm: [210, 297] },
  photo5: { name: '5 寸相纸（89×127mm）',      mm: [89, 127] },
  photo6: { name: '6 寸相纸 / 4R（102×152mm）', mm: [102, 152] },
  custom: { name: '自定义纸张…',               mm: null },
};

/**
 * 输出体积上限档位（bytes 为 0 表示不压缩，null 表示用自定义值）。
 * 用途：把「生成的证件照」压到报名/政务网站要求的「不超过 xx KB」以内。
 * 注意这与用户上传的原图大小无关，原图（通常几 MB）始终可直接使用。
 */
export const SIZE_LIMITS = {
  none:   { name: '不压缩（原始大小）', bytes: 0 },
  kb20:   { name: '≤ 20 KB',   bytes: 20 * 1024 },
  kb40:   { name: '≤ 40 KB',   bytes: 40 * 1024 },
  kb100:  { name: '≤ 100 KB',  bytes: 100 * 1024 },
  kb200:  { name: '≤ 200 KB',  bytes: 200 * 1024 },
  kb500:  { name: '≤ 500 KB',  bytes: 500 * 1024 },
  mb1:    { name: '≤ 1 MB',    bytes: 1024 * 1024 },
  custom: { name: '自定义 KB…', bytes: null },
};

/** 背景底色：rgb 为 null 表示保留原背景 */
export const BACKGROUNDS = {
  keep:  { name: '保留原背景', rgb: null },
  white: { name: '白底', rgb: [255, 255, 255] },
  red:   { name: '红底', rgb: [255, 0, 0] },
  blue:  { name: '蓝底', rgb: [67, 142, 219] },
  gray:  { name: '灰底', rgb: [128, 128, 128] },
};

/** 默认照片间距（毫米）——photo-tool 的 spacing_mm 默认值 */
export const DEFAULT_GAP_MM = 2;

/** 默认 DPI ——photo-tool 的 dpi 默认值 */
export const DEFAULT_DPI = 300;

/** 毫米 → 像素：与 photo_tool.py 的 mm_to_px 完全一致（floor 取整） */
export function mmToPx(mm, dpi) {
  return Math.floor((mm / 25.4) * dpi);
}

/** 数值区间约束，非法值回退（用于自定义尺寸输入） */
export function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * 排版网格计算（photo_tool.create_photo_layout 的核心）
 *   cols = floor((纸宽 + 间距) / (照片宽 + 间距))
 *   rows = floor((纸高 + 间距) / (照片高 + 间距))
 * 网格整体在纸面上居中。
 *
 * @param {{photoMm: number[], paperMm: number[], gapMm?: number, dpi?: number}} p
 * @returns {{paperW:number, paperH:number, cellW:number, cellH:number, gap:number,
 *            cols:number, rows:number, totalW:number, totalH:number,
 *            startX:number, startY:number, count:number}}
 */
export function planLayout({ photoMm, paperMm, gapMm = DEFAULT_GAP_MM, dpi = DEFAULT_DPI }) {
  const [pw, ph] = paperMm;
  const [cw, ch] = photoMm;

  const paperW = mmToPx(pw, dpi);
  const paperH = mmToPx(ph, dpi);
  const cellW = mmToPx(cw, dpi);
  const cellH = mmToPx(ch, dpi);
  const gap = mmToPx(gapMm, dpi);

  const cols = Math.max(1, Math.floor((paperW + gap) / (cellW + gap)));
  const rows = Math.max(1, Math.floor((paperH + gap) / (cellH + gap)));

  const totalW = cols * cellW + (cols - 1) * gap;
  const totalH = rows * cellH + (rows - 1) * gap;

  return {
    paperW, paperH, cellW, cellH, gap, cols, rows, totalW, totalH,
    startX: Math.floor((paperW - totalW) / 2),
    startY: Math.floor((paperH - totalH) / 2),
    count: cols * rows,
  };
}

/**
 * 取第 i 列、第 r 行照片的左上角坐标；
 * 返回 null 表示超出纸面（对应 photo_tool.py 的 paste 前边界校验）。
 */
export function cellAt(plan, col, row) {
  const x = plan.startX + col * (plan.cellW + plan.gap);
  const y = plan.startY + row * (plan.cellH + plan.gap);
  if (x + plan.cellW > plan.paperW || y + plan.cellH > plan.paperH) return null;
  return { x, y };
}

/** 输出文件名的尺寸标签（对齐 photo-tool 的 size_tag 规则） */
export function sizeTagOf(specKey, mm) {
  const tag = SPECS[specKey]?.tag;
  if (tag) return tag;
  return `${mm[0]}x${mm[1]}mm`;
}

/**
 * 换底色：背景色采样 → 区域生长分割 → 边缘羽化混合 → 写入目标底色。
 *
 * 相比「四角单色 + 全局阈值」的做法，这里做了三处增强，用于解决
 * 真实照片背景有渐变/阴影时「一个像素都换不掉」的问题：
 *   1) 参考色取上边缘 5 个采样块的中位数（证件照上部必为背景，
 *      且中位数能容忍其中一块落在头发/衣物上）；
 *   2) 区域生长用三个阈值共同约束：相邻像素的局部差异（允许背景渐变被
 *      连续跟踪）、与参考色的整体上限（防渗漏到主体）、以及更严的起点阈值
 *      （防止画面下缘的深色衣物被当成背景起点）；
 *   3) 掩码做两次 3×3 均值模糊得到 0-1 的 alpha，边缘羽化后再混合，
 *      避免锯齿和生硬的「剪刀边」。
 *
 * @param {ImageData} imageData
 * @param {number[]} rgb       目标底色
 * @param {number} tolerance   颜色容差（0-255 尺度，对应界面「抠图容差」）
 * @returns {{ratio: number, bg: number[]|null}}
 *          ratio 为被替换像素占比（0-1），bg 为采样到的背景色（供界面判断提示）
 */
export function replaceBackground(imageData, rgb, tolerance) {
  const { data, width: w, height: h } = imageData;
  if (w < 8 || h < 8) return { ratio: 0, bg: null };

  const median = (arr) => {
    arr.sort((a, b) => a - b);
    return arr[arr.length >> 1];
  };

  /* ---------- 1. 采样背景参考色 ---------- */
  const patch = Math.max(2, Math.round(Math.min(w, h) * 0.06));
  const anchors = [
    [0, 0],                                        // 左上
    [Math.round(w / 2 - patch / 2), 0],            // 上中
    [w - patch, 0],                                // 右上
    [0, Math.round(h * 0.15)],                     // 左上侧
    [w - patch, Math.round(h * 0.15)],             // 右上侧
  ];
  const c0 = [];
  const c1 = [];
  const c2 = [];
  for (const [ax, ay] of anchors) {
    const x0 = Math.max(0, Math.min(w - patch, ax));
    const y0 = Math.max(0, Math.min(h - patch, ay));
    for (let y = y0; y < y0 + patch; y++) {
      for (let x = x0; x < x0 + patch; x++) {
        const i = (y * w + x) * 4;
        c0.push(data[i]);
        c1.push(data[i + 1]);
        c2.push(data[i + 2]);
      }
    }
  }
  const bg = [median(c0), median(c1), median(c2)];

  /* ---------- 2. 区域生长（从图像四边向内） ---------- */
  // 三个阈值分工不同，缺一不可：
  //   tolLocal  只看相邻像素差异。背景渐变每像素只变零点几，而主体边缘（含抗锯齿、
  //             JPEG 过渡带）每像素要变十几以上 —— 所以必须取小值。取值过大时填充会
  //             顺着边缘过渡带爬进人物内部（实测会把浅肤色人头整块刷成背景色）。
  //   tolSeed   边框起点与背景色的接近程度，避免画面下缘的深色衣物被当成背景起点。
  //   tolGlobal 相对参考色的整体上限，避免慢慢漂移进主体。
  //            （上限 14：容差拉到最大时也不会放松到能穿过边缘过渡带）
  const tolLocal = Math.max(6, Math.min(tolerance * 0.2, 14));
  const tolSeed = Math.max(tolerance, 1) * 1.5;
  const tolGlobal = Math.max(tolerance, 1) * 4;
  const local2 = tolLocal * tolLocal;
  const seed2 = tolSeed * tolSeed;
  const global2 = tolGlobal * tolGlobal;

  const dist2 = (i, r, g, b) => {
    const dr = data[i] - r;
    const dg = data[i + 1] - g;
    const db = data[i + 2] - b;
    return dr * dr + dg * dg + db * db;
  };
  const toRef = (i) => dist2(i, bg[0], bg[1], bg[2]);

  const mask = new Uint8Array(w * h);
  const stack = [];
  const seed = (x, y) => {
    const idx = y * w + x;
    if (mask[idx] || toRef(idx * 4) > seed2) return;
    mask[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }

  while (stack.length) {
    const idx = stack.pop();
    const ci = idx * 4;
    const cr = data[ci];
    const cg = data[ci + 1];
    const cb = data[ci + 2];
    const x = idx % w;
    const y = (idx - x) / w;

    const grow = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
      const nIdx = ny * w + nx;
      if (mask[nIdx]) return;
      const ni = nIdx * 4;
      if (dist2(ni, cr, cg, cb) > local2) return;   // 与相邻像素差异过大 -> 是主体
      if (toRef(ni) > global2) return;              // 离背景色太远 -> 一定是主体
      mask[nIdx] = 1;
      stack.push(nIdx);
    };
    grow(x - 1, y);
    grow(x + 1, y);
    grow(x, y - 1);
    grow(x, y + 1);
  }

  /* ---------- 3. 边缘羽化：两次 3×3 均值模糊 → 0-1 的 alpha ---------- */
  let alpha = Float32Array.from(mask);
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            sum += alpha[yy * w + xx];
            cnt++;
          }
        }
        next[y * w + x] = sum / cnt;
      }
    }
    alpha = next;
  }

  /* ---------- 4. 按 alpha 混合目标底色 ---------- */
  const [tr, tg, tb] = rgb;
  const total = w * h;
  let replaced = 0;
  for (let idx = 0; idx < total; idx++) {
    const a = alpha[idx];
    if (a <= 0) continue;
    const i = idx * 4;
    data[i] = data[i] + (tr - data[i]) * a;
    data[i + 1] = data[i + 1] + (tg - data[i + 1]) * a;
    data[i + 2] = data[i + 2] + (tb - data[i + 2]) * a;
    data[i + 3] = 255;
    if (a >= 0.5) replaced++;
  }

  return { ratio: replaced / total, bg };
}

/**
 * 在 JPEG 的 JFIF(APP0) 段写入打印密度，
 * 对应 photo_tool.py 的 canvas.save(..., dpi=(dpi, dpi))。
 * Canvas 生成的 JPEG 默认 units=0、密度=1，不写密度会导致打印尺寸失真。
 *
 * @param {ArrayBuffer} buffer 原始 JPEG 数据（原地修改）
 * @param {number} dpi
 * @returns {ArrayBuffer} 同一个 buffer
 */
export function patchJpegDpi(buffer, dpi) {
  const view = new DataView(buffer);
  if (view.byteLength < 18 || view.getUint16(0) !== 0xFFD8) return buffer;

  let off = 2; // 跳过 SOI
  while (off + 4 <= view.byteLength) {
    if (view.getUint8(off) !== 0xFF) break;
    const marker = view.getUint8(off + 1);
    // 只跳过可跳过的 APPn / COM 段，遇到 SOF/SOS 等即停止
    if (!((marker >= 0xE0 && marker <= 0xEF) || marker === 0xFE)) break;

    const len = view.getUint16(off + 2);
    if (len < 2) break;

    const isJfif = marker === 0xE0 && off + 18 <= view.byteLength
      && view.getUint8(off + 4) === 0x4A && view.getUint8(off + 5) === 0x46
      && view.getUint8(off + 6) === 0x49 && view.getUint8(off + 7) === 0x46;

    if (isJfif) {
      view.setUint8(off + 11, 1);        // units = 1（每英寸点数）
      view.setUint16(off + 12, dpi);     // X 密度
      view.setUint16(off + 14, dpi);     // Y 密度
      return buffer;
    }
    off += 2 + len;
  }
  return buffer;
}

/**
 * 二分搜索 JPEG 质量，使编码后的体积不超过 targetBytes。
 * JPEG 体积随质量单调递增，因此可以二分；取「仍能满足体积要求的最大质量」，
 * 以保留尽可能好的画质。
 *
 * @param {{measureSize: (quality: number) => Promise<number>|number,
 *          targetBytes: number,
 *          minQuality?: number, maxQuality?: number, iterations?: number}} p
 * @returns {Promise<{quality: number, size: number, fits: boolean}>}
 *          fits 为 false 表示即使最低质量也超出目标体积（调用方应改为缩小尺寸）
 */
export async function searchJpegQuality({
  measureSize,
  targetBytes,
  minQuality = 0.3,
  maxQuality = 0.95,
  iterations = 6,
}) {
  const sizeAtMin = await measureSize(minQuality);
  if (sizeAtMin > targetBytes) {
    return { quality: minQuality, size: sizeAtMin, fits: false };
  }

  let lo = minQuality;
  let hi = maxQuality;
  let best = { quality: minQuality, size: sizeAtMin };

  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const size = await measureSize(mid);
    if (size <= targetBytes) {
      best = { quality: mid, size };
      lo = mid;                 // 还能再高一点
    } else {
      hi = mid;                 // 太大了，降质量
    }
  }

  return { ...best, fits: true };
}
