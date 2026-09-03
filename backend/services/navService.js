/* ============================================================
 * services/navService.js - 网址导航业务逻辑
 * 职责：分类与站点的查询编排、搜索筛选、以及链接有效性校验。
 * ============================================================ */
const fetch = require('node-fetch');
const { BadRequestError } = require('../core/errors');

/** 校验单条链接 */
async function checkUrl(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShixiongNavBot/1.0)' },
    });
    // 部分站点 HEAD 不支持，回退 GET 仅取响应头
    if (res.status >= 400) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShixiongNavBot/1.0)' },
      });
    }
    clearTimeout(timer);
    if (res.status >= 200 && res.status < 400) return { status: 'ok', code: res.status };
    if (res.status >= 500) return { status: 'unreachable', code: res.status };
    return { status: 'unknown', code: res.status };
  } catch {
    clearTimeout(timer);
    return { status: 'unreachable', code: 0 };
  }
}

function createNavService({ navRepository, logger } = {}) {
  /** 分类列表（摘要） */
  function listCategories() {
    return navRepository.findAllCategories();
  }

  /** 分类详情（含站点） */
  function getCategory(id) {
    return navRepository.findCategoryById(id);
  }

  /** 可用地区 */
  function listRegions(categoryId) {
    return navRepository.listRegions(categoryId);
  }

  /**
   * 搜索 / 筛选站点
   * @param {{category?:string, region?:string, q?:string}} params
   */
  function search(params = {}) {
    const category = String(params.category || '').trim();
    const region = String(params.region || '').trim();
    const q = String(params.q || '').trim();
    if (category) {
      const valid = navRepository.findAllCategories().some((c) => c.id === category);
      if (!valid) throw new BadRequestError('未知的分类');
    }
    if (region && region !== '全部') {
      const regions = navRepository.listRegions(category || undefined);
      if (!regions.includes(region)) throw new BadRequestError('未知的地区');
    }
    return navRepository.searchSites({ categoryId: category || undefined, region: region && region !== '全部' ? region : undefined, q });
  }

  /**
   * 校验全部链接有效性，写回 status / lastChecked
   * @param {{concurrency?:number, timeoutMs?:number}} opts
   */
  async function verifyLinks({ concurrency = 8, timeoutMs = 8000 } = {}) {
    const data = navRepository.load();
    const sites = [];
    data.categories.forEach((c) => (c.sites || []).forEach((s) => sites.push(s)));
    let idx = 0;
    let ok = 0, unreachable = 0, unknown = 0;

    async function worker() {
      while (idx < sites.length) {
        const s = sites[idx++];
        const r = await checkUrl(s.url, timeoutMs);
        s.status = r.status;
        s.lastStatus = r.code;
        s.lastChecked = new Date().toISOString();
        if (r.status === 'ok') ok++;
        else if (r.status === 'unreachable') unreachable++;
        else unknown++;
        if (logger) logger.debug(`校验 ${s.url} -> ${r.status}(${r.code})`);
      }
    }

    const n = Math.max(1, Math.min(concurrency, sites.length || 1));
    await Promise.all(Array.from({ length: n }, worker));

    data.updatedAt = new Date().toISOString();
    navRepository.save(data);
    const result = { total: sites.length, ok, unreachable, unknown };
    if (logger) logger.info(`导航链接校验完成: ${JSON.stringify(result)}`);
    return result;
  }

  return { listCategories, getCategory, listRegions, search, verifyLinks };
}

module.exports = { createNavService };
