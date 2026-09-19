/* ============================================================
 * views/media.js - 音视频素材下载（合并页）
 * 三个子功能以标签页切换：
 *   1) 从视频提取音频：本地音视频文件 -> 后端 ffmpeg 提取 MP3
 *   2) 视频素材下载：视频源链接 -> 解析后下载视频
 *   3) 音频素材下载：视频源链接 -> 解析音频/视频下载
 *
 * "从视频提取音频"上传至 pdf-worker，由 ffmpeg 提取音频（MP3）。
 * ============================================================ */
import { mediaApi } from '../api/media.js';
import { toolPage } from './toolLayout.js';
import { setupDropzone } from '../components/dropzone.js';
import { icon } from '../components/icon.js';
import { setStatus, stripExt, fmtSize, esc } from '../utils.js';
import { featureIntro } from '../components/featureIntro.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/** 秒数格式化为 mm:ss 或 h:mm:ss */
function fmtDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 从解析出的视频列表里挑一个适合预览的直链 */
function pickPreviewUrl(videos) {
  if (!videos || !videos.length) return '';
  const playable = videos.find((it) => it.hasAudio && it.height && it.height <= 1080) || videos[0];
  return playable ? playable.url : '';
}

/** 视频预览区 HTML */
function previewArea(id) {
  return `<div class="media-preview-wrap"><video id="${id}" class="media-preview" controls playsinline hidden></video></div>`;
}

/* ---------- 子面板 HTML ---------- */

function extractPanel() {
  return `
  <div class="dropzone" id="au-drop">
    <span class="dz-icon">${icon('film', 32)}${icon('arrow-right', 20)}${icon('music', 32)}</span>
    <span class="dz-main">拖拽音视频文件到此处，或点击选择</span>
    <span class="dz-sub">支持 MP4 / MOV / AVI / MKV / MP3 等，上传后由服务器 ffmpeg 提取音轨（MP3）</span>
    <input type="file" id="au-input" accept="video/*,audio/*" hidden>
  </div>
  <p class="fileinfo" id="au-info">尚未选择文件</p>
  ${previewArea('au-video')}
  <button class="btn btn-primary" id="au-btn" disabled>提取音频（浏览器本地处理）</button>
  <div class="status" id="au-status"></div>
  <div id="au-result"></div>`;
}

/**
 * 支持的平台（图标用品牌色徽章 + 单字符：离线可用、不依赖外部图片与 CDN，
 * 避免 favicon 防盗链导致的破图；如需换成官方 logo，替换 icon 字段为 <img> 即可）
 */
const PLATFORMS = [
  { name: '自动识别', color: '#3f9e6a', glyph: '✓' },
  { name: '抖音', color: '#010101', glyph: '♪' },
  { name: '哔哩哔哩', color: '#fb7299', glyph: 'B' },
  { name: '快手', color: '#ff6a00', glyph: 'K' },
  { name: '微博', color: '#e6162d', glyph: '微' },
  { name: '绿洲', color: '#3fae8e', glyph: '绿' },
  { name: '小红书', color: '#ff2442', glyph: '书' },
  { name: '汽水音乐', color: '#00c8c8', glyph: '♪' },
  { name: '皮皮搞笑', color: '#e6483d', glyph: '皮' },
  { name: '皮皮虾', color: '#f5442c', glyph: '虾' },
  { name: '火山', color: '#ff4d4f', glyph: '火' },
  { name: '微视', color: '#e69500', glyph: '视' },
  { name: '西瓜视频', color: '#f04142', glyph: '西' },
  { name: '最右', color: '#e6a700', glyph: '右' },
  { name: '度小视', color: '#4e6ef2', glyph: '度' },
  { name: '梨视频', color: '#00a862', glyph: '梨' },
  { name: '虎牙', color: '#e08a00', glyph: '虎' },
  { name: 'AcFun', color: '#fd4c5b', glyph: 'A' },
  { name: '美拍', color: '#ff4f9a', glyph: '美' },
  { name: '逗拍', color: '#00bfbf', glyph: '逗' },
  { name: '全民K歌', color: '#00c1de', glyph: 'K' },
  { name: '六间房', color: '#8b5cf6', glyph: '6' },
  { name: '新片场', color: '#2ec66d', glyph: '片' },
  { name: '好看视频', color: '#3b82f6', glyph: '好' },
  { name: 'X', color: '#010101', glyph: 'X' },
  { name: 'TikTok', color: '#010101', glyph: 'T' },
];

