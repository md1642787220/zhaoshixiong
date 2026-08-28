"""页面操作类：合并/拆分/旋转/提取/重排/页码/删除/空白/裁剪/布局/长页。"""
import fitz  # PyMuPDF
from pypdf import PdfReader, PdfWriter
from .core import register, save_uploads, new_tmp, send_file, TMP


def _open(path):
    return fitz.open(str(path))


@register("merge", desc="合并 PDF")
def merge(files, params):
    saved = save_uploads(files)
    writer = PdfWriter()
    for p, _, _ in saved:
        reader = PdfReader(str(p))
        for page in reader.pages:
            writer.add_page(page)
    out = new_tmp() / "merged.pdf"
    with open(out, "wb") as f:
        writer.write(f)
    return send_file(out, "merged.pdf", "application/pdf")


@register("split", desc="拆分 PDF")
def split(files, params):
    import re
    p, _, _ = save_uploads(files)[0]
    mode = params.get("mode", "pages")
    reader = PdfReader(str(p))
    total = len(reader.pages)
    out_dir = new_tmp()
    if mode == "every":
        n = max(1, int(params.get("every", 1)))
        for i in range(0, total, n):
            w = PdfWriter()
            for j in range(i, min(i + n, total)):
                w.add_page(reader.pages[j])
            o = out_dir / f"part-{i // n + 1:03d}.pdf"
            with open(o, "wb") as f:
                w.write(f)
    else:
        # pages / intervals
        spec = params.get("pages") or params.get("intervals") or ""
        idxs = []
        for part in re.split(r"[,\s]+", spec):
            if "-" in part:
                a, b = part.split("-")
                idxs.extend(range(int(a) - 1, int(b)))
            elif part.isdigit():
                idxs.append(int(part) - 1)
        for k, pg in enumerate(idxs):
            if 0 <= pg < total:
                w = PdfWriter()
                w.add_page(reader.pages[pg])
                o = out_dir / f"page-{k + 1:03d}.pdf"
                with open(o, "wb") as f:
                    w.write(f)
    return _zip_dir(out_dir, "split.zip")


@register("rotate", desc="旋转页面")
def rotate(files, params):
    p, _, _ = save_uploads(files)[0]
    angle = int(params.get("angle", 90))
    pages = params.get("pages", "")
    doc = _open(p)
    targets = _page_list(pages, doc.page_count) if pages else range(doc.page_count)
    for i in targets:
        doc[i].set_rotation((doc[i].rotation + angle) % 360)
    out = new_tmp() / "rotated.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "rotated.pdf", "application/pdf")


@register("auto-rotate", desc="自动纠偏旋转")
def auto_rotate(files, params):
    p, _, _ = save_uploads(files)[0]
    doc = _open(p)
    for page in doc:
        rot = page.rotation
        if rot not in (0, 90, 180, 270):
            page.set_rotation(0)
    out = new_tmp() / "auto-rotated.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "auto-rotated.pdf", "application/pdf")


@register("extract-pages", desc="提取页面")
def extract_pages(files, params):
    p, _, _ = save_uploads(files)[0]
    pages = params.get("pages", "")
    reverse = params.get("reverse") == "true" or params.get("reverse") is True
    reader = PdfReader(str(p))
    idxs = _page_list(pages, len(reader.pages))
    if reverse:
        idxs = list(reversed(idxs))
    w = PdfWriter()
    for i in idxs:
        w.add_page(reader.pages[i])
    out = new_tmp() / "extracted.pdf"
    with open(out, "wb") as f:
        w.write(f)
    return send_file(out, "extracted.pdf", "application/pdf")


@register("reorganize", desc="重排页面")
def reorganize(files, params):
    p, _, _ = save_uploads(files)[0]
    order = params.get("order", "")
    reverse = params.get("reverse") == "true" or params.get("reverse") is True
    reader = PdfReader(str(p))
    if reverse:
        idxs = list(range(len(reader.pages) - 1, -1, -1))
    else:
        idxs = _page_list(order, len(reader.pages))
    w = PdfWriter()
    for i in idxs:
        w.add_page(reader.pages[i])
    out = new_tmp() / "reorganized.pdf"
    with open(out, "wb") as f:
        w.write(f)
    return send_file(out, "reorganized.pdf", "application/pdf")


@register("page-numbers", desc="添加页码")
def page_numbers(files, params):
    p, _, _ = save_uploads(files)[0]
    pos = params.get("position", "bottom-center")
    text = params.get("text", "")
    start = int(params.get("start", 1))
    doc = _open(p)
    y_map = {"bottom-center": 0.92, "bottom-right": 0.92, "bottom-left": 0.92, "top-center": 0.05}
    y = y_map.get(pos, 0.92)
    for i, page in enumerate(doc):
        n = start + i
        label = f"{text} {n}" if text else str(n)
        x = 0.5 if "center" in pos else (0.9 if "right" in pos else 0.1)
        page.insert_text((page.rect.width * x, page.rect.height * y),
                         label, fontsize=10, color=(0, 0, 0))
    out = new_tmp() / "numbered.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "numbered.pdf", "application/pdf")


