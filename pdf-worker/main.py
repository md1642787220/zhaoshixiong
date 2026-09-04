"""shixiong PDF Worker - FastAPI 入口。

接收前端 POST /api/pdf/:action（multipart：任意字段名的文件 + 表单参数），
调用 pypdf / PyMuPDF / pdf2docx / pdfplumber / pymupdf4llm / pyHanko 实现处理。
"""
import os
import json
import asyncio
import io
import re
import mimetypes
from urllib.parse import quote
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import JSONResponse, Response, StreamingResponse
from starlette.background import BackgroundTask
from starlette.datastructures import UploadFile
from worker import core
from worker import page, convert, security, edit, advanced, other  # 触发注册

app = FastAPI(title="shixiong-pdf-worker", version="0.1.0")


def _extract_filename(resp, default="converted.docx"):
    """从 Response 的 Content-Disposition 中解析真实文件名（兼容中文编码）。"""
    import re
    from urllib.parse import unquote
    cd = (resp.headers or {}).get("content-disposition", "")
    m = re.search(r"filename\*=UTF-8''([^;]+)", cd)
    if m:
        return unquote(m.group(1))
    m = re.search(r'filename="([^"]+)"', cd)
    if m:
        return m.group(1)
    return default


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

    # 文件大小限制（与前端一致：30MB），超限直接拒绝，避免无谓传输
    MAX_SIZE = 30 * 1024 * 1024
    for up in uploads:
        if getattr(up, "size", 0) and up.size > MAX_SIZE:
            return JSONResponse(status_code=413, content={
                "ok": False,
                "message": f"文件「{up.filename}」超过 30MB 限制，请压缩或拆分后重试。",
            })

    try:
        loop = asyncio.get_running_loop()
        # 在線程池执行阻塞的同步转换，避免阻塞事件循环（否则大文件会卡死整个 worker）
        result = await asyncio.wait_for(
            loop.run_in_executor(None, lambda: meta["handler"](uploads, params)),
            timeout=580,
        )
    except asyncio.TimeoutError:
        return JSONResponse(status_code=504, content={
            "ok": False,
            "message": "转换超时（>9 分钟），文件过大或页数过多，请拆分后重试。",
        })
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

    # 文件大小限制（与前端一致：30MB）
    MAX_SIZE = 30 * 1024 * 1024
    if len(buf) > MAX_SIZE:
        await ws.send_json({"type": "error", "message": "文件超过 30MB 限制，请压缩或拆分后重试。"})
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
            try:
                fut = asyncio.run_coroutine_threadsafe(ws.send_json(m), loop)
                # 吞掉 ws 已关闭后的发送异常，避免噪声
                fut.add_done_callback(lambda f: f.exception())
            except Exception:
                pass

        # 在線程池执行阻塞的同步转换，避免卡住事件循环；
        # 进度回调通过 run_coroutine_threadsafe 安全调度到事件循环实时推送
        try:
            if action == "convert-office":
                result = await asyncio.wait_for(
                    loop.run_in_executor(
                        None, lambda: reg["handler"]([up], params, progress=progress_cb)
                    ),
                    timeout=300,
                )
            else:
                result = await asyncio.wait_for(
                    loop.run_in_executor(None, lambda: reg["handler"]([up], params)),
                    timeout=300,
                )
        except asyncio.TimeoutError:
            await ws.send_json({"type": "error", "message": "转换超时（>5 分钟），文件过大或页数过多，请拆分后重试。"})
            await ws.close()
            return

        if isinstance(result, Response):
            body = result.body
            await ws.send_json({
                "type": "done",
                "filename": _extract_filename(result),
                "contentType": result.media_type or "application/octet-stream",
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


# ==================== 音视频素材下载（yt-dlp） ====================

_URL_RE = re.compile(r"^https?://", re.I)
_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def _fmt_size(n):
    """字节数格式化为人类可读。"""
    n = float(n or 0)
    if n <= 0:
        return ""
    if n < 1024:
        return f"{int(n)}B"
    if n < 1024 ** 2:
        return f"{n / 1024:.0f}KB"
    if n < 1024 ** 3:
        return f"{n / 1024 ** 2:.1f}MB"
    return f"{n / 1024 ** 3:.2f}GB"


def _ytdlp_extract(url):
    """同步调用 yt-dlp 抽取视频源信息（在线程池中运行）。"""
    import yt_dlp
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,      # 只处理单条，不展开播放列表
        "socket_timeout": 20,
        "http_headers": {"User-Agent": _UA},
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=False)


def _pick_formats(formats):
    """从 yt-dlp formats 中挑选音频与视频下载项（去重、限量）。"""
    audios, videos = {}, {}
    for f in formats or []:
        stream_url = f.get("url")
        if not stream_url or f.get("format_id") is None:
            continue
        vcodec = f.get("vcodec") or "none"
        acodec = f.get("acodec") or "none"
        ext = (f.get("ext") or "").lower()
        if not ext:
            continue
        # B 站等站的 fMP4 分片流扩展名为 m4s，映射为常见扩展便于播放
        if ext == "m4s":
            ext = "m4a" if vcodec == "none" else "mp4"
        size = f.get("filesize") or f.get("filesize_approx") or 0
        if vcodec == "none" and acodec != "none":
            # 纯音频流
            abr = round(f.get("abr") or f.get("tbr") or 0)
            key = (abr, ext)
            item = {
                "url": stream_url,
                "ext": ext,
                "size": size,
                "label": f"{ext.upper()} · {abr}kbps" + (f" · {_fmt_size(size)}" if size else ""),
            }
            if key not in audios or (size and (not audios[key]["size"] or size > audios[key]["size"])):
                audios[key] = item
        elif vcodec != "none":
            # 视频流（可能自带音轨）
            h = f.get("height") or 0
            fps = round(f.get("fps") or 0)
            has_audio = acodec != "none"
            key = (h, ext, has_audio)
            res = f"{h}p" + (f"{fps}" if fps and fps > 30 else "")
            label = f"{res} {ext.upper()}" + ("（含音轨）" if has_audio else "（无音轨）")
            if size:
                label += f" · {_fmt_size(size)}"
            item = {
                "url": stream_url,
                "ext": ext,
                "size": size,
                "height": h,
                "hasAudio": has_audio,
                "label": label,
            }
            old = videos.get(key)
            if not old or (size and (not old["size"] or size > old["size"])):
                videos[key] = item

    # 音频按文件大小降序（近似码率高低），限量 6 条
    audio_list = sorted(audios.values(), key=lambda x: -(x.get("size") or 0))[:6]
    video_list = sorted(videos.values(), key=lambda x: -(x.get("height") or 0))[:8]
    return audio_list, video_list


@app.post("/api/media/resolve")
async def media_resolve(request: Request):
    """解析视频源链接 -> 音频/视频下载项清单。"""
    try:
        body = await request.json()
    except Exception:
        body = {}
    url = str((body or {}).get("url") or "").strip()
    if not _URL_RE.match(url):
        return JSONResponse(status_code=400, content={"ok": False, "message": "请输入以 http(s):// 开头的视频源链接"})

    loop = asyncio.get_running_loop()
    try:
        info = await asyncio.wait_for(
            loop.run_in_executor(None, lambda: _ytdlp_extract(url)), timeout=120
        )
    except asyncio.TimeoutError:
        return JSONResponse(status_code=504, content={"ok": False, "message": "解析超时（>2 分钟），请稍后重试"})
    except Exception as e:
        msg = str(e) or e.__class__.__name__
        return JSONResponse(status_code=400, content={"ok": False, "message": f"解析失败：{msg}"})

    # 播放列表场景：只取第一条
    if info and info.get("_type") == "playlist":
        entries = info.get("entries") or []
        if not entries:
            return JSONResponse(status_code=404, content={"ok": False, "message": "未解析到任何内容"})
        info = entries[0]

    audios, videos = _pick_formats(info.get("formats"))
    if not audios and not videos:
        # 部分站点的合并流只有 url 无 vcodec/acodec 字段，兜底取最佳单项
        best = info.get("url")
        if best:
            videos = [{"url": best, "ext": "mp4", "size": 0, "height": 0,
                       "hasAudio": True, "label": "最佳质量 MP4"}]

    duration = info.get("duration") or 0
    return {
        "ok": True,
        "title": info.get("title") or "未命名素材",
        "uploader": info.get("uploader") or info.get("channel") or "",
        "duration": duration,
        "thumbnail": info.get("thumbnail") or "",
        "pageUrl": info.get("webpage_url") or url,
        "audios": audios,
        "videos": videos,
    }


@app.get("/api/media/download")
async def media_download(
    url: str = Query(...),
    ref: str = Query(""),
    filename: str = Query("download"),
):
    """流式代理下载媒体文件，规避浏览器直连的跨域与防盗链限制。"""
    if not _URL_RE.match(url):
        return JSONResponse(status_code=400, content={"ok": False, "message": "非法下载地址"})

    import httpx
    headers = {"User-Agent": _UA}
    if ref:
        headers["Referer"] = ref

    client = httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(30, read=300))
    req = client.build_request("GET", url, headers=headers)
    resp = await client.send(req, stream=True)

    async def _close():
        await resp.aclose()
        await client.aclose()

    if resp.status_code >= 400:
        status = resp.status_code
        await _close()
        return JSONResponse(status_code=502, content={"ok": False, "message": f"源站返回 {status}，下载失败"})

    mime = resp.headers.get("content-type") or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    cd = f"attachment; filename*=UTF-8''{quote(filename)}"

    return StreamingResponse(
        resp.aiter_bytes(),
        media_type=mime,
        headers={"Content-Disposition": cd},
        background=BackgroundTask(_close),
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PDF_WORKER_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
