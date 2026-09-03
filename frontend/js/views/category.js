/* ============================================================
 * views/category.js - 学习分类详情页
 * 支持：资源列表（文件 / 帖子 / 转载文章）+ 「我要贡献」
 *   点击「我要贡献」先选择类型：写帖子 / 传文件 / 写链接，
 *   写帖子进入独立页面，传文件与写链接走对应模态框。
 *   三种贡献类型均支持「关键词」（选填）。
 * ============================================================ */
import { learnApi } from '../api/learn.js';
import { apiJson } from '../api/client.js';
import { icon } from '../components/icon.js';
import { esc, toast } from '../utils.js';

/* ---------------- 校验规则（与后端 learnService 保持一致） ---------------- */
const RULES = {
  TITLE_MIN: 2, TITLE_MAX: 80,
  POST_MIN: 10,
  SUMMARY_FILE_MIN: 5,
};

/* ---------------- 列表渲染 ---------------- */

function keywordTags(r) {
  if (!r.keywords) return '';
  const tags = r.keywords.split(/\s+/).filter(Boolean)
    .map((k) => `<span class="tag-keyword">#${esc(k)}</span>`).join('');
  return tags ? `<div class="r-tags">${tags}</div>` : '';
}

function actionHtml(r) {
  if (r.type === '经验' && r.content) return '<button class="btn btn-ghost btn-sm js-view-post">查看</button>';
  if (r.file) return `<a class="btn btn-ghost btn-sm" href="/api/learn/files/${encodeURIComponent(r.file)}">下载</a>`;
  if (r.url) return `<a class="btn btn-ghost btn-sm" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">阅读原文</a>`;
  return '<button class="btn btn-ghost btn-sm js-view">查看</button>';
}

function originHtml(r) {
  const bits = [];
  if (r.type === '转载') bits.push(`来源：<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.source)}</a>（版权归原作者所有）`);
  if (r.author) bits.push(`贡献：${esc(r.author)}`);
  return bits.length ? `<div class="r-origin">${bits.join(' · ')}</div>` : '';
}

