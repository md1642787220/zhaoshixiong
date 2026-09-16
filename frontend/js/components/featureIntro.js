/* ============================================================
 * components/featureIntro.js - 「功能介绍」通用区块
 *
 * 面向完全的电脑小白：不出现专业术语，用生活化的说法讲清楚
 * 「这是干什么用的、什么时候用得上、要注意什么」。
 * 全站所有功能页共用这一个组件，保证说明的位置与样式统一。
 * ============================================================ */
import { icon } from './icon.js';
import { esc } from '../utils.js';

const DEFAULT_TITLE = '这个功能是干什么的？';

/**
 * 生成功能介绍区块
 * @param {string|{title?:string, text?:string, points?:string[], note?:string}|null} data
 *        传字符串时直接作为正文
 * @param {{compact?: boolean, title?: string}} [opts]
 *        compact=true 用于窄栏（如 PDF 工具右侧面板）
 * @returns {string} HTML（无内容时返回空串，不占位）
 */
export function featureIntro(data, opts = {}) {
  if (!data) return '';
  const d = typeof data === 'string' ? { text: data } : data;
  if (!d.text && !(d.points && d.points.length)) return '';

  const title = opts.title || d.title || DEFAULT_TITLE;
  const points = (d.points || []).length
    ? `<ul class="fi-points">${d.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
    : '';

  return `
  <div class="feature-intro${opts.compact ? ' is-compact' : ''}">
    <div class="fi-title">${icon('info', 17)} ${esc(title)}</div>
    ${d.text ? `<p class="fi-text">${esc(d.text)}</p>` : ''}
    ${points}
    ${d.note ? `<p class="fi-note">${esc(d.note)}</p>` : ''}
  </div>`;
}
