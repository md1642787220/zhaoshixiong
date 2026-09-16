/* ============================================================
 * views/learn.js - 学习板块列表页
 * ============================================================ */
import { learnApi } from '../api/learn.js';
import { icon } from '../components/icon.js';
import { learnCard } from '../components/learnCard.js';
import { featureIntro } from '../components/featureIntro.js';

export default {
  title: '学习板块 · 师兄',
  nav: '/learn',

  render() {
    return `
    <div class="page-head">
      <div class="breadcrumb"><a href="#/">首页</a> / 学习板块</div>
      <h1>${icon('book-open', 28)} 学习板块</h1>
      <p class="sub" id="learn-sub">专区持续更新中</p>
    </div>
    ${featureIntro({
      title: '这一页是干什么的？',
      text: '按用途分好的资料专区，每个专区里放着整理过的文档、模板和使用技巧。点任意一个专区进去，就能查看或下载里面的资料。',
      note: '「常用快捷键」专区不用下载，是直接查的：看到哪条顺手就记下来，用上三四次自然就记住了。',
    })}
    <div class="grid-4" id="learn-grid"><div class="loadbox">加载中…</div></div>`;
  },

  async mount() {
    const grid = document.getElementById('learn-grid');
    const list = await learnApi.categories();
    grid.innerHTML = list.map(learnCard).join('');

    // 专区数量随后端数据变化，这里按实际条数回填，避免写死数字后对不上
    const sub = document.getElementById('learn-sub');
    if (sub) sub.textContent = `${list.length} 个专区，办公技能、考试提分与效率工具持续更新`;
  },
};
