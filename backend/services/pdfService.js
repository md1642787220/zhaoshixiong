/* ============================================================
 * services/pdfService.js - PDF 工具业务逻辑
 * 职责：按 action 编排 PDF 处理流程，返回「结果描述对象」，
 *       不感知 HTTP 细节（由路由层负责发送响应）。
 *
 * 结果类型（kind）：
 *   pdf        { buffer, filename }                  单个 PDF 下载
 *   zip        { items, zipName }                    多文件打包下载
 *   json       { data }                              JSON 响应
 *   text       { content, filename, contentType }    文本类文件下载
 *   upstream   { status, contentType, disposition, json?, buffer? }  引擎转发结果
 *   unavailable{ action, engine }                    需要外部引擎但当前不可用
 * ============================================================ */
const fs = require('fs');
const { NotFoundError, BadRequestError } = require('../core/errors');

/** 已规划的 PDF 能力清单 */
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
  'render-page',
];

/** 需要外部引擎的 action（纯 Node 无法完成） */
const ENGINE_ACTIONS = new Set([
  'single-large-page', 'text-editor', 'replace-color', 'remove-password',
  'change-permissions', 'sign', 'cert-sign', 'remove-cert-sign',
  'validate-signature', 'redact', 'to-image',
  'convert-office',
  // 图片转 PDF 交由 Python worker(PyMuPDF)：需页边距 / 灰度等图像能力，纯 pdf-lib 做不到
  'image-to-pdf',
  'adjust-contrast', 'show-js', 'scanner-split', 'unlock-forms',
  'compare',
  // PDF 页面渲染为图片：供前端签名位置可视化预览（PyMuPDF）
  'render-page',
]);

/** 各引擎依赖功能所需引擎说明（用于降级提示） */
const ENGINE_LABELS = {
  'single-large-page': 'Ghostscript / pdf-lib 渲染（长图导出）',
  'text-editor': 'PDF 文本层编辑库（如 pdf-lib + 文本提取）',
  'replace-color': 'Ghostscript（色彩空间处理）',
  'remove-password': 'qpdf（解密需原密码，node 端无原生实现）',
  'change-permissions': 'qpdf',
  sign: '签名库（如 node-signpdf）',
  'cert-sign': 'PKCS12 签名库（如 node-signpdf）',
  'remove-cert-sign': 'qpdf / mutool',
  'validate-signature': '签名校验库',
  redact: '内容遮盖需精确坐标，建议前端标注后由引擎处理',
  'to-image': 'Ghostscript / poppler（PDF 页面渲染为图片）',
  'convert-office': 'LibreOffice / Gotenberg（Office ⇄ PDF）',
  'image-to-pdf': 'PyMuPDF（图片转 PDF，支持页边距 / 灰度）',
  'adjust-contrast': 'Ghostscript（图像滤镜）',
  'show-js': 'PDF 内嵌脚本解析（需遍历对象流）',
  'scanner-split': '图像切分引擎（OpenCV 等）',
  'unlock-forms': 'qpdf / mutool',
  compare: 'PDF 差异比对引擎',
  'render-page': 'PyMuPDF（PDF 页面渲染为图片）',
};

const toBool = (s) => s === '1' || s === true || s === 'true';

/**
 * 创建 PDF 服务
 * @param {{pdfEngine: object, workerClient: object, storage: object, logger: object}} deps
 */
