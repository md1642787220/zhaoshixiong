const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { marked } = require('marked');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

/* 上传临时目录与大小限制 */
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'helper-'));
const upload = multer({ dest: tmpRoot, limits: { fileSize: 500 * 1024 * 1024 } });

/* ================= 辅助函数 ================= */
function tmpFile(ext) {
  return path.join(tmpRoot, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
}

function safeRemove(file) {
  if (file) fs.unlink(file, () => {});
}

let ffmpegCache;
function checkFfmpeg() {
  if (ffmpegCache !== undefined) return Promise.resolve(ffmpegCache);
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-version'], (err) => {
      ffmpegCache = !err;
      resolve(ffmpegCache);
    });
  });
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { timeout: 15 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 },
      (err, _out, stderr) => {
        if (err) {
          const tail = (stderr || err.message || '').split('\n').filter(Boolean).slice(-3).join(' ');
          reject(new Error(tail || 'ffmpeg 执行失败'));
        } else resolve();
      });
  });
}

/* 支持 "90"、"01:30"、"00:01:30.5" 等格式，返回秒数 */
function parseTime(t) {
  if (typeof t !== 'string' || !t.trim()) return null;
  if (!/^\d{1,3}(:\d{1,2}){0,2}(\.\d+)?$/.test(t.trim())) return null;
  return t.trim().split(':').reduce((acc, x) => acc * 60 + parseFloat(x), 0);
}

function sendResultFile(res, file, filename, mime) {
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  const stream = fs.createReadStream(file);
  stream.on('close', () => safeRemove(file));
  stream.on('error', () => safeRemove(file));
  stream.pipe(res);
}

/* ================= CSV / JSON 转换 ================= */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r[0] || '').trim() !== '');
}

function jsonToCsv(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('JSON 格式不合法'); }
  if (!Array.isArray(data) || !data.length) throw new Error('JSON 顶层需为非空数组（对象列表）');
  if (typeof data[0] !== 'object' || data[0] === null) throw new Error('数组元素需为对象');
  const keys = [...new Set(data.flatMap(o => Object.keys(o || {})))];
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...data.map(o => keys.map(k => esc(o?.[k])).join(','))].join('\r\n');
}

function csvToJson(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('CSV 内容为空');
  const header = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(c => c !== ''))
    .map(r => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = r[i] ?? ''; });
      return obj;
    });
}

/* ================= API：服务状态 ================= */
router.get('/status', async (req, res) => {
  res.json({ server: 'ok', ffmpeg: await checkFfmpeg() });
});

/* ================= API：格式转换 ================= */
router.post('/convert', (req, res) => {
  const { type, content } = req.body || {};
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ message: '请输入要转换的内容' });
  }
  try {
    let result = '';
    if (type === 'md2html') {
      result = marked.parse(content, { async: false });
    } else if (type === 'json2csv') {
      result = jsonToCsv(content);
    } else if (type === 'csv2json') {
      result = JSON.stringify(csvToJson(content), null, 2);
    } else {
      return res.status(400).json({ message: '不支持的转换类型' });
    }
    res.json({ result });
  } catch (e) {
    res.status(422).json({ message: '转换失败：' + e.message });
  }
});

/* ================= API：音频提取 ================= */
router.post('/audio-extract', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择视频文件' });
  const src = req.file.path;
  const out = tmpFile('.mp3');
  try {
    await runFfmpeg(['-y', '-i', src, '-vn', '-acodec', 'libmp3lame', '-b:a', '192k', out]);
    const base = path.basename(req.file.originalname, path.extname(req.file.originalname)) || 'audio';
    sendResultFile(res, out, `${base}-音频.mp3`, 'audio/mpeg');
  } catch (e) {
    safeRemove(out);
    res.status(500).json({ message: `音频提取失败（需服务器安装 ffmpeg）：${e.message}` });
  } finally {
    safeRemove(src);
  }
});

/* ================= API：视频片段提取 ================= */
router.post('/video-clip', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择视频文件' });
  const src = req.file.path;
  const srcExt = path.extname(req.file.originalname).toLowerCase() || '.mp4';
  const out = tmpFile(srcExt);
  const start = parseTime(req.body.start);
  const end = parseTime(req.body.end);

  if (start === null && end === null) {
    safeRemove(src); safeRemove(out);
    return res.status(400).json({ message: '请填写开始或结束时间（支持 90 或 00:01:30 格式）' });
  }
  if (start !== null && end !== null && end <= start) {
    safeRemove(src); safeRemove(out);
    return res.status(400).json({ message: '结束时间必须大于开始时间' });
  }

  try {
    const args = ['-y'];
    if (start !== null) args.push('-ss', String(start));
    if (end !== null) args.push('-to', String(end));
    args.push('-i', src, '-c', 'copy', out);
    await runFfmpeg(args);
    const base = path.basename(req.file.originalname, srcExt) || 'video';
    sendResultFile(res, out, `${base}-片段${srcExt}`, 'video/mp4');
  } catch (e) {
    safeRemove(out);
    res.status(500).json({ message: `视频提取失败（需服务器安装 ffmpeg）：${e.message}` });
  } finally {
    safeRemove(src);
  }
});

/* ================= API：文本提取 ================= */
router.post('/text-extract', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择文件' });
  const src = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();
  try {
    if (ext === '.pdf') {
      const pdf = await pdfParse(fs.readFileSync(src));
      res.json({ text: (pdf.text || '').trim(), pages: pdf.numpages });
    } else if (['.txt', '.md', '.csv', '.json'].includes(ext)) {
      res.json({ text: fs.readFileSync(src, 'utf8') });
    } else {
      res.status(400).json({ message: '暂仅支持 PDF / TXT / MD / CSV / JSON 文件' });
    }
  } catch (e) {
    res.status(500).json({ message: '文本提取失败：' + e.message });
  } finally {
    safeRemove(src);
  }
});

module.exports = router;
