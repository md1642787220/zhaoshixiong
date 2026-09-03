/* ============================================================
 * views/video.js - 视频提取（片段截取）工具
 * ============================================================ */
import { toolsApi } from '../api/tools.js';
import { toolPage } from './toolLayout.js';
import { setupDropzone } from '../components/dropzone.js';
import { icon } from '../components/icon.js';
import { downloadBlob, setStatus, stripExt } from '../utils.js';

const $ = (sel) => document.querySelector(sel);

function body() {
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
  title: '视频提取 · 师兄',
  nav: '/tools',

  render() {
    return toolPage('video', body());
  },

  mount() {
    checkFfmpegBanner($('#vd-warn'));

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
  },
};
