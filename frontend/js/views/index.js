/* ============================================================
 * views/index.js - 视图清单
 * 职责：集中声明「路径 → 视图」的映射。
 *       新增页面时：1) 编写视图模块 2) 在此追加一项，
 *       router.js 与 app.js 均无需改动（开闭原则）。
 * ============================================================ */
import homeView from './home.js';
import toolsView from './tools.js';
import convertView from './convert.js';
import audioView from './audio.js';
import videoView from './video.js';
import textView from './text.js';
import musicView from './music.js';
import handwritingView from './handwriting.js';
import learnView from './learn.js';
import categoryView from './category.js';
import postView from './post.js';
import pdfView from './pdf.js';
import pdfToolView from './pdfTool.js';
import navView from './nav.js';

/** @type {{path: string, view: object}[]} */
export const views = [
  { path: '/', view: homeView },
  { path: '/tools', view: toolsView },
  { path: '/tools/convert', view: convertView },
  { path: '/tools/audio', view: audioView },
  { path: '/tools/video', view: videoView },
  { path: '/tools/text', view: textView },
  { path: '/tools/music', view: musicView },
  { path: '/tools/handwriting', view: handwritingView },
  { path: '/learn', view: learnView },
  { path: '/learn/:id', view: categoryView },
  { path: '/learn/:id/post', view: postView },
  { path: '/pdf', view: pdfView },
  { path: '/pdf/:toolId', view: pdfToolView },
  { path: '/nav', view: navView },
];
