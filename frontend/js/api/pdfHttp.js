/* ============================================================
 * api/pdfHttp.js - 通过 HTTP 分块上传调用 PDF 工具（大文件高速通道）
 * 适用场景：文件较大（>5MB）时，用 multipart 上传 + 流式返回，
 *           避免 WebSocket 单帧大消息带来的内存膨胀与易断问题。
 * 相比 WebSocket 通道：有「上传进度」，但无「转换中页码进度」。
 * 使用相对路径 /api/pdf/...，由托管本页面的后端代理到 PDF Worker。
 * ============================================================ */

/**
 * @param {string} action  后端 action，如 convert-office
 * @param {File} file       待处理的文件
 * @param {object} params   表单参数
 * @param {(p:object)=>void} onProgress 进度回调（仅上传阶段）
 * @returns {Promise<{blob: Blob, filename: string}>}
 */
export function processPdfHttp(action, file, params, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null && v !== '') fd.append(k, String(v));
    });

    const xhr = new XMLHttpRequest();
    const url = `/api/pdf/${encodeURIComponent(action)}`;
    xhr.open('POST', url);
    xhr.responseType = 'blob';

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress({ type: 'progress', percent: pct, message: `上传中 ${pct}%` });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = xhr.response;
        let filename = (file.name || 'converted').replace(/\.[^.]+$/, '') + '.docx';
        const cd = xhr.getResponseHeader('Content-Disposition') || '';
        const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
        if (m) {
          try { filename = decodeURIComponent(m[1]); } catch { filename = m[1]; }
        }
        resolve({ blob, filename });
        return;
      }
      // 失败：尝试读取后端返回的 JSON 错误信息
      const reader = new FileReader();
      reader.onload = () => {
        let msg = `处理失败（${xhr.status}）`;
        try {
          const j = JSON.parse(String(reader.result));
          if (j && j.message) msg = j.message;
        } catch { /* 非 JSON，保留默认信息 */ }
        reject(new Error(msg));
      };
      reader.readAsText(xhr.response);
    };

    xhr.onerror = () => reject(new Error('网络错误，请确认后端已启动'));
    xhr.ontimeout = () => reject(new Error('请求超时，请稍后重试'));
    xhr.send(fd);
  });
}
