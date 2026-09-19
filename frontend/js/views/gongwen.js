/* ============================================================
 * views/gongwen.js - 公文格式规范
 *
 * 三步流程：填写 → 生成并预览 → 确认后下载。
 *
 * 为什么不让后端直接回传文件？
 *   Word 文档无法在浏览器里渲染，若「生成即下载」，用户拿到文件前看不到效果，
 *   一旦层级识别有偏差就得反复重来。因此 worker 的 gongwen-format 返回 JSON
 *   （处理前原文 + 处理后逐段版式 + 文档 base64），前端按 pt / cm 参数渲染出
 *   A4 纸预览，确认无误后再由前端触发下载 —— 保证「预览所见 = 下载所得」。
 *
 * 后端：worker action `gongwen-format`，经 POST /api/pdf/gongwen-format 调用，
 *       后端对 worker 的 JSON 响应原样透传，无需额外改动。
 * ============================================================ */
import { toolPage } from './toolLayout.js';
import { setupDropzone } from '../components/dropzone.js';
import { icon } from '../components/icon.js';
import { setStatus, fmtSize, esc } from '../utils.js';
import { pdfApi } from '../api/pdf.js';

const $ = (sel) => document.querySelector(sel);



/**
 * 版式示例：先静默生成一段固定的示范公文，再用 docx-preview 真实渲染出来。
 *
 * 之前是用 CSS 按参数「画」一张 A4 纸 —— 比例虽然对，但字体、分页、段落细节全是近似值，
 * 看着不够直观。现在直接渲染 Word 文档本身，所见即所得。
 *
 * 下面仍保留一张规格对照表：公文字体属商业字体，本机没装时预览里的字体差异会消失，
 * 用户可照表在 Word 里逐项设置。
 */
function sampleHtml() {
  // 规格表：与上方预览逐层对应，字体没装也能照此设置
  const specRows = [
    ['标题', '方正小标宋简体', '二号 22pt', '居中，段后 10 磅'],
    ['主送机关', '仿宋_GB2312', '三号 16pt', '顶格'],
    ['一级　一、', '黑体', '三号 16pt', '顶格'],
    ['二级　（一）', '楷体_GB2312', '三号 16pt', '顶格'],
    ['三级　1.', '仿宋_GB2312', '三号 16pt', '顶格、加粗'],
    ['正文', '仿宋_GB2312', '三号 16pt', '首行缩进 2 字符'],
    ['落款／日期', '仿宋_GB2312', '三号 16pt', '右对齐'],
  ];

  return `
  <div class="gw-sample">
    <div class="gw-sample-head">
      ${icon('file-check', 15)} 版式示例
      <span class="gw-sample-note">下面是用 Word 渲染引擎预览的真实效果</span>
    </div>

    <div class="gw-sample-body">
      <div class="gw-docx-host gw-docx-sample" id="gw-sample-host">
        <p class="gw-render-fallback">示例加载中…</p>
      </div>

      <table class="gw-spec">
        <thead>
          <tr><th>层级</th><th>字体</th><th>字号</th><th>段落格式</th></tr>
        </thead>
        <tbody>
          ${specRows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>

      <p class="gw-spec-foot">
        全文<b>固定行距 28 磅</b>　·　纸张 <b>A4 210 × 297 mm</b>　·　页边距 <b>上 37 / 下 35 / 左 28 / 右 26 mm</b><br>
        规格表是兜底：本机未安装公文字体时，预览中各层级的字体差异看不出来，可照表在 Word 里逐项设置。
      </p>
    </div>
  </div>`;
}

