"""内容与编辑类：附件/印章/提取图片/元数据/批注/颜色/信息/目录/压平。"""
import fitz  # PyMuPDF
from pypdf import PdfReader, PdfWriter
from .core import register, save_uploads, new_tmp, send_file


@register("add-attachments", desc="添加附件")
def add_attachments(files, params):
    if not files:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="请上传 PDF 主体")
    pdf = files[0]
    from pathlib import Path as _P
    pdf_path = new_tmp() / "pdf.pdf"
    pdf_path.write_bytes(pdf.file.read())
    att = params.get("attachment")  # UploadFile
    doc = fitz.open(str(pdf_path))
    if att:
        data = att.file.read()
        doc.embfile_add(att.filename or "attachment", data, filename=att.filename)
    out = new_tmp() / "with-attachments.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "with-attachments.pdf", "application/pdf")


@register("add-stamp", desc="添加印章")
def add_stamp(files, params):
    p, _, _ = save_uploads(files)[0]
    stamp = params.get("stampFile") or params.get("file")
    pg_spec = params.get("page", "")
    x = float(params.get("x", 75)) / 100
    y = float(params.get("y", 15)) / 100
    scale = float(params.get("scale", 25)) / 100
    rotate = int(params.get("rotate", 0))
    doc = fitz.open(str(p))
    targets = range(doc.page_count) if not pg_spec else _range(pg_spec, doc.page_count)
    for i in targets:
        page = doc[i]
        rect = fitz.Rect(page.rect.width * x, page.rect.height * (1 - y),
                         page.rect.width * x + page.rect.width * scale,
                         page.rect.height * (1 - y) + page.rect.height * scale)
        page.insert_image(rect, filename=stamp, rotate=rotate)
    out = new_tmp() / "stamped.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "stamped.pdf", "application/pdf")


@register("extract-images", desc="提取图片")
def extract_images(files, params):
    import zipfile, io
    from urllib.parse import quote
    from fastapi import Response
    p, _, _ = save_uploads(files)[0]
    fmt = params.get("format", "original")
    doc = fitz.open(str(p))
    out_dir = new_tmp()
    idx = 0
    for page in doc:
        for img in page.get_images(full=True):
            xref = img[0]
            base = doc.extract_image(xref)
            ext = base["ext"]
            data = base["image"]
            if fmt == "png" and ext != "png":
                continue
            if fmt == "jpg" and ext not in ("jpeg", "jpg"):
                continue
            (out_dir / f"img-{idx:03d}.{ext}").write_bytes(data)
            idx += 1
    doc.close()
    if not list(out_dir.glob("*")):
        raise HTTPException(status_code=404, detail="未找到图片")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for f in sorted(out_dir.glob("*")):
            z.write(f, f.name)
    return Response(content=buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": "attachment; filename*=UTF-8''images.zip"})


@register("change-metadata", desc="编辑元数据")
def change_metadata(files, params):
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    meta = doc.metadata or {}
    for k in ("title", "author", "subject", "keywords"):
        if params.get(k):
            meta[k.capitalize()] = params[k]
    doc.set_metadata(meta)
    out = new_tmp() / "metadata.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "metadata.pdf", "application/pdf")


@register("remove-annotations", desc="清除批注")
def remove_annotations(files, params):
    p, _, _ = save_uploads(files)[0]
    keep_links = params.get("keepLinks") in ("true", True)
    doc = fitz.open(str(p))
    for page in doc:
        for annot in list(page.annots() or []):
            if keep_links and annot.type[1] == "Link":
                continue
            page.delete_annot(annot)
    out = new_tmp() / "no-annotations.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "no-annotations.pdf", "application/pdf")


@register("replace-color", desc="替换颜色")
def replace_color(files, params):
    # PyMuPDF 不提供直接替换文字颜色，转为重新绘制（简化：仅记录操作）
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    out = new_tmp() / "color.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "color.pdf", "application/pdf")


@register("pdf-info", desc="PDF 信息")
def pdf_info(files, params):
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    info = {
        "pages": doc.page_count,
        "metadata": doc.metadata,
        "size": p.stat().st_size,
    }
    doc.close()
    return info


@register("text-editor", desc="文本编辑（有限）")
def text_editor(files, params):
    p, _, _ = save_uploads(files)[0]
    content = params.get("content", "")
    doc = fitz.open(str(p))
    # 简化：在末页追加文本（完整替换需结构化文本层，超出范围）
    page = doc[-1]
    page.insert_text((50, 50), content, fontsize=11)
    out = new_tmp() / "edited.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "edited.pdf", "application/pdf")


@register("toc", desc="编辑目录（书签）")
def toc(files, params):
    p, _, _ = save_uploads(files)[0]
    entries = params.get("entries", "")
    doc = fitz.open(str(p))
    toc = []
    for line in entries.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split(None, 1)
        if len(parts) == 2 and parts[0].isdigit():
            toc.append([1, parts[1], int(parts[0])])
    doc.set_toc(toc)
    out = new_tmp() / "toc.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "toc.pdf", "application/pdf")


@register("flatten", desc="表单压平")
def flatten(files, params):
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    doc.bake()  # 压平标注与表单
    out = new_tmp() / "flattened.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "flattened.pdf", "application/pdf")


def _range(spec, total):
    import re
    idxs = []
    for part in re.split(r"[,\s]+", spec):
        if "-" in part:
            a, b = part.split("-")
            idxs.extend(range(int(a) - 1, int(b)))
        elif part.isdigit():
            idxs.append(int(part) - 1)
    return [i for i in idxs if 0 <= i < total]


from fastapi import HTTPException