function createPdfService({ pdfEngine, workerClient, storage, logger } = {}) {
  /** 能力清单：前端据此给「暂未开放」的功能打角标 */
  function capabilities() {
    const capabilitiesMap = {};
    for (const a of PLANNED) {
      if (!ENGINE_ACTIONS.has(a)) {
        capabilitiesMap[a] = { available: true, source: 'node' };
      } else {
        capabilitiesMap[a] = {
          available: Boolean(workerClient?.enabled),
          source: workerClient?.enabled ? 'worker' : 'unavailable',
        };
      }
    }
    return capabilitiesMap;
  }

  /** 需要外部引擎时的处理：优先转发给 worker，否则返回降级描述 */
  async function handleEngineAction({ action, req, body }) {
    const engine = ENGINE_LABELS[action] || '外部 PDF 引擎';
    if (!workerClient?.enabled) {
      return { kind: 'unavailable', action, engine };
    }
    const result = await workerClient.forward({ action, req, body });
    return { kind: 'upstream', ...result };
  }

  /**
   * 执行 PDF 处理
   * @param {{action: string, req: object, body?: object}} params
   * @returns {Promise<object>} 结果描述对象
   */
  async function execute({ action, req, body = {} }) {
    if (!PLANNED.includes(action)) {
      throw new NotFoundError(`未规划的 PDF action: ${action}`);
    }

    const files = storage.readBuffers(req);
    if (logger) logger.debug(`PDF action=${action} files=${files.length}`);

    // 需要外部引擎的统一分支
    if (ENGINE_ACTIONS.has(action)) {
      return handleEngineAction({ action, req, body });
    }

    const P = pdfEngine;

    switch (action) {
      /* ---------- 页面操作 ---------- */
      case 'merge':
        return {
          kind: 'pdf',
          buffer: await P.mergePdfs(files, { bookmark: toBool(body.bookmark), toc: toBool(body.tableOfContents) }),
          filename: 'merged.pdf',
        };
      case 'split':
        return { kind: 'zip', items: await P.splitPages(files[0], body), zipName: 'split.zip' };
      case 'rotate':
        return { kind: 'pdf', buffer: await P.rotatePdf(files[0], body), filename: 'rotated.pdf' };
      case 'auto-rotate':
        return { kind: 'pdf', buffer: await P.autoRotate(files[0]), filename: 'auto-rotated.pdf' };
      case 'extract-pages':
        return { kind: 'pdf', buffer: await P.extractPages(files[0], body), filename: 'extracted.pdf' };
      case 'reorganize':
        return { kind: 'pdf', buffer: await P.reorganizePages(files[0], body), filename: 'reorganized.pdf' };
      case 'remove-pages':
        return { kind: 'pdf', buffer: await P.removePages(files[0], body), filename: 'removed.pdf' };
      case 'remove-blanks':
        return { kind: 'pdf', buffer: await P.removeBlanks(files[0], body), filename: 'no-blanks.pdf' };
      case 'crop':
        return { kind: 'pdf', buffer: await P.cropPdf(files[0], body), filename: 'cropped.pdf' };
      case 'page-numbers':
        return { kind: 'pdf', buffer: await P.addPageNumbers(files[0], body), filename: 'numbered.pdf' };
      case 'page-layout':
        return { kind: 'pdf', buffer: await P.pageLayout(files[0], body), filename: 'layout.pdf' };

      /* ---------- 内容编辑 ---------- */
      case 'change-metadata':
        return { kind: 'pdf', buffer: await P.changeMetadata(files[0], body), filename: 'metadata.pdf' };
      case 'pdf-info':
        return { kind: 'json', data: { ok: true, info: await P.getPdfInfo(files[0]) } };
      case 'extract-images': {
        const images = await P.extractImages(files[0]);
        const items = images.map((im, i) => ({ name: `img-${i + 1}.${im.ext}`, buffer: im.buffer }));
        if (!items.length) return { kind: 'json', data: { ok: false, message: '未找到内嵌图片' } };
        return { kind: 'zip', items, zipName: 'images.zip' };
      }
      case 'watermark':
        return { kind: 'pdf', buffer: await P.watermark(files[0], body), filename: 'watermarked.pdf' };
      case 'add-stamp': {
        const stamp = storage.readParamFile(req, 'stamp');
        if (!stamp) throw new BadRequestError('请上传印章图片');
        return {
          kind: 'pdf',
          buffer: await P.addStamp(files[0], { ...body, stampBuf: stamp.buffer }),
          filename: 'stamped.pdf',
        };
      }
      case 'add-attachments': {
        const att = storage.readParamFile(req, 'attachment');
        if (!att) throw new BadRequestError('请上传附件文件');
        return {
          kind: 'pdf',
          buffer: await P.addAttachments(files[0], {
            attachmentBuf: att.buffer,
            attachmentName: att.name,
            embed: toBool(body.embed),
          }),
          filename: 'with-attachment.pdf',
        };
      }
      case 'remove-annotations':
        return { kind: 'pdf', buffer: await P.removeAnnotations(files[0], body), filename: 'clean.pdf' };
      case 'flatten':
        return { kind: 'pdf', buffer: await P.flattenPdf(files[0], body), filename: 'flattened.pdf' };
      case 'toc':
        return { kind: 'pdf', buffer: await P.addToc(files[0], body), filename: 'with-toc.pdf' };

      /* ---------- 安全 ---------- */
      case 'add-password':
        return { kind: 'pdf', buffer: await P.addPassword(files[0], body), filename: 'encrypted.pdf' };
      case 'sanitize':
        return { kind: 'pdf', buffer: await P.sanitize(files[0], body), filename: 'sanitized.pdf' };

      /* ---------- 转换 ---------- */
      case 'image-to-pdf':
        return { kind: 'pdf', buffer: await P.imageToPdf(files, body), filename: 'from-images.pdf' };
      case 'markdown-to-pdf': {
        const mdText = files[0] ? files[0].toString('utf8') : body.text || '';
        if (!mdText) throw new BadRequestError('请上传 .md 文件或提供文本');
        return { kind: 'pdf', buffer: await P.markdownToPdf(mdText, body), filename: 'converted.pdf' };
      }
      case 'to-html':
        return {
          kind: 'text',
          content: await P.pdfToHtml(files[0]),
          filename: 'converted.html',
          contentType: 'text/html; charset=utf-8',
        };

      /* ---------- 高级 ---------- */
      case 'overlay': {
        const bg = storage.readParamFile(req, 'background');
        if (!bg) throw new BadRequestError('请上传背景/模板 PDF');
        return {
          kind: 'pdf',
          buffer: await P.overlay(files[0], { backgroundBuf: bg.buffer, mode: body.mode }),
          filename: 'overlayed.pdf',
        };
      }
      case 'booklet':
        return { kind: 'pdf', buffer: await P.booklet(files[0], body), filename: 'booklet.pdf' };
      case 'adjust-scale':
        return { kind: 'pdf', buffer: await P.adjustScale(files[0], body), filename: 'scaled.pdf' };
      case 'auto-rename': {
        const info = await P.getPdfInfo(files[0]);
        const suggested = `${info.author || 'doc'}_${info.title || 'untitled'}.pdf`.replace(/[\\/:*?"<>|]/g, '_');
        return { kind: 'json', data: { ok: true, suggested, info } };
      }
      case 'repair': {
        const doc = await P.loadPdfAny(files[0]);
        return { kind: 'pdf', buffer: Buffer.from(await doc.save()), filename: 'repaired.pdf' };
      }

      /* ---------- PDFPatcher 能力（纯 Node） ---------- */
      case 'inspect-structure':
        return { kind: 'json', data: { ok: true, structure: await P.inspectStructure(files[0]) } };
      case 'export-xml':
        return {
          kind: 'text',
          content: await P.exportXml(files[0]),
          filename: 'structure.xml',
          contentType: 'application/xml; charset=utf-8',
        };
      case 'edit-bookmarks':
        return { kind: 'pdf', buffer: await P.editBookmarks(files[0], body), filename: 'bookmarked.pdf' };
      case 'replace-fonts': {
        const fontFile = storage.readParamFile(req, 'font');
        let fontPath = null;
        if (fontFile) fontPath = storage.writeTemp(fontFile.buffer, 'ttf');
        try {
          const r = await P.replaceFonts(files[0], { ...body, fontPath });
          if (r && r.ok === false) return { kind: 'json', data: r };
          return { kind: 'pdf', buffer: r.buffer, filename: 'font-replaced.pdf' };
        } finally {
          if (fontPath) { try { fs.unlinkSync(fontPath); } catch { /* ignore */ } }
        }
      }
      case 'remove-actions':
        return { kind: 'pdf', buffer: await P.removeActions(files[0], body), filename: 'actions-removed.pdf' };

      default:
        return { kind: 'json', data: { ok: false, message: `PDF 工具「${action}」后端待实现。` } };
    }
  }

  return { capabilities, execute, planned: PLANNED };
}

module.exports = { createPdfService };
