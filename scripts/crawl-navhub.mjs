/* ============================================================
 * scripts/crawl-navhub.mjs - 抓取「导航森林」(navhub.shenzjd.com) 的网站导航数据
 *
 * 用法：
 *   node scripts/crawl-navhub.mjs --probe   # 仅探查/打印统计，不写文件
 *   node scripts/crawl-navhub.mjs           # 抓取并生成数据文件
 *
 * 数据来源：
 *   该站为 Next.js(App Router) 服务端渲染，全部导航数据以 RSC 载荷
 *   （self.__next_f.push）内嵌在首页 HTML 中。分类为嵌套结构：
 *     { id, parentId, name, icon, sort, sites:[{title,url,favicon,description}], children:[...] }
 *   其中 parentId 为 "$undefined" 表示一级分类。
 *
 * 输出：
 *   frontend/js/data/navhub.js   （前端静态数据，供「常用导航」页使用）
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://navhub.shenzjd.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const PROBE = process.argv.includes('--probe');

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** HTML 中的 RSC 片段拼接还原为文本 */
function extractRsc(html) {
  const parts = [];
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let m;
  while ((m = re.exec(html))) {
    try { parts.push(JSON.parse(m[1])); } catch { /* 跳过异常片段 */ }
  }
  return parts.join('');
}