function body() {
  return `
  <div class="gw-guide">
    按 <b>GB/T 9704-2012</b> 自动排版。层级识别规则：<b>一、</b> → 黑体，<b>（一）</b> → 楷体，
    <b>1.</b> → 仿宋加粗；标题居中、正文首行缩进 2 字符、落款右对齐均自动处理。
    具体的字体、字号与页面规格见下方示例。
  </div>

  <div class="gw-layout">
    <div class="gw-col gw-col-form">
      <div class="field">
        <label>公文正文（可直接粘贴）</label>
        <textarea id="gw-text" class="input gw-textarea" rows="11"
          placeholder="把正文粘贴到这里，第一行会作为标题；也可以用下面的上传区传 Word 文件。"></textarea>
      </div>

      <div class="dropzone" id="gw-drop">
        <span class="dz-icon">${icon('file-info', 30)}</span>
        <span class="dz-main">拖拽 Word 文件到此处，或点击选择</span>
        <span class="dz-sub">支持 .docx / .txt（.doc 请先在 Word 里另存为 .docx）</span>
        <input type="file" id="gw-input" accept=".docx,.txt,.md" hidden>
      </div>
      <p class="fileinfo" id="gw-info">尚未选择文件</p>

      <div class="gw-grid">
        <div class="field">
          <label>标题（留空则取正文首行）</label>
          <input id="gw-title" class="input" placeholder="如：关于开展文明班级评选工作的通知">
        </div>
        <div class="field">
          <label>主送机关（可选，顶格）</label>
          <input id="gw-receiver" class="input" placeholder="如：各年级组、各班主任：">
        </div>
        <div class="field">
          <label>落款单位（可选，右对齐）</label>
          <input id="gw-signer" class="input" placeholder="如：××学校办公室">
        </div>
        <div class="field">
          <label>成文日期（可选，右对齐）</label>
          <input id="gw-date" class="input" placeholder="如：2026年9月19日">
        </div>
      </div>

      <div class="gw-actions">
        <button class="btn btn-primary" id="gw-btn">生成并预览</button>
        <button class="btn btn-ghost" id="gw-dl" hidden>${icon('download', 16)} 下载公文（.docx）</button>
        <span class="gw-actions-tip muted" id="gw-tip">先预览确认版式，再下载</span>
      </div>
      <div class="status" id="gw-status"></div>
    </div>

    <div class="gw-col gw-col-demo">
      ${sampleHtml()}
    </div>
  </div>

  <div id="gw-preview"></div>

  <p class="gw-tip">
    提示：公文规范字体「方正小标宋简体 / 仿宋_GB2312 / 楷体_GB2312」为商业字体，
    需在电脑上自行安装；未安装时 Word 会回退到相近字体，<b>版式结构仍然正确</b>，
    只需在 Word 里把字体改成单位要求的那款即可。
  </p>`;
}

/** base64 → Uint8Array（还原服务端回传的文档字节） */
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** 服务端返回的文档 → Blob（预览与下载共用同一份字节） */
function docxBlob(file) {
  return new Blob([base64ToBytes(file.base64)], { type: file.mime });
}

/**
 * 用 docx-preview 高保真渲染 .docx。
 *
 * 它直接解析 OOXML，还原页边距、行距、字号、对齐、分页等真实排版，
 * 比手写 CSS「画」一张 A4 纸准确得多 —— 预览所见即下载所得。
 * 组件未加载（vendor 缺失）时给出明确提示，不影响生成与下载主流程。
 */
async function renderDocx(file, host) {
  if (!host) return;
  const lib = window.docx;
  if (!lib?.renderAsync) {
    host.innerHTML = '<p class="gw-render-fallback">文档预览组件未加载，'
      + '仍可正常生成与下载，刷新页面可重试。</p>';
    return;
  }
  host.innerHTML = '';
  await lib.renderAsync(docxBlob(file), host, null, {
    className: 'docx',
    inWrapper: true,   // 生成 .docx-wrapper 容器，便于统一控制背景与分页间距
    breakPages: true,
  });
}

/** 示范公文：供「版式示例」静默生成用 */
const SAMPLE_TEXT = [
  '关于开展文明班级评选工作的通知',
  '一、评选范围',
  '本次评选面向全校所有班级，凡符合条件的均可申报。',
  '（一）申报条件',
  '1. 班风正、学风浓，无重大违纪记录。',
  '二、评选办法',
  '由年级组初评后报德育处复审，择优推荐。',
].join('\n');

/** 示例文档缓存：切走再回到本页时不重复请求 */
let sampleDoc = null;

/** 静默生成一段示范公文并渲染，作为页面右侧的版式示例 */
async function loadSample() {
  const host = document.querySelector('#gw-sample-host');
  if (!host) return;
  try {
    if (!sampleDoc) {
      const d = new Date();
      const data = await pdfApi.processJson('gongwen-format', [], {
        text: SAMPLE_TEXT,
        receiver: '各年级组、各班主任：',
        signer: '××学校办公室',
        date: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
      });
      sampleDoc = data.file;
    }
    await renderDocx(sampleDoc, host);
  } catch {
    host.innerHTML = '<p class="gw-render-fallback">示例加载失败，可直接点击「生成并预览」查看效果。</p>';
  }
}

