/* ============================================================
 * views/shortcuts.js - 常用快捷键速查（学习板块）
 * 搜索 + 分组浏览 + 只看必备 + 键盘示意图联动，数据全部在本地。
 * ============================================================ */
import { SHORTCUT_GROUPS, SHORTCUT_TOTAL } from '../data/shortcuts.js';
import { icon } from '../components/icon.js';
import { esc } from '../utils.js';
import { featureIntro } from '../components/featureIntro.js';
import { KeyboardMap } from '../components/keyboardMap.js';

/** 搜索无结果时给的提示词 */
const SUGGESTIONS = ['截图', '求和', '撤销', '替换', '标签页', '打印'];

/**
 * 把 "Ctrl + Shift + C / Ctrl + Shift + V" 渲染成键帽
 * @param {string} keys
 */
function keycaps(keys) {
  return keys
    .split(' / ')
    .map((alt) => alt
      .split(/\s\+\s/)
      .map((k, i) => `${i ? '<span class="sc-plus">+</span>' : ''}<kbd class="kbd">${esc(k)}</kbd>`)
      .join(''))
    .join('<span class="sc-or">或</span>');
}

/** 拆出这条快捷键用到的全部按键（用于键盘示意图联动） */
function tokensOf(keys) {
  return [...new Set(keys.split(' / ').flatMap((alt) => alt.split(/\s\+\s/)))];
}

/**
 * 需要按住 Shift 才打得出来的符号，还原到它所在的物理键。
 * 数据里为了好认仍写 $ % # > <，但实体键盘上它们是 Shift + 4 / 5 / 3 / . / ,，
 * 映射之后「按 Shift + 4」和「点示意图上的 $」指向同一颗键，两边才对得上。
 */
const SHIFTED_TO_KEY = {
  '~': '`', '!': '数字', '@': '数字', '#': '数字', '$': '数字', '%': '数字',
  '^': '数字', '&': '数字', '*': '数字', '(': '数字', ')': '数字',
  '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\',
  ':': ';', '"': "'", '<': ',', '>': '.', '?': '/',
};

/**
 * 按键名归一化：把「数据里的写法」和「键帽上的文字」对齐，否则会出现
 * 点了键没反应、按了实体键盘没反应、或悬停某条快捷键时图中不亮的情况。
 *   $ % #        → 数字        （Shift + 4 / 5 / 3）
 *   > <          → . ,         （Shift + . ,）
 *   1 / 9 / 1~8  → 数字        （键盘上十个数字键对应同一件事）
 *   ↑ ↓ ← →      → 方向键
 *   + 与 =       → 同一个键
 *   空格 / Space → 空格
 *   其余统一小写（u 与 U 是同一个键）
 */
export function canonKey(token) {
  const t = String(token || '').trim();
  if (!t) return '';
  if (SHIFTED_TO_KEY[t]) return SHIFTED_TO_KEY[t];
  if (/^\d$/.test(t) || t === '数字' || t === '数字键' || /^\d~\d$/.test(t)) return '数字';
  if ('↑↓←→'.includes(t) || t === '方向键') return '方向键';
  if (t === '+' || t === '=') return '=';
  if (t === '空格' || t.toLowerCase() === 'space') return '空格';
  return t.toLowerCase();
}

/** 单行 */
function rowHtml(it) {
  return `
  <div class="sc-row" data-keys="${esc(it.keys)}">
    <div class="sc-main">
      <div class="sc-name">${esc(it.name)}${it.hot ? '<span class="sc-hot">必备</span>' : ''}</div>
      ${it.note ? `<div class="sc-note">${esc(it.note)}</div>` : ''}
    </div>
    <div class="sc-keys">${keycaps(it.keys)}</div>
  </div>`;
}

/**
 * 一组
 * @param {object} g  分组
 * @param {object[]} [items] 要渲染的条目，默认整组
 */
function groupHtml(g, items) {
  const list = items || g.items;
  return `
  <section class="card sc-group">
    <div class="sc-group-head">
      <span class="sc-group-icon">${icon(g.icon, 20)}</span>
      <h2>${esc(g.name)}</h2>
      <span class="sc-group-count">${list.length} 条</span>
    </div>
    ${g.intro ? `<p class="sc-group-intro">${esc(g.intro)}</p>` : ''}
    <div class="sc-list">${list.map(rowHtml).join('')}</div>
  </section>`;
}

