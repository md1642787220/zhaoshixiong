/* ============================================================
 * api/learn.js - 学习板块接口（后端不可用时自动降级本地数据）
 *
 * 对应后端约定：
 *   GET /api/learn/categories          分类列表
 *   GET /api/learn/categories/:id      分类详情（含资源）
 *
 * 后端尚未实现时使用本地 mock 数据，保证前端展示完整；
 * 后端就绪后无需改前端代码。
 * ============================================================ */
import { apiJson } from './client.js';
import { LEARN_CATEGORIES } from '../data/learn.js';

function toSummary(c) {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon,
    description: c.description,
    count: c.resources.length,
  };
}

export const learnApi = {
  /** 学习板块分类列表 */
  async categories() {
    try {
      return await apiJson('/learn/categories');
    } catch {
      // 降级：后端未启动 / 未实现时使用本地数据
      return LEARN_CATEGORIES.map(toSummary);
    }
  },

  /** 分类详情（含资源列表） */
  async category(id) {
    try {
      return await apiJson(`/learn/categories/${id}`);
    } catch {
      const cat = LEARN_CATEGORIES.find(c => c.id === id);
      if (!cat) throw new Error('分类不存在');
      return cat;
    }
  },
};
