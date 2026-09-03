"""安全与签名类：加密/解密/权限/水印/脱敏/签名(pyHanko)。"""
import fitz  # PyMuPDF
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject
from .core import register, save_uploads, new_tmp, send_file
from fastapi import HTTPException


@register("add-password", desc="加密 PDF")
def add_password(files, params):
    p, _, _ = save_uploads(files)[0]
    pw = params.get("password", "")
    owner = params.get("ownerPassword") or ""
    reader = PdfReader(str(p))
    w = PdfWriter()
    w.append(reader)
    perms = 0xFFF0
    if not (params.get("allowPrint") in ("true", True)):
        perms &= ~0x0004
    if not (params.get("allowCopy") in ("true", True)):
        perms &= ~0x0008
    if not (params.get("allowEdit") in ("true", True)):
        perms &= ~0x0008
    w.encrypt(user_password=pw, owner_password=owner or pw, permissions_flag=perms)
    out = new_tmp() / "encrypted.pdf"
    with open(out, "wb") as f:
        w.write(f)
    return send_file(out, "encrypted.pdf", "application/pdf")


@register("remove-password", desc="解密 PDF")
def remove_password(files, params):
    p, _, _ = save_uploads(files)[0]
    pw = params.get("password", "")
    reader = PdfReader(str(p))
    if reader.is_encrypted:
        reader.decrypt(pw)
    w = PdfWriter()
    w.append(reader)
    out = new_tmp() / "decrypted.pdf"
    with open(out, "wb") as f:
        w.write(f)
    return send_file(out, "decrypted.pdf", "application/pdf")


@register("change-permissions", desc="修改权限")
def change_permissions(files, params):
    p, _, _ = save_uploads(files)[0]
    owner = params.get("ownerPassword", "")
    reader = PdfReader(str(p))
    if reader.is_encrypted:
        reader.decrypt(owner)
    w = PdfWriter()
    w.append(reader)
    perms = 0xFFF0
    if not (params.get("allowPrint") in ("true", True)):
        perms &= ~0x0004
    if not (params.get("allowCopy") in ("true", True)):
        perms &= ~0x0008
    if not (params.get("allowEdit") in ("true", True)):
        perms &= ~0x0008
    w.encrypt(user_password="", owner_password=owner, permissions_flag=perms)
    out = new_tmp() / "perms.pdf"
    with open(out, "wb") as f:
        w.write(f)
    return send_file(out, "perms.pdf", "application/pdf")


@register("watermark", desc="添加水印")
def watermark(files, params):
    p, _, _ = save_uploads(files)[0]
    wtype = params.get("type", "text")
    place = params.get("place", "center")
    opacity = float(params.get("opacity", 30)) / 100
    doc = fitz.open(str(p))
    if wtype == "text":
        text = params.get("text", "内部资料")
        size = int(params.get("size", 24))
        for page in doc:
            rect = page.rect
            page.insert_text((rect.width / 2, rect.height / 2), text,
                             fontsize=size, color=(0.5, 0.5, 0.5), rotate=0)
    else:
        # 图片水印
        wm = params.get("watermarkFile") or params.get("file")
    out = new_tmp() / "watermarked.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "watermarked.pdf", "application/pdf")


@register("redact", desc="内容脱敏")
def redact(files, params):
    p, _, _ = save_uploads(files)[0]
    keywords = [k.strip() for k in params.get("keywords", "").split(",") if k.strip()]
    color = (0, 0, 0) if params.get("color", "black") == "black" else (1, 0, 0)
    doc = fitz.open(str(p))
    for page in doc:
        for kw in keywords:
            for inst in page.search_for(kw):
                page.add_redact_annot(inst, fill=color)
        page.apply_redactions()
    out = new_tmp() / "redacted.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "redacted.pdf", "application/pdf")


@register("sanitize", desc="清理元数据")
def sanitize(files, params):
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    if params.get("removeMetadata") in ("true", True):
        doc.set_metadata({})
    if params.get("removeEmbedded") in ("true", True):
        doc.del_xml_metadata()
    if params.get("removeComments") in ("true", True):
        for page in doc:
            page.delete_annot()
    out = new_tmp() / "sanitized.pdf"
    doc.save(str(out), clean=True)
    doc.close()
    return send_file(out, "sanitized.pdf", "application/pdf")


