/* ============================================================
 * utils/recorder.js - 纯前端音视频录制（MediaRecorder）
 * 不依赖任何后端 / ffmpeg：利用浏览器原生解码 + MediaRecorder
 * 实时录制用户指定的时间段。
 *
 * 说明：
 *  - 输出 WebM 容器（音频 opus / 视频 vp8-vp9），非精确字节裁剪，
 *    区间误差约 ±0.25s（基于 timeupdate 事件），满足基础编辑需求。
 *  - 录制为「实时」过程：会实际播放到该时间段后才生成片段。
 * ============================================================ */

/** 选择浏览器支持的录制 MIME */
function pickMime(kind) {
  const cands = kind === 'video'
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return cands.find((m) => {
    try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
  }) || '';
}

/** 浏览器能力检测 */
export function recorderSupported() {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLMediaElement !== 'undefined';
}

/**
 * 从媒体文件提取音轨，录制为音频 WebM
 * @param {File} file
 * @param {number|null} startSec
 * @param {number|null} endSec
 * @returns {Promise<{blob: Blob, mime: string}>}
 */
export function extractAudio(file, startSec, endSec) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const isVideo = (file.type || '').startsWith('video');
    const media = isVideo ? document.createElement('video') : new Audio();
    if (isVideo) { media.src = url; media.muted = true; media.playsInline = true; }
    else { media.src = url; }

    let ctx;
    const cleanup = () => {
      try { if (ctx && ctx.state !== 'closed') ctx.close(); } catch {}
      URL.revokeObjectURL(url);
    };

    media.addEventListener('loadedmetadata', () => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error('当前浏览器不支持 Web Audio');
        ctx = new AC();
        const srcNode = ctx.createMediaElementSource(media);
        const dest = ctx.createMediaStreamDestination();
        srcNode.connect(dest);
        srcNode.connect(ctx.destination); // 允许试听
        const mime = pickMime('audio');
        const rec = new MediaRecorder(dest.stream, mime ? { mimeType: mime } : undefined);
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onerror = () => { cleanup(); reject(new Error('录制过程出错')); };
        rec.onstop = () => {
          cleanup();
          resolve({ blob: new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), mime: rec.mimeType || 'audio/webm' });
        };
        const stopAt = endSec != null ? endSec : (isFinite(media.duration) ? media.duration : Infinity);
        const onTime = () => {
          if (media.currentTime >= Math.max(0, stopAt - 0.05)) {
            media.removeEventListener('timeupdate', onTime);
            try { media.pause(); } catch {}
            rec.stop();
          }
        };
        media.addEventListener('timeupdate', onTime);
        const begin = startSec != null ? startSec : 0;
        const seekReady = () => {
          if (ctx.state === 'suspended') ctx.resume();
          media.play().then(() => rec.start()).catch((e) => { cleanup(); reject(e); });
        };
        if (begin > 0 && isFinite(media.duration)) {
          media.currentTime = begin;
          media.addEventListener('seeked', seekReady, { once: true });
        } else {
          seekReady();
        }
      } catch (e) { cleanup(); reject(e); }
    });
    media.addEventListener('error', () => { cleanup(); reject(new Error('无法读取该文件，请确认格式受浏览器支持')); });
  });
}

/**
 * 从视频文件按时间段截取片段，录制为视频 WebM（含音轨）
 * @returns {Promise<{blob: Blob, mime: string}>}
 */
export function clipVideo(file, startSec, endSec) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.muted = false; // 保留声音以便录制音轨
    video.playsInline = true;

    const cleanup = () => URL.revokeObjectURL(url);

    video.addEventListener('loadedmetadata', () => {
      try {
        const capture = video.captureStream || video.webkitCaptureStream;
        if (typeof capture !== 'function') {
          throw new Error('当前浏览器不支持视频流捕获，请使用最新版 Chrome / Edge');
        }
        const stream = capture.call(video);
        const mime = pickMime('video');
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onerror = () => { cleanup(); reject(new Error('录制过程出错')); };
        rec.onstop = () => {
          cleanup();
          resolve({ blob: new Blob(chunks, { type: rec.mimeType || 'video/webm' }), mime: rec.mimeType || 'video/webm' });
        };
        const stopAt = endSec != null ? endSec : (isFinite(video.duration) ? video.duration : Infinity);
        const onTime = () => {
          if (video.currentTime >= Math.max(0, stopAt - 0.05)) {
            video.removeEventListener('timeupdate', onTime);
            try { video.pause(); } catch {}
            rec.stop();
          }
        };
        video.addEventListener('timeupdate', onTime);
        const begin = startSec != null ? startSec : 0;
        const seekReady = () => {
          video.play().then(() => rec.start()).catch((e) => { cleanup(); reject(e); });
        };
        if (begin > 0 && isFinite(video.duration)) {
          video.currentTime = begin;
          video.addEventListener('seeked', seekReady, { once: true });
        } else {
          seekReady();
        }
      } catch (e) { cleanup(); reject(e); }
    });
    video.addEventListener('error', () => { cleanup(); reject(new Error('无法读取该视频文件，请确认格式受浏览器支持')); });
  });
}
