/* ============================================================
 * data/tools.js - 工具板块静态配置（前端自维护）
 * ============================================================ */

export const TOOLS = [
  {
    id: 'convert',
    icon: 'refresh',
    name: '格式转换',
    desc: 'Markdown、JSON、CSV 等常见格式互转，快速整理资料。',
    path: '/tools/convert',
  },
  {
    id: 'audio',
    icon: 'music',
    name: '音频提取',
    desc: '从视频文件中一键提取音轨，导出 192kbps MP3。',
    path: '/tools/audio',
  },
  {
    id: 'video',
    icon: 'film',
    name: '视频提取',
    desc: '按起止时间裁剪视频片段，会议录像、课程视频快速截取。',
    path: '/tools/video',
  },
  {
    id: 'text',
    icon: 'file-text',
    name: '文本提取',
    desc: '从 PDF、TXT 等文件中提取纯文本，便于二次编辑。',
    path: '/tools/text',
  },
  {
    id: 'music',
    icon: 'music',
    name: '音乐素材解析',
    desc: '输入素材名称即可解析出下载链接，便于课件配音与活动配乐取材。',
    path: '/tools/music',
  },
];

/** 格式转换支持的类型与下载文件名 */
export const CONVERT_TYPES = {
  md2html: { label: 'Markdown → HTML', file: '转换结果.html' },
  json2csv: { label: 'JSON → CSV（表格）', file: '转换结果.csv' },
  csv2json: { label: 'CSV → JSON', file: '转换结果.json' },
};

/** 按 id 查找工具配置 */
export function getTool(id) {
  return TOOLS.find(t => t.id === id);
}
