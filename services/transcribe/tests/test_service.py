import io
import json
import threading
import time
import wave
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas import Segment, Transcript
from app.transcriber import Transcriber, supported_file


def wav_bytes():
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\0\0" * 16000)
    return output.getvalue()


class TestEngine:
    __test__ = False

    def __init__(self, settings):
        self.processor = Transcriber.__new__(Transcriber)
        self.processor.settings = settings

    def run(self, source, language, emit, cancel):
        emit({"type": "stage", "stage": "extracting"})
        duration = self.processor.normalize(source, source.parent / "audio.wav")
        emit({"type": "stage", "stage": "transcribing"})
        emit({"type": "stage", "stage": "formatting"})
        return Transcript(text="Тест", language=language or "ru", language_probability=1,
                          duration=duration, segments=[Segment(id=0, start=0, end=duration, text="Тест")])


@pytest.fixture
def service(tmp_path):
    settings = Settings(_env_file=None, transcribe_temp_dir=tmp_path, max_upload_size_mb=1)
    with TestClient(create_app(settings, TestEngine)) as client:
        yield client, tmp_path


def assert_clean(path):
    for _ in range(100):
        if not list(path.iterdir()):
            return
        time.sleep(.01)
    assert not list(path.iterdir())


def test_health(service):
    client, _ = service
    assert client.get("/health").json() == {"status": "ok", "model": "large-v3-turbo", "device": "cpu"}


def test_wav_normalization_and_cleanup(service):
    client, path = service
    response = client.post("/transcribe", files={"file": ("../../private.wav", wav_bytes(), "audio/wav")}, data={"language": "ru"})
    assert response.status_code == 200, response.text
    assert response.json()["duration"] == 1
    assert response.json()["segments"][0]["text"] == "Тест"
    assert str(path) not in response.text
    assert_clean(path)


def test_streams_real_stages_and_result(service):
    client, path = service
    response = client.post("/transcribe", headers={"Accept": "application/x-ndjson"}, files={"file": ("voice.wav", wav_bytes(), "audio/wav")})
    events = [json.loads(line) for line in response.text.splitlines()]
    assert [e["stage"] for e in events if e["type"] == "stage"] == ["queued", "extracting", "transcribing", "formatting"]
    assert events[-1]["type"] == "result"
    assert_clean(path)


@pytest.mark.parametrize("filename,mime,body,status", [
    ("script.exe", "application/octet-stream", b"x", 415),
    ("voice.wav", "text/html", b"x", 415),
    ("voice.wav", "audio/wav", b"", 400),
    ("fake.mp3", "audio/mpeg", b"not audio", 422),
    ("large.wav", "audio/wav", b"x" * (1024 * 1024 + 1), 413),
], ids=["extension", "mime", "empty", "corrupt", "oversize"])
def test_invalid_uploads_cleanup(service, filename, mime, body, status):
    client, path = service
    response = client.post("/transcribe", files={"file": (filename, body, mime)})
    assert response.status_code == status, response.text
    assert "Traceback" not in response.text
    assert_clean(path)


def test_streaming_failure_is_safe(service):
    client, path = service
    response = client.post("/transcribe", headers={"Accept": "application/x-ndjson"}, files={"file": ("bad.mp4", b"bad", "video/mp4")})
    assert json.loads(response.text.splitlines()[-1])["type"] == "error"
    assert_clean(path)


def test_body_limit_without_content_length(service):
    client, path = service
    def chunks():
        yield b'--boundary\r\nContent-Disposition: form-data; name="file"; filename="x.wav"\r\nContent-Type: audio/wav\r\n\r\n'
        for _ in range(20):
            yield b"x" * 65536
        yield b"\r\n--boundary--\r\n"
    response = client.post("/transcribe", headers={"Content-Type": "multipart/form-data; boundary=boundary"}, content=chunks())
    assert response.status_code == 413, response.text
    assert_clean(path)


def test_language_and_multiple_files(service):
    client, path = service
    assert client.post("/transcribe", files={"file": ("v.wav", wav_bytes(), "audio/wav")}, data={"language": "bad-language"}).status_code == 400
    assert client.post("/transcribe", files=[("file", ("a.wav", wav_bytes(), "audio/wav")), ("file", ("b.wav", wav_bytes(), "audio/wav"))]).status_code == 400
    assert_clean(path)


def test_concurrency_and_single_initialization(tmp_path):
    entered = threading.Event()
    release = threading.Event()
    instances = []
    class BlockingEngine(TestEngine):
        def __init__(self, settings):
            super().__init__(settings)
            instances.append(self)
        def run(self, *args):
            entered.set()
            assert release.wait(10)
            return super().run(*args)
    settings = Settings(_env_file=None, transcribe_temp_dir=tmp_path, transcribe_max_queue=0)
    with TestClient(create_app(settings, BlockingEngine)) as client, ThreadPoolExecutor() as pool:
        future = pool.submit(client.post, "/transcribe", files={"file": ("a.wav", wav_bytes(), "audio/wav")})
        assert entered.wait(5)
        try:
            assert client.post("/transcribe", files={"file": ("b.wav", wav_bytes(), "audio/wav")}).status_code == 429
        finally:
            release.set()
        assert future.result().status_code == 200
    assert len(instances) == 1
    assert_clean(tmp_path)


def test_format_whitelist():
    assert supported_file("video.mkv", "application/octet-stream")
    assert not supported_file("playlist.m3u8", "application/octet-stream")


@pytest.mark.parametrize("ends", [[10, 8, 45], []])
@pytest.mark.parametrize("beam", [1, 5])
def test_progress_streams_before_completion_and_covers_trailing_silence(tmp_path, ends, beam):
    engine = Transcriber.__new__(Transcriber)
    engine.settings = Settings(_env_file=None, whisper_beam_size=beam)
    engine.normalize = lambda source, target: 60.0
    events = []

    def segments():
        for end in ends:
            # Initial progress must arrive before inference yields any segment.
            assert any(e["type"] == "progress" for e in events)
            assert not any(e.get("stage") == "formatting" for e in events)
            yield SimpleNamespace(start=0, end=end, text="Тест")
        assert not any(e.get("processed_seconds") == 60 for e in events)

    def transcribe(*args, **kwargs):
        assert kwargs["beam_size"] == beam
        assert kwargs["language"] == "ru"
        return segments(), SimpleNamespace(language="ru", language_probability=1)

    engine.model = SimpleNamespace(transcribe=transcribe)
    result = engine.run(tmp_path / "test.wav", "ru", events.append, threading.Event())
    progress = [e for e in events if e["type"] == "progress"]
    positions = [e["processed_seconds"] for e in progress]
    assert positions == ([0, 10, 45, 60] if ends else [0, 60])
    assert all(e["duration"] == result.duration for e in progress)
    assert events[-1] == {"type": "stage", "stage": "formatting"}
