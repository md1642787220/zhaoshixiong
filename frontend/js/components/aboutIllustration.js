/* ============================================================
 * components/aboutIllustration.js - 「关于」插画
 * 职责：内联 SVG 小插画，零依赖、随站点配色变化。
 *       画面：圆滚滚的师兄与她并肩而立，中间一颗爱心，
 *             旁边一台会笑的电脑——「我不在的时候，它在」。
 * ============================================================ */

export function aboutIllustration() {
  return `
  <svg class="about-illu" viewBox="0 0 240 150" xmlns="http://www.w3.org/2000/svg"
       role="img" aria-label="师兄与她并肩而立的卡通插画">
    <!-- 背景大光晕 -->
    <circle cx="120" cy="75" r="72" fill="var(--primary-light)" opacity="0.45"/>

    <!-- 空中漂浮的小装饰 -->
    <g opacity=".65">
      <circle cx="42" cy="34" r="5.5" fill="#fbbf24"/>
      <path d="M194 28 l2.2 5.2 5.3 2-5.3 2-2.2 5.2-2.2-5.2-5.3-2 5.3-2z" fill="#f472b6"/>
      <circle cx="204" cy="118" r="4" fill="var(--primary)" opacity=".28"/>
      <path d="M34 92c-1.2-2.4-4-3.4-5.6-2-1.6 1.4-1.6 4 0 5.4l5.6 4.8 5.6-4.8c1.6-1.4 1.6-4 0-5.4-1.6-1.4-4.4-.4-5.6 2z"
            fill="#f472b6" opacity=".55"/>
    </g>

    <!-- 地面：微微拱起的可爱弧线 -->
    <path d="M44 130 Q120 138 196 130" stroke="var(--border)" stroke-width="3" stroke-linecap="round" fill="none"/>

    <!-- 随时待命的电脑（带笑脸） -->
    <g transform="translate(50, 98)">
      <rect x="0" y="0" width="32" height="26" rx="7" fill="#fff" stroke="var(--primary)" stroke-width="2.5"/>
      <circle cx="16" cy="13" r="7.5" fill="var(--primary-light)"/>
      <circle cx="12.5" cy="11.5" r="1.6" fill="var(--primary)"/>
      <circle cx="19.5" cy="11.5" r="1.6" fill="var(--primary)"/>
      <path d="M12 17q4 3 8 0" stroke="var(--primary)" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <path d="M16 26v3.5" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M9 29.5h14" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round"/>
    </g>

    <!-- 师兄（左） -->
    <g id="brother">
      <!-- 小脚丫 -->
      <ellipse cx="90" cy="129" rx="8" ry="5" fill="var(--primary-700)"/>
      <ellipse cx="108" cy="129" rx="8" ry="5" fill="var(--primary-700)"/>
      <!-- 圆滚滚身体 -->
      <rect x="78" y="74" width="42" height="54" rx="21" fill="var(--primary)"/>
      <!-- 衣服纽扣 -->
      <circle cx="99" cy="96" r="2.6" fill="#fff" opacity=".85"/>
      <circle cx="99" cy="108" r="2.6" fill="#fff" opacity=".85"/>
      <!-- 领结 -->
      <path d="M99 80 L88 75 L88 85 Z" fill="var(--accent)"/>
      <path d="M99 80 L110 75 L110 85 Z" fill="var(--accent)"/>
      <circle cx="99" cy="80" r="3.4" fill="var(--accent)" stroke="#fff" stroke-width="1.4"/>
      <!-- 大头 -->
      <circle cx="99" cy="56" r="22" fill="var(--primary)"/>
      <!-- 报童帽 -->
      <path d="M75 42 Q75 22 99 22 Q123 22 123 42 Z" fill="var(--primary-700)"/>
      <ellipse cx="99" cy="42" rx="27" ry="5.5" fill="var(--primary-700)"/>
      <circle cx="99" cy="28" r="3.2" fill="#fff" opacity=".9"/>
      <!-- 眼睛（大眼白 + 黑眼珠 + 高光） -->
      <circle cx="91.5" cy="55" r="5.5" fill="#fff"/>
      <circle cx="106.5" cy="55" r="5.5" fill="#fff"/>
      <circle cx="92.5" cy="55" r="2.4" fill="#3a4049"/>
      <circle cx="107.5" cy="55" r="2.4" fill="#3a4049"/>
      <circle cx="94" cy="53" r="1.3" fill="#fff"/>
      <circle cx="109" cy="53" r="1.3" fill="#fff"/>
      <!-- 腮红 -->
      <circle cx="85" cy="63" r="3.8" fill="#ffb3b3" opacity=".55"/>
      <circle cx="113" cy="63" r="3.8" fill="#ffb3b3" opacity=".55"/>
      <!-- 微笑 -->
      <path d="M92 68q7 5.5 14 0" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      <!-- 伸出去的小手 -->
      <path d="M117 92 Q128 96 133 92" stroke="var(--primary)" stroke-width="5.5" stroke-linecap="round" fill="none"/>
      <circle cx="133" cy="92" r="3.5" fill="#fff"/>
    </g>

    <!-- 她（右） -->
    <g id="her">
      <!-- 小脚丫 -->
      <ellipse cx="139" cy="129" rx="7" ry="4.5" fill="#e0457f"/>
      <ellipse cx="153" cy="129" rx="7" ry="4.5" fill="#e0457f"/>
      <!-- 圆滚滚身体，比师兄略娇小 -->
      <rect x="128" y="79" width="36" height="48" rx="18" fill="#f472b6"/>
      <!-- 裙摆 -->
      <path d="M125 114 Q146 126 167 114 L162 130 Q146 136 130 130 Z" fill="#e0457f"/>
      <!-- 衣服小圆点 -->
      <circle cx="146" cy="98" r="2.3" fill="#fff" opacity=".8"/>
      <circle cx="146" cy="108" r="2.3" fill="#fff" opacity=".8"/>
      <!-- 大头 -->
      <circle cx="146" cy="62" r="19" fill="#f472b6"/>
      <!-- 丸子头 -->
      <line x1="133" y1="50" x2="131" y2="46" stroke="#e0457f" stroke-width="4" stroke-linecap="round"/>
      <line x1="159" y1="50" x2="161" y2="46" stroke="#e0457f" stroke-width="4" stroke-linecap="round"/>
      <circle cx="131" cy="44" r="7" fill="#e0457f"/>
      <circle cx="161" cy="44" r="7" fill="#e0457f"/>
      <!-- 发带 -->
      <path d="M129 50 Q146 41 163 50" stroke="#e0457f" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <!-- 蝴蝶结发饰 -->
      <path d="M161 44 L168 40 L168 50 Z" fill="#fbbf24"/>
      <path d="M161 44 L154 40 L154 50 Z" fill="#fbbf24"/>
      <circle cx="161" cy="44" r="2" fill="#f59e0b"/>
      <!-- 眼睛 -->
      <circle cx="139.5" cy="61" r="4.8" fill="#fff"/>
      <circle cx="152.5" cy="61" r="4.8" fill="#fff"/>
      <circle cx="140.5" cy="61" r="2.1" fill="#3a4049"/>
      <circle cx="153.5" cy="61" r="2.1" fill="#3a4049"/>
      <circle cx="141.8" cy="59.5" r="1.2" fill="#fff"/>
      <circle cx="154.8" cy="59.5" r="1.2" fill="#fff"/>
      <!-- 腮红 -->
      <circle cx="134" cy="69" r="3.2" fill="#ffb3b3" opacity=".55"/>
      <circle cx="158" cy="69" r="3.2" fill="#ffb3b3" opacity=".55"/>
      <!-- 微笑 -->
      <path d="M140 73q6 4.5 12 0" stroke="#fff" stroke-width="2.3" stroke-linecap="round" fill="none"/>
      <!-- 伸出去的小手 -->
      <path d="M131 96 Q126 98 122 96" stroke="#f472b6" stroke-width="4.8" stroke-linecap="round" fill="none"/>
      <circle cx="122" cy="96" r="3" fill="#fff"/>
    </g>

    <!-- 中间的大爱心 -->
    <path d="M120 38c-1.8-3.8-7-5.6-10.5-2.8-3.5 2.8-3.5 7.7 0 10.8l10.5 9.8 10.5-9.8c3.5-3.1 3.5-8 0-10.8-3.5-2.8-8.7-1-10.5 2.8z"
          fill="#f472b6" stroke="#fff" stroke-width="1.6"/>
    <circle cx="115" cy="44" r="2" fill="#fff" opacity=".75"/>
  </svg>`;
}
