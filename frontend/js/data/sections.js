/* ============================================================
 * data/sections.js - 首页板块快捷入口配置
 * 职责：集中声明各板块入口，首页据此渲染快速导航。
 *       新增板块只需在此追加一项，无需改动视图代码。
 *
 * action 说明：
 *   route  跳转到对应 hash 路由
 *   scroll 平滑滚动到当前页内的某个区块（避免与 hash 路由冲突）
 * ============================================================ */
import { TOOLS } from './tools.js';
import { PDF_TOOLS } from './pdfTools.js';

export const SECTIONS = [
  {
    id: 'tools',
    name: '工具板块',
    desc: '音视频素材下载 / 手写体转换',
    icon: 'toolbox',
    path: '/tools',
    badge: `${TOOLS.length} 个`,
    action: 'route',
  },
  {
    id: 'pdf',
    name: 'PDF 工具',
    desc: '合并 / 拆分 / 水印 / 加密 等',
    icon: 'file-text',
    path: '/pdf',
    badge: `${PDF_TOOLS.length} 个`,
    action: 'route',
  },
  {
    id: 'learn',
    name: '学习板块',
    desc: '办公技巧 / 课件模板 / 公文写作',
    icon: 'book-open',
    path: '/learn',
    badge: '25+ 项',
    action: 'route',
  },
];
