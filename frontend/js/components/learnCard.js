/* ============================================================
 * components/learnCard.js - 学习专区卡片
 * 首页「学习」区块与学习板块列表页共用同一份渲染逻辑。
 *
 * 字段约定：
 *   c.path 自定义跳转（非资源型专区，如「常用快捷键」指向独立页面，
 *          不走通用的 #/learn/:id 分类详情页）
 * ============================================================ */
import { icon } from './icon.js';
import { esc } from '../utils.js';
import { SHORTCUT_TOTAL } from '../data/shortcuts.js';

/**
 * 角标文案：
 *   「常用快捷键」的条目数由前端数据决定，这里按 id 回填，
 *   避免与后端 learn.json 里的数字不一致。
 */
const LOCAL_COUNTS = { shortcuts: `${SHORTCUT_TOTAL} 条快捷键` };

/**
 * 生成学习专区卡片
 * @param {object} c 分类摘要 { id, name, icon, description, count, path? }
 */
export function learnCard(c) {
  const href = c.path ? `#${c.path}` : `#/learn/${c.id}`;
  const badge = LOCAL_COUNTS[c.id] || `${c.count} 项资源`;
  return `
  <a class="card learn-card" href="${href}">
    <div class="card-icon">${icon(c.icon, 26)}</div>
    <h3>${esc(c.name)}</h3>
    <p class="desc">${esc(c.description)}</p>
    <div class="card-meta">
      <span class="badge">${esc(badge)}</span>
      <span class="card-link">${c.path ? '打开速查' : '进入专区'}</span>
    </div>
  </a>`;
}
