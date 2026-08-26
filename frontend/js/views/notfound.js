/* ============================================================
 * views/notfound.js - 404 页
 * ============================================================ */

export default {
  title: '404 · Helper 助手',

  render() {
    return `
    <div class="notfound">
      <div class="code">404</div>
      <p>页面不存在或已被移动</p>
      <a class="btn btn-primary" href="#/">返回首页</a>
    </div>`;
  },
};
