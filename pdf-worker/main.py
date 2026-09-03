"""shixiong PDF Worker - FastAPI 入口。

接收前端 POST /api/pdf/:action（multipart：任意字段名的文件 + 表单参数），
调用 pypdf / PyMuPDF / pdf2docx / pdfplumber / pymupdf4llm / pyHanko 实现处理。
"""
import os
import json
import asyncio
import io
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
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


@app.websocket("/ws/api/pdf/{action}")
async def ws_handle(action: str, ws: WebSocket):
    await ws.accept()
    meta = None
    buf = bytearray()
    try:
        while True:
            frame = await ws.receive()
            if frame["type"] == "websocket.disconnect":
                return
            if frame["type"] != "websocket.receive":
                continue
            if frame.get("text") is not None:
                data = json.loads(frame["text"])
                if data.get("type") == "meta":
                    meta = data
                elif data.get("type") == "end":
                    break
            elif frame.get("bytes") is not None:
                buf.extend(frame["bytes"])
    except WebSocketDisconnect:
        return

    if not meta:
        await ws.send_json({"type": "error", "message": "缺少 meta 信息"})
        await ws.close()
        return

    reg = core.REGISTRY.get(action)
    if not reg:
        await ws.send_json({"type": "error", "message": f"未知 action: {action}"})
        await ws.close()
        return

    try:
        up = UploadFile(filename=meta.get("filename", "input.pdf"), file=io.BytesIO(bytes(buf)))
        params = meta.get("params", {}) or {}
        loop = asyncio.get_running_loop()

        def progress_cb(m):
            asyncio.run_coroutine_threadsafe(ws.send_json(m), loop)

        # 在線程池执行阻塞的同步转换，避免卡住事件循环；
        # 进度回调通过 run_coroutine_threadsafe 安全调度到事件循环实时推送
        if action == "convert-office":
            result = await loop.run_in_executor(
                None, lambda: reg["handler"]([up], params, progress=progress_cb)
            )
        else:
            result = await loop.run_in_executor(
                None, lambda: reg["handler"]([up], params)
            )

        if isinstance(result, Response):
            body = result.body
            await ws.send_json({
                "type": "done",
                "filename": "converted.docx",
                "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            })
            await ws.send_bytes(body)
            await ws.send_json({"type": "final"})
        else:
            await ws.send_json({"type": "done", "json": result})
    except Exception as e:
        import traceback
        traceback.print_exc()
        await ws.send_json({"type": "error", "message": str(e)})
    finally:
        await ws.close()


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PDF_WORKER_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
