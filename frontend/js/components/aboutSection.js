/* ============================================================
 * components/aboutSection.js - 首页底部「关于」彩蛋
 * 职责：默认展示一枚卡通蛋 + 锤子，点击后锤破蛋，
 *       品牌故事（彩蛋文案）随之弹出。
 * ============================================================ */
import { aboutIllustration } from './aboutIllustration.js';
import { icon } from './icon.js';

/** 关于文案（首页底部彩蛋） */
export const ABOUT_STORY =
  '为什么叫「师兄」？我女朋友是幼儿园老师，总这么叫我。' +
  '她不常跟电脑打交道，遇到小问题就喊我。' +
  '后来我想，不如做个小工具——我不在的时候，它也能随叫随到。' +
  '再后来发现，这些功能很多老师、公务员都用得上，' +
  '索性开放出来，让它成为大家的「师兄」。';

/**
 * 渲染关于（彩蛋）区块
 * @returns {string} HTML
 */
export function aboutSection() {
  return `
  <section class="section about-section" id="about">
    <div class="egg-scene" id="eggScene" role="button" tabindex="0"
         aria-label="连续点击三次彩蛋，看看会发生什么">
      <svg class="egg" viewBox="0 0 120 130" aria-hidden="true">
        <!-- 地面投影（蛋飞走后淡出） -->
        <ellipse class="egg-shadow" cx="60" cy="122" rx="34" ry="5.5" fill="#4a5670" opacity=".15"/>

        <!-- 完整的蛋：矮胖 Q 版 + 高光 -->
        <g class="egg-base">
          <path d="M60 14 C26 14 8 46 8 76 C8 104 30 120 60 120 C90 120 112 104 112 76 C112 46 94 14 60 14 Z"
                fill="#fffcf6" stroke="#4a5670" stroke-width="4" stroke-linejoin="round"/>
          <ellipse cx="37" cy="47" rx="8.5" ry="13" fill="#fff" transform="rotate(-24 37 47)"/>
          <ellipse cx="29" cy="70" rx="3.2" ry="5.5" fill="#fff" opacity=".9" transform="rotate(-24 29 70)"/>
        </g>

        <!-- 左半壳（破壳后飞出） -->
        <g class="shell shell-l">
          <path d="M60 14 C26 14 8 46 8 76 C8 104 30 120 60 120 Z"
                fill="#fffcf6" stroke="#4a5670" stroke-width="4" stroke-linejoin="round"/>
          <ellipse cx="37" cy="47" rx="8.5" ry="13" fill="#fff" transform="rotate(-24 37 47)"/>
        </g>

        <!-- 右半壳（破壳后飞出） -->
        <g class="shell shell-r">
          <path d="M60 14 C94 14 112 46 112 76 C112 104 90 120 60 120 Z"
                fill="#fffcf6" stroke="#4a5670" stroke-width="4" stroke-linejoin="round"/>
        </g>

        <!-- 表情：眼白 + 会跟随锤子转动的眼珠 + 腮红 + 微笑 -->
        <g class="face">
          <ellipse class="eye-socket" cx="44" cy="66" rx="8.5" ry="10.5" fill="#fffcf6" stroke="#3a4049" stroke-width="1.6"/>
          <ellipse class="eye-socket" cx="76" cy="66" rx="8.5" ry="10.5" fill="#fffcf6" stroke="#3a4049" stroke-width="1.6"/>
          <g class="eye-ball">
            <ellipse class="eye eye-l" cx="44" cy="66" rx="5" ry="6.5" fill="#3a4049"/>
            <circle class="eye-dot eye-dot-l" cx="41.8" cy="63.4" r="1.9" fill="#fff"/>
          </g>
          <g class="eye-ball">
            <ellipse class="eye eye-r" cx="76" cy="66" rx="5" ry="6.5" fill="#3a4049"/>
            <circle class="eye-dot eye-dot-r" cx="73.8" cy="63.4" r="1.9" fill="#fff"/>
          </g>
          <ellipse class="blush blush-l" cx="26" cy="84" rx="8.5" ry="5.5" fill="#ff9db0" opacity=".6"/>
          <ellipse class="blush blush-r" cx="94" cy="84" rx="8.5" ry="5.5" fill="#ff9db0" opacity=".6"/>
          <path class="mouth" d="M53 84 Q60 92 67 84" fill="none" stroke="#3a4049" stroke-width="3.2" stroke-linecap="round"/>
        </g>

        <!-- 被砸时：皱眉 + 眯眼(＞_＜) + 瘪嘴的疼痛表情 -->
        <g class="face-pain">
          <path class="brow brow-l" d="M36 50 L52 59" fill="none" stroke="#3a4049" stroke-width="3.6" stroke-linecap="round"/>
          <path class="brow brow-r" d="M84 50 L68 59" fill="none" stroke="#3a4049" stroke-width="3.6" stroke-linecap="round"/>
          <path class="eye-pain eye-pain-l" d="M38 66 L50 59 M38 66 L50 73" fill="none" stroke="#3a4049" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="eye-pain eye-pain-r" d="M82 66 L70 59 M82 66 L70 73" fill="none" stroke="#3a4049" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="mouth-pain" d="M53 91 Q60 83 67 91" fill="none" stroke="#3a4049" stroke-width="3.2" stroke-linecap="round"/>
        </g>

        <!-- 破壳瞬间：叉叉眼 + 惊呆张嘴 -->
        <g class="eye-x">
          <path d="M37 58 l13 13 M50 58 l-13 13" fill="none" stroke="#3a4049" stroke-width="3.6" stroke-linecap="round"/>
          <path d="M70 58 l13 13 M83 58 l-13 13" fill="none" stroke="#3a4049" stroke-width="3.6" stroke-linecap="round"/>
          <ellipse class="mouth-o" cx="60" cy="87" rx="6" ry="7.5" fill="#3a4049"/>
        </g>

        <!-- 裂纹 -->
        <g class="crack">
          <path d="M60 16 L49 36 L67 48 L51 68 L63 90 L55 106"
                fill="none" stroke="#4a5670" stroke-width="3.4"
                stroke-linejoin="round" stroke-linecap="round"/>
        </g>
      </svg>
      <div class="egg-hint" id="eggHint" aria-hidden="true"></div>
      <div class="egg-end-tip">到底啦～</div>
    </div>
    <div class="about-reveal" id="aboutReveal">
      <div class="about-inner">
        <div class="about-illu-wrap">
          ${aboutIllustration()}
        </div>
        <div class="about-text">
          <h2>${icon('info', 20)} 关于</h2>
          <p class="about-story">${ABOUT_STORY}</p>
        </div>
      </div>
    </div>
  </section>`;
}

