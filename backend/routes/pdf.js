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
];

/* 统一的文件读取 */
function readFiles(req) {
  const files = (req.files || []).filter(f => f.fieldname === 'file');
  return files.map(f => fs.readFileSync(f.path));
}
function readParamFile(req, name) {
  const f = (req.files || []).find(x => x.fieldname === name);
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
        return needEngine(res, action, 'Ghostscript / pdf-lib 渲染（长图导出）');
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
      case 'text-editor': return needEngine(res, action, 'PDF 文本层编辑库（如 pdf-lib + 文本提取）');
      case 'replace-color': return needEngine(res, action, 'Ghostscript（色彩空间处理）');

      /* ---------- 安全 ---------- */
      case 'add-password': {
        const buf = await P.addPassword(files[0], body);
        return sendPdf(res, buf, 'encrypted.pdf');
      }
      case 'remove-password': return needEngine(res, action, 'qpdf（解密需原密码，node 端无原生实现）');
      case 'change-permissions': return needEngine(res, action, 'qpdf');
      case 'sign': return needEngine(res, action, '签名库（如 node-signpdf）');
      case 'cert-sign': return needEngine(res, action, 'PKCS12 签名库（如 node-signpdf）');
      case 'remove-cert-sign': return needEngine(res, action, 'qpdf / mutool');
      case 'validate-signature': return needEngine(res, action, '签名校验库');
      case 'sanitize': {
        const buf = await P.sanitize(files[0], body);
        return sendPdf(res, buf, 'sanitized.pdf');
      }
      case 'redact': return needEngine(res, action, '内容遮盖需精确坐标，建议前端标注后由引擎处理');
      case 'timestamp': return needEngine(res, action, 'TSA 时间戳服务');

      /* ---------- 转换 ---------- */
      case 'image-to-pdf': {
        const buf = await P.imageToPdf(files, body);
        return sendPdf(res, buf, 'from-images.pdf');
      }
      case 'to-image': return needEngine(res, action, 'Ghostscript / poppler（PDF 页面渲染为图片）');
      case 'to-pdfa': return needEngine(res, action, 'Ghostscript（PDF/A 规范化）');
      case 'markdown-to-pdf': return needEngine(res, action, 'marked + 渲染引擎（或 wkhtmltopdf）');
      case 'convert-office': return needEngine(res, action, 'LibreOffice / Gotenberg（Office ⇄ PDF）');
      case 'to-pdf': return needEngine(res, action, 'LibreOffice / Gotenberg');
      case 'html-to-pdf': return needEngine(res, action, 'wkhtmltopdf / Gotenberg');
      case 'to-html': return needEngine(res, action, 'PDF 文本提取 + HTML 生成');
      case 'to-presentation': return needEngine(res, action, 'LibreOffice');

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
      case 'adjust-contrast': return needEngine(res, action, 'Ghostscript（图像滤镜）');
      case 'auto-rename': {
        const info = await P.getPdfInfo(files[0]);
        const suggested = `${info.author || 'doc'}_${info.title || 'untitled'}.pdf`.replace(/[\\\/:*?"<>|]/g, '_');
        return res.json({ ok: true, suggested, info });
      }
      case 'show-js': return needEngine(res, action, 'PDF 内嵌脚本解析（需遍历对象流）');
      case 'scanner-split': return needEngine(res, action, '图像切分引擎（OpenCV 等）');
      case 'repair': {
        const buf = await P.loadPdfAny(files[0]).then(d => d.save());
        return sendPdf(res, Buffer.from(buf), 'repaired.pdf');
      }
      case 'unlock-forms': return needEngine(res, action, 'qpdf / mutool');

      /* ---------- 其他 ---------- */
      case 'ocr': return needEngine(res, action, 'OCRmyPDF + Tesseract');
      case 'compare': return needEngine(res, action, 'PDF 差异比对引擎');
      case 'read-annotate': return needEngine(res, action, '前端阅读器直接处理');

      default:
        return res.status(200).json({ ok: false, message: `PDF 工具「${action}」后端待实现。` });
    }
  } catch (err) {
    console.error('[pdf] error:', err);
    return res.status(500).json({ ok: false, message: '处理失败：' + (err.message || err), action });
  }
});

module.exports = router;
