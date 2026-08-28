"""高级处理类：叠加/缩放/对比度/重命名/脚本/扫描切分/修复/解锁。"""
import fitz  # PyMuPDF
import os
from pathlib import Path
from .core import register, save_uploads, new_tmp, send_file, require
from fastapi import HTTPException


@register("overlay", desc="PDF 叠加")
def overlay(files, params):
    saved = save_uploads(files)
    base = saved[0][0]
    bg = params.get("backgroundFile") or (saved[1][0] if len(saved) > 1 else None)
    mode = params.get("mode", "over")
    doc = fitz.open(str(base))
    bdoc = fitz.open(str(bg))
    for i in range(min(doc.page_count, bdoc.page_count)):
        if mode == "over":
            doc[i].show_pdf_page(doc[i].rect, bdoc, i)
        else:
            doc[i].draw_rect(doc[i].rect, color=None, fill=(1, 1, 1))
            doc[i].show_pdf_page(doc[i].rect, bdoc, i)
    out = new_tmp() / "overlay.pdf"
    doc.save(str(out))
    doc.close()
    bdoc.close()
    return send_file(out, "overlay.pdf", "application/pdf")


@register("adjust-scale", desc="调整页面缩放")
def adjust_scale(files, params):
    p, _, _ = save_uploads(files)[0]
    scale = float(params.get("scale", 100)) / 100
    doc = fitz.open(str(p))
    out = fitz.open()
    for page in doc:
        w, h = page.rect.width * scale, page.rect.height * scale
        np = out.new_page(width=w, height=h)
        np.show_pdf_page(np.rect, doc, page.number)
    op = new_tmp() / "scaled.pdf"
    out.save(str(op))
    out.close()
    doc.close()
    return send_file(op, "scaled.pdf", "application/pdf")


@register("adjust-contrast", desc="调整对比度")
def adjust_contrast(files, params):
    import PIL.Image as Image
    from PIL import ImageEnhance
    p, _, _ = save_uploads(files)[0]
    contrast = float(params.get("contrast", 0)) / 100
    brightness = float(params.get("brightness", 0)) / 100
    gray = params.get("grayscale") in ("true", True)
    doc = fitz.open(str(p))
    out = fitz.open()
    scale = 1.5
    for page in doc:
        pm = page.get_pixmap(matrix=fitz.Matrix(scale, scale))
        img = Image.frombytes("RGB", (pm.width, pm.height), pm.samples)
        if gray:
            img = img.convert("L")
        img = ImageEnhance.Contrast(img).enhance(1 + contrast)
        img = ImageEnhance.Brightness(img).enhance(1 + brightness)
        np = out.new_page(width=page.rect.width, height=page.rect.height)
        np.insert_image(np.rect, stream=img.tobytes(), pixmap=pm)
    op = new_tmp() / "contrast.pdf"
    out.save(str(op))
    out.close()
    doc.close()
    return send_file(op, "contrast.pdf", "application/pdf")


@register("auto-rename", desc="按内容重命名")
def auto_rename(files, params):
    import re
    saved = save_uploads(files)
    pattern = params.get("pattern", "{title}")
    names = []
    for p, orig, _ in saved:
        doc = fitz.open(str(p))
        text = doc[0].get_text()[:500]
        doc.close()
        title = (re.search(r"标题[:：]\s*(.+)", text) or re.search(r"(.+)", text))
        title = title.group(1).strip()[:30] if title else Path(orig).stem
        new = pattern.replace("{title}", title).replace("{author}", "未知")
        names.append(new)
    return {"names": names}


@register("show-js", desc="查看内嵌脚本")
def show_js(files, params):
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    scripts = []
    for i, page in enumerate(doc):
        for j in range(page.get_links() and len(page.get_links()) or 0):
            pass
    # 通过 pypdf 读取 JavaScript
    from pypdf import PdfReader
    reader = PdfReader(str(p))
    js = reader.trailer.get("/Root", {}).get("/Names", {})
    scripts.append(str(js))
    doc.close()
    return {"scripts": scripts}


@register("scanner-split", desc="扫描件切分")
def scanner_split(files, params):
    p, _, _ = save_uploads(files)[0]
    layout = int(params.get("layout", 2))
    doc = fitz.open(str(p))
    out = fitz.open()
    for page in doc:
        w, h = page.rect.width, page.rect.height
        if layout == 2:
            rects = [fitz.Rect(0, 0, w / 2, h), fitz.Rect(w / 2, 0, w, h)]
        else:
            rects = [fitz.Rect(0, 0, w / 2, h / 2), fitz.Rect(w / 2, 0, w, h / 2),
                     fitz.Rect(0, h / 2, w / 2, h), fitz.Rect(w / 2, h / 2, w, h)]
        for r in rects:
            np = out.new_page(width=r.width, height=r.height)
            np.show_pdf_page(np.rect, doc, page.number, clip=r)
    op = new_tmp() / "split-scan.pdf"
    out.save(str(op))
    out.close()
    doc.close()
    return send_file(op, "split-scan.pdf", "application/pdf")


@register("repair", desc="修复 PDF")
def repair(files, params):
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    out = new_tmp() / "repaired.pdf"
    doc.save(str(out), clean=True, deflate=True)
    doc.close()
    return send_file(out, "repaired.pdf", "application/pdf")


@register("unlock-forms", desc="解锁表单")
def unlock_forms(files, params):
    from pypdf import PdfReader, PdfWriter
    p, _, _ = save_uploads(files)[0]
    reader = PdfReader(str(p))
    w = PdfWriter()
    w.append(reader)
    out = new_tmp() / "unlocked.pdf"
    with open(out, "wb") as f:
        w.write(f)
    return send_file(out, "unlocked.pdf", "application/pdf")


@register("booklet", desc="小册子拼版")
def booklet(files, params):
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    out = fitz.open()
    n = doc.page_count
    # 简易对折：两两背靠背
    for i in range(0, n, 2):
        np = out.new_page(width=doc[0].rect.width * 2, height=doc[0].rect.height)
        np.show_pdf_page(fitz.Rect(0, 0, doc[0].rect.width, doc[0].rect.height), doc, i)
        if i + 1 < n:
            np.show_pdf_page(fitz.Rect(doc[0].rect.width, 0, doc[0].rect.width * 2, doc[0].rect.height), doc, i + 1)
    op = new_tmp() / "booklet.pdf"
    out.save(str(op))
    out.close()
    doc.close()
    return send_file(op, "booklet.pdf", "application/pdf")