/** 绑蛋交互：躲避锤子 + 眼珠跟随 + 点击/键盘锤破蛋并展开故事 */
export function bindAboutEgg() {
  const scene = document.getElementById('eggScene');
  if (!scene) return;
  const sec = document.getElementById('about');
  const egg = scene.querySelector('.egg');

  /** 躲避幅度与眼珠偏移（CSS 变量由 .egg / .eye-ball 消费） */
  const TILT_MAX = 10;    // 最大倾斜角度（度）
  const SHIFT_MAX = 6;    // 最大横向躲避位移（px）
  const EYE_X = 3.4;      // 眼珠水平活动半径（SVG 用户单位）
  const EYE_Y = 2.4;      // 眼珠垂直活动半径

  const setVars = (tilt, shift, ex, ey) => {
    egg.style.setProperty('--tilt', `${tilt.toFixed(2)}deg`);
    egg.style.setProperty('--shift', `${shift.toFixed(2)}px`);
    egg.style.setProperty('--ex', `${ex.toFixed(2)}px`);
    egg.style.setProperty('--ey', `${ey.toFixed(2)}px`);
  };

  const reset = () => setVars(0, 0, 0, 0);

  /**
   * 根据锤子（鼠标）位置计算躲避姿态与视线方向。
   * 参考系用不变的 .egg-scene（蛋本身会旋转，若以其 rect 计算会形成反馈回路导致抖动）。
   */
  const aim = (clientX, clientY) => {
    const r = scene.getBoundingClientRect();
    const cx = r.left + r.width / 2;      // 蛋的水平中心
    const cy = r.top + r.height * 0.66;   // 眼睛大致高度
    const nx = Math.max(-1, Math.min(1, (clientX - cx) / (r.width * 0.55)));
    const ny = Math.max(-1, Math.min(1, (clientY - cy) / (r.height * 0.55)));
    // 锤子从右边来 → 蛋向左倾并向左躲（倾斜取负，位移取负）
    setVars(-nx * TILT_MAX, -nx * SHIFT_MAX, nx * EYE_X, ny * EYE_Y);
  };

  const HITS_TO_CRACK = 3;   // 连续砸三下才破壳
  let hits = 0;
  let hitLock = false;       // 回弹动画期间锁定，避免连点重复计数

  const hint = document.getElementById('eggHint');
  let hintTimer = null;
  const showHint = (text) => {
    if (!hint) return;
    hint.textContent = text;
    hint.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('show'), 1400);
  };

  /**
   * 砸蛋：每次点击都触发「回弹 + 皱眉疼痛」，累计三次后才破壳展开故事。
   */
  const hit = () => {
    if (sec.classList.contains('cracked') || hitLock) return;
    hitLock = true;
    hits += 1;
    const remain = HITS_TO_CRACK - hits;
    if (remain === 2) showHint('再点两下有彩蛋哦');
    else if (remain === 1) showHint('再点一下有彩蛋哦');
    reset();
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 480);
    scene.classList.add('hit');
    setTimeout(() => {
      scene.classList.remove('hit');
      hitLock = false;
      if (hits >= HITS_TO_CRACK) sec.classList.add('cracked');
    }, 460);
  };

  scene.addEventListener('mousemove', (e) => {
    if (sec.classList.contains('cracked')) return;
    aim(e.clientX, e.clientY);
  });
  scene.addEventListener('mouseleave', reset);
  scene.addEventListener('click', hit);
  scene.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(); }
  });
}
