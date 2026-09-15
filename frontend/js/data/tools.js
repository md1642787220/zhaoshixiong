/* ============================================================
 * data/tools.js - 工具板块静态配置（前端自维护）
 *
 * 字段说明：
 *   closed: true 表示该功能尚未实现 / 暂未开放，
 *               前端会在工具卡片与详情页统一标注「未开放」。
 * ============================================================ */

export const TOOLS = [
  {
    id: 'media',
    icon: 'film',
    name: '音视频素材下载',
    desc: '从视频提取音频、视频素材下载与音频素材下载，课件配音配乐一站取材。',
    path: '/tools/media',
  },
  {
    id: 'handwriting',
    icon: 'pen-tool',
    name: '手写体转换',
    desc: '将一段打印体文字转换为手写体图片，便于手写笔记、签名等场景。',
    path: '/tools/handwriting',
    closed: true,
  },
  {
    id: 'idphoto',
    icon: 'images',
    name: '寸照编辑器',
    desc: '上传照片裁剪为各类证件照尺寸，可换白 / 红 / 蓝底，并一键生成排版打印图。',
    path: '/tools/idphoto',
  },
];

/** 按 id 查找工具配置 */
export function getTool(id) {
  return TOOLS.find(t => t.id === id);
}
