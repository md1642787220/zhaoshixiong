/* ============================================================
 * core/config.js - 全局配置
 * 职责：集中管理前端可变参数，其他模块不得硬编码这些值。
 * ============================================================ */

/**
 * 后端 API 地址
 * - 同源部署（后端托管前端静态页）留空字符串
 * - 前后端分离部署时改为后端地址，如 'http://localhost:3000'
 */
export const API = '';

/** API 基础路径 */
export const API_BASE = '/api';

/**
 * 音乐素材解析是否使用前端占位数据
 * 后端接口 GET /api/music/resolve 就绪后，将此值改为 false 即可切换到真实接口，
 * 无需改动其他任何模块。
 */
export const MUSIC_USE_MOCK = true;

/** 模拟接口延迟（毫秒），仅占位数据模式下生效，便于体验加载状态 */
export const MOCK_LATENCY = 400;

/** WebSocket 基础地址（同源部署时自动推导协议与主机） */
export const WS_BASE = (() => {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  let host = location.host;
  // 本地开发兼容：浏览器常把 `localhost` 解析为 IPv6 `::1`，但很多后端（尤其 Node
  // 绑 0.0.0.0）只接受 IPv4，WebSocket 不会自动回退到 IPv4，导致握手失败。
  // hostname 为 localhost / ::1 时，统一把 WS 主机换成 127.0.0.1（强制走 IPv4）。
  if (location.hostname === 'localhost' || location.hostname === '::1') {
    host = '127.0.0.1' + (location.port ? ':' + location.port : '');
  }
  return `${proto}//${host}`;
})();