export default {
  title: '常用快捷键 · 师兄',
  nav: '/learn',

  render() {
    return `
    <div class="page-head">
      <div class="breadcrumb"><a href="#/">首页</a> / <a href="#/learn">学习板块</a> / 常用快捷键</div>
      <h1>${icon('toolbox', 28)} 常用快捷键</h1>
      <p class="sub">${SHORTCUT_TOTAL} 条高频快捷键速查，标「必备」的先记住，效率立刻不一样</p>
    </div>

    ${featureIntro({
      title: '这一页是干什么的？',
      text: '把办公中最常用、也最容易被忽略的快捷键整理成一张随时能查的表。会用以后，很多鼠标来回点的动作，按两个键就完成了。',
      points: [
        'Win 键：键盘左下角那个带窗户图标的键，位于 Ctrl 与 Alt 之间。',
        '组合键怎么按：先按住前面的键不放，再按最后一个键，然后一起松开。例如 Ctrl + C，就是按住 Ctrl 再按一下 C。',
        '不用背：记不住就回到这一页查，用上三四次自然就记住了。',
      ],
    })}

    <div class="card sc-kb-card">
      <div class="sc-kb-head">
        <span class="sc-kb-title">${icon('grid', 18)} 键盘示意图</span>
        <span class="sc-kb-tip" id="sc-kb-tip"><b>鼠标移到键盘图上，直接按你键盘上的键试试</b>（按住 Ctrl 再按 C 这类组合键也行）；也可以点图上的键来筛选，<b>连点多个键就是组合键</b>；鼠标滑过某条快捷键，图中对应的键会亮起来。</span>
      </div>
      <div id="sc-kb"></div>
    </div>

    <div class="card sc-toolbar">
      <div class="sc-search">
        ${icon('search', 18)}
        <input type="search" id="sc-q" class="input" placeholder="搜索功能、按键或用途，例如「截图」「求和」「撤销」">
      </div>
      <select id="sc-group" class="input sc-group-sel">
        <option value="">全部分类</option>
        ${SHORTCUT_GROUPS.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}
      </select>
      <label class="sc-hot-toggle">
        <input type="checkbox" id="sc-hot">
        <span>只看必备</span>
      </label>
    </div>

    <div class="sc-filterbar">
      <div class="sc-summary" id="sc-summary"></div>
      <button type="button" class="sc-key-chip" id="sc-key-chip" hidden></button>
    </div>

    <div id="sc-list">${SHORTCUT_GROUPS.map((g) => groupHtml(g)).join('')}</div>`;
  },

  mount() {
    const qInput = document.getElementById('sc-q');
    const groupSel = document.getElementById('sc-group');
    const hotBox = document.getElementById('sc-hot');
    const summaryEl = document.getElementById('sc-summary');
    const listEl = document.getElementById('sc-list');
    const keyChip = document.getElementById('sc-key-chip');

    /** 键盘图上点选的组合键（空数组 = 未筛选） */
    let activeKeys = [];

    /* 提示文案随「是否正在读取实体键盘」切换 */
    const kbTip = document.getElementById('sc-kb-tip');
    const TIP_IDLE = kbTip.innerHTML;
    const TIP_CAPTURE = '<b>正在读取你的实体键盘</b> —— 直接按键盘上的键试试（可以按住 Ctrl 再按 C）；鼠标移开键盘图就停止。';
    function syncCaptureHint(capturing) {
      kbTip.innerHTML = capturing ? TIP_CAPTURE : TIP_IDLE;
    }

    const kb = KeyboardMap(document.getElementById('sc-kb'), {
      normalize: canonKey,
      onChange(keys) { activeKeys = keys; apply(); },
      onCaptureChange(capturing) { syncCaptureHint(capturing); },
    });

    /** 组合键的展示顺序固定为 Ctrl → Shift → Alt → Win → 其余，与点击先后无关 */
    const MOD_ORDER = ['Ctrl', 'Shift', 'Alt', 'Win'];
    function comboText() {
      return [...activeKeys]
        .sort((a, b) => {
          const ia = MOD_ORDER.indexOf(a);
          const ib = MOD_ORDER.indexOf(b);
          return (ia < 0 ? MOD_ORDER.length : ia) - (ib < 0 ? MOD_ORDER.length : ib);
        })
        .join(' + ');
    }

    /** 清空按键筛选（setSelection 会回调 onChange，这里不必再手动改 activeKeys） */
    function clearKeys() {
      kb.setSelection(null);
    }

    /** 已选组合键的提示条 */
    function syncKeyChip(count) {
      if (!activeKeys.length) { keyChip.hidden = true; return; }
      keyChip.hidden = false;
      keyChip.innerHTML = `只看到用到「${esc(comboText())}」的快捷键`
        + (count == null ? '' : `（${count} 条）`)
        + '<span class="sc-chip-x">×</span>';
    }

    keyChip.addEventListener('click', clearKeys);

    /** 空结果时的推荐词 / 清空按键筛选 */
    function bindChips() {
      listEl.querySelectorAll('.sc-chip[data-sug]').forEach((b) => b.addEventListener('click', () => {
        qInput.value = b.dataset.sug;
        hotBox.checked = false;
        groupSel.value = '';
        apply();
      }));
      const clearBtn = listEl.querySelector('.js-clear-keys');
      if (clearBtn) clearBtn.addEventListener('click', clearKeys);
    }

    /** 悬停某条时，在键盘图上高亮对应的键 */
    function bindRows() {
      listEl.querySelectorAll('.sc-row').forEach((row) => {
        row.addEventListener('mouseenter', () => kb.highlight(tokensOf(row.dataset.keys || '')));
        row.addEventListener('mouseleave', () => kb.highlight([]));
      });
    }

    /** 按当前条件过滤并渲染 */
    function apply() {
      const q = qInput.value.trim().toLowerCase();
      const groupId = groupSel.value;
      const onlyHot = hotBox.checked;

      let total = 0;
      let hot = 0;
      const blocks = [];

      SHORTCUT_GROUPS.forEach((g) => {
        if (groupId && g.id !== groupId) return;
        const items = g.items.filter((it) => {
          if (onlyHot && !it.hot) return false;
          if (activeKeys.length) {
            // 组合键筛选：必须「同时用到」全部已选键（Ctrl + Shift 只出现在两者都在的快捷键里）
            const want = new Set(activeKeys.map(canonKey));
            const has = new Set(tokensOf(it.keys).map(canonKey));
            if ([...want].some((t) => !has.has(t))) return false;
          }
          if (!q) return true;
          return `${it.name} ${it.keys} ${it.note || ''} ${g.name}`.toLowerCase().includes(q);
        });
        if (!items.length) return;
        total += items.length;
        hot += items.filter((it) => it.hot).length;
        blocks.push(groupHtml(g, items));
      });

      syncKeyChip(total);

      if (!blocks.length) {
        listEl.innerHTML = activeKeys.length
          ? `<div class="card sc-empty">
              <p>没有快捷键同时用到「${esc(comboText())}」，去掉一个键再试试。</p>
              <div class="sc-empty-tips">
                <button type="button" class="sc-chip js-clear-keys">清空按键筛选</button>
              </div>
            </div>`
          : `<div class="card sc-empty">
              <p>没有找到相关快捷键，换个词试试：</p>
              <div class="sc-empty-tips">
                ${SUGGESTIONS.map((s) => `<button type="button" class="sc-chip" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}
              </div>
            </div>`;
        summaryEl.textContent = '';
        bindChips();
        return;
      }

      listEl.innerHTML = blocks.join('');
      summaryEl.textContent = `共 ${total} 条`
        + (onlyHot ? '' : `，其中必备 ${hot} 条`)
        + `（全部 ${SHORTCUT_TOTAL} 条）`;
      bindRows();
    }

    qInput.addEventListener('input', apply);
    groupSel.addEventListener('change', apply);
    hotBox.addEventListener('change', apply);
    apply();
  },
};
