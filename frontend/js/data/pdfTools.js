/* ============================================================
 * data/pdfTools.js
 * PDF 工具完整清单（以 Stirling-Tools/stirling-pdf 源码为准）
 * 源码目录：frontend/editor/src/core/components/tools/
 * 分类依据：Stirling-PDF 官方 6 大分类（Convert / Page Operations /
 *           Security / Content & Editing / Advanced / Other）
 *
 * 每个工具结构：
 *   id      唯一标识（用于路由 #/pdf/:id 与表单）
 *   name    中文名（对齐源码工具语义）
 *   cat     所属分类 id
 *   icon    图标名（见 components/icon.js）
 *   desc    一句话描述
 *   action  后端接口后缀：POST /api/pdf/:action（后端待实现）
 *   multi   是否多文件上传（如合并、叠加）
 *   params  表单参数 schema（前端通用渲染）
 *   hint    交互提示
 * ============================================================ */

/* ---------- 6 大分类（顺序即展示顺序） ---------- */
export const PDF_CATEGORIES = [
  { id: 'convert',  name: '格式转换',        icon: 'refresh',   desc: 'PDF 与 Word / Excel / PPT / 图片 / HTML 等互转' },
  { id: 'page',     name: '页面操作',        icon: 'grid',      desc: '合并、拆分、旋转、提取、重排、加页码等' },
  { id: 'security', name: '安全与签名',      icon: 'shield',    desc: '加密、解密、权限、水印、签名、脱敏' },
  { id: 'edit',     name: '内容与编辑',      icon: 'edit',      desc: '附件、印章、提取图片、元数据、文本编辑' },
  { id: 'advanced', name: '高级处理',        icon: 'layers',    desc: '叠加、缩放、对比度、小册子、修复等' },
  { id: 'other',    name: '其他工具',        icon: 'toolbox',   desc: 'OCR 识别、文档比较、阅读批注' },
];

