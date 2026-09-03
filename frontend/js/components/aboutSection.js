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
         aria-label="点击彩蛋，查看关于师兄的故事">
      <svg class="egg" viewBox="0 0 120 130" aria-hidden="true">
        <ellipse class="egg-base" cx="60" cy="72" rx="46" ry="56" fill="#fff" stroke="#5a6883" stroke-width="3.5"/>
        <g class="shell shell-l">
          <path d="M60 16 C30 16 14 40 14 72 C14 100 34 114 60 114 Z"
                fill="#fff" stroke="#5a6883" stroke-width="3.5"/>
        </g>
        <g class="shell shell-r">
          <path d="M60 16 C90 16 106 40 106 72 C106 100 86 114 60 114 Z"
                fill="#fff" stroke="#5a6883" stroke-width="3.5"/>
        </g>
        <g class="face">
          <circle class="eye eye-l" cx="46" cy="64" r="5.5" fill="#3a4049"/>
          <circle class="eye eye-r" cx="74" cy="64" r="5.5" fill="#3a4049"/>
          <circle class="blush blush-l" cx="35" cy="80" r="8" fill="#ffb3b3" opacity=".7"/>
          <circle class="blush blush-r" cx="85" cy="80" r="8" fill="#ffb3b3" opacity=".7"/>
          <path class="mouth" d="M50 80 Q60 90 70 80" fill="none" stroke="#3a4049" stroke-width="3" stroke-linecap="round"/>
        </g>
        <g class="eye-x">
          <path d="M40 58 l12 12 M52 58 l-12 12" fill="none" stroke="#3a4049" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M68 58 l12 12 M80 58 l-12 12" fill="none" stroke="#3a4043" stroke-width="3.5" stroke-linecap="round"/>
        </g>
        <g class="crack">
          <path d="M60 18 L50 38 L66 50 L52 70 L64 98"
                fill="none" stroke="#5a6883" stroke-width="3"
                stroke-linejoin="round" stroke-linecap="round"/>
        </g>
      </svg>
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

/** 绑定彩蛋交互：点击 / 键盘触发锤破蛋并展开故事 */
export function bindAboutEgg() {
  const scene = document.getElementById('eggScene');
  if (!scene) return;
  const fire = () => {
    const sec = document.getElementById('about');
    if (sec.classList.contains('cracked')) return;
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 480);
    sec.classList.add('cracked');
  };
  scene.addEventListener('click', fire);
  scene.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
  });
}
