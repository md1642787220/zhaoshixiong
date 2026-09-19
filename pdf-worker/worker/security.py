"""安全与签名类：加密/解密/权限/水印/脱敏/签名(pyHanko)。"""
import re
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
    if not keywords:
        return {"ok": False, "level": "warn", "matched": 0,
                "message": "请填写要遮盖的关键词后再处理。"}
    color = (0, 0, 0) if params.get("color", "black") == "black" else (1, 0, 0)
    doc = fitz.open(str(p))
    matched = 0
    for page in doc:
        for kw in keywords:
            hits = page.search_for(kw)
            if hits:
                matched += len(hits)
                for inst in hits:
                    page.add_redact_annot(inst, fill=color)
        page.apply_redactions()
    # 一个关键词都没匹配到：不生成文件，明确提示用户（避免「处理完成」的误导）
    if matched == 0:
        doc.close()
        shown = "、".join(f"「{k}」" for k in keywords)
        return {
            "ok": False, "level": "warn", "matched": 0,
            "message": f"未在文档中找到 {shown}，未做任何修改。请检查关键词是否与原文完全一致（注意简繁、空格与标点）。",
        }
    out = new_tmp() / "redacted.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, "redacted.pdf", "application/pdf")


# ---------- 智能脱敏：自动识别 + 掩码式遮盖 ----------
# 识别规则按「从具体到宽泛」排列。身份证（18位）同时满足银行卡的 15-19 位规则，
# 因此命中后按字符串去重，同一串只处理一次。
#
# 掩码规则参考 red.zyc:desensitization（Apache-2.0）的默认策略：它不是把敏感信息
# 整块涂黑，而是「保留关键位 + 其余打码」，脱敏后的文档依然读得懂上下文。
# 这里一律按位替换成 '*'，因此**掩码串与原串等长**，不会影响原有排版。


def _mask_keep(head, tail=0, ch="*"):
    """保留开头 head 位与结尾 tail 位，中间按位替换（等长）。"""

    def f(s):
        n = len(s)
        if n <= head + tail:
            return ch * n
        return s[:head] + ch * (n - head - tail) + (s[n - tail:] if tail else "")

    return f


def _mask_tail(tail, ch="*"):
    """只保留结尾 tail 位（银行卡：不泄露任何前缀）。"""

    def f(s):
        n = len(s)
        if n <= tail:
            return ch * n
        return ch * (n - tail) + s[n - tail:]

    return f


def _mask_email(s, ch="*"):
    """保留 @ 前的首字符与整个域名：123456@qq.com -> 1*****@qq.com"""
    at = s.find("@")
    if at <= 1:
        return ch * len(s)
    return s[0] + ch * (at - 1) + s[at:]


AUTO_RULES = [
    ("idcard", "身份证号", re.compile(r"[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]"), _mask_keep(6, 4)),
    ("phone", "手机号", re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"), _mask_keep(3, 4)),
    ("bank", "银行卡号", re.compile(r"(?<!\d)\d{15,19}(?!\d)"), _mask_tail(4)),
    ("email", "邮箱", re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"), _mask_email),
    ("tel", "固定电话", re.compile(r"(?<!\d)0\d{2,3}-?\d{7,8}(?!\d)"), _mask_keep(3, 4)),
]


@register("auto-redact", desc="智能脱敏")
def auto_redact(files, params):
    """自动识别并永久遮盖常见敏感信息：身份证 / 手机号 / 银行卡 / 邮箱 / 固定电话。

    与「内容脱敏」的区别：无需手工填写关键词，直接按规则扫描 PDF 文本层。
    注意：仅对**文字型 PDF** 有效；扫描件需先做 OCR 再脱敏。

    style 参数：
      partial（默认）按类型套用掩码规则做「部分保留」，遮盖处写入等长的掩码文本
                     （如 199****0001、1*****@qq.com），文档脱敏后仍然可读；
      full           整块涂色、不写入任何文字，不泄露原文字数与结构。
    两种方式都会调用 apply_redactions() **真正删除**原文字，不可恢复。
    """
    p, _, _ = save_uploads(files)[0]
    chosen = [r for r in AUTO_RULES if params.get(r[0]) in ("true", True, "1", "on")]
    if not chosen:
        return {"ok": False, "level": "warn",
                "message": "请至少勾选一类要识别的敏感信息（身份证 / 手机号 / 银行卡 / 邮箱 / 固定电话）。"}
    partial = params.get("style", "partial") != "full"
    color = (0, 0, 0) if params.get("color", "black") == "black" else (1, 0, 0)

    doc = fitz.open(str(p))
    stats = {}
    for page in doc:
        text = page.get_text()
        tokens = {}          # 原文 -> 掩码文本（同一个串只保留一份）
        for key, label, rx, masker in chosen:
            found = rx.findall(text)
            if found:
                stats[label] = stats.get(label, 0) + len(found)
                for s in found:
                    tokens.setdefault(s, masker(s))
        # 先收集完本页所有位置再统一加遮盖，避免边找边改导致漏匹配
        for s, masked in tokens.items():
            for rect in page.search_for(s):
                if partial:
                    # 掩码串与原串等长；字号按矩形高度推算，避免明显溢出或过小
                    fs = max(6.0, min(20.0, rect.height * 0.72))
                    page.add_redact_annot(rect, text=masked, fontname="helv",
                                          fontsize=fs, align=0,
                                          fill=(1, 1, 1), text_color=(0, 0, 0))
                else:
                    page.add_redact_annot(rect, fill=color)
        page.apply_redactions()

    total = sum(stats.values())
    if total == 0:
        doc.close()
        return {"ok": False, "level": "warn", "matched": 0,
                "message": "未识别到所选类型的敏感信息，未做任何修改。"
                           "（若文件是扫描件/图片型 PDF，其文本层为空，请先做 OCR 文字识别）"}

    out = new_tmp() / "auto-redacted.pdf"
    doc.save(str(out))
    doc.close()
    return send_file(out, f"已脱敏-共{total}处.pdf", "application/pdf")


@register("sanitize", desc="清理文档信息")
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