function resourceTable(resources) {
  return `
  <div style="overflow-x:auto;">
  <table class="resource-table">
    <thead>
      <tr><th>资源名称</th><th>类型</th><th>格式</th><th>大小</th><th>操作</th></tr>
    </thead>
    <tbody>
      ${resources.map(r => `
      <tr>
        <td>
          <div class="r-title">${esc(r.title)}</div>
          <div class="r-summary">${esc(r.summary)}</div>
          ${keywordTags(r)}
          ${originHtml(r)}
        </td>
        <td><span class="tag tag-${r.type}">${r.type}</span></td>
        <td>${r.format}</td>
        <td>${r.size}</td>
        <td>${actionHtml(r)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  </div>`;
}

/* ---------------- 选择贡献类型弹窗 ---------------- */
function chooseKindHtml() {
  return `
  <div class="modal-mask" id="chooseMask" hidden>
    <div class="modal choose-modal" role="dialog" aria-modal="true" aria-label="我要贡献">
      <div class="modal-head">
        <h3>${icon('pen-tool', 18)} 我要贡献</h3>
        <button type="button" class="modal-close" data-close aria-label="关闭">×</button>
      </div>
      <p class="sub" style="margin:0 0 14px;">选择你要贡献的内容类型：</p>
      <div class="choose-grid">
        <button type="button" class="choose-card" data-target="post">
          <span class="choose-icon">${icon('pen-tool', 26)}</span>
          <span class="choose-title">写帖子</span>
          <span class="choose-desc">分享经验、方法<br>与踩过的坑</span>
        </button>
        <button type="button" class="choose-card" data-target="file">
          <span class="choose-icon">${icon('upload', 26)}</span>
          <span class="choose-title">传文件</span>
          <span class="choose-desc">模板、速查表<br>课件等</span>
        </button>
        <button type="button" class="choose-card" data-target="repost">
          <span class="choose-icon">${icon('globe', 26)}</span>
          <span class="choose-title">写链接</span>
          <span class="choose-desc">转载优质文章<br>并标注来源</span>
        </button>
      </div>
    </div>
  </div>`;
}

/* ---------------- 传文件模态框 ---------------- */
function fileModalHtml() {
  return `
  <div class="modal-mask" id="fileMask" hidden>
    <div class="modal contrib-modal" role="dialog" aria-modal="true" aria-label="上传文件">
      <div class="modal-head">
        <h3>${icon('upload', 18)} 上传文件</h3>
        <button type="button" class="modal-close" data-close aria-label="关闭">×</button>
      </div>
      <form id="fileForm" novalidate>
        <label class="f-label">标题 <span class="req">*</span></label>
        <input class="input" name="title" maxlength="80" placeholder="一句话说清主题（2~80 字）">

        <label class="f-label">选择文件 <span class="req">*</span></label>
        <input class="input" type="file" name="file">
        <p class="f-hint">模板、速查表、课件等均可，单文件不超过 30MB</p>

        <label class="f-label">简介 <span class="req">*</span>（至少 5 字）</label>
        <input class="input" name="summary" maxlength="200" placeholder="一句话介绍内容亮点">

        <label class="f-label">关键词 <span class="f-opt">（选填，多个用空格分隔）</span></label>
        <input class="input" name="keywords" maxlength="100" placeholder="例如：Word 模板 速查表">

        <label class="f-label">署名（选填）</label>
        <input class="input" name="author" maxlength="30" placeholder="怎么称呼你？留空则显示「匿名师兄」">

        <div class="f-err" id="fileErr" hidden></div>
        <div class="f-actions">
          <button type="button" class="btn btn-ghost" data-close>取消</button>
          <button type="submit" class="btn btn-primary">提交贡献</button>
        </div>
      </form>
    </div>
  </div>`;
}

/* ---------------- 写链接（转载）模态框 ---------------- */
function repostModalHtml() {
  return `
  <div class="modal-mask" id="repostMask" hidden>
    <div class="modal contrib-modal" role="dialog" aria-modal="true" aria-label="转载文章">
      <div class="modal-head">
        <h3>${icon('globe', 18)} 转载文章</h3>
        <button type="button" class="modal-close" data-close aria-label="关闭">×</button>
      </div>
      <form id="repostForm" novalidate>
        <label class="f-label">原文链接 <span class="req">*</span></label>
        <input class="input" name="url" placeholder="https://…（完整网址）">

        <label class="f-label">来源网站 <span class="f-opt">（选填）</span></label>
        <input class="input" name="source" maxlength="60" placeholder="例如：微软官方支持 / 某某博客">

        <label class="f-label">标题 <span class="req">*</span></label>
        <input class="input" name="title" maxlength="80" placeholder="文章标题或一句话概括">

        <label class="f-label">关键词 <span class="f-opt">（选填，多个用空格分隔）</span></label>
        <input class="input" name="keywords" maxlength="100" placeholder="例如：Word 目录 自动编号">

        <label class="f-label">简介 <span class="f-opt">（选填）</span></label>
        <input class="input" name="summary" maxlength="200" placeholder="一句话介绍内容亮点">

        <label class="f-label">署名（选填）</label>
        <input class="input" name="author" maxlength="30" placeholder="怎么称呼你？留空则显示「匿名师兄」">

        <p class="f-hint">请仅转载有权分享或允许注明出处的合规内容，转载会保留原文链接与来源标注</p>

        <div class="f-err" id="repostErr" hidden></div>
        <div class="f-actions">
          <button type="button" class="btn btn-ghost" data-close>取消</button>
          <button type="submit" class="btn btn-primary">提交贡献</button>
        </div>
      </form>
    </div>
  </div>`;
}

/** 帖子详情模态框 */
function postModalHtml(r) {
  const date = r.contributedAt ? new Date(r.contributedAt).toLocaleString('zh-CN') : '';
  return `
  <div class="modal-mask" id="postMask">
    <div class="modal post-modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h3>${esc(r.title)}</h3>
        <button type="button" class="modal-close" data-close aria-label="关闭">×</button>
      </div>
      <div class="post-meta">
        <span class="tag tag-${r.type}">${r.type}</span>
        ${r.author ? `<span>贡献：${esc(r.author)}</span>` : ''}
        ${date ? `<span>${date}</span>` : ''}
      </div>
      ${keywordTags(r)}
      <div class="post-body">${esc(r.content).replace(/\n/g, '<br>')}</div>
    </div>
  </div>`;
}

/* ---------------- 错误提示 ---------------- */
function showErr(box, msg) {
  box.textContent = msg;
  box.hidden = false;
  toast(msg);
}
function closeMask(mask) { mask.hidden = true; }
function bindClose(mask) {
  mask.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeMask(mask)));
  mask.addEventListener('click', (e) => { if (e.target === mask) closeMask(mask); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !mask.hidden) closeMask(mask); });
}

/* ---------------- 页面 ---------------- */

export default {
  nav: '/learn',

  render() {
    return `
    <div class="page-head">
      <div class="breadcrumb"><a href="#/">首页</a> / <a href="#/learn">学习板块</a></div>
    </div>
    <div id="category-body"><div class="loadbox">加载中…</div></div>
    ${chooseKindHtml()}
    ${fileModalHtml()}
    ${repostModalHtml()}`;
  },

  async mount({ id }) {
    const body = document.getElementById('category-body');
    let cat;
    try {
      cat = await learnApi.category(id);
    } catch (e) {
      body.innerHTML = `<div class="banner warn">加载失败：${esc(e.message)}</div>`;
      return;
    }

    document.title = `${cat.name} · 师兄`;
    const reload = async () => {
      cat = await learnApi.category(id);
      document.getElementById('res-wrap').innerHTML = resourceTable(cat.resources);
      bindRows();
    };

    const bindRows = () => {
      body.querySelectorAll('.js-view').forEach((btn) => {
        btn.addEventListener('click', () => toast('资源整理中，敬请期待'));
      });
      body.querySelectorAll('.js-view-post').forEach((btn, i) => {
        const r = cat.resources.filter((x) => x.type === '经验' && x.content)[i];
        btn.addEventListener('click', () => openPostModal(r));
      });
    };

    const openPostModal = (r) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = postModalHtml(r);
      const mask = wrap.firstElementChild;
      document.body.appendChild(mask);
      bindClose(mask);
    };

    body.innerHTML = `
      <div class="card category-panel">
        <div class="category-head contrib-head">
          <div class="category-head-left">
            <div class="card-icon">${icon(cat.icon, 30)}</div>
            <div>
              <h1 style="font-size:24px;">${esc(cat.name)}</h1>
              <p class="sub" style="color:var(--text-light); margin-top:4px;">${esc(cat.description)}</p>
            </div>
          </div>
          <button type="button" class="btn btn-primary js-contribute">${icon('pen-tool', 16)} 我要贡献</button>
        </div>
        <div id="res-wrap">${resourceTable(cat.resources)}</div>
      </div>`;

    bindRows();

    /* 打开选择类型弹窗 */
    const chooseMask = document.getElementById('chooseMask');
    document.querySelector('.js-contribute').addEventListener('click', () => { chooseMask.hidden = false; });
    bindClose(chooseMask);
    chooseMask.querySelectorAll('.choose-card').forEach((card) => {
      card.addEventListener('click', () => {
        closeMask(chooseMask);
        const target = card.dataset.target;
        if (target === 'post') {
          location.hash = `#/learn/${id}/post`;
        } else if (target === 'file') {
          document.getElementById('fileMask').hidden = false;
        } else if (target === 'repost') {
          document.getElementById('repostMask').hidden = false;
        }
      });
    });

    /* 传文件 */
    const fileMask = document.getElementById('fileMask');
    bindClose(fileMask);
    bindFileForm(fileMask, id, reload);

    /* 写链接 */
    const repostMask = document.getElementById('repostMask');
    bindClose(repostMask);
    bindRepostForm(repostMask, id, reload);
  },
};

