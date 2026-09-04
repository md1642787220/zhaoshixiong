/* ============================================================
 * views/media.js - 音视频素材下载（合并页）
 * 三个子功能以标签页切换：
 *   1) 音频提取：视频 -> MP3（192kbps）
 *   2) 视频截取：按起止时间裁剪片段
 *   3) 音乐素材解析：素材名称 -> 下载链接
 * ============================================================ */
import { toolsApi } from '../api/tools.js';
import { musicApi } from '../api/music.js';
import { normalizeKeyword, parseMusicResult } from '../services/musicParser.js';
import {
  musicResultCard,
  musicEmptyState,
  musicLoadingState,
} from '../components/musicResult.js';
import { toolPage } from './toolLayout.js';
import { setupDropzone } from '../components/dropzone.js';
import { icon } from '../components/icon.js';
import { downloadBlob, setStatus, stripExt } from '../utils.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* ---------- 子面板 HTML ---------- */

function extractPanel() {
  return `
  <div id="au-warn"></div>
  <div class="dropzone" id="au-drop">
    <span class="dz-icon">${icon('film', 32)}${icon('arrow-right', 20)}${icon('music', 32)}</span>
    <span class="dz-main">拖拽视频文件到此处，或点击选择</span>
    <span class="dz-sub">支持 MP4 / AVI / MOV / MKV 等常见格式，将提取音轨为 MP3</span>
    <input type="file" id="au-input" accept="video/*" hidden>
  </div>
  <p class="fileinfo" id="au-info">尚未选择文件</p>
  <button class="btn btn-primary" id="au-btn" disabled>提取音频（MP3 · 192kbps）</button>
  <div class="status" id="au-status"></div>`;
}

function clipPanel() {
  return `
  <div id="vd-warn"></div>
  <div class="dropzone" id="vd-drop">
    <span class="dz-icon">${icon('scissors', 30)}${icon('film', 32)}</span>
    <span class="dz-main">拖拽视频文件到此处，或点击选择</span>
    <span class="dz-sub">支持 MP4 / AVI / MOV / MKV 等常见格式，按时间段截取片段</span>
    <input type="file" id="vd-input" accept="video/*" hidden>
  </div>
  <p class="fileinfo" id="vd-info">尚未选择文件</p>
  <div class="time-row">
    <div class="field">
      <label>开始时间（可留空）</label>
      <input id="vd-start" class="input" placeholder="如 90 或 00:01:30">
    </div>
    <div class="field">
      <label>结束时间（可留空）</label>
      <input id="vd-end" class="input" placeholder="如 150 或 00:02:30">
    </div>
  </div>
  <button class="btn btn-primary" id="vd-btn" disabled>截取视频片段</button>
  <div class="status" id="vd-status"></div>`;
}

function musicPanel() {
  return `
  <div class="music-form">
    <label class="music-label" for="ms-input">音乐素材名称</label>
    <div class="music-input-row">
      <span class="music-input-icon">${icon('music', 18)}</span>
      <input
        type="text"
        id="ms-input"
        class="music-input"
        placeholder="例如：清晨的微风 / 会议开场提示音"
        autocomplete="off"
        maxlength="60"
      >
      <button class="btn btn-primary" id="ms-btn">解析素材</button>
    </div>
    <p class="music-hint muted">
      输入素材名称后点击解析，即可获取该素材的下载链接。
    </p>
  </div>

  <div class="status" id="ms-status"></div>
  <div id="ms-result"></div>`;
}

const TAB_DEFS = [
  { id: 'extract', name: '音频提取', icon: 'music' },
  { id: 'clip', name: '视频截取', icon: 'scissors' },
  { id: 'music', name: '音乐素材', icon: 'music' },
];

function body() {
  const tabs = TAB_DEFS.map((t, i) =>
    `<button type="button" class="media-tab${i === 0 ? ' active' : ''}" data-tab="${t.id}">${icon(t.icon, 16)} ${t.name}</button>`
  ).join('');

  return `
  <div class="media-tabs" id="md-tabs">${tabs}</div>
  <div class="media-panel" data-panel="extract">${extractPanel()}</div>
  <div class="media-panel" data-panel="clip" hidden>${clipPanel()}</div>
  <div class="media-panel" data-panel="music" hidden>${musicPanel()}</div>`;
}

