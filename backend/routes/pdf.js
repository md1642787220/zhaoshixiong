/* ============================================================
 * routes/pdf.js - PDF 工具后端接口（预留 / 分阶段实现）
 *
 * 前端 data/pdfTools.js 为每个工具定义了 action，提交到
 *   POST /api/pdf/:action
 * 本文件作为统一入口 stub：接收文件与参数，打印日志，
 * 并返回“后端待实现”，方便逐工具对接真实 PDF 引擎。
 *
 * 后续实现每个 action 时，可在此 switch 中分别调用：
 *   - pdf-lib / pdf-lib 系列（合并、拆分、旋转、页码、元数据…）
 *   - sharp / ghostscript（图片转换、缩放、对比度）
 *   - LibreOffice / gotenberg（Office ⇄ PDF）
 *   - OCRmyPDF + Tesseract（OCR）
 *   - qpdf / mutool（加密、解密、权限）
 * ============================================================ */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'helper-pdf-'));
const upload = multer({ dest: tmpRoot, limits: { fileSize: 500 * 1024 * 1024 } });

/** 已规划但待实现的 action 清单（与前端一致） */
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

router.post('/:action', upload.any(), (req, res) => {
  const { action } = req.params;
  const files = (req.files || []).map(f => f.originalname);
  console.log(`[pdf] action=${action} files=${files.join(',') || '-'} body=`, req.body);

  if (!PLANNED.includes(action)) {
    return res.status(404).json({ ok: false, message: `未规划的 PDF action: ${action}` });
  }
  // 暂未实现具体引擎：统一返回“后端待实现”，前端据此提示用户
  return res.status(200).json({
    ok: false,
    message: `PDF 工具「${action}」后端待实现。前端交互与接口已就绪，等待接入 PDF 处理引擎。`,
  });
});

module.exports = router;
