import asyncio
import json
import logging
import shutil
import tempfile
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from faster_whisper.tokenizer import _LANGUAGE_CODES
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse, StreamingResponse

from .config import Settings
from .transcriber import Transcriber, supported_file

logger = logging.getLogger("argo.transcribe")
SAFE_ERROR = "Не удалось обработать файл. Попробуйте другой формат или файл меньшего размера."


class BodyLimitMiddleware:
    def __init__(self, app, max_bytes):
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST":
            return await self.app(scope, receive, send)
        size = 0

        async def limited_receive():
            nonlocal size
            message = await receive()
            size += len(message.get("body", b""))
            if size > self.max_bytes:
                scope.setdefault("state", {})["upload_over_limit"] = True
                # Starlette closes multipart spool files on MultiPartException.
                raise MultiPartException("Upload size limit exceeded")
            return message

        await self.app(scope, limited_receive, send)


def create_app(settings: Settings | None = None, engine_factory=Transcriber):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
            raise RuntimeError("Install ffmpeg and ffprobe before starting the service")
        settings.transcribe_temp_dir.mkdir(parents=True, exist_ok=True)
        app.state.engine = await asyncio.to_thread(engine_factory, settings)
        app.state.semaphore = asyncio.Semaphore(settings.transcribe_max_concurrent)
        app.state.admitted = 0
        app.state.jobs = {}
        yield
        for cancel in list(app.state.jobs.values()):
            cancel.set()
        await asyncio.gather(*list(app.state.jobs), return_exceptions=True)

    app = FastAPI(title="ARGO Transcribe", lifespan=lifespan)
    app.add_middleware(BodyLimitMiddleware, max_bytes=settings.max_bytes + 65536)

    @app.get("/health")
    async def health():
        return {"status": "ok", "model": settings.whisper_model, "device": settings.whisper_device}

    @app.post("/transcribe")
    async def transcribe(request: Request):
        state = request.app.state
        if state.admitted >= settings.transcribe_max_concurrent + settings.transcribe_max_queue:
            raise HTTPException(429, "Сервис занят. Попробуйте позже.", headers={"Retry-After": "60"})
        state.admitted += 1
        temp = None
        handed_off = False
        try:
            if not request.headers.get("content-type", "").startswith("multipart/form-data"):
                raise HTTPException(415, "Требуется файл аудио или видео.")
            try:
                length = int(request.headers.get("content-length", "0"))
            except ValueError:
                raise HTTPException(400, "Некорректная загрузка.")
            if length > settings.max_bytes + 65536:
                raise HTTPException(413, "Файл превышает допустимый размер.")
            async with request.form(max_files=1, max_fields=1, max_part_size=1024) as form:
                upload = form.get("file")
                if len(form.multi_items()) > 2 or set(form) - {"file", "language"}:
                    raise HTTPException(400, "Загрузите один файл за раз.")
                if not isinstance(upload, UploadFile):
                    raise HTTPException(400, "Выберите файл.")
                if not supported_file(upload.filename or "", upload.content_type or ""):
                    raise HTTPException(415, "Неподдерживаемый формат.")
                language = form.get("language") or None
                if language is not None and (not isinstance(language, str) or language not in _LANGUAGE_CODES):
                    raise HTTPException(400, "Некорректный язык записи.")
                temp = tempfile.TemporaryDirectory(prefix=f"{uuid4()}-", dir=settings.transcribe_temp_dir)
                source = Path(temp.name) / f"{uuid4()}{Path(upload.filename).suffix.lower()}"
                total = 0
                with source.open("xb") as target:
                    while chunk := await upload.read(1024 * 1024):
                        total += len(chunk)
                        if total > settings.max_bytes:
                            raise HTTPException(413, "Файл превышает допустимый размер.")
                        await asyncio.to_thread(target.write, chunk)
                if not total:
                    raise HTTPException(400, "Файл пустой.")

            queue = asyncio.Queue()
            cancel = threading.Event()
            loop = asyncio.get_running_loop()

            def emit(event):
                loop.call_soon_threadsafe(queue.put_nowait, event)

            async def run():
                try:
                    queue.put_nowait({"type": "stage", "stage": "queued"})
                    async with state.semaphore:
                        result = await asyncio.to_thread(state.engine.run, source, language, emit, cancel)
                    payload = result.model_dump(exclude_none=True)
                    queue.put_nowait({"type": "result", "result": payload})
                    return payload
                except Exception as error:
                    logger.warning("Transcription failed: %s", type(error).__name__)
                    queue.put_nowait({"type": "error", "error": SAFE_ERROR})
                    return None
                finally:
                    await asyncio.to_thread(temp.cleanup)
                    state.admitted -= 1

            task = asyncio.create_task(run())
            state.jobs[task] = cancel
            task.add_done_callback(lambda done: state.jobs.pop(done, None))
            handed_off = True

            if "application/x-ndjson" in request.headers.get("accept", ""):
                async def events():
                    try:
                        while True:
                            try:
                                event = await asyncio.wait_for(queue.get(), timeout=10)
                            except asyncio.TimeoutError:
                                event = {"type": "heartbeat"}
                            yield json.dumps(event, ensure_ascii=False) + "\n"
                            if event["type"] in {"result", "error"}:
                                break
                    finally:
                        cancel.set()
                        # The background job owns its directory. Do not delete it
                        # while FFmpeg or the model still has a file open.
                return StreamingResponse(events(), media_type="application/x-ndjson", headers={"X-Accel-Buffering": "no", "Cache-Control": "no-store"})
            try:
                result = await asyncio.shield(task)
            except asyncio.CancelledError:
                cancel.set()
                raise
            if result is None:
                raise HTTPException(422, SAFE_ERROR)
            return JSONResponse(result, headers={"Cache-Control": "no-store"})
        except StarletteHTTPException:
            if getattr(request.state, "upload_over_limit", False):
                raise HTTPException(413, "Файл превышает допустимый размер.")
            raise
        except (MultiPartException, ValueError):
            raise HTTPException(413 if getattr(request.state, "upload_over_limit", False) else 400, "Некорректная загрузка файла.")
        except Exception as error:
            logger.warning("Upload failed: %s", type(error).__name__)
            raise HTTPException(500, SAFE_ERROR)
        finally:
            if not handed_off:
                if temp:
                    await asyncio.to_thread(temp.cleanup)
                state.admitted -= 1

    return app


app = create_app()
