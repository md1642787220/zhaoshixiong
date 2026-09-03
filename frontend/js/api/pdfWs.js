/* ============================================================
 * api/pdfWs.js - 通过 WebSocket 调用 PDF 工具（带实时进度）
 * 协议（与后端 /ws/pdf 代理、Python worker 一致）：
 *   1) 连接 /ws/pdf?action=xxx
 *   2) 发送 meta(JSON):   { type:'meta', filename, params }
 *   3) 发送文件二进制(可多帧)
 *   4) 发送 { type:'end' }
 *   后端返回：
 *     { type:'progress', page, pageTotal, message } 实时进度
 *     { type:'done', filename }                      文件即将到达
 *     <二进制帧>                                      文件内容(可多帧)
 *     { type:'final' }                               文件结束
 *     { type:'error', message }                      失败
 * ============================================================ */
import { WS_BASE } from '../core/config.js';

/**
 * @param {string} action  后端 action，如 convert-office
 * @param {File} file       待处理的文件
 * @param {object} params   表单参数
 * @param {(p:object)=>void} onProgress 进度回调
 * @returns {Promise<{blob: Blob, filename: string}>}
 */
export function processPdfWs(action, file, params, onProgress) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const resolveOnce = (v) => { if (!settled) { settled = true; resolve(v); } };
    const rejectOnce = (e) => { if (!settled) { settled = true; reject(e); } };
    const ws = new WebSocket(`${WS_BASE}/ws/pdf?action=${encodeURIComponent(action)}`);
    const docxParts = [];
    let expectingFile = false;
    let filename = 'converted.docx';

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'meta', filename: file.name, params }));
      file.arrayBuffer()
        .then((buf) => {
          ws.send(buf);
          ws.send(JSON.stringify({ type: 'end' }));
        })
        .catch((e) => rejectOnce(e));
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === 'progress') {
          onProgress && onProgress(msg);
        } else if (msg.type === 'done') {
          expectingFile = true;
          if (msg.filename) filename = msg.filename;
        } else if (msg.type === 'final') {
          const blob = new Blob(docxParts, {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
          resolveOnce({ blob, filename });
          try { ws.close(); } catch {}
        } else if (msg.type === 'error') {
          rejectOnce(new Error(msg.message || '转换失败'));
        }
      } else if (expectingFile) {
        docxParts.push(ev.data);
      }
    };

    ws.onerror = () => rejectOnce(new Error('WebSocket 连接失败，请确认后端已启动'));
    ws.onclose = () => {
      // 未进入文件接收阶段、且尚未完成即关闭（如文件过大被服务端断开）→ 明确报错，避免界面永久卡住
      if (!settled && !expectingFile && docxParts.length === 0) {
        rejectOnce(new Error('连接已关闭，转换未完成（可能文件过大导致服务端断开）'));
      }
    };
  });
}
