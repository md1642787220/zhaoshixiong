/* ============================================================
 * routes/pdf.js - PDF 工具后端接口
 * 前端提交：POST /api/pdf/:action  （multipart: file + 参数）
 * 已实现：页面操作/内容编辑/安全加密/部分转换与高级（基于 pdf-lib）
 * 降级：需外部引擎（LibreOffice/Ghostscript/Tesseract/qpdf）的工具返回 engine 提示
 * ============================================================ */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('../lib/pdf');
const Stirling = require('../lib/stirling');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'helper-pdf-'));
const upload = multer({ dest: tmpRoot, limits: { fileSize: 500 * 1024 * 1024 } });

const PLANNED = [
  'convert-office', 'to-pdf', 'to-pdfa', 'to-html', 'html-to-pdf', 'markdown-to-pdf',
  'to-image', 'image-to-pdf', 'to-presentation',
  'merge', 'split', 'rotate', 'auto-rotate', 'extract-pages', 'reorganize',
  'page-numbers', 'remove-pages', 'remove-blanks', 'crop', 'page-layout', 'single-large-page',
  'add-password', 'remove-password', 'change-permissions', 'sign', 'cert-sign',
  'remove-cert-sign', 'validate-signature', 'watermark', 'sanitize', 'redact', 'timestamp',
  'add-attachments', 'add-stamp', 'extract-images', 'change-metadata', 'remove-annotations',
  'replace-color', 'pdf-info', 'text-editor', 'toc', 'flatten',
  'overlay', 'booklet', 'adjust-scale', 'adjust-contrast', 'auto-rename', 'show-js',
  'scanner-split', 'repair', 'unlock-forms',
  'ocr', 'compare', 'read-annotate',
  'inspect-structure', 'export-xml', 'edit-bookmarks', 'replace-fonts', 'remove-actions',
];

/* 统一的文件读取 */
function readFiles(req) {
  // 兼容前端两种字段命名：files（pdfApi 通用约定）/ file（旧版单文件约定）
  const list = (req.files || []);
  const f = list.filter(x => x.fieldname === 'files');
  if (f.length) return f.map(x => fs.readFileSync(x.path));
  const g = list.filter(x => x.fieldname === 'file');
  return g.map(x => fs.readFileSync(x.path));
}
function readParamFile(req, name) {
  // 同名字段也兼容单/复数（background / backgrounds、attachment / attachments）
  const list = (req.files || []);
  let f = list.find(x => x.fieldname === name);
  if (!f) f = list.find(x => x.fieldname === (name + 's'));
  return f ? { buf: fs.readFileSync(f.path), name: f.originalname } : null;
}
const b = (s) => (s === '1' || s === true || s === 'true');

/* 多文件/单文件下载响应 */
function sendPdf(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}
function sendZip(res, items, zipName) {
  // 简易：用 adm-zip 若可用，否则退化为依次返回第一个
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    items.forEach(it => zip.addFile(it.name, it.buffer));
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    res.send(zip.toBuffer());
  } catch {
    if (items[0]) sendPdf(res, items[0].buffer, items[0].name);
    else res.status(400).json({ ok: false, message: '无可输出文件' });
  }
}
function needEngine(res, action, engine) {
  return res.status(200).json({
    ok: false,
    engine,
    message: `「${action}」需要服务端安装 ${engine} 引擎，当前环境未提供。接口与前端已就绪，安装后即可启用。`,
  });
}