@register("remove-pages", desc="删除页面")
def remove_pages(files, params):
    from pypdf import PdfWriter as W
    p, _, _ = save_uploads(files)[0]
    pages = params.get("pages", "")
    reader = PdfReader(str(p))
    drop = set(_page_list(pages, len(reader.pages)))
    w = W()
    for i, page in enumerate(reader.pages):
        if i not in drop:
            w.add_page(page)
    out = new_tmp() / "removed.pdf"
    with open(out, "wb") as f:
        w.write(f)
    return send_file(out, "removed.pdf", "application/pdf")


@register("remove-blanks", desc="删除空白页")
def remove_blanks(files, params):
    p, _, _ = save_uploads(files)[0]
    threshold = float(params.get("threshold", 95))
    doc = _open(p)
    keep = []
    for i, page in enumerate(doc):
        txt = page.get_text().strip()
        if txt or page.get_images():
            keep.append(i)
    new = fitz.open()
    for i in keep:
        new.insert_pdf(doc, from_page=i, to_page=i)
    out = new_tmp() / "no-blanks.pdf"
    new.save(str(out))
    new.close()
    doc.close()
    return send_file(out, "no-blanks.pdf", "application/pdf")


@register("crop", desc="裁剪页面")
def crop(files, params):
    p, _, _ = save_uploads(files)[0]
    t, b, l, r = (float(params.get(k, 0)) for k in ("top", "bottom", "left", "right"))
    doc = _open(p)
    for page in doc:
        rct = page.rect
        clip = fitz.Rect(rct.x0 + l, rct.y0 + t, rct.x1 - r, rct.y1 - b)
        page.set_cropbox(clip)
    out = new_tmp() / "cropped.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "cropped.pdf", "application/pdf")


@register("page-layout", desc="多页布局")
def page_layout(files, params):
    p, _, _ = save_uploads(files)[0]
    cols = int(params.get("cols", 2))
    rows = int(params.get("rows", 2))
    doc = _open(p)
    out = new_tmp() / "layout.pdf"
    result = fitz.open()
    src_w, src_h = doc[0].rect.width, doc[0].rect.height
    cell_w, cell_h = src_w / cols, src_h / rows
    idx = 0
    while idx < doc.page_count:
        page = result.new_page(width=src_w, height=src_h)
        for r in range(rows):
            for c in range(cols):
                if idx >= doc.page_count:
                    break
                rect = fitz.Rect(c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h)
                page.show_pdf_page(rect, doc, idx)
                idx += 1
    result.save(str(out))
    result.close()
    doc.close()
    return send_file(out, "layout.pdf", "application/pdf")


@register("single-large-page", desc="拼成长页")
def single_large_page(files, params):
    p, _, _ = save_uploads(files)[0]
    fmt = params.get("format", "pdf")
    doc = _open(p)
    w = doc[0].rect.width
    h = sum(page.rect.height for page in doc)
    if fmt == "pdf":
        big = fitz.open()
        big.new_page(width=w, height=h)
        y = 0
        for page in doc:
            big[0].show_pdf_page(fitz.Rect(0, y, w, y + page.rect.height), doc, page.number)
            y += page.rect.height
        out = new_tmp() / "long.pdf"
        big.save(str(out))
        big.close()
        doc.close()
        return send_file(out, "long.pdf", "application/pdf")
    else:
        # 渲染为 PNG 长图
        import PIL.Image as Image
        scale = 1.5
        imgs = [page.get_pixmap(matrix=fitz.Matrix(scale, scale)) for page in doc]
        total_h = sum(pm.height for pm in imgs)
        canvas = Image.new("RGB", (imgs[0].width, total_h), (255, 255, 255))
        y = 0
        for pm in imgs:
            canvas.paste(Image.frombytes("RGB", (pm.width, pm.height), pm.samples), (0, y))
            y += pm.height
        out = new_tmp() / "long.png"
        canvas.save(str(out))
        doc.close()
        return send_file(out, "long.png", "image/png")


def _page_list(spec, total):
    import re
    idxs = []
    for part in re.split(r"[,\s]+", spec or ""):
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-")
            idxs.extend(range(int(a) - 1, int(b)))
        elif part.isdigit():
            idxs.append(int(part) - 1)
    return [i for i in idxs if 0 <= i < total]


def _zip_dir(dir_path, filename):
    import zipfile, io
    from urllib.parse import quote
    from fastapi import Response
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(dir_path):
            for fn in files:
                fp = Path(root) / fn
                z.write(fp, fp.relative_to(dir_path))
    return Response(content=buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"})


import os
from pathlib import Path
