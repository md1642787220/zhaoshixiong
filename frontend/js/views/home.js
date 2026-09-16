/* ============================================================
 * views/home.js - 首页
 * 布局：顶部「板块快速导航」(quick-nav) 直达各板块，
 *      其下平铺工具 / PDF / 学习三大板块卡片，
 *      底部为「关于」彩蛋区块（含插画）。
 * ============================================================ */
import { TOOLS } from '../data/tools.js';
import { PDF_TOOLS } from '../data/pdfTools.js';
import { learnApi } from '../api/learn.js';
import { icon } from '../components/icon.js';
import { toolCard } from './tools.js';
import { pdfToolCard, applyPdfCaps } from './pdf.js';
import { aboutSection, bindAboutEgg } from '../components/aboutSection.js';
import { SECTIONS } from '../data/sections.js';
import { learnCard } from '../components/learnCard.js';
import { featureIntro } from '../components/featureIntro.js';

/** 板块快捷入口卡片（route 用链接，scroll 用按钮以免干扰 hash 路由） */
function sectionCard(s) {
  const isRoute = s.action === 'route';
  const tag = isRoute ? 'a' : 'button';
  const attrs = isRoute ? `href="#${s.path}"` : `type="button" data-scroll="${s.target}"`;

  return `
  <${tag} class="qn-item" ${attrs}>
    <span class="qn-icon">${icon(s.icon, 21)}</span>
    <span class="qn-body">
      <span class="qn-title">${s.name}</span>
      <span class="qn-desc">${s.desc}</span>
    </span>
    ${s.badge ? `<span class="qn-badge">${s.badge}</span>` : ''}
    <span class="qn-arrow">→</span>
  </${tag}>`;
}

export default {
  title: '师兄 · 体制内办公好帮手',
  nav: '/',

  render() {
    return `
    ${featureIntro({
      title: '这个网站是干什么的？',
      text: '给老师、公务员等体制内同事准备的办公工具箱。工作中那些又琐碎又费时间的小事——比如证件照要改尺寸换底色、PDF 里的字改不动、电脑快捷键不会用——在这里几步就能搞定。不用下载安装，也不用注册账号。',
      note: '第一次来可以点下面的方块快速找到自己需要的板块。',
    })}

    <nav class="quick-nav" aria-label="板块快速导航">
      ${SECTIONS.map(sectionCard).join('')}
    </nav>

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
    </section>

    ${aboutSection()}`;
  },

  async mount() {
    const box = document.getElementById('home-learn');
    const list = await learnApi.categories();
    box.innerHTML = list.map(learnCard).join('');
    applyPdfCaps();
    bindAboutEgg();
  },
};
