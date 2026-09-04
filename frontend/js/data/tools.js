/* ============================================================
 * data/tools.js - 工具板块静态配置（前端自维护）
 * ============================================================ */

export const TOOLS = [
  {
    id: 'media',
    icon: 'film',
    name: '音视频素材下载',
    desc: '音频提取、视频截取与音乐素材解析，课件配音配乐一站取材。',
    path: '/tools/media',
  },
  {
    id: 'handwriting',
    icon: 'pen-tool',
    name: '手写体转换',
    desc: '将一段打印体文字转换为手写体图片，便于手写笔记、签名等场景（功能开发中）。',
    path: '/tools/handwriting',
  },
];

/** 按 id 查找工具配置 */
export function getTool(id) {
  return TOOLS.find(t => t.id === id);
}
