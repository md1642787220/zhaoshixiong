/* ============================================================
 * components/keyboardMap.js - 标准键盘示意图（内联 SVG）
 *
 * 用途：常用快捷键页的「图文映射」。相比一张静态图片，这里额外做了三件事：
 *   1. 点键盘上的键 → 只显示用到它的快捷键；可连点多个键组成组合键
 *      （先点 Ctrl 再点 Shift，就只看同时用到这两个键的快捷键）；
 *   2. 鼠标移到某条快捷键上 → 图中对应的键亮起来（与已选中的键用不同底色区分）；
 *   3. 纯矢量绘制，跟着容器缩放，高分屏不糊、不依赖任何图片文件。
 *
 * 按键数据里的 token 用于与 data/shortcuts.js 的 keys 文本对齐，
 * 默认等于键帽文字，特殊情况（空格 / 数字 / 方向键）单独指定。
 * ============================================================ */
import { esc } from '../utils.js';

const U = 44;        // 1u 键宽
const KH = 42;       // 键高
const GAP = 5;       // 键间距
const PAD = 4;       // 画布内边距（避免描边被裁）

/* ---------- 主键盘区（6 行，每行合计 15u） ---------- */
const MAIN_ROWS = [
  [ // 功能键行
    ['Esc', 1], [null, 0.5],
    ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], [null, 0.25],
    ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1], [null, 0.25],
    ['F9', 1], ['F10', 1], ['F11', 1], ['F12', 1], [null, 0.25],
    ['PrtSc', 1],
  ],
  [ // 数字行
    ['`', 1], ['1', 1, '数字'], ['2', 1, '数字'], ['3', 1, '数字'], ['4', 1, '数字'],
    ['5', 1, '数字'], ['6', 1, '数字'], ['7', 1, '数字'], ['8', 1, '数字'],
    ['9', 1, '数字'], ['0', 1, '数字'], ['-', 1], ['=', 1], ['Backspace', 2],
  ],
  [ // QWERTY 行
    ['Tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1],
    ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1.5],
  ],
  [ // ASDF 行
    ['CapsLock', 1.75], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1],
    ['J', 1], ['K', 1], ['L', 1], [';', 1], ["'", 1], ['Enter', 2.25],
  ],
  [ // ZXCV 行
    ['Shift', 2.25], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1],
    ['M', 1], [',', 1], ['.', 1], ['/', 1], ['Shift', 2.75],
  ],
  [ // 底行（含笔记本常见的 Fn 键，Space 相应收窄，整行仍为 15u）
    ['Fn', 1, 'Fn'], ['Ctrl', 1.25], ['Win', 1.25], ['Alt', 1.25], ['Space', 5.25, '空格'],
    ['Alt', 1.25], ['Win', 1.25], ['Menu', 1.25, ''], ['Ctrl', 1.25],
  ],
];

/* ---------- 右侧导航键区（与主键盘行对齐，共 3u 宽） ---------- */
const NAV_ROWS = [
  [],
  [['Ins', 1, ''], ['Home', 1], ['PgUp', 1, 'PageUp']],
  [['Del', 1, 'Delete'], ['End', 1], ['PgDn', 1, 'PageDown']],
  [],
  [[null, 1], ['↑', 1, '方向键'], [null, 1]],
  [['←', 1, '方向键'], ['↓', 1, '方向键'], ['→', 1, '方向键']],
];

const NAV_X = 15.5;                       // 导航区横向起点（单位：u）
const COLS = NAV_X + 3;                   // 总宽 18.5u
const ROWS = MAIN_ROWS.length;            // 6 行
const W = COLS * U;
const HGT = ROWS * (KH + GAP) - GAP;

/** 渲染一行按键（xOffset 单位：px） */
function renderRow(row, rowIndex, xOffset) {
  const y = PAD + rowIndex * (KH + GAP);
  let x = xOffset;
  const parts = [];

  for (const item of row) {
    if (!item) continue;
    const width = item[1];
    // 留空占位（[null, n]）
    if (item[0] === null) { x += width * U; continue; }

    const label = item[0];
    // token === undefined 时用键帽文字；显式给 '' 表示该键不参与筛选
    const token = item.length > 2 ? item[2] : label;
    const wpx = width * U - GAP;
    const fs = label.length <= 2 ? 13.5 : (label.length <= 4 ? 12 : 10.5);
    const attrs = token
      ? ` data-token="${esc(token)}" role="button" tabindex="0" aria-label="${esc(token)} 键"`
      : '';

    parts.push(
      `<g class="kbd-key${token ? ' is-clickable' : ''}"${attrs}>`
      + `<rect x="${PAD + x}" y="${y}" width="${wpx}" height="${KH}" rx="5"/>`
      + `<text x="${PAD + x + wpx / 2}" y="${y + KH / 2}" font-size="${fs}">${esc(label)}</text>`
      + '</g>',
    );
    x += width * U;
  }
  return parts.join('');
}

