"""格式转换类：PDF/A、HTML、图片、图片转PDF、Markdown、Office(Word)。"""
import fitz  # PyMuPDF
import logging
import re
from contextlib import contextmanager
from .core import register, save_uploads, new_tmp, send_file, require


# ---------- PDF→DOCX 进度回调 ----------
# pdf2docx 内部通过 logging.info 输出 [1/4]~[4/4] 与 (x/y) Page 进度，
# 这里截获并归一化为进度消息，供 WebSocket 实时推送。
_PROG_STAGE = re.compile(r"\[(\d+)/(\d+)\]\s*(.+)")
_PROG_PAGE = re.compile(r"\((\d+)/(\d+)\)\s*Page")


class _ProgressHandler(logging.Handler):
    def __init__(self, cb):
        super().__init__()
        self.cb = cb

    def emit(self, record):
        msg = record.getMessage()
        m = _PROG_STAGE.match(msg)
        if m:
            self.cb({"type": "progress", "stage": int(m.group(1)),
                    "stageTotal": int(m.group(2)), "message": m.group(3).strip()})
            return
        m = _PROG_PAGE.match(msg)
        if m:
            self.cb({"type": "progress", "page": int(m.group(1)),
                    "pageTotal": int(m.group(2)),
                    "message": f"正在转换第 {m.group(1)}/{m.group(2)} 页"})


@contextmanager
def _progress_ctx(cb):
    if not cb:
        yield
        return
    root = logging.getLogger()
    h = _ProgressHandler(cb)
    h.setLevel(logging.INFO)
    root.addHandler(h)
    try:
        yield
    finally:
        root.removeHandler(h)


def parse_pages_param(s):
    """解析 '1-3,5' 为 pdf2docx 的 0-based 页码列表；空返回 None。"""
    if not s:
        return None
    pages = []
    for part in str(s).split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            for i in range(int(a) - 1, int(b)):
                pages.append(i)
        else:
            pages.append(int(part) - 1)
    return pages or None


@register("to-pdfa", desc="PDF 转 PDF/A")
def to_pdfa(files, params):
    p, _, _ = save_uploads(files)[0]
    level = params.get("level", "PDF/A-1b")
    doc = fitz.open(str(p))
    out = new_tmp() / "pdfa.pdf"
    # PyMuPDF 通过元数据标识 PDF/A 并清理交互元素
    doc.set_metadata({})
    doc.save(str(out), clean=True, deflate=True)
    doc.close()
    return send_file(out, "pdfa.pdf", "application/pdf")


