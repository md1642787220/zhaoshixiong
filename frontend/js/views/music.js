/* ============================================================
 * views/music.js - 音乐素材解析页面
 * 职责：页面编排层——组织表单交互，串联
 *       「解析逻辑(services) → 数据获取(api) → 结果渲染(components)」。
 *       本文件不含具体解析算法、HTTP 细节与 HTML 片段。
 * ============================================================ */
import { musicApi } from '../api/music.js';
import { normalizeKeyword, parseMusicResult } from '../services/musicParser.js';
import {
  musicResultCard,
  musicEmptyState,
  musicLoadingState,
} from '../components/musicResult.js';
import { toolPage } from './toolLayout.js';
import { icon } from '../components/icon.js';
import { setStatus } from '../utils.js';

const $ = (sel) => document.querySelector(sel);

/** 页面主体表单 */
function body() {
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

export default {
  title: '音乐素材解析 · 师兄',
  nav: '/tools',

  render() {
    return toolPage('music', body());
  },

  mount() {
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
  },
};