/** 平台图标墙 */
function platformWall() {
  return `<div class="vd-plats">
    <div class="vd-plats-head">支持平台（粘贴链接后自动识别）</div>
    <div class="vd-plats-grid">
      ${PLATFORMS.map((p, i) => `
        <span class="vd-plat${i === 0 ? ' is-auto' : ''}">
          <span class="vd-plat-icon" style="background:${p.color}">${esc(p.glyph)}</span>
          <span class="vd-plat-name">${esc(p.name)}</span>
        </span>`).join('')}
    </div>
  </div>`;
}

function clipPanel() {
  return `
  <div class="vd-top">
    <div class="vd-intro">
      <h3>粘贴视频链接，一键解析下载</h3>
      <p>自动识别来源平台，解析出可直接下载的视频（含清晰度选项），可一次粘贴多个链接批量解析。</p>
    </div>

    <div class="vd-input-wrap">
      <textarea id="vd-input" class="vd-textarea" rows="3"
        placeholder="粘贴视频链接或分享文本，可一次粘贴多个，每行一个"
        autocomplete="off" maxlength="4000"></textarea>
      <div class="vd-input-bar">
        <button type="button" class="btn btn-ghost btn-sm" id="vd-paste">粘贴</button>
        <span class="vd-bar-spacer"></span>
        <button type="button" class="btn btn-primary" id="vd-btn">解析</button>
      </div>
    </div>

    <div class="vd-note">聚合解析：粘贴任一平台分享链接，自动识别来源并给出下载地址。</div>
  </div>

  ${platformWall()}

  <div class="vd-steps" id="vd-steps">
    <div class="vd-step"><span class="vd-step-no">1</span><b>复制分享链接</b><p>在 B 站 / 抖音 / 快手等 App 内点「分享」→「复制链接」。</p></div>
    <div class="vd-step"><span class="vd-step-no">2</span><b>粘贴到框内</b><p>回到本页点「粘贴」或手动粘贴，可多行一次粘贴多个。</p></div>
    <div class="vd-step"><span class="vd-step-no">3</span><b>解析并下载</b><p>点「解析」，选择清晰度点击下载；也可先截取某一段。</p></div>
  </div>

  ${previewArea('vd-video')}

  <div class="status" id="vd-status"></div>
  <div id="vd-result"></div>

  <details class="vd-faq">
    <summary>常见问题</summary>
    <div class="vd-faq-body">
      <p><b>支持哪些平台？</b>B 站、抖音、快手、微博、小红书、YouTube 等主流平台，粘贴后自动识别。</p>
      <p><b>解析失败怎么办？</b>请确认是从 App「分享」复制的完整链接；部分内容因作者设置权限或已删除会无法解析，可稍后重试。</p>
      <p><b>可以一次解析多个吗？</b>可以，每行粘贴一个链接，会依次解析并分别给出下载项。</p>
    </div>
  </details>`;
}

function sourcePanel() {
  return `
  <div class="music-form">
    <label class="music-label" for="ms-input">视频源链接</label>
    <div class="music-input-row">
      <span class="music-input-icon">${icon('globe', 18)}</span>
      <input
        type="text"
        id="ms-input"
        class="music-input"
        placeholder="粘贴视频源链接，解析后可下载音频/视频片段"
        autocomplete="off"
        maxlength="500"
      >
      <button class="btn btn-primary" id="ms-btn">解析</button>
    </div>
    <p class="music-hint muted">
      支持各视频平台链接，粘贴后点击解析，即可获取该素材的音频与视频下载地址。
    </p>
  </div>
  ${previewArea('ms-video')}
  <div class="status" id="ms-status"></div>
  <div id="ms-result"></div>`;
}