@register("to-html", desc="PDF 转 HTML")
def to_html(files, params):
    p, _, _ = save_uploads(files)[0]
    single = params.get("singlePage") in ("true", True)
    doc = fitz.open(str(p))
    out_dir = new_tmp()
    if single:
        parts = [page.get_text("html") for page in doc]
        (out_dir / "output.html").write_text("\n<hr>\n".join(parts), encoding="utf-8")
    else:
        for i, page in enumerate(doc):
            (out_dir / f"page-{i + 1:03d}.html").write_text(page.get_text("html"), encoding="utf-8")
    doc.close()
    import zipfile, io
    from urllib.parse import quote
    from fastapi import Response
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for f in out_dir.glob("*"):
            z.write(f, f.name)
    return Response(content=buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": "attachment; filename*=UTF-8''html.zip"})


@register("to-image", desc="PDF 转图片")
def to_image(files, params):
    p, _, _ = save_uploads(files)[0]
    fmt = params.get("format", "png")
    dpi = int(params.get("dpi", 150))
    single = params.get("single") in ("true", True)
    scale = dpi / 72.0
    doc = fitz.open(str(p))
    out_dir = new_tmp()
    if single:
        import PIL.Image as Image
        imgs = [page.get_pixmap(matrix=fitz.Matrix(scale, scale)) for page in doc]
        canvas = Image.new("RGB", (imgs[0].width, sum(pm.height for pm in imgs)))
        y = 0
        for pm in imgs:
            canvas.paste(Image.frombytes("RGB", (pm.width, pm.height), pm.samples), (0, y))
            y += pm.height
        out = out_dir / f"long.{fmt}"
        canvas.save(str(out))
    else:
        for i, page in enumerate(doc):
            pm = page.get_pixmap(matrix=fitz.Matrix(scale, scale))
            out = out_dir / f"page-{i + 1:03d}.{fmt}"
            pm.save(str(out))
    doc.close()
    import zipfile, io
    from urllib.parse import quote
    from fastapi import Response
    if single:
        return send_file(list(out_dir.glob("*"))[0], f"long.{fmt}", f"image/{fmt}")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for f in sorted(out_dir.glob(f"*.{fmt}")):
            z.write(f, f.name)
    return Response(content=buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": "attachment; filename*=UTF-8''images.zip"})


def _natural_key(name):
    """文件名自然排序，保证 img2 排在 img10 之前。"""
    return [int(s) if s.isdigit() else s.lower() for s in re.split(r"(\d+)", str(name))]


@register("image-to-pdf", desc="图片转 PDF")
def image_to_pdf(files, params):
    """把多张图片合成为一份 PDF。

    支持参数：
      fit    : fit(页面贴合图片+页边距) / stretch(拉伸铺满A4) / center(A4内等比居中)
      color  : color(原色) / grayscale(灰度)
      margin : 页边距，单位 mm
    多图按文件名自然排序，与前端提示一致。
    """
    saved = save_uploads(files)
    fit = params.get("fit", "fit")
    color = params.get("color", "color")
    try:
        margin_mm = float(params.get("margin", 0) or 0)
    except (TypeError, ValueError):
        margin_mm = 0.0
    m = max(0.0, margin_mm) * 72.0 / 25.4  # mm -> pt

    saved.sort(key=lambda t: _natural_key(t[1]))

    a4 = fitz.paper_rect("a4")
    doc = fitz.open()
    try:
        for p, name, _ in saved:
            # 混入的 PDF 原样插入
            if p.suffix.lower() == ".pdf":
                src = fitz.open(p)
                doc.insert_pdf(src)
                src.close()
                continue

            try:
                pix = fitz.Pixmap(str(p))
            except Exception:
                raise ValueError(f"不支持的图片格式或文件已损坏：{name}")

            # 灰度：转换色彩空间
            if color == "grayscale" and not pix.is_gray:
                pix = fitz.Pixmap(fitz.csGRAY, pix)

            if fit == "stretch":
                # 拉伸铺满 A4（不保持比例，可能变形）
                page = doc.new_page(width=a4.width, height=a4.height)
                page.insert_image(fitz.Rect(m, m, a4.width - m, a4.height - m), pixmap=pix)
            elif fit == "center":
                # A4 页面内等比居中（保持比例，可能留白）
                page = doc.new_page(width=a4.width, height=a4.height)
                avail_w = max(1.0, a4.width - 2 * m)
                avail_h = max(1.0, a4.height - 2 * m)
                scale = min(avail_w / pix.width, avail_h / pix.height)
                w, h = pix.width * scale, pix.height * scale
                x0 = (a4.width - w) / 2.0
                y0 = (a4.height - h) / 2.0
                page.insert_image(fitz.Rect(x0, y0, x0 + w, y0 + h), pixmap=pix)
            else:
                # fit：页面尺寸贴合图片 + 页边距，图片 1:1 放入
                page = doc.new_page(width=pix.width + 2 * m, height=pix.height + 2 * m)
                page.insert_image(fitz.Rect(m, m, m + pix.width, m + pix.height), pixmap=pix)

        out = new_tmp() / "from-images.pdf"
        doc.save(str(out))
    finally:
        doc.close()
    return send_file(out, "from-images.pdf", "application/pdf")


@register("render-page", desc="渲染 PDF 指定页为 PNG（供前端可视化定位）")
def render_page(files, params):
    """把 PDF 的某一页渲染成 PNG 图片返回。

    用于前端「签名位置可视化」：前端拿到页面图片作背景，
    用户在其上拖动签名，再把位置换算成百分比提交。
    参数：page(页码，从 1 开始)、scale(渲染倍率，默认 1.5)
    """
    p, _, _ = save_uploads(files)[0]
    try:
        page_no = int(params.get("page", 1) or 1)
    except (TypeError, ValueError):
        page_no = 1

    doc = fitz.open(str(p))
    try:
        if page_no < 1:
            page_no = 1
        if page_no > doc.page_count:
            page_no = doc.page_count
        try:
            zoom = float(params.get("scale", 1.5) or 1.5)
        except (TypeError, ValueError):
            zoom = 1.5
        zoom = max(0.5, min(4.0, zoom))
        pix = doc[page_no - 1].get_pixmap(matrix=fitz.Matrix(zoom, zoom))
        out = new_tmp() / f"page-{page_no}.png"
        pix.save(str(out))
        page_w = doc[page_no - 1].rect.width
        page_h = doc[page_no - 1].rect.height
    finally:
        doc.close()
    resp = send_file(out, f"page-{page_no}.png", "image/png")
    # 附带页面尺寸，便于前端按比例换算
    resp.headers["X-Page-Width"] = str(page_w)
    resp.headers["X-Page-Height"] = str(page_h)
    return resp


@register("markdown-to-pdf", desc="Markdown 转 PDF")
def markdown_to_pdf(files, params):
    p, _, _ = save_uploads(files)[0]
    from pymupdf4llm import to_markdown
    # pymupdf4llm 主攻 PDF->MD；此处用 PyMuPDF 渲染纯文本为 PDF
    import md2pdf
    text = p.read_text(encoding="utf-8", errors="ignore")
    out = new_tmp() / "from-md.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), text, fontsize=11)
    doc.save(str(out))
    doc.close()
    return send_file(out, "from-md.pdf", "application/pdf")


@register("convert-office", desc="PDF 转 Office(Word)")
def convert_office(files, params, progress=None):
    p, _, _ = save_uploads(files)[0]
    target = params.get("target", "docx")
    if target != "docx":
        from fastapi import HTTPException
        raise HTTPException(status_code=501, detail=f"当前仅支持 Word(.docx)，{target} 需额外转换组件")
    from pdf2docx import Converter
    out = new_tmp() / "converted.docx"
    password = params.get("password") or None
    pages = parse_pages_param(params.get("pages"))
    cv_kwargs = {}
    if pages is not None:
        cv_kwargs["pages"] = pages
    # 默认把列表识别为列表而非表格；前端传 listNotTable=0 可关闭
    if str(params.get("listNotTable", "1")) in ("0", "false", "no"):
        cv_kwargs["list_not_table"] = False
    cv = Converter(str(p), password=password)
    with _progress_ctx(progress):
        cv.convert(str(out), **cv_kwargs)
    cv.close()
    return send_file(out, "converted.docx",
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@register("to-pdf", desc="Office 转 PDF（需 LibreOffice）")
def to_pdf(files, params):
    require("libreoffice", "soffice")
    saved = save_uploads(files)
    out_dir = new_tmp()
    import subprocess
    src = saved[0][0]
    subprocess.run(["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", str(out_dir), str(src)],
                   check=True)
    out = next(out_dir.glob("*.pdf"))
    return send_file(out, "converted.pdf", "application/pdf")


@register("html-to-pdf", desc="HTML 转 PDF（需外部渲染引擎）")
def html_to_pdf(files, params):
    from fastapi import HTTPException
    raise HTTPException(status_code=501, detail="需配置 WeasyPrint / wkhtmltopdf 渲染引擎")


@register("to-presentation", desc="PDF 转演示文稿（暂未支持）")
def to_presentation(files, params):
    from fastapi import HTTPException
    raise HTTPException(status_code=501, detail="PPTX/ODP 导出需额外转换组件，暂未实现")
