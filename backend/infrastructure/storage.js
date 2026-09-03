/* ============================================================
 * infrastructure/storage.js - 临时文件与上传存储
 * 职责：封装 multer 上传、临时文件创建与清理。
 *       业务层只依赖本模块暴露的接口，不直接操作 fs/os。
 * ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');

/**
 * 创建存储服务
 * @param {{uploadBytes: number, logger: object}} deps
 */
function createStorage({ uploadBytes, logger }) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shixiong-'));
  const multerBase = multer({ dest: tmpRoot, limits: { fileSize: uploadBytes } });

  /** 生成临时文件路径 */
  function tmpFile(ext = '') {
    const suffix = ext && !ext.startsWith('.') ? `.${ext}` : ext;
    return path.join(tmpRoot, `${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`);
  }

  /** 删除临时文件（失败静默） */
  function remove(file) {
    if (!file) return;
    fs.unlink(file, (err) => {
      if (err && logger) logger.debug(`临时文件清理失败: ${file}`);
    });
  }

  /** 写出 Buffer 到临时文件，返回路径 */
  function writeTemp(buffer, ext = '') {
    const p = tmpFile(ext);
    fs.writeFileSync(p, buffer);
    return p;
  }

  /** 按字段名收集上传文件（兼容单/复数命名） */
  function pickUploads(req, name) {
    const list = req.files || [];
    const exact = list.filter((x) => x.fieldname === name);
    if (exact.length) return exact;
    // 兼容复数形式（file -> files，background -> backgrounds）
    return list.filter((x) => x.fieldname === `${name}s`);
  }

  /** 读取主上传文件的 Buffer 列表 */
  function readBuffers(req) {
    const files = pickUploads(req, 'files');
    const source = files.length ? files : pickUploads(req, 'file');
    return source.map((x) => fs.readFileSync(x.path));
  }

  /** 读取主上传文件（保留文件名与类型，供引擎识别） */
  function readWithMeta(req) {
    const files = pickUploads(req, 'files');
    const source = files.length ? files : pickUploads(req, 'file');
    return source.map((x) => ({
      buffer: fs.readFileSync(x.path),
      name: x.originalname,
      mimetype: x.mimetype,
    }));
  }

  /** 读取指定参数文件（如 stamp / attachment / background） */
  function readParamFile(req, name) {
    const matched = pickUploads(req, name);
    if (!matched.length) return null;
    return {
      buffer: fs.readFileSync(matched[0].path),
      name: matched[0].originalname,
    };
  }

  /** 创建临时文件读取流（用于大文件流式下载，避免整体载入内存） */
  function createReadStream(filePath) {
    return fs.createReadStream(filePath);
  }

  /** 清理本次请求产生的所有上传文件 */
  function cleanup(req) {
    (req.files || []).forEach((f) => remove(f.path));
  }

  return {
    tmpRoot,
    /** 单文件上传中间件 */
    single: (field) => multerBase.single(field),
    /** 任意字段上传中间件 */
    any: () => multerBase.any(),
    tmpFile,
    remove,
    writeTemp,
    readBuffers,
    readWithMeta,
    readParamFile,
    createReadStream,
    cleanup,
  };
}

module.exports = { createStorage };