const TAB_DEFS = [
  { id: 'extract', name: '从视频提取音频', icon: 'music' },
  { id: 'clip', name: '视频素材下载', icon: 'film' },
  { id: 'music', name: '音频素材下载', icon: 'globe' },
];

/** 三个标签页各自的一句话说明（切换标签即可看到） */
const TAB_INTROS = {
  extract: '把电脑里的视频文件抽出声音、存成 MP3。比如把一段讲课录像变成音频，路上也能听。',
  clip: '粘贴一个视频网址，自动识别来源并解析出可直接下载的视频；也可以只截取其中一小段保存。',
  music: '粘贴一个视频网址，只把里面的声音存下来，适合收集背景音乐、课件配乐。',
};

function body() {
  const tabs = TAB_DEFS.map((t, i) =>
    `<button type="button" class="media-tab${i === 0 ? ' active' : ''}" data-tab="${t.id}">${icon(t.icon, 16)} ${t.name}</button>`
  ).join('');

  const panel = (id, html, hidden) => `
  <div class="media-panel" data-panel="${id}"${hidden ? ' hidden' : ''}>
    ${featureIntro(TAB_INTROS[id], { title: '这个标签页是干什么的？' })}
    ${html}
  </div>`;

  return `
  <div class="media-tabs" id="md-tabs">${tabs}</div>
  ${panel('extract', extractPanel())}
  ${panel('clip', clipPanel(), true)}
  ${panel('music', sourcePanel(), true)}`;
}

/* ---------- 各子功能交互 ---------- */

function bindExtract() {
  const btn = $('#au-btn');
  const status = $('#au-status');
  const result = $('#au-result');
  const video = $('#au-video');
  let file = null;
  let fileUrl = null;
  let resultUrl = null;

  setupDropzone($('#au-drop'), $('#au-input'), $('#au-info'), (f) => {
    file = f;
    btn.disabled = false;
    result.innerHTML = '';
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    const oldUrl = fileUrl;
    fileUrl = URL.createObjectURL(f);
    video.src = fileUrl;
    video.hidden = false;
    video.load();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
  });

  btn.addEventListener('click', async () => {
    if (!file) return;

    setStatus(status, 'processing', '正在上传并提取音频，请稍候…');
    btn.disabled = true;
    result.innerHTML = '';
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    try {
      const blob = await mediaApi.extractAudio(file);
      const fname = `${stripExt(file.name) || 'audio'}-音频.mp3`;
      resultUrl = URL.createObjectURL(blob);
      result.innerHTML = `
        <audio controls src="${resultUrl}" style="width:100%"></audio>
        <div class="dl-row">
          <a class="btn btn-primary" href="${resultUrl}" download="${fname}">下载音频（MP3）</a>
          <span class="muted">由服务器 ffmpeg 提取完成</span>
        </div>`;
      setStatus(status, 'ok', `提取完成：${fmtSize(blob.size)} MP3 音频，可在上方预览或下载`);
    } catch (e) {
      setStatus(status, 'err', e.message || '提取失败');
    } finally {
      btn.disabled = false;
    }
  });
}

