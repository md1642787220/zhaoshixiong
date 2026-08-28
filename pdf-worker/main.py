"""shixiong PDF Worker - FastAPI 入口。

接收前端 POST /api/pdf/:action（multipart：任意字段名的文件 + 表单参数），
调用 pypdf / PyMuPDF / pdf2docx / pdfplumber / pymupdf4llm / pyHanko 实现处理。
"""
import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from starlette.datastructures import UploadFile
from worker import core
from worker import page, convert, security, edit, advanced, other  # 触发注册

app = FastAPI(title="shixiong-pdf-worker", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok", "service": "shixiong-pdf-worker", "actions": len(core.REGISTRY)}


@app.get("/api/pdf/capabilities")
def capabilities():
    return {
        a: {"available": True, "source": "python", "desc": meta["desc"]}
        for a, meta in core.REGISTRY.items()
    }


@app.post("/api/pdf/{action}")
async def handle(action: str, request: Request):
    meta = core.REGISTRY.get(action)
    if not meta:
        return JSONResponse(status_code=404, content={"ok": False, "message": f"未知 action: {action}"})

    form = await request.form()
    uploads = []
    params = {}
    for key, val in form.multi_items():
        if isinstance(val, UploadFile):
            uploads.append(val)
            # 同时保留字段名映射，便于 handler 取附加文件（stamp/background/cert...）
            params.setdefault(key, val)
        else:
            params[key] = val

    try:
        result = meta["handler"](uploads, params)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"ok": False, "message": str(e)})
    # handler 可能返回 Response（文件）或 dict（JSON）
    if isinstance(result, Response):
        return result
    return {"ok": True, **result}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PDF_WORKER_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
