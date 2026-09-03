/* ============================================================
 * repositories/learnRepository.js - 学习板块数据访问层
 * 职责：封装 learn.json 的读取与查询，业务层不直接接触文件与结构。
 * ============================================================ */
const path = require('path');
const { NotFoundError } = require('../core/errors');

/**
 * 创建学习数据仓库
 * @param {{dataPath?: string, logger: object}} deps
 */
function createLearnRepository({ dataPath, logger } = {}) {
  const file = dataPath || path.join(__dirname, '..', 'data', 'learn.json');

  /** 读取原始数据（每次读取，便于开发期热更新） */
  function load() {
    // eslint-disable-next-line global-require
    const raw = require(file);
    return raw;
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

  return { findAllCategories, findCategoryById };
}

module.exports = { createLearnRepository };