/** 从 start（应为 '['）开始，返回与之配对的 ']' 下标 */
function matchBracket(str, start) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < str.length; i += 1) {
    const c = str[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[') depth += 1;
    else if (c === ']') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

/** 解析 initialSites 数组（含嵌套 children） */
function extractInitialSites(rsc) {
  const key = '"initialSites":';
  const i = rsc.indexOf(key);
  if (i < 0) throw new Error('未在 RSC 中找到 initialSites 字段');
  const start = rsc.indexOf('[', i);
  const end = matchBracket(rsc, start);
  if (start < 0 || end < 0) throw new Error('initialSites 数组括号不匹配');
  const raw = rsc.slice(start, end + 1);
  return JSON.parse(raw.replace(/"\$undefined"/g, 'null'));
}

/** 直接从 RSC 粗抽所有「名称+网址」对（用于校验/检索，不参与建树） */
function extractAllSites(rsc) {
  const out = [];
  const re = /"(?:title|name)":"([^"]{1,140})"([^{}]{0,400}?)"(?:url|href|link)":"((?:https?:)?\\?\/\\?\/[^"]+)"/g;
  let m;
  while ((m = re.exec(rsc))) {
    out.push({ name: m[1], url: m[3].replace(/\\\//g, '/') });
  }
  return out;
}

const clean = (v) => (v === '$undefined' || v == null ? '' : String(v));
const unescapeUrl = (v) => String(v || '').replace(/\\\//g, '/');

/** 规整站点 */
function normSite(s) {
  const url = unescapeUrl(s.url);
  if (!url) return null;
  const favicon = clean(s.favicon) ? unescapeUrl(s.favicon) : '';
  const description = clean(s.description);
  return {
    name: String(s.title || s.name || url).trim(),
    url,
    ...(favicon ? { favicon } : {}),
    ...(description ? { description } : {}),
  };
}

/** 递归规整分类 */
function normCategory(c) {
  const sites = (c.sites || []).map(normSite).filter(Boolean);
  const children = (c.children || []).map(normCategory).filter((x) => x.count > 0);
  const count = sites.length + children.reduce((n, x) => n + x.count, 0);
  return {
    id: c.id,
    name: clean(c.name).trim(),
    icon: clean(c.icon),
    count,
    sites,
    children,
  };
}

function countAll(nodes) {
  let cats = 0;
  let sites = 0;
  const walk = (list) => {
    for (const n of list) {
      cats += 1;
      sites += n.sites.length;
      walk(n.children);
    }
  };
  walk(nodes);
  return { cats, sites };
}

async function main() {
  const urlArgIdx = process.argv.indexOf('--url');
  const page = urlArgIdx >= 0 ? process.argv[urlArgIdx + 1] : `${BASE}/`;
  const html = await fetchText(page);
  const rsc = extractRsc(html);
  console.log(`页面: ${page}\nHTML: ${html.length} 字节  RSC: ${rsc.length} 字节`);
  console.log(`"title": ${rsc.split('"title":').length - 1}  "url": ${rsc.split('"url":').length - 1}  "sites": ${rsc.split('"sites":').length - 1}  "parentId": ${rsc.split('"parentId"').length - 1}  "initialSites": ${rsc.split('"initialSites"').length - 1}`);

  const grepIdx = process.argv.indexOf('--grep');
  if (grepIdx >= 0) {
    const kw = process.argv[grepIdx + 1] || '';
    const all = extractAllSites(rsc);
    const hits = all.filter((s) => s.name.includes(kw) || s.url.includes(kw));
    const uniq = [...new Map(hits.map((s) => [s.url, s])).values()];
    console.log(`\nRSC 中匹配「${kw}」：命中 ${hits.length} 条，按网址去重后 ${uniq.length} 条`);
    uniq.forEach((s) => console.log(`  ${s.name}  ->  ${s.url}`));
    return;
  }

  let flat = null;
  try { flat = extractInitialSites(rsc); } catch (e) { console.log('initialSites 解析失败:', e.message); }
  if (!flat) return;

  const tree = flat.map(normCategory).filter((c) => c.count > 0);
  const { cats, sites } = countAll(tree);

  console.log(`一级分类: ${tree.length}，分类总数: ${cats}，站点总数: ${sites}`);
  tree.forEach((c) => {
    console.log(`  ${c.icon || '📁'} ${c.name} —— ${c.children.length} 子分类 / ${c.count} 站`);
  });

  // --check：按前端渲染口径（递归展开）核对每个一级分类的站点总数
  if (process.argv.includes('--check')) {
    const collect = (node, prefix, out) => {
      const label = prefix ? `${prefix} · ${node.name}` : node.name;
      if (node.sites.length) out.push({ label, n: node.sites.length });
      node.children.forEach((c) => collect(c, label, out));
    };
    let bad = 0;
    tree.forEach((c) => {
      const gs = [];
      if (c.sites.length) gs.push({ label: '推荐', n: c.sites.length });
      c.children.forEach((ch) => collect(ch, '', gs));
      const total = gs.reduce((n, g) => n + g.n, 0);
      const same = total === c.count;
      if (!same) bad += 1;
      // 旧口径：只渲染「本级 sites + 一层 children.sites」，深层会漏
      const oldTotal = c.sites.length + c.children.reduce((n, ch) => n + ch.sites.length, 0);
      const miss = c.count - oldTotal;
      console.log(`${same ? '✓' : '✗'} ${c.name}：${gs.length} 组 / ${total} 站（计数 ${c.count}）`
        + (miss > 0 ? `  ← 修复前仅显示 ${oldTotal} 站，漏 ${miss} 站` : ''));
    });
    console.log(bad ? `\n有 ${bad} 个分类渲染数与计数不一致` : '\n全部分类渲染数与计数一致');
    return;
  }

  if (PROBE) return;

  const data = {
    source: BASE,
    updatedAt: new Date().toISOString().slice(0, 10),
    totalCategories: cats,
    totalSites: sites,
    categories: tree,
  };

  const jsPath = path.join(ROOT, 'frontend', 'js', 'data', 'navhub.js');
  const banner = `/* ============================================================
 * data/navhub.js - 「常用导航」静态数据（自动生成，请勿手工编辑）
 * 生成脚本：scripts/crawl-navhub.mjs
 * 数据来源：${BASE}/ （导航森林）
 * 更新时间：${data.updatedAt}
 * 共 ${tree.length} 个一级分类 / ${cats} 个分类 / ${sites} 个站点
 * ============================================================ */
`;
  fs.writeFileSync(jsPath, `${banner}export const NAVHUB = ${JSON.stringify(data, null, 2)};\n\nexport default NAVHUB;\n`, 'utf8');

  const size = (p) => `${(fs.statSync(p).size / 1024).toFixed(0)} KB`;
  console.log(`\n已生成：\n  ${path.relative(ROOT, jsPath)}  (${size(jsPath)})`);
}

main().catch((e) => { console.error('抓取失败:', e.message); process.exit(1); });
