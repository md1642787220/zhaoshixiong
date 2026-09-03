"""pdf-worker 公共工具：临时文件、结果返回、能力注册。"""
import os
import tempfile
import shutil
from pathlib import Path
from fastapi import UploadFile, HTTPException
from fastapi.responses import Response

TMP = Path(tempfile.gettempdir()) / "shixiong-pdf-worker"
TMP.mkdir(parents=True, exist_ok=True)

# 能力注册表：action -> dict(handler, needs_files, desc)
REGISTRY: dict = {}


def register(action, *, needs_files=True, desc="", handler=None):
    def wrap(fn):
        REGISTRY[action] = {
            "handler": fn,
            "needs_files": needs_files,
            "desc": desc,
        }
        return fn
    if handler is not None:
        REGISTRY[action] = {"handler": handler, "needs_files": needs_files, "desc": desc}
        return handler
    return wrap


def new_tmp() -> Path:
    d = TMP / os.urandom(8).hex()
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_uploads(files) -> list:
    """保存上传文件，返回 [(path, original_name, ext)]。

    兼容 starlette / fastapi 的 UploadFile 与内部 dict 两种表示，
    避免不同 UploadFile 类导致 isinstance 判断失效。
    """
    saved = []
    for f in files:
        if hasattr(f, "file"):
            data = f.file.read()
            name = f.filename or "file"
        elif isinstance(f, dict):
            data = f.get("buf")
            name = f.get("name", "file")
        suf = Path(name).suffix or ".bin"
        p = new_tmp() / ("upload" + suf)
        p.write_bytes(data)
        saved.append((p, name, suf))
    return saved


def ext_of(filename: str) -> str:
    return Path(filename).suffix.lower().lstrip(".") or "pdf"


def send_file(path: Path, filename: str = None, media_type: str = "application/octet-stream"):
    if not path.exists():
        raise HTTPException(status_code=500, detail="处理结果缺失")
    data = path.read_bytes()
    headers = {}
    if filename:
        # 兼容中文文件名
        from urllib.parse import quote
        disp = f"attachment; filename*=UTF-8''{quote(filename)}"
        headers["Content-Disposition"] = disp
    return Response(content=data, media_type=media_type, headers=headers)


def send_zip(dir_path: Path, filename: str):
    import zipfile
    import io
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(dir_path):
            for fn in files:
                fp = Path(root) / fn
                z.write(fp, fp.relative_to(dir_path))
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    from urllib.parse import quote
    return Response(content=buf.getvalue(), media_type="application/zip", headers=headers)


def require(*modules):
    """检查可选外部命令是否存在。"""
    import shutil
    missing = [m for m in modules if shutil.which(m) is None]
    if missing:
        raise HTTPException(
            status_code=501,
            detail=f"需要服务器安装外部依赖：{', '.join(missing)}",
        )