/** 生成完整的键盘 SVG */
function svgHtml() {
  let body = '';
  MAIN_ROWS.forEach((row, i) => { body += renderRow(row, i, PAD); });
  NAV_ROWS.forEach((row, i) => { body += renderRow(row, i, PAD + NAV_X * U); });

  return `<div class="kb-scroll">
    <svg class="kb-svg" viewBox="0 0 ${W + PAD * 2} ${HGT + PAD * 2}"
         role="img" aria-label="标准键盘示意图">${body}</svg>
  </div>`;
}

const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta', 'Fn'];

/**
 * 物理键位 → 示意图 token。一律以 e.code（按键的物理位置）为准，不用 e.key 字符。
 *
 * 为什么必须用 code：e.key 是「打出来的字符」，会被这三件事带偏 ——
 *   1. 中文输入法开着时，按字母得到的 e.key 是 'Process'，只有 code 仍是 KeyC；
 *   2. 开了大写锁定、或按住 Shift，同一个物理键的字符会变（c/C、1/!、./>），
 *      而 code 始终是 KeyC、Digit1、Period，正好对上示意图上的那一颗键；
 *   3. 换成别的键盘布局也不影响 code。
 * 返回 null 表示图上没有这个键（小键盘、Insert、右键菜单键、大小写锁定等），直接忽略。
 */
const CODE_TO_TOKEN = {
  Space: '空格', Escape: 'Esc', PrintScreen: 'PrtSc',
  ArrowUp: '方向键', ArrowDown: '方向键', ArrowLeft: '方向键', ArrowRight: '方向键',
  Backspace: 'Backspace', Tab: 'Tab', Enter: 'Enter', Delete: 'Delete',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Backquote: '`', Comma: ',', Period: '.', Slash: '/',
};

function keyTokenFromEvent(e) {
  const code = e.code || '';
  if (/^Numpad/.test(code)) return null;                   // 右侧小键盘图上没有
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);       // KeyC → C
  if (/^Digit[0-9]$/.test(code)) return '数字';             // 十个数字键统一算「数字」
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;         // F1~F12 与键位表同名
  if (Object.prototype.hasOwnProperty.call(CODE_TO_TOKEN, code)) return CODE_TO_TOKEN[code];

  // 极少数环境拿不到 code，退回 e.key 兜底
  const k = e.key;
  if (!k || k === 'Process' || k === 'Unidentified') return null;
  if (k === ' ' || k === 'Spacebar') return '空格';
  if (/^[a-zA-Z]$/.test(k)) return k.toUpperCase();
  if (/^[0-9]$/.test(k)) return '数字';
  if (Object.prototype.hasOwnProperty.call(CODE_TO_TOKEN, k)) return CODE_TO_TOKEN[k];
  if (/^F([1-9]|1[0-2])$/.test(k)) return k;
  return null;
}

/** 这几个键按下会让页面滚动，测试快捷键时页面乱跑最影响手感，捕获期间要拦掉 */
const NO_SCROLL_TOKENS = new Set(['空格', '方向键', 'PageUp', 'PageDown', 'Home', 'End']);

/** 当前按住的修饰键 */
function pressedModifiers(e) {
  const out = [];
  if (e.ctrlKey) out.push('Ctrl');
  if (e.shiftKey) out.push('Shift');
  if (e.altKey) out.push('Alt');
  if (e.metaKey) out.push('Win');
  return out;
}

/** 当前存活的实例（同时只保留一份键盘监听，避免反复进出页面时事件叠加） */
let live = null;

/**
 * 在容器内创建键盘示意图
 * @param {HTMLElement} container
 * @param {{onChange?: (tokens: string[]) => void,
 *          normalize?: (token: string) => string,
 *          captureOnHover?: boolean,
 *          onCaptureChange?: (capturing: boolean) => void}} [opts]
 *        normalize 用于把「数据里的按键名」与「键帽文字」归一到同一套写法
 *        （例如 1 / 9 / 1~8 都算「数字」，↑↓←→ 都算「方向键」，+ 与 = 同一个键）
 * @returns {{el, setSelection, highlight, setCapture, destroy}}
 */
