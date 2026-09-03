/* ============================================================
 * infrastructure/pdfEngine.js - PDF 底层操作引擎（基于 pdf-lib）
 * 职责：提供纯 PDF 处理原语，所有函数接收 Buffer，
 *       返回 Buffer 或结构化数据；不含任何 HTTP / 业务判断。
 * ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFDocument, rgb, StandardFonts, degrees, PDFName, PDFDict } = require('pdf-lib');
const fontkit = require('fontkit');

const FONT_PATH = path.join(__dirname, '..', 'fonts');

/* 尝试加载系统中文字体（用于页码/水印等中文文本绘制） */
let _cjk = null;
async function getCjkFont(doc) {
  if (_cjk && _cjk.doc === doc) return _cjk.font;
  const candidates = [
    'C:\\Windows\\Fonts\\simhei.ttf', 'C:\\Windows\\Fonts\\msyh.ttc',
    'C:\\Windows\\Fonts\\simsun.ttc', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/System/Library/Fonts/PingFang.ttc',
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        doc.registerFontkit(fontkit);
        const bytes = fs.readFileSync(p);
        // 注意：不要传 {fontIndex}，否则 pdf-lib 会返回 fontkit 原生 Font（无 layout 方法）
        const font = await doc.embedFont(bytes);
        _cjk = { doc, font };
        return font;
      }
    } catch { /* try next */ }
  }
  return null; // 无中文字体则回退 Helvetica（不支持中文）
}

async function loadPdf(buf) {
  return PDFDocument.load(buf, { ignoreEncryption: false, updateMetadata: false });
}
async function loadPdfAny(buf) {
  // 尝试加载（忽略部分损坏/加密，用于修复、信息读取）
  try { return await PDFDocument.load(buf, { ignoreEncryption: true }); }
  catch { return await PDFDocument.load(buf, { ignoreEncryption: true, throwOnInvalidObject: false }); }
}

