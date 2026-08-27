# Helper 助手

一个为**教师、公务员及体制内员工**量身打造的实用工具箱网站，前后端分离架构，帮助日常工作更高效、更规范。

## 功能总览

### 工具板块

| 工具 | 说明 |
|------|------|
| 🔄 格式转换 | Markdown → HTML、JSON → CSV、CSV → JSON 等常见格式互转 |
| 🎵 音频提取 | 从视频文件中提取音轨，导出 192kbps MP3 |
| 🎬 视频提取 | 按起止时间段裁剪视频片段（会议录像、课程视频快速截取） |
| 📄 文本提取 | 从 PDF / TXT / MD / CSV / JSON 文件中提取纯文本 |

### PDF 工具（功能对齐开源 Stirling-Tools/stirling-pdf，前端已就绪、接口预留）

共 **57 个工具**，按官方 6 大分类组织（数据见 `frontend/js/data/pdfTools.js`）：

- **格式转换（9）**：PDF→Office(Word/Excel/PPT)、Office→PDF、PDF→PDF/A、PDF→HTML、HTML→PDF、Markdown→PDF、PDF→图片、图片→PDF、PDF→演示文稿
- **页面操作（12）**：合并、拆分、旋转、自动纠偏、提取页面、重排页面、添加页码、删除页面、删除空白页、裁剪、多页布局、拼成长页
- **安全与签名（12）**：加密、解密、修改权限、手写签名、证书签名、移除证书签名、校验签名、水印、清理元数据、内容脱敏、时间戳签名
- **内容与编辑（10）**：添加附件、添加印章、提取图片、编辑元数据、清除批注、替换颜色、PDF 信息、文本编辑、编辑目录、表单压平
- **高级处理（9）**：PDF 叠加、小册子拼版、调整缩放、调整对比度、按内容重命名、查看内嵌脚本、扫描件切分、修复、解锁表单
- **其他（3）**：OCR 文字识别、文档比较、阅读批注

> 所有工具前端交互（上传 + 参数表单 + 提交）已完整实现，提交统一调用 `POST /api/pdf/:action`；后端接口目前为占位 stub（返回"待实现"），可逐工具接入 pdf-lib / LibreOffice / OCRmyPDF / qpdf 等引擎。

### 学习板块

- **Office/WPS 专区**：办公软件技巧、函数速查、排版规范
- **课件模板**：中小学课件、班会、说课、公开课模板
- **教育文件板块**：课程标准、政策文件、评审材料汇编
- **公文写作板块**：法定公文格式、写作要点、常用表述
- **提升专区**：计算机等级考试、教资考试、雅思托福等备考资料

## 技术栈

- **前端**：原生 HTML / CSS / JavaScript（ES Module 模块化，hash 路由，无构建依赖）
- **后端**：Node.js + Express + Multer（文件上传）+ Marked（Markdown 解析）+ pdf-parse（PDF 解析）
- **音视频处理**：调用系统 ffmpeg（可选，未安装时功能自动降级并给出提示）

### 架构说明：前端先行、接口预留

前端已实现全部页面显示与交互，所有后端调用集中在 `js/api/` 层封装：

- **学习板块**：后端未启动 / 未实现时自动降级到 `js/data/learn.js` 本地数据，页面展示不受影响；
- **工具板块**：接口全部留好（见 `js/api/tools.js` 顶部约定注释），后端可逐步实现，前端无需改动；
- 后端就绪后，仅需在 `js/config.js` 中配置 API 地址即可（同源部署留空）。

## 快速开始

```bash
# 1. 安装后端依赖
cd backend
npm install

# 2. 启动服务（默认端口 3000，自动托管前端页面）
npm start
```

启动后访问：<http://localhost:3000>

> 音频提取 / 视频提取需要服务器安装 [ffmpeg](https://ffmpeg.org/download.html) 并加入 PATH；
> 未安装时其余功能不受影响，相关工具页会显示友好提示。

## 项目结构

```
helper/
├── frontend/                       # 前端（静态单页应用，模块化）
│   ├── index.html                  # 页面骨架
│   ├── css/
│   │   ├── base.css                # 主题变量 / 重置 / 按钮 / 卡片基础
│   │   ├── layout.css              # 导航 / 页脚 / Hero / 页头
│   │   ├── components.css          # 表单 / 上传区 / 状态提示 / 表格 / Toast
│   │   └── pages.css               # 工具卡片 / 详情布局 / 学习专区
│   └── js/
│       ├── app.js                  # 应用入口
│       ├── config.js               # 全局配置（API 地址）
│       ├── router.js               # hash 路由器
│       ├── utils.js                # 通用工具函数
│       ├── api/                    # 接口层（前后端唯一耦合点）
│       │   ├── client.js           # fetch 封装（JSON / 文件上传）
│       │   ├── tools.js            # 工具接口（转换/音视频/文本）
│       │   └── learn.js            # 学习接口（失败自动降级本地数据）
│       ├── data/                   # 前端静态数据
│       │   ├── tools.js            # 工具配置
│       │   └── learn.js            # 学习板块降级数据
│       ├── components/
│       │   └── dropzone.js         # 拖拽上传组件
│       └── views/                  # 视图模块（render + mount）
│           ├── home.js             # 首页
│           ├── tools.js            # 工具列表页
│           ├── toolLayout.js       # 工具详情页公共布局
│           ├── convert.js          # 格式转换
│           ├── audio.js            # 音频提取
│           ├── video.js            # 视频提取
│           ├── text.js             # 文本提取
│           ├── learn.js            # 学习板块列表
│           ├── category.js         # 学习分类详情
│           └── notfound.js         # 404
├── backend/                        # 后端（Express API）
│   ├── server.js                   # 服务入口（含静态托管与 CORS）
│   ├── routes/
│   │   ├── tools.js                # 工具板块 API（转换/音视频/文本提取）
│   │   └── learn.js                # 学习板块 API
│   └── data/learn.json             # 学习专区资源数据
├── zhaoshixiong/                   # 相关资源目录
└── README.md
```

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | /api/health | 健康检查 |
| GET  | /api/tools/status | 服务与 ffmpeg 依赖状态 |
| POST | /api/tools/convert | 格式转换（type: md2html / json2csv / csv2json） |
| POST | /api/tools/audio-extract | 上传视频 → 返回 MP3 音频 |
| POST | /api/tools/video-clip | 上传视频 + 起止时间 → 返回片段 |
| POST | /api/tools/text-extract | 上传 PDF/TXT 等 → 返回纯文本 |
| GET  | /api/learn/categories | 学习板块分类列表 |
| GET  | /api/learn/categories/:id | 分类详情与资源列表 |
| POST | /api/pdf/:action | PDF 工具统一入口（57 个 action，详见 `backend/routes/pdf.js`） |

前后端分离部署时，修改 `frontend/js/config.js` 中的 `API` 常量为后端地址即可（后端已开启 CORS）。

---

如有功能建议或需求，欢迎提出。
