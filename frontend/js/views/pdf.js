/* ============================================================
 * views/pdf.js - PDF 工具板块（分类总览）
 * 数据来源：data/pdfTools.js（对应 Stirling-PDF 全部工具）
 * ============================================================ */
import { PDF_CATEGORIES, PDF_TOOLS } from '../data/pdfTools.js';
import { pdfApi } from '../api/pdf.js';
import { icon } from '../components/icon.js';
import { esc } from '../utils.js';

/** 首页紧凑卡片（grid-pdf 用，home.js 复用） */
export function pdfToolCard(t) {
  return `
  <a class="card pdf-tool-card" href="#/pdf/${t.id}" data-action="${t.action}">
    <div class="ptc-icon">${icon(t.icon, 22)}</div>
    <div class="ptc-body">
      <div class="ptc-name">${esc(t.name)}</div>
      <div class="ptc-desc">${esc(t.desc)}</div>
    </div>
  </a>`;
}

/** 拉取能力清单，给「暂未开放」的 PDF 工具卡片加角标 */
export async function applyPdfCaps() {
  let caps = {};
  try { caps = await pdfApi.capabilities(); } catch { return; }
  document.querySelectorAll('.pdf-tool-card[data-action]').forEach(card => {
    const cap = caps[card.dataset.action];
    if (cap && cap.available === false) {
      const name = card.querySelector('.ptc-name');
      if (name && !name.querySelector('.ptc-tag')) {
        name.insertAdjacentHTML('beforeend', '<span class="ptc-tag">暂未开放</span>');
      }
      card.classList.add('is-closed');
    }
  });
}

export default {
  title: 'PDF 工具 · Helper 助手',
  nav: '/pdf',

  render() {
    const filters = [{ id: 'all', name: '全部', icon: 'grid' }, ...PDF_CATEGORIES];
    const groups = PDF_CATEGORIES.map(cat => `
      <section class="pdf-group" id="cat-${cat.id}">
        <div class="pdf-group-head">
          <span class="pdf-group-icon">${icon(cat.icon, 22)}</span>
          <div>
            <h2>${esc(cat.name)}</h2>
            <p class="sub">${esc(cat.desc)}</p>
          </div>
        </div>
        <div class="grid-pdf">
          ${PDF_TOOLS.filter(t => t.cat === cat.id).map(pdfToolCard).join('')}
        </div>
      </section>
    `).join('');

    return `
    <div class="page-head">
      <div class="breadcrumb"><a href="#/">首页</a> / PDF 工具</div>
      <h1>${icon('file', 28)} PDF 工具 <span class="count-tag">${PDF_TOOLS.length} 个</span></h1>
      <p class="sub">覆盖转换、页面操作、安全签名、内容编辑、高级处理与辅助工具——能力对齐开源 Stirling-PDF</p>
    </div>

    <div class="pdf-filters">
      ${filters.map(f => `
        <button class="chip ${f.id === 'all' ? 'active' : ''}" data-cat="${f.id}">
          ${icon(f.icon, 16)}${esc(f.name)}
        </button>`).join('')}
    </div>

    <div class="pdf-groups">${groups}</div>`;
  },

  mount() {
    const chips = document.querySelectorAll('.pdf-filters .chip');
    const groups = document.querySelectorAll('.pdf-group');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const cat = chip.dataset.cat;
        chips.forEach(c => c.classList.toggle('active', c === chip));
        groups.forEach(g => {
          g.style.display = (cat === 'all' || g.id === 'cat-' + cat) ? '' : 'none';
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    applyPdfCaps();
  },
};
