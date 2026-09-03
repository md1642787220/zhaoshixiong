/* ============================================================
 * repositories/navRepository.js - 网址导航数据访问层
 * 职责：封装 nav.json 的读取与查询，业务层不直接接触文件与结构。
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { NotFoundError } = require('../core/errors');

/**
 * 创建导航数据仓库
 * @param {{dataPath?: string, logger: object}} deps
 */
function createNavRepository({ dataPath, logger } = {}) {
  const file = dataPath || path.join(__dirname, '..', 'data', 'nav.json');

  /** 读取原始数据（每次读盘，便于爬虫补齐数据后无需重启） */
  function load() {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  /** 原子写回 nav.json（临时文件 + rename，避免写一半损坏数据） */
  function save(data) {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  /** 分类摘要（脱敏，含站点数与可用地区） */
  function findAllCategories() {
    const data = load();
    return (data.categories || []).map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description,
      count: (c.sites || []).length,
      regions: [...new Set((c.sites || []).map((s) => s.region).filter(Boolean))].sort(),
    }));
  }

  /** 按 id 查询分类（含站点明细） */
  function findCategoryById(id) {
    const data = load();
    const category = (data.categories || []).find((c) => c.id === id);
    if (!category) {
      if (logger) logger.debug(`导航分类未找到: ${id}`);
      throw new NotFoundError('分类不存在');
    }
    return category;
  }

  /** 可用地区列表（可限定分类） */
  function listRegions(categoryId) {
    const data = load();
    let cats = data.categories || [];
    if (categoryId) cats = cats.filter((c) => c.id === categoryId);
    const set = new Set();
    cats.forEach((c) => (c.sites || []).forEach((s) => { if (s.region) set.add(s.region); }));
    return [...set].sort();
  }

  /**
   * 按分类 / 地区 / 关键词搜索站点
   * @returns {Array} 站点（附带 categoryId / categoryName）
   */
  function searchSites({ categoryId, region, q } = {}) {
    const data = load();
    let cats = data.categories || [];
    if (categoryId) cats = cats.filter((c) => c.id === categoryId);
    const ql = String(q || '').trim().toLowerCase();
    const out = [];
    cats.forEach((c) => {
      (c.sites || []).forEach((s) => {
        if (region && s.region !== region) return;
        if (ql) {
          const hay = `${s.name} ${s.url} ${s.description || ''} ${s.region || ''}`.toLowerCase();
          if (!hay.includes(ql)) return;
        }
        out.push({ ...s, categoryId: c.id, categoryName: c.name });
      });
    });
    return out;
  }

  /** 整体修改数据并写回（供链接校验更新状态使用） */
  function mutate(fn) {
    const data = load();
    fn(data);
    save(data);
    return data;
  }

  return {
    load,
    save,
    findAllCategories,
    findCategoryById,
    listRegions,
    searchSites,
    mutate,
  };
}

module.exports = { createNavRepository };