function bindClip() {
  const input = $('#vd-input');
  const btn = $('#vd-btn');
  const pasteBtn = $('#vd-paste');
  const status = $('#vd-status');
  const result = $('#vd-result');
  const video = $('#vd-video');
  const steps = $('#vd-steps');
  /** 解析结果项：成功为解析数据，失败为 { url, error } */
  let items = [];
  /** 绘制进度条上的「选中区间」高亮，并刷新下方提示文案 */
  function render() {
    if (!items.length) return;
    result.innerHTML = items.map((it) => (it.error
      ? `<div class="ms-result-card vd-error">
           <p class="vd-error-title">解析失败：${esc(it.error)}</p>
           <p class="vd-error-url">${esc(it.url)}</p>
         </div>`
      : renderVideoResult(it))).join('');
  }

  /** 从输入框提取链接：每行一个，行内自动截取 http(s) 链接（兼容分享文本） */
  function parseLinks() {
    return input.value
      .split(/[\r\n]+/)
      .map((line) => {
        const m = line.match(/https?:\/\/[^\s，,]+/i);
        return m ? m[0] : '';
      })
      .filter(Boolean);
  }

  async function resolveAll() {
    const links = parseLinks();
    if (!links.length) {
      setStatus(status, 'err', '请先粘贴视频链接（支持多行，每行一个）');
      result.innerHTML = '';
      input.focus();
      return;
    }

    setStatus(status, 'processing', '正在解析，请稍候…');
    btn.disabled = true;
    btn.textContent = '解析中…';
    result.innerHTML = '';
    video.hidden = true;
    video.removeAttribute('src');
    items = [];
    if (steps) steps.hidden = true;

    let ok = 0;
    for (let i = 0; i < links.length; i += 1) {
      setStatus(status, 'processing', `正在解析第 ${i + 1}/${links.length} 条…`);
      try {
        const data = await mediaApi.resolve(links[i]);
        if ((data.videos || []).length) { items.push(data); ok += 1; }
        else items.push({ url: links[i], error: '该链接未解析到可下载的视频' });
      } catch (e) {
        items.push({ url: links[i], error: e.message || '解析失败，请稍后重试' });
      }
      render();
    }

    // 预览：取第一个成功且有可播放直链的结果
    const first = items.find((it) => !it.error && (it.videos || []).length);
    const previewUrl = first ? pickPreviewUrl(first.videos) : '';
    if (previewUrl) {
      video.src = previewUrl;
      video.hidden = false;
      video.load();
      video.onerror = () => {
        video.hidden = true;
        setStatus(status, 'warn', '当前链接不支持在线预览，可直接下载');
      };
    }

    btn.disabled = false;
    btn.textContent = '解析';
    if (ok) setStatus(status, 'ok', `解析完成：成功 ${ok} / ${links.length} 条，选择清晰度即可下载`);
    else setStatus(status, 'err', '全部解析失败，请检查链接是否正确或稍后重试');
  }

  /* 一键粘贴：读取剪贴板（非安全上下文会失败，此时提示手动粘贴） */
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) { setStatus(status, 'warn', '剪贴板为空，请先复制视频链接'); return; }
      input.value = input.value.trim() ? `${input.value.trim()}\n${text}` : text;
      setStatus(status, '', '');
      input.focus();
    } catch {
      setStatus(status, 'warn', '浏览器未授权读取剪贴板，请手动粘贴（Ctrl+V）');
      input.focus();
    }
  });

  btn.addEventListener('click', resolveAll);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); resolveAll(); }
  });
  input.focus();
}

/* ---------- 音频素材下载：视频源链接解析 ---------- */