/* ---------------- 表单提交绑定 ---------------- */

function bindFileForm(mask, catId, reload) {
  const form = document.getElementById('fileForm');
  const errBox = document.getElementById('fileErr');
  const val = (n) => (form.querySelector(`[name="${n}"]`)?.value || '').trim();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.hidden = true;
    const title = val('title');
    if (title.length < RULES.TITLE_MIN || title.length > RULES.TITLE_MAX) {
      return showErr(errBox, `标题需为 ${RULES.TITLE_MIN}~${RULES.TITLE_MAX} 个字`);
    }
    const fileInput = form.querySelector('[name="file"]');
    if (!fileInput.files.length) return showErr(errBox, '请选择要上传的文件');
    if (val('summary').length < RULES.SUMMARY_FILE_MIN) {
      return showErr(errBox, `简介至少 ${RULES.SUMMARY_FILE_MIN} 个字`);
    }

    const fd = new FormData();
    fd.append('kind', 'file');
    fd.append('title', title);
    fd.append('summary', val('summary'));
    fd.append('keywords', val('keywords'));
    fd.append('author', val('author'));
    fd.append('file', fileInput.files[0]);

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await apiJson(`/learn/categories/${catId}/contributions`, { method: 'POST', body: fd });
      closeMask(mask);
      form.reset();
      toast('感谢贡献！内容已发布到本专区');
      await reload();
    } catch (err) {
      showErr(errBox, err.message || '提交失败，请稍后重试');
    } finally {
      btn.disabled = false;
    }
  });
}

function bindRepostForm(mask, catId, reload) {
  const form = document.getElementById('repostForm');
  const errBox = document.getElementById('repostErr');
  const val = (n) => (form.querySelector(`[name="${n}"]`)?.value || '').trim();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.hidden = true;
    const title = val('title');
    if (title.length < RULES.TITLE_MIN || title.length > RULES.TITLE_MAX) {
      return showErr(errBox, `标题需为 ${RULES.TITLE_MIN}~${RULES.TITLE_MAX} 个字`);
    }
    const url = val('url');
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      return showErr(errBox, '原文链接格式不正确，需以 http(s):// 开头');
    }

    const fd = new FormData();
    fd.append('kind', 'repost');
    fd.append('title', title);
    fd.append('url', url);
    fd.append('source', val('source'));
    fd.append('keywords', val('keywords'));
    fd.append('summary', val('summary'));
    fd.append('author', val('author'));

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await apiJson(`/learn/categories/${catId}/contributions`, { method: 'POST', body: fd });
      closeMask(mask);
      form.reset();
      toast('感谢贡献！内容已发布到本专区');
      await reload();
    } catch (err) {
      showErr(errBox, err.message || '提交失败，请稍后重试');
    } finally {
      btn.disabled = false;
    }
  });
}
