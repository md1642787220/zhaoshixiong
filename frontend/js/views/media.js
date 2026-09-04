/* ============================================================
 * views/media.js - 音视频素材下载（合并页）
 * 三个子功能以标签页切换：
 *   1) 从视频提取音频：本地音视频文件 -> WebM 音频（浏览器本地录制）
 *   2) 视频素材下载：视频源链接 -> 解析后下载视频
 *   3) 音频素材下载：视频源链接 -> 解析音频/视频下载
 *
 * "从视频提取音频"完全在浏览器本地完成（MediaRecorder），无需后端 / ffmpeg。
 * ============================================================ */
import { mediaApi } from '../api/media.js';
import { extractAudio, recorderSupported } from '../utils/recorder.js';
import { toolPage } from './toolLayout.js';
import { setupDropzone } from '../components/dropzone.js';
import { icon } from '../components/icon.js';
import { setStatus, stripExt, fmtSize } from '../utils.js';

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

/** 解析时间输入："90" / "00:01:30" / "1:30" -> 秒数，空或非法返回 null */
function parseTimeInput(v) {
  v = (v || '').trim();
  if (!v) return null;
  if (!/^\d{1,3}(:\d{1,2}){0,2}(\.\d+)?$/.test(v)) return null;
  return v.split(':').reduce((acc, x) => acc * 60 + parseFloat(x), 0);
}

/** 读取剪辑输入框原始值（不校验大小关系） */
function readClipValues(startId, endId) {
  return {
    start: parseTimeInput($(startId).value),
    end: parseTimeInput($(endId).value),
  };
}

/** 读取并校验剪辑起止时间 */
function readClipRange(startId, endId) {
  const { start, end } = readClipValues(startId, endId);
  if (start != null && end != null && end <= start) {
    throw new Error('结束时间必须大于开始时间');
  }
  return { start, end };
}

/** 从解析出的视频列表里挑一个适合预览的直链 */
function pickPreviewUrl(videos) {
  if (!videos || !videos.length) return '';
  const playable = videos.find((it) => it.hasAudio && it.height && it.height <= 1080) || videos[0];
  return playable ? playable.url : '';
}

/** 剪辑时间输入控件 HTML */
function clipInputs(prefix) {
  return `
  <div class="time-row">
    <div class="field">
      <label>开始时间（可留空，提取整段）</label>
      <input id="${prefix}-start" class="input" placeholder="如 90 或 00:01:30">
    </div>
    <div class="field">
      <label>结束时间（可留空）</label>
      <input id="${prefix}-end" class="input" placeholder="如 150 或 00:02:30">
    </div>
  </div>`;
}

/** 视频预览区 HTML */
function previewArea(id) {
  return `<div class="media-preview-wrap"><video id="${id}" class="media-preview" controls playsinline hidden></video></div>`;
}

/* ---------- 子面板 HTML ---------- */

function extractPanel() {
  return `
  <div id="au-warn"></div>
  <div class="dropzone" id="au-drop">
    <span class="dz-icon">${icon('film', 32)}${icon('arrow-right', 20)}${icon('music', 32)}</span>
    <span class="dz-main">拖拽音视频文件到此处，或点击选择</span>
    <span class="dz-sub">支持 MP4 / MOV / AVI / MKV / MP3 等，浏览器本地提取音轨（WebM）</span>
    <input type="file" id="au-input" accept="video/*,audio/*" hidden>
  </div>
  <p class="fileinfo" id="au-info">尚未选择文件</p>
  ${previewArea('au-video')}
  ${clipInputs('au')}
  <button class="btn btn-primary" id="au-btn" disabled>提取音频（浏览器本地处理）</button>
  <div class="status" id="au-status"></div>
  <div id="au-result"></div>`;
}

