"""其他工具类：OCR(需Tesseract)/比较/结构分析/XML/书签/字体/动作。"""
import fitz  # PyMuPDF
import os
from pathlib import Path
from .core import register, save_uploads, new_tmp, send_file, require
from fastapi import HTTPException


@register("ocr", desc="OCR 文字识别（需 Tesseract）")
def ocr(files, params):
    require("tesseract")
    p, _, _ = save_uploads(files)[0]
    lang = params.get("lang", "chi_sim")
    searchable = params.get("searchable") in ("true", True)
    import subprocess
    out = new_tmp() / "ocr.pdf"
    if searchable:
        # 生成可搜索层（需 OCRmyPDF，若已安装）
        if os.system("which ocrmypdf >/dev/null 2>&1") == 0:
            subprocess.run(["ocrmypdf", "-l", lang, str(p), str(out)], check=True)
        else:
            raise HTTPException(status_code=501, detail="可搜索 OCR 需安装 OCRmyPDF")
    else:
        doc = fitz.open(str(p))
        for page in doc:
            pix = page.get_pixmap()
            pix.save(new_tmp() / "tmp.png")
            txt = subprocess.run(["tesseract", "stdin", "stdout", "-l", lang],
                                 input=pix.tobytes(), capture_output=True).stdout.decode("utf-8", "ignore")
            page.insert_text((50, 50), txt)
        doc.save(str(out))
        doc.close()
    return send_file(out, "ocr.pdf", "application/pdf")


@register("compare", desc="文档比较")
def compare(files, params):
    """逐页对比两份 PDF 的文本差异。

    返回每页的新增/删除行数与 unified diff，并汇总变更页数。
    """
    import difflib
    saved = save_uploads(files)
    if len(saved) < 2:
        raise HTTPException(status_code=400, detail="需上传两份文件（原稿 + 修改稿）")

    da = fitz.open(str(saved[0][0]))
    db = fitz.open(str(saved[1][0]))
    count_a, count_b = da.page_count, db.page_count

    pages = []
    total_added = total_removed = 0
    for i in range(max(count_a, count_b)):
        ta = da[i].get_text("text") if i < count_a else ""
        tb = db[i].get_text("text") if i < count_b else ""
        diff = list(difflib.unified_diff(ta.splitlines(), tb.splitlines(), lineterm="", n=1))
        added = sum(1 for x in diff if x.startswith("+") and not x.startswith("+++"))
        removed = sum(1 for x in diff if x.startswith("-") and not x.startswith("---"))
        total_added += added
        total_removed += removed
        pages.append({
            "page": i + 1,
            "identical": ta.strip() == tb.strip(),
            "added": added,
            "removed": removed,
            "diff": "\n".join(diff),
        })

    da.close()
    db.close()
    return {
        "pageCountA": count_a,
        "pageCountB": count_b,
        "changedPages": sum(1 for pg in pages if not pg["identical"]),
        "totalAdded": total_added,
        "totalRemoved": total_removed,
        "pages": pages,
    }


@register("read-annotate", desc="阅读与批注（返回页数）")
def read_annotate(files, params):
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    res = {"pages": doc.page_count, "canAnnotate": True}
    doc.close()
    return res


@register("inspect-structure", desc="文档结构分析")
def inspect_structure(files, params):
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    nodes = []
    for i, page in enumerate(doc):
        nodes.append({"page": i + 1, "objects": len(page.get_images()) + len(page.get_links())})
    doc.close()
    return {"pages": nodes}


@register("export-xml", desc="导出 XML 结构")
def export_xml(files, params):
    import xml.etree.ElementTree as ET
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    root = ET.Element("pdf")
    for i, page in enumerate(doc):
        pg = ET.SubElement(root, "page", id=str(i + 1))
        pg.set("width", str(page.rect.width))
        pg.set("height", str(page.rect.height))
    out = new_tmp() / "structure.xml"
    out.write_text(ET.tostring(root, encoding="unicode"), encoding="utf-8")
    doc.close()
    return send_file(out, "structure.xml", "application/xml")


@register("edit-bookmarks", desc="书签编辑器")
def edit_bookmarks(files, params):
    p, _, _ = save_uploads(files)[0]
    mode = params.get("mode", "auto")
    doc = fitz.open(str(p))
    if mode == "auto":
        prefix = params.get("prefix", "")
        toc = [[1, f"{prefix}{i + 1}", i + 1] for i in range(doc.page_count)]
        doc.set_toc(toc)
    else:
        find = params.get("find", "")
        replace = params.get("replace", "")
        toc = doc.get_toc()
        for t in toc:
            t[1] = t[1].replace(find, replace)
        doc.set_toc(toc)
    out = new_tmp() / "bookmarks.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "bookmarks.pdf", "application/pdf")


@register("replace-fonts", desc="字体替换/嵌入")
def replace_fonts(files, params):
    p, _, _ = save_uploads(files)[0]
    font_file = params.get("fontFile")
    doc = fitz.open(str(p))
    if font_file:
        font = fitz.Font(fontfile=font_file)
        for page in doc:
            page.insert_font(fontname="china-s", fontbuffer=font.buffer)
    out = new_tmp() / "fonts.pdf"
    doc.save(str(out), deflate=True, subset_fonts=True)
    doc.close()
    return send_file(out, "fonts.pdf", "application/pdf")


@register("remove-actions", desc="移除文档动作")
def remove_actions(files, params):
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    # 清除 OpenAction / JS
    if "OpenAction" in doc.pdf_catalog():
        del doc.pdf_catalog()["OpenAction"]
    out = new_tmp() / "no-actions.pdf"
    doc.save(str(out), clean=True)
    doc.close()
    return send_file(out, "no-actions.pdf", "application/pdf")