/* 引擎依赖功能：优先转发 Stirling-PDF（若已配置），否则返回降级提示 */
async function engineOrForward(req, res, action, engine, files, body) {
  if (Stirling.enabled() && Stirling.isForwardable(action)) {
    const r = await Stirling.forward(action, files, body);
    if (r.ok && r.buffer) {
      const ext = (r.contentType || '').includes('zip') ? 'zip'
        : (r.contentType || '').includes('json') ? 'json'
        : (r.contentType || '').includes('image') ? 'png' : 'pdf';
      res.setHeader('Content-Type', r.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${(r.filename || action)}.${ext}"`);
      return res.send(r.buffer);
    }
    if (r.ok && r.json) {
      return res.json({ ok: true, ...r.json });
    }
    return res.status(200).json({ ok: false, message: r.message || 'Stirling-PDF 转发失败' });
  }
  return needEngine(res, action, engine);
}

router.post('/:action', upload.any(), async (req, res) => {
  const { action } = req.params;
  const body = req.body || {};
  const files = readFiles(req);
  console.log(`[pdf] action=${action} files=${files.length} body=`, body);

  if (!PLANNED.includes(action)) {
    return res.status(404).json({ ok: false, message: `未规划的 PDF action: ${action}` });
  }

  try {
    switch (action) {
      /* ---------- 页面操作 ---------- */
      case 'merge': {
        const buf = await P.mergePdfs(files, { bookmark: b(body.bookmark), toc: b(body.tableOfContents) });
        return sendPdf(res, buf, 'merged.pdf');
      }
      case 'split': {
        const items = await P.splitPages(files[0], body);
        return sendZip(res, items, 'split.zip');
      }
      case 'rotate': {
        const buf = await P.rotatePdf(files[0], body);
        return sendPdf(res, buf, 'rotated.pdf');
      }
      case 'auto-rotate': {
        const buf = await P.autoRotate(files[0]);
        return sendPdf(res, buf, 'auto-rotated.pdf');
      }
      case 'extract-pages': {
        const buf = await P.extractPages(files[0], body);
        return sendPdf(res, buf, 'extracted.pdf');
      }
      case 'reorganize': {
        const buf = await P.reorganizePages(files[0], body);
        return sendPdf(res, buf, 'reorganized.pdf');
      }
      case 'remove-pages': {
        const buf = await P.removePages(files[0], body);
        return sendPdf(res, buf, 'removed.pdf');
      }
      case 'remove-blanks': {
        const buf = await P.removeBlanks(files[0], body);
        return sendPdf(res, buf, 'no-blanks.pdf');
      }
      case 'crop': {
        const buf = await P.cropPdf(files[0], body);
        return sendPdf(res, buf, 'cropped.pdf');
      }
      case 'page-numbers': {
        const buf = await P.addPageNumbers(files[0], body);
        return sendPdf(res, buf, 'numbered.pdf');
      }
      case 'page-layout': {
        const buf = await P.pageLayout(files[0], body);
        return sendPdf(res, buf, 'layout.pdf');
      }
      case 'single-large-page': {
        return engineOrForward(req, res, action, 'Ghostscript / pdf-lib 渲染（长图导出）', files, body);
      }

      /* ---------- 内容编辑 ---------- */
      case 'change-metadata': {
        const buf = await P.changeMetadata(files[0], body);
        return sendPdf(res, buf, 'metadata.pdf');
      }
      case 'pdf-info': {
        const info = await P.getPdfInfo(files[0]);
        return res.json({ ok: true, info });
      }
      case 'extract-images': {
        const imgs = await P.extractImages(files[0]);
        const items = imgs.map((im, i) => ({ name: `img-${i + 1}.${im.ext}`, buffer: im.buffer }));
        if (!items.length) return res.status(200).json({ ok: false, message: '未找到内嵌图片' });
        return sendZip(res, items, 'images.zip');
      }
      case 'watermark': {
        const buf = await P.watermark(files[0], body);
        return sendPdf(res, buf, 'watermarked.pdf');
      }
      case 'add-stamp': {
        const stamp = readParamFile(req, 'stamp');
        if (!stamp) return res.status(400).json({ ok: false, message: '请上传印章图片' });
        const buf = await P.addStamp(files[0], { ...body, stampBuf: stamp.buf });
        return sendPdf(res, buf, 'stamped.pdf');
      }
      case 'add-attachments': {
        const att = readParamFile(req, 'attachment');
        if (!att) return res.status(400).json({ ok: false, message: '请上传附件文件' });
        const buf = await P.addAttachments(files[0], { attachmentBuf: att.buf, attachmentName: att.name, embed: b(body.embed) });
        return sendPdf(res, buf, 'with-attachment.pdf');
      }
      case 'remove-annotations': {
        const buf = await P.removeAnnotations(files[0], body);
        return sendPdf(res, buf, 'clean.pdf');
      }
      case 'flatten': {
        const buf = await P.flattenPdf(files[0], body);
        return sendPdf(res, buf, 'flattened.pdf');
      }
      case 'toc': {
        const buf = await P.addToc(files[0], body);
        return sendPdf(res, buf, 'with-toc.pdf');
      }
      case 'text-editor': return engineOrForward(req, res, action, 'PDF 文本层编辑库（如 pdf-lib + 文本提取）', files, body);
      case 'replace-color': return engineOrForward(req, res, action, 'Ghostscript（色彩空间处理）', files, body);

      /* ---------- 安全 ---------- */
      case 'add-password': {
        const buf = await P.addPassword(files[0], body);
        return sendPdf(res, buf, 'encrypted.pdf');
      }
      case 'remove-password': return engineOrForward(req, res, action, 'qpdf（解密需原密码，node 端无原生实现）', files, body);
      case 'change-permissions': return engineOrForward(req, res, action, 'qpdf', files, body);
      case 'sign': return engineOrForward(req, res, action, '签名库（如 node-signpdf）', files, body);
      case 'cert-sign': return engineOrForward(req, res, action, 'PKCS12 签名库（如 node-signpdf）', files, body);
      case 'remove-cert-sign': return engineOrForward(req, res, action, 'qpdf / mutool', files, body);
      case 'validate-signature': return engineOrForward(req, res, action, '签名校验库', files, body);
      case 'sanitize': {
        const buf = await P.sanitize(files[0], body);
        return sendPdf(res, buf, 'sanitized.pdf');
      }
      case 'redact': return engineOrForward(req, res, action, '内容遮盖需精确坐标，建议前端标注后由引擎处理', files, body);
      case 'timestamp': return engineOrForward(req, res, action, 'TSA 时间戳服务', files, body);

      /* ---------- 转换 ---------- */
      case 'image-to-pdf': {
        const buf = await P.imageToPdf(files, body);
        return sendPdf(res, buf, 'from-images.pdf');
      }
      case 'to-image': return engineOrForward(req, res, action, 'Ghostscript / poppler（PDF 页面渲染为图片）', files, body);
      case 'to-pdfa': return engineOrForward(req, res, action, 'Ghostscript（PDF/A 规范化）', files, body);
      case 'markdown-to-pdf': {
        const mdText = files[0] ? files[0].toString('utf8') : (body.text || '');
        if (!mdText) return res.status(400).json({ ok: false, message: '请上传 .md 文件或提供文本' });
        const buf = await P.markdownToPdf(mdText, body);
        return sendPdf(res, buf, 'converted.pdf');
      }
      case 'convert-office': return engineOrForward(req, res, action, 'LibreOffice / Gotenberg（Office ⇄ PDF）', files, body);
      case 'to-pdf': return engineOrForward(req, res, action, 'LibreOffice / Gotenberg', files, body);
      case 'html-to-pdf': return engineOrForward(req, res, action, 'wkhtmltopdf / Gotenberg', files, body);
      case 'to-html': {
        const html = await P.pdfToHtml(files[0]);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="converted.html"');
        return res.send(html);
      }
      case 'to-presentation': return engineOrForward(req, res, action, 'LibreOffice', files, body);

      /* ---------- 高级 ---------- */
      case 'overlay': {
        const bg = readParamFile(req, 'background');
        if (!bg) return res.status(400).json({ ok: false, message: '请上传背景/模板 PDF' });
        const buf = await P.overlay(files[0], { backgroundBuf: bg.buf, mode: body.mode });
        return sendPdf(res, buf, 'overlayed.pdf');
      }
      case 'booklet': {
        const buf = await P.booklet(files[0], body);
        return sendPdf(res, buf, 'booklet.pdf');
      }
      case 'adjust-scale': {
        const buf = await P.adjustScale(files[0], body);
        return sendPdf(res, buf, 'scaled.pdf');
      }
      case 'adjust-contrast': return engineOrForward(req, res, action, 'Ghostscript（图像滤镜）', files, body);
      case 'auto-rename': {
        const info = await P.getPdfInfo(files[0]);
        const suggested = `${info.author || 'doc'}_${info.title || 'untitled'}.pdf`.replace(/[\\\/:*?"<>|]/g, '_');
        return res.json({ ok: true, suggested, info });
      }
      case 'show-js': return engineOrForward(req, res, action, 'PDF 内嵌脚本解析（需遍历对象流）', files, body);
      case 'scanner-split': return engineOrForward(req, res, action, '图像切分引擎（OpenCV 等）', files, body);
      case 'repair': {
        const buf = await P.loadPdfAny(files[0]).then(d => d.save());
        return sendPdf(res, Buffer.from(buf), 'repaired.pdf');
      }
      case 'unlock-forms': return engineOrForward(req, res, action, 'qpdf / mutool', files, body);

      /* ---------- PDFPatcher 能力（纯 Node） ---------- */
      case 'inspect-structure': {
        const struct = await P.inspectStructure(files[0]);
        return res.json({ ok: true, structure: struct });
      }
      case 'export-xml': {
        const xml = await P.exportXml(files[0]);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="structure.xml"');
        return res.send(xml);
      }
      case 'edit-bookmarks': {
        const buf = await P.editBookmarks(files[0], body);
        return sendPdf(res, buf, 'bookmarked.pdf');
      }
      case 'replace-fonts': {
        const fontFile = readParamFile(req, 'font');
        let fontPath = null;
        if (fontFile) { fontPath = P.tmpFile('ttf'); fs.writeFileSync(fontPath, fontFile.buf); }
        const r = await P.replaceFonts(files[0], { ...body, fontPath });
        if (fontPath) { try { fs.unlinkSync(fontPath); } catch { } }
        if (r && r.ok === false) return res.status(400).json(r);
        return sendPdf(res, r.buffer, 'font-replaced.pdf');
      }
      case 'remove-actions': {
        const buf = await P.removeActions(files[0], body);
        return sendPdf(res, buf, 'actions-removed.pdf');
      }

      /* ---------- 其他 ---------- */
      case 'ocr': return engineOrForward(req, res, action, 'OCRmyPDF + Tesseract', files, body);
      case 'compare': return engineOrForward(req, res, action, 'PDF 差异比对引擎', files, body);
      case 'read-annotate': return engineOrForward(req, res, action, '前端阅读器直接处理', files, body);

      default:
        return res.status(200).json({ ok: false, message: `PDF 工具「${action}」后端待实现。` });
    }
  } catch (err) {
    console.error('[pdf] error:', err);
    return res.status(500).json({ ok: false, message: '处理失败：' + (err.message || err), action });
  }
});

module.exports = router;