function tmpFile(ext = 'pdf') {
  return path.join(os.tmpdir(), `helper-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
}
function saveBuf(buf, ext = 'pdf') {
  const p = tmpFile(ext);
  fs.writeFileSync(p, buf);
  return p;
}
function readTmp(p) { const b = fs.readFileSync(p); fs.unlinkSync(p); return b; }

/* ---------- 页面操作 ---------- */
async function mergePdfs(buffers, { bookmark = false, toc = false } = {}) {
  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);
  let pageIndex = 0;
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p, i) => {
      if (bookmark) p.bookmark = `文件${bookmark ? '' : ''} p${i + 1}`;
      out.addPage(p); pageIndex++;
    });
  }
  return Buffer.from(await out.save());
}

async function splitPages(buf, { mode, pages, intervals, every, size }) {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const count = src.getPageCount();
  const groups = []; // 每组是页码数组（1-based）
  if (mode === 'pages') {
    groups.push(parsePageList(pages, count));
  } else if (mode === 'intervals') {
    intervals.split(',').forEach(iv => {
      const [a, b] = iv.split('-').map(s => parseInt(s.trim(), 10));
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const arr = []; for (let i = lo; i <= hi; i++) arr.push(i); groups.push(arr);
    });
  } else if (mode === 'every') {
    const n = Math.max(1, parseInt(every, 10) || 1);
    for (let i = 1; i <= count; i += n) groups.push([i]);
  } else { // size 模式：纯前端难按大小切，退化为每页一份
    for (let i = 1; i <= count; i++) groups.push([i]);
  }
  const zips = [];
  for (const g of groups) {
    const out = await PDFDocument.create();
    out.registerFontkit(fontkit);
    const idx = g.map(p => p - 1).filter(i => i >= 0 && i < count);
    if (!idx.length) continue;
    const copied = await out.copyPages(src, idx);
    copied.forEach(p => out.addPage(p));
    zips.push({ name: g.length === 1 ? `page-${g[0]}.pdf` : `pages-${g[0]}-${g[g.length - 1]}.pdf`, buffer: Buffer.from(await out.save()) });
  }
  return zips; // [{name, buffer}]
}

async function rotatePdf(buf, { angle = 90, pages = '' }) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const count = doc.getPageCount();
  const only = pages ? new Set(parsePageList(pages, count)) : null;
  doc.getPages().forEach((p, i) => {
    if (!only || only.has(i + 1)) p.setRotation(degrees((p.getRotation().angle + parseInt(angle, 10)) % 360));
  });
  return Buffer.from(await doc.save());
}

async function extractPages(buf, { pages, reverse = false }) {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const count = src.getPageCount();
  let list = parsePageList(pages, count);
  if (reverse) list = list.reverse();
  const out = await PDFDocument.create(); out.registerFontkit(fontkit);
  const idx = list.map(p => p - 1).filter(i => i >= 0 && i < count);
  const copied = await out.copyPages(src, idx);
  copied.forEach(p => out.addPage(p));
  return Buffer.from(await out.save());
}

async function reorganizePages(buf, { order, reverse = false }) {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const count = src.getPageCount();
  let seq = reverse ? Array.from({ length: count }, (_, i) => count - i) : parsePageList(order, count);
  const out = await PDFDocument.create(); out.registerFontkit(fontkit);
  const idx = seq.map(p => p - 1).filter(i => i >= 0 && i < count);
  const copied = await out.copyPages(src, idx);
  copied.forEach(p => out.addPage(p));
  return Buffer.from(await out.save());
}

async function removePages(buf, { pages }) {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const count = src.getPageCount();
  const del = new Set(parsePageList(pages, count));
  const keep = []; for (let i = 1; i <= count; i++) if (!del.has(i)) keep.push(i);
  const out = await PDFDocument.create(); out.registerFontkit(fontkit);
  const idx = keep.map(p => p - 1);
  const copied = await out.copyPages(src, idx);
  copied.forEach(p => out.addPage(p));
  return Buffer.from(await out.save());
}

async function removeBlanks(buf, { threshold = 95 }) {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const count = src.getPageCount();
  const keep = [];
  for (let i = 0; i < count; i++) {
    const p = src.getPage(i);
    const content = p.node.Contents();
    let len = 0;
    try { len = content ? content.getContentsString().length : 0; } catch { len = 0; }
    // 简单启发：内容流很短视为空白
    if (len > (threshold < 90 ? 50 : 10)) keep.push(i + 1);
  }
  const out = await PDFDocument.create(); out.registerFontkit(fontkit);
  const copied = await out.copyPages(src, keep.map(p => p - 1));
  copied.forEach(p => out.addPage(p));
  return Buffer.from(await out.save());
}

async function cropPdf(buf, { top = 0, bottom = 0, left = 0, right = 0 }) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const pt = 72 / 25.4; // mm -> pt
  doc.getPages().forEach(p => {
    const { width, height } = p.getSize();
    const nl = left * pt, nb = bottom * pt, nr = right * pt, nt = top * pt;
    p.setMediaBox(nl, nb, width - nl - nr, height - nb - nt);
  });
  return Buffer.from(await doc.save());
}

async function addPageNumbers(buf, { position, text, start = 1, size = 'medium' }) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  doc.registerFontkit(fontkit);
  const cjk = await getCjkFont(doc);
  const font = cjk || await doc.embedFont(StandardFonts.Helvetica);
  const sizes = { small: 9, medium: 11, large: 14 };
  const fs_ = sizes[size] || 11;
  const count = doc.getPageCount();
  doc.getPages().forEach((p, i) => {
    const { width, height } = p.getSize();
    const n = i + parseInt(start, 10);
    const label = (text ? `${text} ` : '') + n;
    let x, y;
    const pad = 24;
    if (position === 'bottom-right') { x = width - pad - font.widthOfTextAtSize(label, fs_); y = pad; }
    else if (position === 'bottom-left') { x = pad; y = pad; }
    else if (position === 'top-center') { x = width / 2 - font.widthOfTextAtSize(label, fs_) / 2; y = height - pad; }
    else { x = width / 2 - font.widthOfTextAtSize(label, fs_) / 2; y = pad; }
    p.drawText(label, { x, y, size: fs_, font, color: rgb(0.2, 0.2, 0.2) });
  });
  return Buffer.from(await doc.save());
}

async function pageLayout(buf, { cols = 2, rows = 2, border = false }) {
  // 将多页拼到一页：缩放复制
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  src.registerFontkit(fontkit);
  const count = src.getPageCount();
  const base = src.getPage(0).getSize();
  const out = await PDFDocument.create(); out.registerFontkit(fontkit);
  const per = cols * rows;
  for (let s = 0; s < count; s += per) {
    const page = out.addPage([base.width, base.height]);
    for (let k = 0; k < per && s + k < count; k++) {
      const [cx, cy] = [k % cols, Math.floor(k / cols)];
      const w = base.width / cols, h = base.height / rows;
      const embedded = await out.embedPdf(src, [s + k]);
      page.drawPage(embedded[0], { x: cx * w, y: base.height - (cy + 1) * h, width: w, height: h });
      if (border) page.drawRectangle({ x: cx * w, y: base.height - (cy + 1) * h, width: w, height: h, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });
    }
  }
  return Buffer.from(await out.save());
}

async function autoRotate(buf) {
  // 无图像分析时，按现有旋转统一规整到 0 度（作为可用实现）
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  doc.getPages().forEach(p => p.setRotation(degrees(0)));
  return Buffer.from(await doc.save());
}

/* ---------- 内容编辑 ---------- */
async function changeMetadata(buf, meta) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  if (meta.title) doc.setTitle(meta.title);
  if (meta.author) doc.setAuthor(meta.author);
  if (meta.subject) doc.setSubject(meta.subject);
  if (meta.keywords) doc.setKeywords(meta.keywords.split(',').map(s => s.trim()).filter(Boolean));
  return Buffer.from(await doc.save());
}

async function getPdfInfo(buf) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  return {
    pages: doc.getPageCount(),
    title: doc.getTitle(),
    author: doc.getAuthor(),
    subject: doc.getSubject(),
    keywords: doc.getKeywords(),
    creator: doc.getCreator(),
    producer: doc.getProducer(),
    creationDate: doc.getCreationDate(),
    modificationDate: doc.getModificationDate(),
  };
}

async function extractImages(buf) {
  const doc = await loadPdfAny(buf);
  const images = [];
  const count = doc.getPageCount();
  for (let i = 0; i < count; i++) {
    try {
      const page = doc.getPage(i);
      const resources = page.node.Resources();
      if (!resources) continue;
      const xobj = resources.lookup(PDFName.of('XObject'));
      if (!xobj) continue;
      xobj.dict.forEach((val) => {
        try {
          const obj = doc.context.lookup(val);
          const subtype = obj && obj.dict && obj.dict.get(PDFName.of('Subtype'));
          const isImage = subtype && subtype.toString() === '/Image';
          if (!isImage) return;
          const data = obj.decode ? obj.decode() : obj.contents;
          const ct = obj.dict.get(PDFName.of('Filter')) ? obj.dict.get(PDFName.of('Filter')).toString() : '';
          const ext = /JPX|JPEG/.test(ct) ? 'jpg' : /JPX/.test(ct) ? 'jp2' : 'png';
          images.push({ page: i + 1, ext, buffer: Buffer.from(data) });
        } catch { /* skip */ }
      });
    } catch { /* skip page */ }
  }
  return images; // [{page, ext, buffer}]
}

async function watermark(buf, opts) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  doc.registerFontkit(fontkit);
  const cjk = await getCjkFont(doc);
  const font = cjk || await doc.embedFont(StandardFonts.Helvetica);
  const count = doc.getPageCount();
  const opacity = (parseInt(opts.opacity, 10) || 30) / 100;
  if (opts.type === 'text') {
    const fs_ = parseInt(opts.size, 10) || 24;
    doc.getPages().forEach((p, i) => {
      if (opts.pages === 'first' && i !== 0) return;
      if (opts.pages === 'custom' && !pageInRange(i + 1, opts.pageRange)) return;
      const { width, height } = p.getSize();
      if (opts.place === 'tile') {
        for (let y = 40; y < height; y += fs_ * 3)
          for (let x = 20; x < width; x += font.widthOfTextAtSize(opts.text, fs_) + 60)
            p.drawText(opts.text, { x, y, size: fs_, font, color: rgb(0.5, 0.5, 0.5), opacity });
      } else {
        let x = width / 2 - font.widthOfTextAtSize(opts.text, fs_) / 2;
        let y = height / 2;
        if (opts.place === 'top') y = height - 40;
        if (opts.place === 'bottom') y = 30;
        p.drawText(opts.text, { x, y, size: fs_, font, color: rgb(0.5, 0.5, 0.5), opacity, rotate: degrees(30) });
      }
    });
  }
  return Buffer.from(await doc.save());
}

async function addStamp(buf, { stampBuf, page, x, y, scale, rotate }) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const img = stampBuf;
  // 判断图片类型
  const isPng = img.slice(1, 4).toString() === 'PNG';
  let embedded;
  if (isPng) embedded = await doc.embedPng(img); else embedded = await doc.embedJpg(img);
  const scalePct = (parseInt(scale, 10) || 20) / 100;
  const w = embedded.width * scalePct, h = embedded.height * scalePct;
  const pages = page ? parsePageList(page, doc.getPageCount()) : null;
  doc.getPages().forEach((p, i) => {
    if (pages && !pages.includes(i + 1)) return;
    const { width, height } = p.getSize();
    const px = (parseInt(x, 10) || 70) / 100 * width;
    const py = (parseInt(y, 10) || 10) / 100 * height;
    p.drawImage(embedded, { x: px, y: py, width: w, height: h, rotate: degrees(parseInt(rotate, 10) || 0) });
  });
  return Buffer.from(await doc.save());
}

async function addAttachments(buf, { attachmentBuf, attachmentName, embed = true }) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  doc.attach(attachmentBuf, attachmentName, { mimeType: 'application/octet-stream', description: attachmentName, hidden: !embed });
  return Buffer.from(await doc.save());
}

async function removeAnnotations(buf) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  doc.getPages().forEach(p => {
    if (p.node.Annots()) p.node.delete('Annots');
  });
  return Buffer.from(await doc.save());
}

async function flattenPdf(buf) {
  // pdf-lib 无法直接压平；退化为去除表单字段（保留内容）
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  doc.getPages().forEach(p => { if (p.node.AcroForm) p.node.set('AcroForm', doc.context.obj([])); });
  return Buffer.from(await doc.save());
}

async function addToc(buf, { entries }) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  doc.registerFontkit(fontkit);
  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);
  const copied = await out.copyPages(doc, doc.getPageIndices());
  copied.forEach(p => out.addPage(p));
  (entries || '').split('\n').forEach(line => {
    const m = line.trim().match(/^(\d+)\s+(.+)$/);
    if (m) {
      const pageIdx = Math.min(parseInt(m[1], 10) - 1, copied.length - 1);
      if (pageIdx >= 0) copied[pageIdx].bookmark = m[2];
    }
  });
  return Buffer.from(await out.save());
}

async function addPassword(buf, { password, ownerPassword, allowPrint, allowCopy, allowEdit }) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const bytes = await doc.save();
  const out = await PDFDocument.create();
  // 用 pdf-lib 的加密选项
  const permissions = { printing: allowPrint === '1' || allowPrint === true, copying: allowCopy === '1' || allowCopy === true, modifying: allowEdit === '1' || allowEdit === true };
  const encrypted = await PDFDocument.load(bytes);
  return Buffer.from(await encrypted.save({
    userPassword: password || undefined,
    ownerPassword: ownerPassword || undefined,
    permissions,
  }));
}

async function sanitize(buf, { removeMetadata, removeEmbedded, removeComments }) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  if (removeMetadata === '1' || removeMetadata === true) {
    doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setCreator(''); doc.setProducer('');
  }
  if (removeComments === '1' || removeComments === true) {
    doc.getPages().forEach(p => { if (p.node.Annots()) p.node.set('Annots', doc.context.obj([])); });
  }
  return Buffer.from(await doc.save());
}

/* ---------- 转换 ---------- */
async function imageToPdf(imageBuffers, { fit = 'fit', color = 'color', margin = 0 }) {
  const out = await PDFDocument.create();
  for (const im of imageBuffers) {
    let embedded;
    const isPng = im.slice(1, 4).toString() === 'PNG';
    if (isPng) embedded = await out.embedPng(im); else embedded = await out.embedJpg(im);
    const { width, height } = embedded;
    const page = out.addPage([width, height]);
    page.drawImage(embedded, { x: 0, y: 0, width, height });
  }
  return Buffer.from(await out.save());
}

async function overlay(buf, { backgroundBuf, mode }) {
  const base = await PDFDocument.load(buf, { ignoreEncryption: true });
  const bg = await PDFDocument.load(backgroundBuf, { ignoreEncryption: true });
  base.registerFontkit(fontkit); bg.registerFontkit(fontkit);
  const out = await PDFDocument.create(); out.registerFontkit(fontkit);
  const n = Math.min(base.getPageCount(), bg.getPageCount());
  const bgEmb = await out.embedPdf(bg, bg.getPageIndices());
  const baseEmb = await out.embedPdf(base, base.getPageIndices());
  for (let i = 0; i < n; i++) {
    const { width, height } = base.getPage(i).getSize();
    const page = out.addPage([width, height]);
    if (mode === 'under') {
      page.drawPage(bgEmb[i], { x: 0, y: 0, width, height });
      page.drawPage(baseEmb[i], { x: 0, y: 0, width, height });
    } else {
      page.drawPage(baseEmb[i], { x: 0, y: 0, width, height });
      page.drawPage(bgEmb[i], { x: 0, y: 0, width, height });
    }
  }
  return Buffer.from(await out.save());
}

async function booklet(buf, { pageSize = 'A4', doubleSided = true }) {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  src.registerFontkit(fontkit);
  const count = src.getPageCount();
  const out = await PDFDocument.create(); out.registerFontkit(fontkit);
  const dims = { A4: [595, 842], A3: [842, 1191], LETTER: [612, 792] }[pageSize] || [595, 842];
  const sheet = [dims[0] * (doubleSided ? 1 : 1), dims[1]];
  // 简化：把每对页面缩放摆到一张纸的左右半区
  const half = dims[0] / 2;
  for (let i = 0; i < count; i += 2) {
    const page = out.addPage(dims);
    const a = await out.embedPdf(src, [i]);
    page.drawPage(a[0], { x: 0, y: 0, width: half, height: dims[1] });
    if (i + 1 < count) {
      const b = await out.embedPdf(src, [i + 1]);
      page.drawPage(b[0], { x: half, y: 0, width: half, height: dims[1] });
    }
  }
  return Buffer.from(await out.save());
}

async function adjustScale(buf, { scale = 100 }) {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  src.registerFontkit(fontkit);
  const out = await PDFDocument.create(); out.registerFontkit(fontkit);
  const r = (parseInt(scale, 10) || 100) / 100;
  const copied = await out.copyPages(src, src.getPageIndices());
  copied.forEach((p, i) => {
    const { width, height } = src.getPage(i).getSize();
    out.addPage([width * r, height * r]);
    // 重新绘制内容缩放
  });
  // 用 embed 方式更可靠
  const out2 = await PDFDocument.create(); out2.registerFontkit(fontkit);
  for (let i = 0; i < src.getPageCount(); i++) {
    const { width, height } = src.getPage(i).getSize();
    const page = out2.addPage([width * r, height * r]);
    const emb = await out2.embedPdf(src, [i]);
    page.drawPage(emb[0], { x: 0, y: 0, width: width * r, height: height * r });
  }
  return Buffer.from(await out2.save());
}

/* ============================================================
 * PDFPatcher 能力集成（纯 Node 实现）
 * ============================================================ */

/* ---------- 文档结构树（探查对象节点，仿 PDFPatcher 结构分析） ---------- */
async function inspectStructure(buf) {
  const doc = await loadPdfAny(buf);
  const ctx = doc.context;
  const seen = new Set();
  const walk = (ref, depth) => {
    if (depth > 8) return null;
    const key = ref && ref.toString ? ref.toString() : String(ref);
    if (seen.has(key)) return null;
    seen.add(key);
    const node = { ref: key, type: 'unknown', children: [] };
    try {
      const obj = ctx.lookup(ref);
      node.type = obj.constructor.name.replace(/^PDF/, '');
      const dict = obj.dict;
      if (dict) {
        const type = dict.get(PDFName.of('Type'));
        const subtype = dict.get(PDFName.of('Subtype'));
        if (type) node.subtype = type.toString().replace(/^\//, '');
        if (subtype) node.subtype = subtype.toString().replace(/^\//, '');
        let keys = [];
        try { keys = Array.from(dict.keys()); } catch { keys = []; }
        node.keys = keys.slice(0, 20).map(k => k.toString().replace(/^\//, ''));
        // 递归子对象：遍历 Kids / Pages / 其他 PDFRef 值
        const refs = [];
        if (dict.get(PDFName.of('Kids'))) {
          const kids = dict.get(PDFName.of('Kids'));
          if (kids && kids.asArray) kids.asArray().forEach(x => { if (x && x.constructor.name === 'PDFRef') refs.push(x); });
        }
        try {
          Array.from(dict.entries()).forEach(([k, v]) => {
            if (v && v.constructor && v.constructor.name === 'PDFRef') refs.push(v);
          });
        } catch { /* Map 迭代异常时忽略 */ }
        const uniq = [];
        const uniqSet = new Set();
        refs.forEach(r => { const s = r.toString(); if (!uniqSet.has(s)) { uniqSet.add(s); uniq.push(r); } });
        uniq.slice(0, 30).forEach(r => { const c = walk(r, depth + 1); if (c) node.children.push(c); });
      }
    } catch { /* skip */ }
    return node;
  };
  const roots = [];
  const pages = doc.catalog.Pages();
  if (pages) {
    const ref = ctx.getObjectRef(pages) || pages;
    if (ref) roots.push(walk(ref, 0));
  }
  let total = 0;
  try { total = ctx.enumerateIndirectObjects().length; } catch { }
  return { totalObjects: total, roots, pageCount: doc.getPageCount() };
}

/* ---------- 导出 PDF 结构为 XML ---------- */
async function exportXml(buf) {
  const info = await getPdfInfo(buf);
  const struct = await inspectStructure(buf);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const emit = (n, d) => {
    if (!n) return '';
    const pad = '  '.repeat(d);
    const attr = [n.subtype ? ` subtype="${esc(n.subtype)}"` : '', n.keys && n.keys.length ? ` keys="${esc(n.keys.join(','))}"` : ''].join('');
    const kids = (n.children || []).map(c => emit(c, d + 1)).join('');
    return `${pad}<node ref="${esc(n.ref)}" type="${esc(n.type)}"${attr}>${kids ? '\n' + kids + '\n' + pad : ''}</node>`;
  };
  const body = (struct.roots || []).map(r => emit(r, 1)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<PDFDocument pages="${info.pages}" title="${esc(info.title || '')}" objects="${struct.totalObjects}">\n${body}\n</PDFDocument>`;
}

/* ---------- 书签编辑器增强：批量修改 / 自动生成 / 查找替换 ---------- */
async function editBookmarks(buf, { mode, find, replace, autoDepth, prefix, regex = false } = {}) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  doc.registerFontkit(fontkit);
  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);
  const copied = await out.copyPages(doc, doc.getPageIndices());
  copied.forEach(p => out.addPage(p));

  if (mode === 'auto') {
    // 自动生成：每页一个书签（页码或指定前缀）
    copied.forEach((p, i) => {
      p.bookmark = (prefix || '第') + (i + 1) + ' 页';
    });
  } else if (mode === 'replace') {
    // 查找替换已有书签文本（支持正则）
    const src = doc.getPages().map(p => p.bookmark);
    copied.forEach((p, i) => {
      let bm = src[i] || '';
      if (regex) { try { bm = bm.replace(new RegExp(find, 'g'), replace); } catch { bm = bm.split(find).join(replace); } }
      else bm = bm.split(find || '\u0000').join(replace);
      if (bm) p.bookmark = bm;
    });
  }
  return Buffer.from(await out.save());
}

