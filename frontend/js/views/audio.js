/* ============================================================
 * views/audio.js - 音频提取工具
 * ============================================================ */
import { toolsApi } from '../api/tools.js';
import { toolPage } from './toolLayout.js';
import { setupDropzone } from '../components/dropzone.js';
import { icon } from '../components/icon.js';
import { downloadBlob, setStatus, stripExt } from '../utils.js';

const $ = (sel) => document.querySelector(sel);

function body() {
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

/** ffmpeg 依赖检测：不可用时给出提示（接口已留好，后端补装即可） */
async function checkFfmpegBanner(warnEl) {
  try {
    const { ffmpeg } = await toolsApi.status();
    if (!ffmpeg) {
      warnEl.innerHTML = `<div class="banner warn">${icon('alert-triangle', 15)} 服务器未检测到 ffmpeg，本工具暂不可用。请安装 ffmpeg 并重启后端服务。</div>`;
    }
  } catch {
    warnEl.innerHTML = `<div class="banner info">${icon('info', 15)} 后端服务未连接，接口已预留——后端就绪后本工具即可使用。</div>`;
  }
}

export default {
  title: '音频提取 · 师兄',
  nav: '/tools',

  render() {
    return toolPage('audio', body());
  },

  mount() {
    checkFfmpegBanner($('#au-warn'));

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
  },
};