/** 渲染「处理前 / 处理后」双栏：左侧原文，右侧交给 docx-preview 渲染真实文档 */
function previewHtml(pv) {
  const before = (pv.before || []).map((l) => esc(l)).join('\n');
  return `
  <div class="gw-preview">
    <section class="gw-pane">
      <header class="gw-pane-head">
        <span class="gw-pane-title">${icon('file-info', 15)} 处理前</span>
        <span class="gw-pane-sub">原始内容，未套用任何格式</span>
      </header>
      <div class="gw-pane-body">
        <pre class="gw-before-text">${before}</pre>
      </div>
    </section>
    <section class="gw-pane">
      <header class="gw-pane-head">
        <span class="gw-pane-title">${icon('file-check', 15)} 处理后</span>
        <span class="gw-pane-sub">GB/T 9704-2012 · Word 渲染引擎预览</span>
      </header>
      <div class="gw-pane-body gw-docx-host" id="gw-docx-host"></div>
    </section>
  </div>
  <p class="gw-preview-hint">
    右侧为真实文档渲染结果（字体显示取决于本机是否安装公文字体）。确认无误后，点上方「下载公文」。
  </p>`;
}

function bind() {
  const textEl = $('#gw-text');
  const btn = $('#gw-btn');
  const dlBtn = $('#gw-dl');
  const status = $('#gw-status');
  const previewEl = $('#gw-preview');
  const tipEl = $('#gw-tip');
  /** 待下载的文档（服务端返回的 base64），点「下载」时才真正产出文件 */
  let pending = null;
  let file = null;

  setupDropzone($('#gw-drop'), $('#gw-input'), $('#gw-info'), (f) => {
    file = f;
    invalidate();
  });

  /** 输入变化 → 之前的预览作废，避免用户拿着旧预览去下载新内容 */
  function invalidate() {
    if (!pending) return;
    pending = null;
    dlBtn.hidden = true;
    previewEl.innerHTML = '';
    tipEl.textContent = '内容已修改，请重新点击「生成并预览」';
  }

  ['gw-text', 'gw-title', 'gw-receiver', 'gw-signer', 'gw-date'].forEach((id) => {
    $(`#${id}`).addEventListener('input', invalidate);
  });

  async function generate() {
    const text = textEl.value.trim();
    if (!file && !text) {
      setStatus(status, 'err', '请粘贴公文正文，或上传 .docx / .txt 文件');
      textEl.focus();
      return;
    }

    const params = {
      text,
      title: $('#gw-title').value.trim(),
      receiver: $('#gw-receiver').value.trim(),
      signer: $('#gw-signer').value.trim(),
      date: $('#gw-date').value.trim(),
    };

    btn.disabled = true;
    setStatus(status, 'processing', '正在排版…');
    try {
      const data = await pdfApi.processJson('gongwen-format', file ? [file] : [], params);
      pending = data.file;
      previewEl.innerHTML = previewHtml(data.preview || { before: [] });
      // 两栏布局下预览区位于表单下方，生成后主动滚进视野，
      // 免得用户点完按钮看不到任何变化（以为没反应）。
      previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // 用 docx-preview 渲染真实文档；渲染失败不影响下载（文件已经在手）
      const docHost = $('#gw-docx-host');
      renderDocx(pending, docHost).catch(() => {
        docHost.innerHTML = '<p class="gw-render-fallback">文档渲染失败，但文件已生成，可直接下载。</p>';
      });

      const info = pending.size ? `，${fmtSize(pending.size)}` : '';
      dlBtn.hidden = false;
      tipEl.textContent = `已生成：${pending.name}${info}`;
      setStatus(status, 'ok', '排版完成，请对照左右两栏确认效果，无误后点击「下载公文（.docx）」');
    } catch (e) {
      pending = null;
      dlBtn.hidden = true;
      previewEl.innerHTML = '';
      setStatus(status, 'err', e.message || '生成失败，请稍后重试');
    } finally {
      btn.disabled = false;
    }
  }

  /** 真正的下载动作：把 base64 还原为 Blob 再触发保存 */
  function download() {
    if (!pending) return;
    const bin = atob(pending.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: pending.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pending.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus(status, 'ok', `已开始下载：${pending.name}`);
  }

  btn.addEventListener('click', generate);
  dlBtn.addEventListener('click', download);
}

export default {
  title: '公文格式规范 · 师兄',
  nav: '/tools',

  render() {
    return toolPage('gongwen', body());
  },

  mount() {
    bind();
    // 静默生成示例文档并用真实渲染展示，让用户动手前就看到效果
    loadSample();
  },
};
