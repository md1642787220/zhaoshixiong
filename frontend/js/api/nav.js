/* ============================================================
 * api/nav.js - 网址导航接口（后端不可用时自动降级本地数据）
 *
 * 对应后端约定：
 *   GET /api/nav/categories              分类列表（政府/教育）
 *   GET /api/nav/categories/:id          分类详情（含站点）
 *   GET /api/nav/sites?category=&region=&q=   搜索 / 筛选
 *   GET /api/nav/regions?category=       可用地区列表
 * ============================================================ */
import { apiJson } from './client.js';
import { NAV } from '../data/nav.js';

function categoriesMock() {
  return NAV.categories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    description: c.description,
    count: (c.sites || []).length,
    regions: [...new Set((c.sites || []).map((s) => s.region).filter(Boolean))].sort(),
  }));
}

function sitesMock({ category, region, q } = {}) {
  const out = [];
  NAV.categories.forEach((c) => {
    if (category && c.id !== category) return;
    (c.sites || []).forEach((s) => {
      if (region && region !== '全部' && s.region !== region) return;
      const ql = (q || '').trim().toLowerCase();
      if (ql) {
        const hay = `${s.name} ${s.url} ${s.description || ''} ${s.region || ''}`.toLowerCase();
        if (!hay.includes(ql)) return;
      }
      out.push({ ...s, categoryId: c.id, categoryName: c.name });
    });
  });
  return out;
}

export const navApi = {
  async categories() {
    try {
      return await apiJson('/nav/categories');
    } catch {
      return categoriesMock();
    }
  },
  async category(id) {
    try {
      return await apiJson(`/nav/categories/${id}`);
    } catch {
      const c = NAV.categories.find((x) => x.id === id);
      if (!c) throw new Error('分类不存在');
      return c;
    }
  },
  async sites(params = {}) {
    const { category, region, q } = params;
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (region && region !== '全部') qs.set('region', region);
    if (q) qs.set('q', q);
    try {
      return await apiJson(`/nav/sites?${qs.toString()}`);
    } catch {
      return sitesMock({ category, region, q });
    }
  },
  async regions(category) {
    try {
      return await apiJson(`/nav/regions${category ? `?category=${encodeURIComponent(category)}` : ''}`);
    } catch {
      const c = NAV.categories.find((x) => x.id === category);
      return c ? [...new Set((c.sites || []).map((s) => s.region).filter(Boolean))].sort() : [];
    }
  },
};
