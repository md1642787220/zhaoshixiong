/* ============================================================
 * views/tools.js - 工具板块列表页
 * toolCard 同时被首页复用，未开放工具统一在此追加角标。
 * ============================================================ */
import { TOOLS } from '../data/tools.js';
import { icon } from '../components/icon.js';
import { esc } from '../utils.js';
import { featureIntro } from '../components/featureIntro.js';

/** 工具卡片（工具板块与首页共用）；未开放工具追加「未开放」角标与右上角红叉 */
export function toolCard(t) {
  const tag = t.closed ? '<span class="tool-tag">未开放</span>' : '';
  return `
  <a class="card tool-card${t.closed ? ' is-closed is-unimplemented' : ''}" href="#${t.path}"${t.closed ? ' title="该功能尚未实现"' : ''}>
    <div class="card-icon">${icon(t.icon, 26)}</div>
    <h3>${esc(t.name)}${tag}</h3>
    <p class="desc">${esc(t.desc)}</p>
  </a>`;
}

export default {
  title: '工具板块 · 师兄',
  nav: '/tools',

  render() {
    return `
    <div class="page-head">
      <div class="breadcrumb"><a href="#/">首页</a> / 工具板块</div>
      <h1>${icon('toolbox', 28)} 工具板块</h1>
      <p class="sub">覆盖日常办公高频场景，无需安装即可在线使用</p>
    </div>
    ${featureIntro({
      title: '这一页是干什么的？',
      text: '把日常办公最常用的小工具集中放在这里：处理照片、处理视频和音频。不用下载安装、不用注册账号，打开网页就能用。点下面任意一张卡片进入对应工具。',
      note: '每个工具打开后都会再说明一次它具体能做什么，不用担心点错。',
    })}
    <div class="grid-4">${TOOLS.map(toolCard).join('')}</div>`;
  },
};