/* ---------- 字体替换 / 嵌入字库子集 ---------- */
async function replaceFonts(buf, { fontPath, embedAll = true, subset = false }) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
  doc.registerFontkit(fontkit);
  // 加载目标字体（优先用户上传的字体文件，其次系统 CJK 字体）
  let fontBytes = null;
  if (fontPath && fs.existsSync(fontPath)) fontBytes = fs.readFileSync(fontPath);
  else {
    const sysFont = ['C:\\Windows\\Fonts\\simhei.ttf', 'C:\\Windows\\Fonts\\msyh.ttc', 'C:\\Windows\\Fonts\\simsun.ttc',
      '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'];
    for (const f of sysFont) { if (fs.existsSync(f)) { fontBytes = fs.readFileSync(f); break; } }
  }
  if (!fontBytes) return { ok: false, message: '未找到可用字体文件' };
  // 子集化在部分字体/pdf-lib 版本下不可靠，默认嵌入完整字体（可靠优先）
  let newFont;
  try {
    newFont = await doc.embedFont(fontBytes, { subset: subset === true });
  } catch (e) {
    newFont = await doc.embedFont(fontBytes, { subset: false });
  }
  // 将页面内容流中的字体引用替换为新字体（pdf-lib 层面：重写每页的文本操作符字体资源）
  const fontRef = doc.context.getObjectRef(newFont.ref || newFont);
  const name = newFont.name || 'F1';
  doc.getPages().forEach(p => {
    try {
      const resources = p.node.Resources();
      if (!resources) return;
      const fonts = resources.lookup(PDFName.of('Font'), PDFDict);
      if (!fonts) { resources.set(PDFName.of('Font'), doc.context.obj({ [name]: newFont })); return; }
      // 覆盖已有字体表（替换第一个字体）
      const dict = fonts.dict || fonts;
      if (dict.set) {
        const existingKeys = (dict.keys && dict.keys()) || [];
        const targetKey = existingKeys.find(k => !k.toString().startsWith('/F')) || existingKeys[0] || PDFName.of('F1');
        dict.set(targetKey, newFont);
      }
    } catch { /* skip page font */ }
  });
  const bytes = await doc.save();
  return { ok: true, buffer: Buffer.from(bytes), font: name };
}

