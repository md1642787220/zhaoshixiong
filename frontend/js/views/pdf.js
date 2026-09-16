/* ============================================================
 * views/pdf.js - PDF 工具板块（分类总览）
 * 数据来源：data/pdfTools.js（对应 Stirling-PDF 全部工具）
 * ============================================================ */
import { PDF_CATEGORIES, PDF_TOOLS } from '../data/pdfTools.js';
import { pdfApi } from '../api/pdf.js';
import { icon } from '../components/icon.js';
import { esc } from '../utils.js';
import { featureIntro } from '../components/featureIntro.js';

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

/**
 * 拉取能力清单，为 PDF 工具卡片标注状态：
 *   - implemented === false            → 「未开放」（后端尚未实现）
 *   - 已实现但依赖引擎且当前不可用      → 「需服务端支持」（未部署 PDF Worker）
 */
export async function applyPdfCaps() {
  let caps = {};
  try { caps = await pdfApi.capabilities(); } catch { return; }
  document.querySelectorAll('.pdf-tool-card[data-action], .wb-tool[data-action]').forEach(card => {
    const cap = caps[card.dataset.action];
    if (!cap) return;
    const name = card.querySelector('.ptc-name') || card;

    if (cap.implemented === false) {
      // 未实现：右上角小红叉 + 文字角标 + 悬停提示
      card.classList.add('is-closed', 'is-unimplemented');
      card.title = '该功能尚未实现';
      if (!name.querySelector('.ptc-tag')) {
        name.insertAdjacentHTML('beforeend', '<span class="ptc-tag">未开放</span>');
      }
    } else if (cap.needsWorker && cap.available === false) {
      // 已实现但依赖引擎且当前未部署
      if (!name.querySelector('.ptc-tag')) {
        name.insertAdjacentHTML('beforeend', '<span class="ptc-tag pending">需服务端支持</span>');
      }
    }
  });
}

export default {
  title: 'PDF 工具 · 师兄',
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
      <p class="sub">跟 PDF 文件有关的各种麻烦事，这里都有对应的工具</p>
    </div>

    ${featureIntro({
      title: '这一页能帮你解决什么？',
      text: '日常遇到的情况比如：别人发来的材料改不动里面的字、好几份文件想拼成一份、扫描件太暗看不清、文件发出去怕外泄想加水印、报名要交 PDF 但手里只有图片。上面按用途分成了六类，点标签可以只看某一类。',
      note: '每个工具点进去后，右侧还会用大白话说明它具体怎么用、什么时候用得上。',
    })}

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