function clipPanel() {
  return `
  <div id="vd-warn"></div>
  <div class="music-form">
    <label class="music-label" for="vd-input">视频源链接</label>
    <div class="music-input-row">
      <span class="music-input-icon">${icon('film', 18)}</span>
      <input
        type="text"
        id="vd-input"
        class="music-input"
        placeholder="粘贴视频链接，解析后可预览并下载片段"
        autocomplete="off"
        maxlength="500"
      >
      <button class="btn btn-primary" id="vd-btn">解析</button>
    </div>
    <p class="music-hint muted">
      支持 B 站、YouTube、抖音等主流平台链接，解析后预览并选择时间段下载。
    </p>
  </div>
  ${previewArea('vd-video')}
  ${clipInputs('vd')}
  <div class="status" id="vd-status"></div>
  <div id="vd-result"></div>`;
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
  ${clipInputs('ms')}
  <div class="status" id="ms-status"></div>
  <div id="ms-result"></div>`;
}

const TAB_DEFS = [
  { id: 'extract', name: '从视频提取音频', icon: 'music' },
  { id: 'clip', name: '视频素材下载', icon: 'film' },
  { id: 'music', name: '音频素材下载', icon: 'globe' },
];

function body() {
  const tabs = TAB_DEFS.map((t, i) =>
    `<button type="button" class="media-tab${i === 0 ? ' active' : ''}" data-tab="${t.id}">${icon(t.icon, 16)} ${t.name}</button>`
  ).join('');

  return `
  <div class="media-tabs" id="md-tabs">${tabs}</div>
  <div class="media-panel" data-panel="extract">${extractPanel()}</div>
  <div class="media-panel" data-panel="clip" hidden>${clipPanel()}</div>
  <div class="media-panel" data-panel="music" hidden>${sourcePanel()}</div>`;
}

/** 浏览器本地录制能力检测：不支持时给两个面板加提示 */
function checkSupportBanner() {
  let html = '';
  const ok = recorderSupported()
    && (!MediaRecorder.isTypeSupported
      || MediaRecorder.isTypeSupported('video/webm')
      || MediaRecorder.isTypeSupported('audio/webm'));
  if (!ok) {
    html = `<div class="banner warn">${icon('alert-triangle', 15)} 当前浏览器不支持本地录制（MediaRecorder），请使用最新版 Chrome / Edge。</div>`;
  }
  $('#au-warn').innerHTML = html;
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
    let range;
    try { range = readClipRange('#au-start', '#au-end'); }
    catch (e) { setStatus(status, 'err', e.message); return; }

    setStatus(status, 'processing', '正在本地提取音频，请在预览中确认…');
    btn.disabled = true;
    result.innerHTML = '';
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    try {
      const { blob } = await extractAudio(file, range.start, range.end);
      const fname = `${stripExt(file.name) || 'audio'}-音频.webm`;
      resultUrl = URL.createObjectURL(blob);
      result.innerHTML = `
        <audio controls src="${resultUrl}" style="width:100%"></audio>
        <div class="dl-row">
          <a class="btn btn-primary" href="${resultUrl}" download="${fname}">下载音频（WebM）</a>
          <span class="muted">已在本地完成，未上传服务器</span>
        </div>`;
      setStatus(status, 'ok', `提取完成：${fmtSize(blob.size)} WebM 音频，可在上方预览或下载`);
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
  const status = $('#vd-status');
  const result = $('#vd-result');
  const video = $('#vd-video');
  let resolved = null;

  function render() {
    if (!resolved) return;
    const { start, end } = readClipValues('#vd-start', '#vd-end');
    result.innerHTML = renderVideoResult(resolved, start, end);
  }

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
      const videos = data.videos || [];
      if (!videos.length) {
        setStatus(status, 'err', '该链接未解析到可下载的视频');
        return;
      }
      resolved = data;
      const previewUrl = pickPreviewUrl(videos);
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
      setStatus(status, 'ok', `解析完成：视频 ${videos.length} 项，选择时间段后点击下载`);
    } catch (e) {
      setStatus(status, 'err', e.message || '解析失败，请稍后重试');
    } finally {
      btn.disabled = false;
    }
  }

  $('#vd-start').addEventListener('input', render);
  $('#vd-end').addEventListener('input', render);
  btn.addEventListener('click', resolve);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') resolve();
  });
  input.focus();
}

/* ---------- 音频素材下载：视频源链接解析 ---------- */

/** 文件名安全化：去非法字符，限长度 */
function safeName(name) {
  return String(name || '素材').replace(/[\\/:*?"<>|\r\n]/g, '').trim().slice(0, 80) || '素材';
}

/** 渲染解析结果：素材信息 + 音频/视频两组下载项 */
function renderSourceResult(data, start = null, end = null) {
  const meta = [
    data.uploader ? `作者：${data.uploader}` : '',
    data.duration ? `时长：${fmtDuration(data.duration)}` : '',
  ].filter(Boolean).join(' · ');

  const clipNote = (start != null || end != null)
    ? `<p class="ms-clip-note muted">已设置下载片段：${fmtDuration(start || 0)} - ${end != null ? fmtDuration(end) : '结束'}</p>`
    : '';

  const list = (items, kind) => (items || []).map(it => `
    <a
      class="ms-dl-item"
      href="${mediaApi.downloadUrl(it, `${safeName(data.title)}.${it.ext}`, data.pageUrl, start, end)}"
      download
      target="_blank"
      rel="noopener"
    >
      ${icon(kind === 'audio' ? 'music' : 'film', 16)}
      <span class="ms-dl-label">${it.label}</span>
      <span class="ms-dl-go">${icon('download', 16)}</span>
    </a>`).join('');

  return `
  <div class="ms-result-card">
    <div class="ms-result-head">
      ${data.thumbnail ? `<img class="ms-thumb" src="${data.thumbnail}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      <div class="ms-result-info">
        <h3 class="ms-title">${data.title || '未命名素材'}</h3>
        ${meta ? `<p class="ms-meta muted">${meta}</p>` : ''}
      </div>
    </div>
    ${clipNote}
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

/** 渲染视频解析结果：只展示视频下载项 */
function renderVideoResult(data, start = null, end = null) {
  const meta = [
    data.uploader ? `作者：${data.uploader}` : '',
    data.duration ? `时长：${fmtDuration(data.duration)}` : '',
  ].filter(Boolean).join(' · ');

  const clipNote = (start != null || end != null)
    ? `<p class="ms-clip-note muted">已设置下载片段：${fmtDuration(start || 0)} - ${end != null ? fmtDuration(end) : '结束'}</p>`
    : '';

  const list = (data.videos || []).map(it => `
    <a
      class="ms-dl-item"
      href="${mediaApi.downloadUrl(it, `${safeName(data.title)}.${it.ext}`, data.pageUrl, start, end)}"
      download
      target="_blank"
      rel="noopener"
    >
      ${icon('film', 16)}
      <span class="ms-dl-label">${it.label}</span>
      <span class="ms-dl-go">${icon('download', 16)}</span>
    </a>`).join('');

  return `
  <div class="ms-result-card">
    <div class="ms-result-head">
      ${data.thumbnail ? `<img class="ms-thumb" src="${data.thumbnail}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      <div class="ms-result-info">
        <h3 class="ms-title">${data.title || '未命名素材'}</h3>
        ${meta ? `<p class="ms-meta muted">${meta}</p>` : ''}
      </div>
    </div>
    ${clipNote}
    <div class="ms-group">
      <div class="ms-group-title">${icon('film', 15)} 视频下载</div>
      ${list}
    </div>
  </div>`;
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
    const { start, end } = readClipValues('#ms-start', '#ms-end');
    result.innerHTML = renderSourceResult(resolved, start, end);
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
      setStatus(status, 'ok', `解析完成：音频 ${audios.length} 项 / 视频 ${videos.length} 项，选择时间段后点击下载`);
    } catch (e) {
      setStatus(status, 'err', e.message || '解析失败，请稍后重试');
    } finally {
      btn.disabled = false;
    }
  }

  $('#ms-start').addEventListener('input', render);
  $('#ms-end').addEventListener('input', render);
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

    checkSupportBanner();
    bindExtract();
    bindClip();
    bindSource();
  },
};