/* ---------- 完整工具清单 ---------- */
export const PDF_TOOLS = [
  /* ===================== 转换 Convert ===================== */
  {
    id: 'pdf-to-office', name: 'PDF 转 Office', cat: 'convert', icon: 'refresh',
    desc: '将 PDF 转为可编辑的 Word / Excel / PPT', action: 'convert-office', multi: false,
    params: [
      { type: 'select', name: 'target', label: '目标格式',
        options: [['docx', 'Word (.docx)'], ['xlsx', 'Excel (.xlsx)'], ['pptx', 'PowerPoint (.pptx)']] },
      { type: 'switch', name: 'singlePageSheets', label: 'Excel 每页一个工作表', when: { target: 'xlsx' } },
      { type: 'switch', name: 'fitImages', label: '自动适配图片尺寸', when: { target: 'docx' } },
    ],
    hint: '转换结果可能需要简单校对，复杂排版建议用“PDF 转图片”再识别。',
  },
  {
    id: 'office-to-pdf', name: 'Office 转 PDF', cat: 'convert', icon: 'file',
    desc: 'Word / Excel / PPT / 文本 转成 PDF', action: 'to-pdf', multi: true,
    params: [
      { type: 'select', name: 'engine', label: '转换引擎',
        options: [['libreoffice', 'LibreOffice（推荐）'], ['gotenberg', 'Gotenberg']] },
    ],
    hint: '需服务器安装 LibreOffice 或配置 Gotenberg 服务。',
  },
  {
    id: 'pdf-to-pdfa', name: 'PDF 转 PDF/A', cat: 'convert', icon: 'file-check',
    desc: '转为长期归档合规的 PDF/A 标准', action: 'to-pdfa', multi: false,
    params: [
      { type: 'select', name: 'level', label: '合规等级',
        options: [['PDF/A-1b', 'PDF/A-1b'], ['PDF/A-2b', 'PDF/A-2b'], ['PDF/A-3b', 'PDF/A-3b']] },
    ],
    hint: '用于档案归档、招投标等需要长期可读的场景。',
  },
  {
    id: 'pdf-to-html', name: 'PDF 转 HTML', cat: 'convert', icon: 'globe',
    desc: '将 PDF 页面转为可编辑的 HTML 网页', action: 'to-html', multi: false,
    params: [
      { type: 'switch', name: 'singlePage', label: '合并为单个 HTML' },
    ],
  },
  {
    id: 'html-to-pdf', name: 'HTML 转 PDF', cat: 'convert', icon: 'globe',
    desc: '把 HTML 文件或网址渲染为 PDF', action: 'html-to-pdf', multi: false,
    params: [
      { type: 'select', name: 'source', label: '来源',
        options: [['file', '上传 HTML 文件'], ['url', '输入网页网址']] },
      { type: 'text', name: 'url', label: '网页网址', placeholder: 'https://...', when: { source: 'url' } },
    ],
    hint: '适用于把通知、公告网页保存为 PDF。',
  },
  {
    id: 'markdown-to-pdf', name: 'Markdown 转 PDF', cat: 'convert', icon: 'file-text',
    desc: '将 Markdown 文档排版本地化为 PDF', action: 'markdown-to-pdf', multi: false,
    params: [
      { type: 'select', name: 'theme', label: '主题样式',
        options: [['default', '默认'], ['academic', '学术'], ['compact', '紧凑']] },
    ],
  },
  {
    id: 'pdf-to-image', name: 'PDF 转图片', cat: 'convert', icon: 'image',
    desc: '把每一页导出为 PNG / JPG 压缩包', action: 'to-image', multi: false,
    params: [
      { type: 'select', name: 'format', label: '图片格式', options: [['png', 'PNG'], ['jpg', 'JPG']] },
      { type: 'range', name: 'dpi', label: '清晰度 (DPI)', min: 72, max: 600, step: 12, value: 150 },
      { type: 'switch', name: 'single', label: '合并为单张长图' },
    ],
    hint: '导出图片可直接贴入 Word / PPT。',
  },
  {
    id: 'image-to-pdf', name: '图片转 PDF', cat: 'convert', icon: 'image',
    desc: '将多张图片合成为一份 PDF', action: 'image-to-pdf', multi: true,
    params: [
      { type: 'select', name: 'fit', label: '页面适应', options: [['fit', '自动适配页边距'], ['stretch', '拉伸铺满'], ['center', '居中']] },
      { type: 'select', name: 'color', label: '颜色', options: [['color', '彩色'], ['grayscale', '灰度']] },
      { type: 'range', name: 'margin', label: '页边距 (mm)', min: 0, max: 50, step: 5, value: 0 },
    ],
    hint: '支持 JPG / PNG，按文件名顺序拼合。',
  },
  {
    id: 'pdf-to-presentation', name: 'PDF 转演示文稿', cat: 'convert', icon: 'presentation',
    desc: '将 PDF 每页拆成演示文稿幻灯片', action: 'to-presentation', multi: false,
    params: [
      { type: 'select', name: 'format', label: '输出格式', options: [['pptx', 'PowerPoint'], ['odp', 'OpenDocument']] },
    ],
  },

  /* ===================== 页面操作 Page Operations ===================== */
  {
    id: 'merge', name: '合并 PDF', cat: 'page', icon: 'merge',
    desc: '把多份 PDF 按顺序合并为一份', action: 'merge', multi: true,
    params: [
      { type: 'switch', name: 'bookmark', label: '为每个文件生成书签' },
      { type: 'switch', name: 'tableOfContents', label: '生成目录页' },
    ],
    hint: '支持拖拽排序；可同时加入图片文件。',
  },
  {
    id: 'split', name: '拆分 PDF', cat: 'page', icon: 'split',
    desc: '按页码、区间或大小拆分 PDF', action: 'split', multi: false,
    params: [
      { type: 'select', name: 'mode', label: '拆分方式',
        options: [['pages', '指定页码'], ['intervals', '按区间'], ['every', '每 N 页一份'], ['size', '按文件大小']] },
      { type: 'text', name: 'pages', label: '页码（如 1,3,5-7）', placeholder: '1,3,5-7', when: { mode: 'pages' } },
      { type: 'text', name: 'intervals', label: '区间（如 1-3,4-6）', placeholder: '1-3,4-6', when: { mode: 'intervals' } },
      { type: 'number', name: 'every', label: '每几页一份', value: 1, when: { mode: 'every' } },
      { type: 'number', name: 'size', label: '每份最大大小 (MB)', value: 10, when: { mode: 'size' } },
    ],
  },
  {
    id: 'rotate', name: '旋转页面', cat: 'page', icon: 'rotate',
    desc: '将全部或指定页面旋转 90°/180°/270°', action: 'rotate', multi: false,
    params: [
      { type: 'select', name: 'angle', label: '旋转角度', options: [['90', '顺时针 90°'], ['180', '180°'], ['270', '逆时针 90°']] },
      { type: 'text', name: 'pages', label: '指定页码（留空=全部）', placeholder: '如 1,3,5-7' },
    ],
  },
  {
    id: 'auto-rotate', name: '自动纠偏旋转', cat: 'page', icon: 'rotate-cw',
    desc: '根据内容方向自动校正页面角度', action: 'auto-rotate', multi: false,
    params: [
      { type: 'switch', name: 'useExif', label: '参考图片 EXIF 方向' },
    ],
  },
  {
    id: 'extract-pages', name: '提取页面', cat: 'page', icon: 'file-plus',
    desc: '抽取指定页码生成新 PDF', action: 'extract-pages', multi: false,
    params: [
      { type: 'text', name: 'pages', label: '要提取的页码', placeholder: '如 1-3,5,8-10' },
      { type: 'switch', name: 'reverse', label: '逆序排列' },
    ],
  },
  {
    id: 'reorganize', name: '重排页面', cat: 'page', icon: 'move-vertical',
    desc: '按自定义顺序重新排列页面', action: 'reorganize', multi: false,
    params: [
      { type: 'text', name: 'order', label: '页面顺序', placeholder: '如 3,1,2,4-6' },
      { type: 'switch', name: 'reverse', label: '全部倒序' },
    ],
    hint: '支持删除（省略页码）与复制（重复写）。',
  },
  {
    id: 'page-numbers', name: '添加页码', cat: 'page', icon: 'list-ordered',
    desc: '为页面批量添加页码与页眉页脚', action: 'page-numbers', multi: false,
    params: [
      { type: 'select', name: 'position', label: '位置',
        options: [['bottom-center', '底部居中'], ['bottom-right', '右下'], ['bottom-left', '左下'], ['top-center', '顶部居中']] },
      { type: 'text', name: 'text', label: '前缀文字（可选）', placeholder: '如 第 / 页' },
      { type: 'number', name: 'start', label: '起始页码', value: 1 },
      { type: 'select', name: 'size', label: '字号', options: [['small', '小'], ['medium', '中'], ['large', '大']] },
    ],
  },
  {
    id: 'remove-pages', name: '删除页面', cat: 'page', icon: 'trash-2',
    desc: '移除指定页面后输出剩余 PDF', action: 'remove-pages', multi: false,
    params: [
      { type: 'text', name: 'pages', label: '要删除的页码', placeholder: '如 2,4-6' },
    ],
  },
  {
    id: 'remove-blanks', name: '删除空白页', cat: 'page', icon: 'file-minus',
    desc: '自动检测并删除空白页', action: 'remove-blanks', multi: false,
    params: [
      { type: 'range', name: 'threshold', label: '空白判定阈值 (%)', min: 50, max: 99, step: 1, value: 95 },
    ],
  },
  {
    id: 'crop', name: '裁剪页面', cat: 'page', icon: 'crop',
    desc: '按边距裁剪 PDF 页面', action: 'crop', multi: false,
    params: [
      { type: 'number', name: 'top', label: '上边距 (mm)', value: 0 },
      { type: 'number', name: 'bottom', label: '下边距 (mm)', value: 0 },
      { type: 'number', name: 'left', label: '左边距 (mm)', value: 0 },
      { type: 'number', name: 'right', label: '右边距 (mm)', value: 0 },
    ],
  },
  {
    id: 'page-layout', name: '多页布局', cat: 'page', icon: 'grid',
    desc: '把多页拼到一页（如 2×2 小册排版）', action: 'page-layout', multi: false,
    params: [
      { type: 'number', name: 'cols', label: '每行列数', value: 2 },
      { type: 'number', name: 'rows', label: '每页行数', value: 2 },
      { type: 'switch', name: 'border', label: '显示页面边框' },
    ],
  },
  {
    id: 'single-large-page', name: '拼成长页', cat: 'page', icon: 'move-vertical',
    desc: '将所有页面竖向拼接成一张超长图/长页', action: 'single-large-page', multi: false,
    params: [
      { type: 'select', name: 'format', label: '输出格式', options: [['pdf', '长页 PDF'], ['png', '长图 PNG'], ['svg', 'SVG']] },
    ],
  },

  /* ===================== 安全与签名 Security ===================== */
  {
    id: 'add-password', name: '加密 PDF', cat: 'security', icon: 'lock',
    desc: '为 PDF 添加打开密码与权限', action: 'add-password', multi: false,
    params: [
      { type: 'password', name: 'password', label: '打开密码' },
      { type: 'password', name: 'ownerPassword', label: '权限密码（可选）' },
      { type: 'switch', name: 'allowPrint', label: '允许打印' },
      { type: 'switch', name: 'allowCopy', label: '允许复制内容' },
      { type: 'switch', name: 'allowEdit', label: '允许编辑' },
    ],
  },
  {
    id: 'remove-password', name: '解密 PDF', cat: 'security', icon: 'unlock',
    desc: '去除 PDF 打开密码（需提供密码）', action: 'remove-password', multi: false,
    params: [
      { type: 'password', name: 'password', label: '当前密码' },
    ],
  },
  {
    id: 'change-permissions', name: '修改权限', cat: 'security', icon: 'shield',
    desc: '在不改密码情况下调整权限设置', action: 'change-permissions', multi: false,
    params: [
      { type: 'password', name: 'ownerPassword', label: '权限密码' },
      { type: 'switch', name: 'allowPrint', label: '允许打印' },
      { type: 'switch', name: 'allowCopy', label: '允许复制内容' },
      { type: 'switch', name: 'allowEdit', label: '允许编辑' },
      { type: 'switch', name: 'allowAnnotations', label: '允许批注' },
    ],
  },
  {
    id: 'sign', name: '手写签名', cat: 'security', icon: 'pen-tool',
    desc: '在 PDF 上手写/绘制签名并叠加', action: 'sign', multi: false,
    params: [
      { type: 'select', name: 'mode', label: '签名方式', options: [['draw', '画板手绘'], ['upload', '上传签名图片']] },
      { type: 'text', name: 'page', label: '所在页（默认末页）', placeholder: '如 1 或 1,3' },
      { type: 'range', name: 'x', label: '水平位置 (%)', min: 0, max: 90, step: 1, value: 70 },
      { type: 'range', name: 'y', label: '垂直位置 (%)', min: 0, max: 90, step: 1, value: 10 },
      { type: 'range', name: 'scale', label: '大小 (%)', min: 5, max: 50, step: 1, value: 20 },
    ],
  },
  {
    id: 'cert-sign', name: '证书签名', cat: 'security', icon: 'certificate',
    desc: '用 PKCS12 数字证书对 PDF 签名', action: 'cert-sign', multi: false,
    params: [
      { type: 'file', name: 'cert', label: '证书文件 (.pfx/.p12)', accept: '.pfx,.p12' },
      { type: 'password', name: 'certPassword', label: '证书密码' },
      { type: 'text', name: 'reason', label: '签名原因（可选）', placeholder: '如 已审阅' },
      { type: 'text', name: 'location', label: '地点（可选）' },
    ],
  },
  {
    id: 'remove-cert-sign', name: '移除证书签名', cat: 'security', icon: 'x',
    desc: '移除 PDF 上的数字证书签名域', action: 'remove-cert-sign', multi: false,
    params: [],
  },
  {
    id: 'validate-signature', name: '校验签名', cat: 'security', icon: 'award',
    desc: '验证 PDF 签名是否有效、是否被篡改', action: 'validate-signature', multi: false,
    params: [],
    hint: '输出每个签名的校验结果与证书信息。',
  },
  {
    id: 'watermark', name: '添加水印', cat: 'security', icon: 'droplet',
    desc: '添加文字或图片水印（防泄密）', action: 'watermark', multi: false,
    params: [
      { type: 'select', name: 'type', label: '水印类型', options: [['text', '文字'], ['image', '图片']] },
      { type: 'text', name: 'text', label: '水印文字', placeholder: '内部资料 请勿外传', when: { type: 'text' } },
      { type: 'select', name: 'place', label: '位置', options: [['center', '居中'], ['tile', '平铺'], ['top', '顶部'], ['bottom', '底部']] },
      { type: 'range', name: 'opacity', label: '透明度 (%)', min: 5, max: 100, step: 5, value: 30 },
      { type: 'range', name: 'size', label: '字号', min: 8, max: 80, step: 2, value: 24, when: { type: 'text' } },
      { type: 'select', name: 'pages', label: '应用范围', options: [['all', '全部页面'], ['first', '仅首页'], ['custom', '自定义页码']] },
      { type: 'text', name: 'pageRange', label: '页码（自定义时填写）', placeholder: '如 1-3', when: { pages: 'custom' } },
    ],
    hint: '体制内文件外发前建议加“内部资料”水印。',
  },
  {
    id: 'sanitize', name: '清理元数据', cat: 'security', icon: 'eraser',
    desc: '移除隐藏元数据与敏感信息', action: 'sanitize', multi: false,
    params: [
      { type: 'switch', name: 'removeMetadata', label: '清除文档元数据' },
      { type: 'switch', name: 'removeEmbedded', label: '移除内嵌文件/链接' },
      { type: 'switch', name: 'removeComments', label: '移除批注与表单' },
    ],
  },
  {
    id: 'redact', name: '内容脱敏', cat: 'security', icon: 'eraser',
    desc: '永久遮盖指定文字/区域（不可恢复）', action: 'redact', multi: false,
    params: [
      { type: 'text', name: 'keywords', label: '要遮盖的关键词', placeholder: '用逗号分隔，如 姓名,身份证' },
      { type: 'select', name: 'color', label: '遮盖颜色', options: [['black', '黑'], ['red', '红']] },
    ],
    hint: '脱敏为不可逆操作，请确认后再下载。',
  },
  {
    id: 'timestamp', name: '时间戳签名', cat: 'security', icon: 'bookmark',
    desc: '为 PDF 添加可信时间戳（TSA）', action: 'timestamp', multi: false,
    params: [
      { type: 'text', name: 'tsaUrl', label: 'TSA 服务地址', placeholder: 'https://...' },
    ],
  },

  /* ===================== 内容与编辑 Content & Editing ===================== */
  {
    id: 'add-attachments', name: '添加附件', cat: 'edit', icon: 'paperclip',
    desc: '向 PDF 嵌入附件文件', action: 'add-attachments', multi: false,
    params: [
      { type: 'file', name: 'attachment', label: '附件文件', accept: '*' },
      { type: 'switch', name: 'embed', label: '嵌入到文档（非链接）' },
    ],
  },
  {
    id: 'add-stamp', name: '添加印章', cat: 'edit', icon: 'stamp',
    desc: '在 PDF 上加盖图片印章', action: 'add-stamp', multi: false,
    params: [
      { type: 'file', name: 'stamp', label: '印章图片', accept: '.png,.jpg,.svg' },
      { type: 'text', name: 'page', label: '所在页（默认全部）', placeholder: '如 1 或 1,3' },
      { type: 'range', name: 'x', label: '水平位置 (%)', min: 0, max: 90, step: 1, value: 75 },
      { type: 'range', name: 'y', label: '垂直位置 (%)', min: 0, max: 90, step: 1, value: 15 },
      { type: 'range', name: 'scale', label: '大小 (%)', min: 5, max: 60, step: 1, value: 25 },
      { type: 'select', name: 'rotate', label: '旋转', options: [['0', '0°'], ['90', '90°'], ['180', '180°'], ['270', '270°']] },
    ],
    hint: '红头文件、审批单常用。',
  },
  {
    id: 'extract-images', name: '提取图片', cat: 'edit', icon: 'images',
    desc: '从 PDF 中抽取全部内嵌图片', action: 'extract-images', multi: false,
    params: [
      { type: 'select', name: 'format', label: '输出格式', options: [['original', '原格式'], ['png', 'PNG'], ['jpg', 'JPG']] },
    ],
  },
  {
    id: 'change-metadata', name: '编辑元数据', cat: 'edit', icon: 'file-info',
    desc: '修改标题、作者、主题等文档属性', action: 'change-metadata', multi: false,
    params: [
      { type: 'text', name: 'title', label: '标题' },
      { type: 'text', name: 'author', label: '作者' },
      { type: 'text', name: 'subject', label: '主题' },
      { type: 'text', name: 'keywords', label: '关键词（逗号分隔）' },
    ],
  },
  {
    id: 'remove-annotations', name: '清除批注', cat: 'edit', icon: 'message-square',
    desc: '移除所有批注、高亮与表单域', action: 'remove-annotations', multi: false,
    params: [
      { type: 'switch', name: 'keepLinks', label: '保留超链接' },
    ],
  },
  {
    id: 'replace-color', name: '替换颜色', cat: 'edit', icon: 'palette',
    desc: '替换 PDF 中的文字/背景颜色', action: 'replace-color', multi: false,
    params: [
      { type: 'color', name: 'from', label: '原颜色' },
      { type: 'color', name: 'to', label: '替换为' },
    ],
    hint: '适合把扫描件的深色背景转浅色护眼。',
  },
  {
    id: 'pdf-info', name: 'PDF 信息', cat: 'edit', icon: 'file-info',
    desc: '查看页数、大小、元数据等概览', action: 'pdf-info', multi: false,
    params: [],
    hint: '只读分析，不修改文件。',
  },
  {
    id: 'text-editor', name: '文本编辑', cat: 'edit', icon: 'type',
    desc: '直接编辑 PDF 中的文字内容', action: 'text-editor', multi: false,
    params: [
      { type: 'textarea', name: 'content', label: '修改后的文本内容（按页）' },
    ],
    hint: '基于 PDF 文本层编辑，复杂排版请谨慎。',
  },
  {
    id: 'toc', name: '编辑目录', cat: 'edit', icon: 'list-tree',
    desc: '添加或修改 PDF 书签/目录', action: 'toc', multi: false,
    params: [
      { type: 'textarea', name: 'entries', label: '目录条目（每行：页码 标题）', placeholder: '1 第一章\n3 第二章' },
    ],
  },
  {
    id: 'flatten', name: '表单压平', cat: 'edit', icon: 'file-minus',
    desc: '把表单/批注压平为静态内容（锁定）', action: 'flatten', multi: false,
    params: [
      { type: 'switch', name: 'keepText', label: '保留可复制文字' },
    ],
    hint: '压平后表单不可再填写，适合定稿归档。',
  },

  /* ===================== 高级 Advanced ===================== */
  {
    id: 'overlay', name: 'PDF 叠加', cat: 'advanced', icon: 'layers',
    desc: '将背景/模板 PDF 与文件叠加', action: 'overlay', multi: false,
    params: [
      { type: 'file', name: 'background', label: '背景/模板 PDF', accept: '.pdf' },
      { type: 'select', name: 'mode', label: '叠加模式', options: [['over', '前景覆盖'], ['under', '作为背景']] },
    ],
  },
  {
    id: 'booklet', name: '小册子拼版', cat: 'advanced', icon: 'booklet',
    desc: '排版为可对折打印的小册子', action: 'booklet', multi: false,
    params: [
      { type: 'select', name: 'pageSize', label: '纸张', options: [['A4', 'A4'], ['A3', 'A3'], ['LETTER', 'Letter']] },
      { type: 'switch', name: 'doubleSided', label: '双面打印' },
    ],
  },
  {
    id: 'adjust-scale', name: '调整页面缩放', cat: 'advanced', icon: 'ruler',
    desc: '整体缩放页面内容比例', action: 'adjust-scale', multi: false,
    params: [
      { type: 'range', name: 'scale', label: '缩放比例 (%)', min: 20, max: 400, step: 5, value: 100 },
    ],
  },
  {
    id: 'adjust-contrast', name: '调整对比度', cat: 'advanced', icon: 'contrast',
    desc: '增强扫描件清晰度（灰度/对比）', action: 'adjust-contrast', multi: false,
    params: [
      { type: 'range', name: 'contrast', label: '对比度', min: -100, max: 100, step: 5, value: 0 },
      { type: 'range', name: 'brightness', label: '亮度', min: -100, max: 100, step: 5, value: 0 },
      { type: 'switch', name: 'grayscale', label: '转为灰度' },
    ],
  },
  {
    id: 'auto-rename', name: '按内容重命名', cat: 'advanced', icon: 'tag',
    desc: '依据 PDF 关键词自动重命名文件', action: 'auto-rename', multi: true,
    params: [
      { type: 'text', name: 'pattern', label: '命名规则', placeholder: '如 {author}_{title}' },
    ],
  },
  {
    id: 'show-js', name: '查看内嵌脚本', cat: 'advanced', icon: 'code',
    desc: '提取并展示 PDF 内嵌 JavaScript', action: 'show-js', multi: false,
    params: [],
    hint: '用于安全审计，排查可疑脚本。',
  },
  {
    id: 'scanner-split', name: '扫描件切分', cat: 'advanced', icon: 'scan',
    desc: '把一页多份扫描件切分为独立页', action: 'scanner-split', multi: false,
    params: [
      { type: 'select', name: 'layout', label: '每页份数', options: [['2', '1 页 2 份'], ['4', '1 页 4 份']] },
    ],
  },
  {
    id: 'repair', name: '修复 PDF', cat: 'advanced', icon: 'file-check',
    desc: '尝试修复损坏或无法打开的 PDF', action: 'repair', multi: false,
    params: [
      { type: 'switch', name: 'rebuild', label: '重建结构' },
    ],
    hint: '文件打不开时优先尝试此功能。',
  },
  {
    id: 'unlock-forms', name: '解锁表单', cat: 'advanced', icon: 'unlock',
    desc: '解除表单域的锁定限制', action: 'unlock-forms', multi: false,
    params: [],
  },

  /* ===================== 其他 Other ===================== */
  {
    id: 'ocr', name: 'OCR 文字识别', cat: 'other', icon: 'text-recognition',
    desc: '扫描件识别为可搜索/可复制文字', action: 'ocr', multi: false,
    params: [
      { type: 'select', name: 'lang', label: '识别语言', options: [['chi_sim', '中文（简）'], ['eng', '英文'], ['chi_sim+eng', '中英文']] },
      { type: 'switch', name: 'deskew', label: '自动纠斜' },
      { type: 'switch', name: 'searchable', label: '保留原图（可搜索层）' },
    ],
    hint: '需服务器安装 OCR 引擎（如 OCRmyPDF + Tesseract）。',
  },
  {
    id: 'compare', name: '文档比较', cat: 'other', icon: 'git-compare',
    desc: '逐页对比两份 PDF 的差异', action: 'compare', multi: true,
    params: [
      { type: 'switch', name: 'highlight', label: '高亮差异区域' },
    ],
    hint: '上传两份文件（原稿 + 修改稿）。',
  },
  {
    id: 'read-annotate', name: '阅读与批注', cat: 'other', icon: 'message-square',
    desc: '在线阅读 PDF 并添加高亮/批注', action: 'read-annotate', multi: false,
    params: [],
    hint: '轻量预览与标注，结果可导出。',
  },

  /* ===================== PDFPatcher 能力 ===================== */
  {
    id: 'inspect-structure', name: '文档结构分析', cat: 'other', icon: 'layers',
    desc: '以树视图探查 PDF 对象结构与页面节点', action: 'inspect-structure', multi: false,
    params: [],
    hint: '仿 PDFPatcher 结构分析，展示对象类型、子类型与关键字。',
  },
  {
    id: 'export-xml', name: '导出 XML 结构', cat: 'other', icon: 'code',
    desc: '将 PDF 文档结构导出为 XML 文件', action: 'export-xml', multi: false,
    params: [],
    hint: '导出对象树为 XML，便于二次处理或排查。',
  },
  {
    id: 'edit-bookmarks', name: '书签编辑器', cat: 'other', icon: 'bookmark',
    desc: '批量修改、自动生成或查找替换书签', action: 'edit-bookmarks', multi: false,
    params: [
      { type: 'select', name: 'mode', label: '模式',
        options: [['auto', '自动生成（每页一个）'], ['replace', '查找替换']] },
      { type: 'text', name: 'prefix', label: '书签前缀', placeholder: '如“第”', when: { mode: 'auto' } },
      { type: 'text', name: 'find', label: '查找内容', placeholder: '被替换的文本', when: { mode: 'replace' } },
      { type: 'text', name: 'replace', label: '替换为', placeholder: '新文本', when: { mode: 'replace' } },
      { type: 'switch', name: 'regex', label: '使用正则表达式', when: { mode: 'replace' } },
    ],
    hint: '仿 PDFPatcher 书签编辑器，支持批量改属性与自动生成。',
  },
  {
    id: 'replace-fonts', name: '字体替换 / 嵌入', cat: 'other', icon: 'type',
    desc: '嵌入中文字库，解决复制乱码与 Kindle 阅读', action: 'replace-fonts', multi: false,
    params: [
      { type: 'file', name: 'font', label: '字体文件（可选，默认系统黑体）', accept: '.ttf,.ttc,.otf' },
    ],
    hint: '未指定字体时自动嵌入系统黑体（SimHei），消除复制乱码。',
  },
  {
    id: 'remove-actions', name: '移除文档动作', cat: 'other', icon: 'shield',
    desc: '清除自动打开网页、打开文档等动作', action: 'remove-actions', multi: false,
    params: [
      { type: 'switch', name: 'openAction', label: '移除打开文档动作' },
      { type: 'switch', name: 'pageActions', label: '移除页面动作' },
      { type: 'switch', name: 'links', label: '同时移除页面链接' },
    ],
    hint: '仿 PDFPatcher 移除自动打开网页等动作，消除安全隐患。',
  },
];

/* ---------- 便捷查询 ---------- */
export function getPdfTool(id) {
  return PDF_TOOLS.find(t => t.id === id) || null;
}
export function getPdfCategory(id) {
  return PDF_CATEGORIES.find(c => c.id === id) || null;
}
