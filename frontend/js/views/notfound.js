/* ============================================================
 * views/notfound.js - 404 页
 * ============================================================ */

export default {
  title: '404 · 师兄',

  render() {
    return `
    <div class="notfound">
      <div class="code">404</div>
      <p>页面不存在或已被移动</p>
      <p class="nf-hint">可能是网址抄错了一个字，也可能是这个页面已经下线。点下面的按钮回到首页，重新找一下就能找到。</p>
      <a class="btn btn-primary" href="#/">返回首页</a>
    </div>`;
  },
};
