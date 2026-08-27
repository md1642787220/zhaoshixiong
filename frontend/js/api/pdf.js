/* ============================================================
 * api/pdf.js - PDF 工具接口（预留）
 *
 * 后端约定（待实现）：
 *   POST /api/pdf/:toolId
 *   multipart/form-data:
 *     files[]     上传的文件（1 个或多个）
 *     <其他参数>  与前端参数表单一一对应（level / password / ranges…）
 *   响应：处理后的文件流（Blob），或打包 zip（拆分 / 多文件结果）
 *
 * 后端实现后前端零改动即可使用。
 * ============================================================ */
import { API, API_BASE } from '../config.js';

export const pdfApi = {
  /** 能力清单：{ action: { available, source } } */
  async capabilities() {
    const res = await fetch(`${API}${API_BASE}/pdf/capabilities`);
    const data = await res.json().catch(() => ({}));
    return data.capabilities || {};
  },

  /**
   * 通用 PDF 处理
   * @param {string} toolId  工具标识，如 merge / compress / pdf-to-word
   * @param {File[]} files   上传的文件列表
   * @param {object} params  参数表单值
   * @returns {Promise<Blob>} 处理结果文件
   */
  async process(toolId, files, params = {}) {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    Object.entries(params).forEach(([k, v]) => fd.append(k, v));

    const res = await fetch(`${API}${API_BASE}/pdf/${toolId}`, {
      method: 'POST',
      body: fd,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `请求失败（${res.status}）`);
    }
    return res.blob();
  },
};