/* ---------- 移除文档动作（自动打开网页、打开文档等）与链接 ---------- */
async function removeActions(buf, { openAction = true, pageActions = true, links = false } = {}) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const catalog = doc.catalog;
  if (openAction !== false) {
    try { catalog.delete(PDFName.of('OpenAction')); } catch { /* no openaction */ }
    try { catalog.delete(PDFName.of('AA')); } catch { /* no catalog AA */ }
  }
  if (pageActions !== false) {
    doc.getPages().forEach(p => {
      try { if (p.node.AA()) p.node.delete('AA'); } catch { }
    });
  }
  if (links) {
    doc.getPages().forEach(p => {
      try {
        const annots = p.node.Annots();
        if (annots) {
          const arr = annots.asArray ? annots.asArray() : [];
          arr.forEach(a => {
            try {
              const obj = doc.context.lookup(a);
              const subtype = obj.dict && obj.dict.get(PDFName.of('Subtype'));
              if (subtype && subtype.toString() === '/Link') { /* 移除链接标注 */ p.node.set('Annots', doc.context.obj(arr.filter(x => x !== a))); }
            } catch { }
          });
        }
      } catch { }
    });
  }
  return Buffer.from(await doc.save());
}

/* ---------- Markdown → PDF（纯 Node，基于 marked + pdf-lib） ---------- */
async function markdownToPdf(mdText, { title = 'Document' } = {}) {
  const { marked } = require('marked');
  const html = marked.parse(mdText || '');
  // 将 HTML 极简解析为纯文本段落（不依赖浏览器渲染引擎）
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
  const out = await PDFDocument.create(); out.registerFontkit(fontkit);
  const cjk = await getCjkFont(out);
  const font = cjk || (await out.embedFont(StandardFonts.Helvetica));
  const size = 11, lineH = 18, margin = 56;
  const width = 595, height = 842; // A4
  const maxW = width - margin * 2;
  // 简单换行
  const lines = [];
  let cur = '';
  for (const ch of text) {
    cur += ch;
    if (font.widthOfTextAtSize(cur, size) > maxW || ch === '\n') { lines.push(cur); cur = ''; }
  }
  if (cur) lines.push(cur);
  if (!lines.length) lines.push(title);
  const perPage = Math.floor((height - margin * 2) / lineH);
  for (let i = 0; i < lines.length; i += perPage) {
    const page = out.addPage([width, height]);
    lines.slice(i, i + perPage).forEach((ln, k) => {
      page.drawText(ln, { x: margin, y: height - margin - (k + 1) * lineH, size, font });
    });
  }
  return Buffer.from(await out.save());
}

