/* ============================================================
 * views/post.js - 写经验帖（独立页面）
 * 通过 #/learn/:id/post 进入，提交到本专区。
 * 关键词为选填项。
 * ============================================================ */
import { apiJson } from '../api/client.js';
import { icon } from '../components/icon.js';
import { esc, toast } from '../utils.js';

const RULES = { TITLE_MIN: 2, TITLE_MAX: 80, POST_MIN: 10 };

export default {
  title: '写经验帖 · 师兄',
  nav: '/learn',

  render({ id }) {
    return `
    <div class="page-head">
      <div class="breadcrumb">
        <a href="#/">首页</a> / <a href="#/learn">学习板块</a> /
        <a href="#/learn/${id}">返回专区</a> / 写经验帖
      </div>
      <h1>${icon('pen-tool', 28)} 写经验帖</h1>
      <p class="sub">分享你的做法、步骤与踩过的坑，帮助更多师弟师妹</p>
    </div>

    <div class="card post-edit-card">
      <form id="postForm" novalidate>
        <label class="f-label">标题 <span class="req">*</span></label>
        <input class="input" name="title" maxlength="80" placeholder="一句话说清主题（2~80 字），例如：Word 目录自动生成三步法">

        <label class="f-label">经验正文 <span class="req">*</span></label>
        <textarea class="input" name="content" rows="10"
          placeholder="分享你的做法、步骤和踩过的坑…（至少 10 字，支持换行）"></textarea>

        <label class="f-label">简介 <span class="f-opt">（选填）</span></label>
        <input class="input" name="summary" maxlength="200" placeholder="一句话介绍内容亮点">

        <label class="f-label">关键词 <span class="f-opt">（选填，多个用空格分隔）</span></label>
        <input class="input" name="keywords" maxlength="100" placeholder="例如：Word 排版 技巧 模板">

        <label class="f-label">署名（选填）</label>
        <input class="input" name="author" maxlength="30" placeholder="怎么称呼你？留空则显示「匿名师兄」">

        <div class="f-err" id="postErr" hidden></div>

        <div class="f-actions">
          <a class="btn btn-ghost" href="#/learn/${id}">取消</a>
          <button type="submit" class="btn btn-primary">发布帖子</button>
        </div>
      </form>
    </div>`;
  },

  async mount({ id }) {
    const form = document.getElementById('postForm');
    const errBox = document.getElementById('postErr');
    const showErr = (msg) => { errBox.textContent = msg; errBox.hidden = false; toast(msg); };
    const val = (n) => (form.querySelector(`[name="${n}"]`)?.value || '').trim();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.hidden = true;

      const title = val('title');
      if (title.length < RULES.TITLE_MIN || title.length > RULES.TITLE_MAX) {
        return showErr(`标题需为 ${RULES.TITLE_MIN}~${RULES.TITLE_MAX} 个字`);
      }
      const content = val('content');
      if (content.length < RULES.POST_MIN) return showErr(`经验正文至少 ${RULES.POST_MIN} 个字`);

      const fd = new FormData();
      fd.append('kind', 'post');
      fd.append('title', title);
      fd.append('content', content);
      fd.append('summary', val('summary'));
      fd.append('keywords', val('keywords'));
      fd.append('author', val('author'));

      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await apiJson(`/learn/categories/${id}/contributions`, { method: 'POST', body: fd });
        toast('发布成功！正在返回专区…');
        location.hash = `#/learn/${id}`;
      } catch (err) {
        showErr(err.message || '提交失败，请稍后重试');
        btn.disabled = false;
      }
    });
  },
};
