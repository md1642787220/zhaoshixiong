/* ============================================================
 * services/learnService.js - 学习板块业务逻辑
 * 职责：分类与资源的查询编排、用户贡献内容的校验与落库，
 *       数据访问由注入的 repository 完成。
 * ============================================================ */
const { BadRequestError } = require('../core/errors');

/** 字节数格式化（与前端 utils.fmtSize 规则一致） */
function fmtSize(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

/** 校验规则常量 */
const RULES = {
  TITLE_MIN: 2,
  TITLE_MAX: 80,
  POST_MIN: 10,
  POST_MAX: 20000,
  SUMMARY_MAX: 200,
  SUMMARY_FILE_MIN: 5,
};

/**
 * 创建学习服务
 * @param {{learnRepository: object, logger: object}} deps
 */
function createLearnService({ learnRepository, logger } = {}) {
  /** 分类列表（摘要） */
  function listCategories() {
    return learnRepository.findAllCategories();
  }

  /** 分类详情（含资源） */
  function getCategory(id) {
    if (logger) logger.debug(`查询学习分类: ${id}`);
    return learnRepository.findCategoryById(id);
  }

  /**
   * 提交用户贡献
   * @param {string} categoryId 分类 id
   * @param {object} payload { kind, title, author, summary, content, url, source, keywords }
   * @param {{buffer:Buffer,name:string,size:number}|null} file 上传文件（kind=file 时必填）
   * 支持三种贡献：
   *   post   经验帖（正文必填，关键词可选）
   *   file   文件资源（文件 + 简介，关键词可选）
   *   repost 转载文章（必须提供原文链接与来源标注，关键词可选）
   */
  function addContribution(categoryId, payload = {}, file = null) {
    const kind = String(payload.kind || '').trim();
    const title = String(payload.title || '').trim();
    const summary = String(payload.summary || '').trim().slice(0, RULES.SUMMARY_MAX);
    const author = String(payload.author || '').trim().slice(0, 30) || '匿名师兄';
    const content = String(payload.content || '').trim();
    const url = String(payload.url || '').trim();
    const source = String(payload.source || '').trim().slice(0, 60);
    const keywords = String(payload.keywords || '').trim().slice(0, 100);

    /* ---- 公共校验 ---- */
    if (title.length < RULES.TITLE_MIN || title.length > RULES.TITLE_MAX) {
      throw new BadRequestError(`标题需为 ${RULES.TITLE_MIN}~${RULES.TITLE_MAX} 个字符`);
    }

    const resource = {
      id: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      title,
      type: '经验',
      format: '帖子',
      size: '—',
      author,
      contributedAt: new Date().toISOString(),
    };

    if (kind === 'post') {
      /* ---- 经验帖 ---- */
      if (content.length < RULES.POST_MIN) throw new BadRequestError(`经验正文至少 ${RULES.POST_MIN} 个字`);
      if (content.length > RULES.POST_MAX) throw new BadRequestError('经验正文过长，请精简后再提交');
      resource.type = '经验';
      resource.format = '帖子';
      resource.content = content;
      resource.summary = summary || `${content.replace(/\s+/g, ' ').slice(0, 90)}${content.length > 90 ? '…' : ''}`;
    } else if (kind === 'file') {
      /* ---- 文件资源 ---- */
      if (!file) throw new BadRequestError('请选择要上传的文件');
      if (summary.length < RULES.SUMMARY_FILE_MIN) {
        throw new BadRequestError(`请填写至少 ${RULES.SUMMARY_FILE_MIN} 个字的资源简介`);
      }
      const saved = learnRepository.saveUpload(file);
      const ext = (file.name || '').split('.').pop();
      resource.type = '资源';
      resource.format = (ext && ext.length <= 6 ? ext : 'file').toUpperCase();
      resource.size = fmtSize(saved.size);
      resource.summary = summary;
      resource.file = saved.name;
    } else if (kind === 'repost') {
      /* ---- 转载文章：必须标注来源 ---- */
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        throw new BadRequestError('原文链接格式不正确，请填写完整网址');
      }
      if (!/^https?:$/.test(parsed.protocol)) {
        throw new BadRequestError('原文链接必须以 http:// 或 https:// 开头');
      }
      resource.type = '转载';
      resource.format = '文章';
      resource.size = '—';
      resource.url = parsed.toString();
      if (source) resource.source = source;
      resource.summary = summary || (source ? `转载自 ${source}` : '');
    } else {
      throw new BadRequestError('未知的贡献类型');
    }

    /* ---- 关键词（三种类型统一保存，选填） ---- */
    if (keywords) resource.keywords = keywords;

    const saved = learnRepository.addResource(categoryId, resource);
    if (logger) logger.info(`新贡献已收录: [${categoryId}] ${saved.type} - ${saved.title}（by ${author}）`);
    return saved;
  }

  /** 解析贡献文件下载路径 */
  function resolveUpload(name) {
    return learnRepository.resolveUpload(name);
  }

  return { listCategories, getCategory, addContribution, resolveUpload };
}

module.exports = { createLearnService };
