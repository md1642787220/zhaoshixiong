/* ============================================================
 * repositories/learnRepository.js - 学习板块数据访问层
 * 职责：封装 learn.json 的读取与查询，业务层不直接接触文件与结构。
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { BadRequestError, NotFoundError } = require('../core/errors');

/** 用户贡献文件持久化目录 */
const uploadDir = path.join(__dirname, '..', 'data', 'uploads');

/**
 * 创建学习数据仓库
 * @param {{dataPath?: string, logger: object}} deps
 */
function createLearnRepository({ dataPath, logger } = {}) {
  const file = dataPath || path.join(__dirname, '..', 'data', 'learn.json');

  /** 读取原始数据（每次读盘，便于开发期热更新，爬虫补齐数据后无需重启） */
  function load() {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  /** 原子写回 learn.json（临时文件 + rename，避免写一半损坏数据） */
  function save(data) {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  /** 查询全部分类（脱敏摘要，不含资源明细） */
  function findAllCategories() {
    const data = load();
    return (data.categories || []).map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description,
      count: (c.resources || []).length,
    }));
  }

  /** 按 id 查询分类（含资源明细） */
  function findCategoryById(id) {
    const data = load();
    const category = (data.categories || []).find((c) => c.id === id);
    if (!category) {
      if (logger) logger.debug(`学习分类未找到: ${id}`);
      throw new NotFoundError('分类不存在');
    }
    return category;
  }

  /** 追加资源到指定分类（用户贡献入口，返回带 id 的完整资源） */
  function addResource(categoryId, resource) {
    const data = load();
    const category = (data.categories || []).find((c) => c.id === categoryId);
    if (!category) throw new NotFoundError('分类不存在');
    if (!category.resources) category.resources = [];
    category.resources.push(resource);
    save(data);
    return resource;
  }

  /** 持久化用户上传的贡献文件，返回 { name, size, original } */
  function saveUpload(file) {
    fs.mkdirSync(uploadDir, { recursive: true });
    const ext = path.extname(file.name || '').slice(0, 10);
    const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    fs.writeFileSync(path.join(uploadDir, name), file.buffer);
    if (logger) logger.info(`贡献文件已保存: ${name}（${file.size} bytes）`);
    return { name, size: file.size, original: file.name };
  }

  /** 解析贡献文件下载路径（校验文件名，防路径遍历） */
  function resolveUpload(name) {
    if (!/^[a-z0-9-]+\.[a-z0-9]{1,9}$/i.test(name)) throw new BadRequestError('非法的文件名');
    const p = path.join(uploadDir, name);
    if (!fs.existsSync(p)) throw new NotFoundError('文件不存在或已被清理');
    return p;
  }

  return { findAllCategories, findCategoryById, addResource, saveUpload, resolveUpload };
}

module.exports = { createLearnRepository };
