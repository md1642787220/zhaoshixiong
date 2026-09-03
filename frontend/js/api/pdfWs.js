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
        .catch((e) => reject(e));
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
          resolve({ blob, filename });
          try { ws.close(); } catch {}
        } else if (msg.type === 'error') {
          reject(new Error(msg.message || '转换失败'));
        }
      } else if (expectingFile) {
        docxParts.push(ev.data);
      }
    };

    ws.onerror = () => reject(new Error('WebSocket 连接失败，请确认后端已启动'));
    ws.onclose = () => {
      if (!expectingFile && docxParts.length === 0) {
        // 未进入文件接收阶段即关闭（已被 error/reject 处理的情况忽略）
      }
    };
  });
}