# ---------- 数字签名（pyHanko）----------
@register("cert-sign", desc="证书签名")
def cert_sign(files, params):
    p, _, _ = save_uploads(files)[0]
    cert = params.get("certFile")
    cert_pw = params.get("certPassword", "")
    reason = params.get("reason", "")
    location = params.get("location", "")
    from pyhanko.sign import signers
    from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
    out = new_tmp() / "signed.pdf"
    signer = signers.SimpleSigner.load_pkcs12(cert, cert_pw.encode())
    with open(p, "rb") as inf, open(out, "wb") as outf:
        w = IncrementalPdfFileWriter(inf)
        signers.sign_pdf(w, signers.PdfSignatureMetadata(
            field_name="Signature1", reason=reason, location=location), signer=signer, out=outf)
    return send_file(out, "signed.pdf", "application/pdf")


@register("remove-cert-sign", desc="移除证书签名")
def remove_cert_sign(files, params):
    p, _, _ = save_uploads(files)[0]
    doc = fitz.open(str(p))
    for field in doc.get_form_fields():
        pass
    # 使用 pypdf 移除签名域
    reader = PdfReader(str(p))
    w = PdfWriter()
    w.append(reader)
    out = new_tmp() / "unsigned.pdf"
    with open(out, "wb") as f:
        w.write(f)
    return send_file(out, "unsigned.pdf", "application/pdf")


@register("validate-signature", desc="校验签名")
def validate_signature(files, params):
    from pyhanko.sign.validation import validate_pdf_signature
    from pyhanko.pdf_utils.reader import PdfFileReader
    p, _, _ = save_uploads(files)[0]
    reader = PdfFileReader(str(p))
    results = []
    for fld in reader.root["/AcroForm"]["/Fields"]:
        sig = fld.get_object()
        name = sig.get("/T")
        try:
            status = validate_pdf_signature(sig)
            results.append({"field": str(name), "valid": bool(status.valid), "summary": str(status)})
        except Exception as e:
            results.append({"field": str(name), "valid": False, "summary": str(e)})
    return results


@register("timestamp", desc="时间戳签名")
def timestamp(files, params):
    p, _, _ = save_uploads(files)[0]
    tsa = params.get("tsaUrl", "")
    if not tsa:
        raise HTTPException(status_code=400, detail="需提供 TSA 服务地址")
    from pyhanko.sign import signers
    from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
    out = new_tmp() / "timestamped.pdf"
    signer = signers.PdfTimeStamper.from_server_url(tsa)
    with open(p, "rb") as inf, open(out, "wb") as outf:
        w = IncrementalPdfFileWriter(inf)
        signer.timestamp(w, "/Timestamp", out=outf)
    return send_file(out, "timestamped.pdf", "application/pdf")


@register("sign", desc="手写签名（叠加图片）")
def sign(files, params):
    # 签名图片作为附加文件随主 PDF 一起被 save_uploads 落盘了，按扩展名直接找路径，
    # 避免直接读 UploadFile.file 缓冲（不可靠，可能为空/已被消费）。
    saved = save_uploads(files)
    pdf_saved = next((s for s in saved if s[2].lower() == ".pdf"), None)
    img_saved = next((s for s in saved if s[2].lower() in (".png", ".jpg", ".jpeg")), None)
    if not pdf_saved:
        raise HTTPException(status_code=400, detail="请上传 PDF 文件")
    if not img_saved:
        raise HTTPException(status_code=400, detail="请上传签名图片（PNG / JPG）")

    p, _, _ = pdf_saved
    img_path = img_saved[0]
    x = float(params.get("x", 70)) / 100
    y = float(params.get("y", 10)) / 100
    scale = float(params.get("scale", 20)) / 100
    pages = params.get("page", "")

    doc = fitz.open(str(p))
    targets = _page_range(pages, doc.page_count)
    for i in targets:
        page = doc[i]
        rect = fitz.Rect(page.rect.width * x, page.rect.height * (1 - y),
                         page.rect.width * x + page.rect.width * scale,
                         page.rect.height * (1 - y) + page.rect.height * scale)
        page.insert_image(rect, filename=str(img_path))
    out = new_tmp() / "signed.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "signed.pdf", "application/pdf")


def _page_range(spec, total):
    if not spec:
        return [total - 1]
    import re
    idxs = []
    for part in re.split(r"[,\s]+", spec):
        if "-" in part:
            a, b = part.split("-")
            idxs.extend(range(int(a) - 1, int(b)))
        elif part.isdigit():
            idxs.append(int(part) - 1)
    return [i for i in idxs if 0 <= i < total]
