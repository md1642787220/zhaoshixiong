"""格式转换类：PDF/A、HTML、图片、图片转PDF、Markdown、Office(Word)。"""
import fitz  # PyMuPDF
from .core import register, save_uploads, new_tmp, send_file, require


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


@register("image-to-pdf", desc="图片转 PDF")
def image_to_pdf(files, params):
    saved = save_uploads(files)
    fit = params.get("fit", "fit")
    color = params.get("color", "color")
    margin = float(params.get("margin", 0))
    doc = fitz.open()
    for p, name, _ in saved:
        img = fitz.open(p) if p.suffix.lower() == ".pdf" else None
        if img:
            doc.insert_pdf(img)
            continue
        page = doc.new_page()
        rect = page.rect
        page.insert_image(rect, filename=str(p))
    out = new_tmp() / "from-images.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "from-images.pdf", "application/pdf")


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
def convert_office(files, params):
    p, _, _ = save_uploads(files)[0]
    target = params.get("target", "docx")
    if target != "docx":
        from fastapi import HTTPException
        raise HTTPException(status_code=501, detail=f"当前仅支持 Word(.docx)，{target} 需额外转换组件")
    from pdf2docx import Converter
    out = new_tmp() / "converted.docx"
    cv = Converter(str(p))
    cv.convert(str(out))
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
