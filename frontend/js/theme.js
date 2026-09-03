/* ============================================================
 * theme.js - 主题切换与持久化
 * 职责：读取/保存用户所选主题并应用到 <html data-theme>，
 *      提供导航栏主题面板的开关与选择交互。
 *      新增主题只需在 base.css 追加 [data-theme="xxx"] 并在
 *      index.html 的 .theme-menu 中加一个 .swatch 即可。
 * ============================================================ */
const STORAGE_KEY = 'shixiong-theme';
const DEFAULT_THEME = 'mist';

export function initTheme() {
  applyTheme(localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME);

  const toggle = document.getElementById('themeToggle');
  const menu = document.getElementById('themeMenu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  menu.querySelectorAll('.swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      localStorage.setItem(STORAGE_KEY, theme);
      menu.hidden = true;
    });
  });

  // 点击面板外部自动收起
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== toggle) {
      menu.hidden = true;
    }
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const menu = document.getElementById('themeMenu');
  if (menu) {
    menu.querySelectorAll('.swatch').forEach((b) =>
      b.classList.toggle('active', b.dataset.theme === theme));
  }
}