export function KeyboardMap(container, {
  onChange, normalize, captureOnHover = true, onCaptureChange,
} = {}) {
  if (live) live.destroy();          // 回收上一个实例的 window 监听
  container.classList.add('keyboard-map');
  container.innerHTML = svgHtml();

  const norm = typeof normalize === 'function' ? normalize : (t) => t;

  /** 归一化后的 token -> 该键在图上对应的所有元素（左右 Shift / Ctrl 各算一个） */
  const keyEls = new Map();
  container.querySelectorAll('.kbd-key[data-token]').forEach((g) => {
    const t = norm(g.dataset.token);
    if (!keyEls.has(t)) keyEls.set(t, []);
    keyEls.get(t).push(g);
  });

  /** 已选中的组合键：归一化 token -> 原始 token（用于按点击顺序展示，如 Ctrl + Shift） */
  const selected = new Map();
  let hovering = [];        // 临时高亮（鼠标悬停某条快捷键 / 按住修饰键）
  let capturing = false;    // 是否正在监听实体键盘

  function paint() {
    keyEls.forEach((list, token) => {
      const on = selected.has(token);
      const hov = hovering.includes(token);
      list.forEach((g) => {
        g.classList.toggle('is-on', on);
        g.classList.toggle('is-hover', !on && hov);
      });
    });
  }

  function notify() { if (onChange) onChange([...selected.values()]); }

  /** 整体替换选中的组合键 */
  function applySelection(tokens) {
    selected.clear();
    (tokens || []).forEach((raw) => selected.set(norm(raw), raw));
    paint();
    notify();
  }

  /** 点键 = 加入/移出组合，可累积多个键（如先点 Ctrl 再点 Shift） */
  function toggle(rawToken) {
    const t = norm(rawToken);
    if (selected.has(t)) selected.delete(t);   // 再点一次取消
    else selected.set(t, rawToken);
    paint();
    notify();
  }

  container.querySelectorAll('.kbd-key[data-token]').forEach((g) => {
    g.addEventListener('click', () => toggle(g.dataset.token));
    // 键帽本身可聚焦，回车 / 空格等于点它一下。
    // stopPropagation 是必须的：否则同一次按键还会冒泡到 window 被「实体键盘捕获」
    // 再处理一遍，两次 toggle 互相抵消，表现就是「按了没反应」。
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        e.stopPropagation();
        toggle(g.dataset.token);
      }
    });
  });

  /* ---------- 实体键盘联动 ---------- */

  /** 正在输入框里打字时不抢按键 */
  function typingInField() {
    const ae = document.activeElement;
    return !!ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
  }

  /**
   * 把焦点从输入框 / 下拉框上挪开。
   * 关键一处：鼠标移到键盘图上时，焦点常常还停在上面的搜索框里 —— 那样按什么键
   * 都被输入框吃掉，捕获看起来就是「完全没反应」。这里主动失焦（不会清空已输入内容）。
   */
  function releaseField() {
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) ae.blur();
  }

  function onKeyDown(e) {
    if (!capturing || typingInField()) return;
    if (e.repeat) return;                       // 长按不反复触发

    // 只按住了修饰键：先亮起来作为「即将组合」的预览；
    // 同时拦掉默认行为 —— 单独按一下 Alt 会把焦点抢到浏览器菜单栏，之后按键就全废了
    if (MODIFIER_KEYS.includes(e.key)) {
      e.preventDefault();
      // 必须走 norm 归一化：paint() 是按归一化后的 token 比对的，
      // 直接塞原始名（'Ctrl'）会和图上的 'ctrl' 对不上，表现就是「按住 Ctrl 图上不亮」
      hovering = pressedModifiers(e).map(norm);
      paint();
      return;
    }

    const token = keyTokenFromEvent(e);
    if (!token) return;                         // 图上没有的键（小键盘 / Insert / 大小写锁定…）

    // 组合键、F 键、翻页键、Tab 都会触发浏览器动作或让页面乱跑，测试时一律拦掉
    if (e.ctrlKey || e.altKey || e.metaKey
      || /^F([1-9]|1[0-2])$/.test(token)
      || NO_SCROLL_TOKENS.has(token)
      || token === 'Tab') {
      e.preventDefault();
    }

    hovering = [];
    applySelection([...pressedModifiers(e), token]);
  }

  function onKeyUp(e) {
    if (!capturing || !MODIFIER_KEYS.includes(e.key)) return;
    hovering = pressedModifiers(e).map(norm);   // 同上，必须归一化
    paint();
  }

  function setCapture(on) {
    if (capturing === on) return;
    capturing = on;
    hovering = [];
    container.classList.toggle('is-capturing', on);
    if (on) releaseField();
    paint();
    if (onCaptureChange) onCaptureChange(on);
  }

  if (captureOnHover) {
    container.addEventListener('mouseenter', () => setCapture(true));
    container.addEventListener('mouseleave', () => setCapture(false));
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    container.classList.remove('is-capturing');
    if (live === api) live = null;
  }

  const api = {
    el: container,
    /** 代码里主动设置选中的组合键（传 null 或空数组即清空） */
    setSelection: applySelection,
    /** 临时高亮一组键（如鼠标停在某条快捷键上） */
    highlight(tokens) { hovering = (tokens || []).map(norm); paint(); },
    /** 手动开关实体键盘监听 */
    setCapture,
    destroy,
  };
  live = api;
  return api;
}