/** ffmpeg 依赖检测：不可用时给音/视频两个面板加提示（接口已留好，后端补装即可） */
async function checkFfmpegBanner() {
  let html = '';
  try {
    const { ffmpeg } = await toolsApi.status();
    if (!ffmpeg) {
      html = `<div class="banner warn">${icon('alert-triangle', 15)} 服务器未检测到 ffmpeg，音视频功能暂不可用。请安装 ffmpeg 并重启后端服务。</div>`;
    }
  } catch {
    html = `<div class="banner info">${icon('info', 15)} 后端服务未连接，接口已预留——后端就绪后即可使用。</div>`;
  }
  $('#au-warn').innerHTML = html;
  $('#vd-warn').innerHTML = html;
}

/* ---------- 各子功能交互（与原独立页面逻辑一致） ---------- */

function bindExtract() {
  const btn = $('#au-btn');
  const status = $('#au-status');
  let file = null;

  setupDropzone($('#au-drop'), $('#au-input'), $('#au-info'), f => {
    file = f;
    btn.disabled = false;
  });

  btn.addEventListener('click', async () => {
    if (!file) return;
    setStatus(status, 'processing', '正在上传并提取音频，请稍候…');
    btn.disabled = true;
    try {
      const blob = await toolsApi.audioExtract(file);
      downloadBlob(blob, `${stripExt(file.name) || 'audio'}-音频.mp3`);
      setStatus(status, 'ok', '提取完成，已开始下载');
    } catch (e) {
      setStatus(status, 'err', e.message);
    } finally {
      btn.disabled = false;
    }
  });
}

function bindClip() {
  const btn = $('#vd-btn');
  const status = $('#vd-status');
  let file = null;

  setupDropzone($('#vd-drop'), $('#vd-input'), $('#vd-info'), f => {
    file = f;
    btn.disabled = false;
  });

  btn.addEventListener('click', async () => {
    if (!file) return;
    const start = $('#vd-start').value.trim();
    const end = $('#vd-end').value.trim();
    if (!start && !end) {
      setStatus(status, 'err', '请至少填写开始或结束时间');
      return;
    }
    setStatus(status, 'processing', '正在上传并截取片段，请稍候…');
    btn.disabled = true;
    try {
      const blob = await toolsApi.videoClip(file, start, end);
      const ext = (file.name.match(/\.[^.]+$/) || ['.mp4'])[0];
      downloadBlob(blob, `${stripExt(file.name) || 'video'}-片段${ext}`);
      setStatus(status, 'ok', '截取完成，已开始下载');
    } catch (e) {
      setStatus(status, 'err', e.message);
    } finally {
      btn.disabled = false;
    }
  });
}

function bindMusic() {
  const input = $('#ms-input');
  const btn = $('#ms-btn');
  const status = $('#ms-status');
  const result = $('#ms-result');

  /** 执行解析：校验 → 取数 → 建模 → 渲染 */
  async function resolve() {
    const { valid, keyword, message } = normalizeKeyword(input.value);

    if (!valid) {
      setStatus(status, 'err', message);
      result.innerHTML = '';
      input.focus();
      return;
    }

    setStatus(status, 'processing', '正在解析素材，请稍候…');
    result.innerHTML = musicLoadingState();
    btn.disabled = true;

    try {
      const raw = await musicApi.resolve(keyword);
      const model = parseMusicResult(raw);

      if (!model) {
        setStatus(status, 'err', '未找到匹配素材');
        result.innerHTML = musicEmptyState(keyword);
        return;
      }

      setStatus(status, 'ok', '解析完成，可点击下载');
      result.innerHTML = musicResultCard(model);
    } catch (e) {
      setStatus(status, 'err', e.message || '解析失败，请稍后重试');
      result.innerHTML = '';
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

    checkFfmpegBanner();
    bindExtract();
    bindClip();
    bindMusic();
  },
};