/** 文件名安全化：去非法字符，限长度 */
function safeName(name) {
  return String(name || '素材').replace(/[\\/:*?"<>|\r\n]/g, '').trim().slice(0, 80) || '素材';
}

/** 渲染解析结果：素材信息 + 音频/视频两组下载项 */
function renderSourceResult(data) {
  const meta = [
    data.uploader ? `作者：${data.uploader}` : '',
    data.duration ? `时长：${fmtDuration(data.duration)}` : '',
  ].filter(Boolean).join(' · ');

  // B站 / YouTube 等采用 DASH 音视频分离：视频流本身不含声音，音频是独立的一条。
  // 明确提示用户，避免误以为「视频损坏」或「工具不支持」。
  const hasVideoOnly = (data.videos || []).some((it) => it.hasAudio === false);
  const dashTip = hasVideoOnly
    ? `<p class="ms-clip-note muted">说明：该平台把画面与声音分开存储（DASH），视频流本身不含音轨。下方视频项点击后会由服务端自动挑选并合并音轨（需先下载再合并，文件越大等待越久）；音频也可在下方单独下载。</p>`
    : '';

  const list = (items, kind) => (items || []).map(it => {
    // 视频流若本身无音轨（DASH 分离流），改走服务端「合并下载」：
    // 由 yt-dlp 挑同清晰度视频 + 最佳音频，再用 ffmpeg 合并，避免下载到无声文件。
    const merged = kind === 'video' && it.hasAudio === false;
    const href = merged
      ? mediaApi.mergedDownloadUrl(it, `${safeName(data.title)}.mp4`, data.pageUrl)
      : mediaApi.downloadUrl(it, `${safeName(data.title)}.${it.ext}`, data.pageUrl);
    return `
    <a
      class="ms-dl-item"
      href="${href}"
      download
      target="_blank"
      rel="noopener"
    >
      ${icon(kind === 'audio' ? 'music' : 'film', 16)}
      <span class="ms-dl-label">${it.label}</span>
      <span class="ms-dl-go">${icon('download', 16)}</span>
    </a>`;
  }).join('');

  return `
  <div class="ms-result-card">
    <div class="ms-result-head">
      ${data.thumbnail ? `<img class="ms-thumb" src="${data.thumbnail}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      <div class="ms-result-info">
        <h3 class="ms-title">${data.title || '未命名素材'}</h3>
        ${meta ? `<p class="ms-meta muted">${meta}</p>` : ''}
      </div>
    </div>
    ${dashTip}
    ${(data.audios || []).length ? `
      <div class="ms-group">
        <div class="ms-group-title">${icon('music', 15)} 音频下载</div>
        ${list(data.audios, 'audio')}
      </div>` : ''}
    ${(data.videos || []).length ? `
      <div class="ms-group">
        <div class="ms-group-title">${icon('film', 15)} 视频下载</div>
        ${list(data.videos, 'video')}
      </div>` : ''}
  </div>`;
}

/** 渲染视频解析结果（保留函数名以兼容调用处）：
 *  统一委托给 renderSourceResult —— 原实现只循环 data.videos、整块丢弃音频，
 *  导致 B站/YouTube 这类 DASH 分离流的页面里看不到任何音频项。 */
function renderVideoResult(data) {
  return renderSourceResult(data);
}

function bindSource() {
  const input = $('#ms-input');
  const btn = $('#ms-btn');
  const status = $('#ms-status');
  const result = $('#ms-result');
  const video = $('#ms-video');
  let resolved = null;

  function render() {
    if (!resolved) return;
    result.innerHTML = renderSourceResult(resolved);
  }

  /** 解析：校验 → 请求 → 渲染 */
  async function resolve() {
    const url = input.value.trim();
    if (!/^https?:\/\//i.test(url)) {
      setStatus(status, 'err', '请输入以 http(s):// 开头的视频源链接');
      result.innerHTML = '';
      input.focus();
      return;
    }

    setStatus(status, 'processing', '正在解析视频源，请稍候…');
    result.innerHTML = '';
    video.hidden = true;
    video.src = '';
    resolved = null;
    btn.disabled = true;

    try {
      const data = await mediaApi.resolve(url);
      const audios = data.audios || [];
      const videos = data.videos || [];
      if (!audios.length && !videos.length) {
        setStatus(status, 'err', '该链接未解析到可下载的音频或视频');
        return;
      }
      resolved = data;
      const previewUrl = pickPreviewUrl(videos.length ? videos : []);
      if (previewUrl) {
        video.src = previewUrl;
        video.hidden = false;
        video.load();
        video.onerror = () => {
          video.hidden = true;
          setStatus(status, 'warn', '当前链接不支持在线预览，可直接下载');
        };
      }
      render();
      setStatus(status, 'ok', `解析完成：音频 ${audios.length} 项 / 视频 ${videos.length} 项，点击即可下载`);
    } catch (e) {
      setStatus(status, 'err', e.message || '解析失败，请稍后重试');
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', resolve);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') resolve();
  });
  input.focus();
}

export default {
  title: '音视频素材下载 · 师兄',
  nav: '/tools',

  render() {
    return toolPage('media', body());
  },

  mount() {
    /* 标签页切换 */
    $$('#md-tabs .media-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('#md-tabs .media-tab').forEach(t => t.classList.toggle('active', t === tab));
        $$('.media-panel').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
      });
    });

    bindExtract();
    bindClip();
    bindSource();
  },
};