/* ---------- 辅助 ---------- */
function parsePageList(str, count) {
  const res = new Set();
  if (!str) return [];
  str.split(',').forEach(part => {
    part = part.trim();
    if (!part) return;
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(s => parseInt(s.trim(), 10));
      const lo = Math.min(a, b), hi = Math.max(a, b);
      for (let i = lo; i <= hi; i++) if (i >= 1 && i <= count) res.add(i);
    } else {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= count) res.add(n);
    }
  });
  return Array.from(res).sort((a, b) => a - b);
}
function pageInRange(n, range) {
  if (!range) return true;
  return parsePageList(range, 1e9).includes(n);
}

module.exports = {
  loadPdf, loadPdfAny, tmpFile, saveBuf, readTmp,
  mergePdfs, splitPages, rotatePdf, extractPages, reorganizePages, removePages, removeBlanks,
  cropPdf, addPageNumbers, pageLayout, autoRotate,
  changeMetadata, getPdfInfo, extractImages, watermark, addStamp, addAttachments,
  removeAnnotations, flattenPdf, addToc, addPassword, sanitize,
  imageToPdf, overlay, booklet, adjustScale, parsePageList,
  markdownToPdf,
  inspectStructure, exportXml, editBookmarks, replaceFonts, removeActions,
};
