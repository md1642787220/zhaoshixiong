/* ============================================================
 * views/home.js - 首页
 * 布局：上半部分左右分栏（左文案 + 右两大入口卡片），
 *      下半部分平铺工具与学习板块，省去冗余纵向滚动。
 * ============================================================ */
import { TOOLS } from '../data/tools.js';
import { PDF_TOOLS } from '../data/pdfTools.js';
import { learnApi } from '../api/learn.js';
import { icon } from '../components/icon.js';
import { pdfToolCard } from './pdf.js';
import { esc } from '../utils.js';

function toolCard(t) {
  return `
  <div class="card tool-card">
    <div class="card-icon">${icon(t.icon, 26)}</div>
    <h3>${t.name}</h3>
    <p class="desc">${t.desc}</p>
    <div class="card-meta">
      <a class="card-link" href="#${t.path}">立即使用</a>
    </div>
  </div>`;
}

function learnCard(c) {
  return `
  <div class="card learn-card">
    <div class="card-icon">${icon(c.icon, 26)}</div>
    <h3>${esc(c.name)}</h3>
    <p class="desc">${esc(c.description)}</p>
    <div class="card-meta">
      <span class="badge">${c.count} 项资源</span>
      <a class="card-link" href="#/learn/${c.id}">进入专区</a>
    </div>
  </div>`;
}

/** 大入口卡片：直接进入工具或学习板块 */
function entryCard({ to, title, sub, cta, kpi, kpiLabel, iconName }) {
  return `
  <a class="entry-card" href="${to}">
    <div class="entry-icon">${icon(iconName, 30)}</div>
    <div class="entry-body">
      <div class="entry-title">${title}</div>
      <div class="entry-sub">${sub}</div>
      <div class="entry-kpi"><b>${kpi}</b><span>${kpiLabel}</span></div>
      <div class="entry-cta">${cta} →</div>
    </div>
  </a>`;
}

export default {
  title: 'Helper 助手 · 体制内办公好帮手',
  nav: '/',

  render() {
    return `
    <section class="hero hero-split">
      <div class="hero-left">
        <h1>让体制内办公<span class="hl">更高效</span></h1>
        <p>为教师、公务员及体制内员工量身打造的实用工具箱——<br>格式转换、音视频处理、资料查询，一站搞定。</p>
        <div class="hero-actions">
          <a class="btn btn-light" href="#/tools">进入工具板块</a>
          <a class="btn btn-outline" href="#/learn">浏览学习专区</a>
        </div>
      </div>
      <div class="hero-right">
        ${entryCard({
          to: '#/tools',
          title: '工具板块',
          sub: '格式转换 / 音频提取 / 视频提取 / 文本提取',
          cta: '立即使用',
          kpi: TOOLS.length,
          kpiLabel: '个实用工具',
          iconName: 'toolbox',
        })}
        ${entryCard({
          to: '#/learn',
          title: '学习板块',
          sub: '办公技巧 / 课件模板 / 教育文件 / 公文写作 / 考试提升',
          cta: '进入学习',
          kpi: '25+',
          kpiLabel: '项精选资源',
          iconName: 'book-open',
        })}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>工具</h2>
        <a class="more" href="#/tools">查看全部 →</a>
      </div>
      <div class="grid-4">${TOOLS.map(toolCard).join('')}</div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>PDF 工具</h2>
        <a class="more" href="#/pdf">全部 ${PDF_TOOLS.length} 个 →</a>
      </div>
      <div class="grid-pdf">${PDF_TOOLS.slice(0, 8).map(pdfToolCard).join('')}</div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>学习</h2>
        <a class="more" href="#/learn">查看全部 →</a>
      </div>
      <div class="grid-4" id="home-learn"><div class="loadbox">加载中…</div></div>
    </section>`;
  },

  async mount() {
    const box = document.getElementById('home-learn');
    const list = await learnApi.categories();
    box.innerHTML = list.map(learnCard).join('');
  },
};
