import json
import math
import subprocess
import threading
import time
import wave
from pathlib import Path
from typing import Callable

from faster_whisper import WhisperModel

from .config import Settings
from .schemas import Segment, Transcript

FORMATS = {
    ".mp3": {"audio/mpeg", "audio/mp3"},
    ".wav": {"audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"},
    ".m4a": {"audio/mp4", "audio/x-m4a", "video/mp4"},
    ".aac": {"audio/aac", "audio/x-aac"},
    ".ogg": {"audio/ogg", "video/ogg", "application/ogg"},
    ".flac": {"audio/flac", "audio/x-flac"},
    ".mp4": {"video/mp4", "audio/mp4"},
    ".mov": {"video/quicktime"},
    ".webm": {"video/webm", "audio/webm"},
    ".mkv": {"video/x-matroska", "audio/x-matroska"},
}
DEMUXERS = "mp3,wav,mov,aac,ogg,flac,matroska,webm"


class MediaError(Exception):
    pass


def supported_file(filename: str, mime: str) -> bool:
    suffix = Path(filename).suffix.lower()
    return suffix in FORMATS and (mime in FORMATS[suffix] or mime in {"", "application/octet-stream"})


class Transcriber:
    def __init__(self, settings: Settings):
        self.settings = settings
        # Called once in lifespan, never per request. A local converted model
        # directory allows fully offline startup after model provisioning.
        self.model = WhisperModel(
            str(settings.whisper_model_dir) if settings.whisper_model_dir else settings.whisper_model,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
            cpu_threads=settings.whisper_cpu_threads,
            num_workers=settings.transcribe_max_concurrent,
            download_root=str(settings.whisper_download_root),
            local_files_only=bool(settings.whisper_model_dir),
        )

    def normalize(self, source: Path, target: Path):
        settings = self.settings
        # Only approved demuxers and local file/pipe protocols. Playlists and
        # remote references cannot turn an upload into a network request.
        options = ["-protocol_whitelist", "file,pipe", "-format_whitelist", DEMUXERS]
        try:
            probe = subprocess.run(
                ["ffprobe", "-v", "error", *options, "-select_streams", "a:0",
                 "-show_entries", "stream=codec_type:format=duration,format_name", "-of", "json", str(source)],
                capture_output=True, timeout=min(settings.ffmpeg_timeout_seconds, 30), check=True,
            )
            metadata = json.loads(probe.stdout)
            if not metadata.get("streams"):
                raise MediaError("В файле нет аудиодорожки.")
            declared_duration = metadata.get("format", {}).get("duration")
            if declared_duration is not None:
                duration = float(declared_duration)
                if not math.isfinite(duration) or duration > settings.transcribe_max_duration_seconds:
                    raise MediaError("Запись слишком длинная.")
            subprocess.run(
                ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", *options,
                 "-i", str(source), "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000",
                 "-t", str(settings.transcribe_max_duration_seconds + 1),
                 "-c:a", "pcm_s16le", "-y", str(target)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=settings.ffmpeg_timeout_seconds, check=True,
            )
            with wave.open(str(target)) as audio:
                duration = audio.getnframes() / audio.getframerate()
            if duration <= 0 or duration > settings.transcribe_max_duration_seconds:
                raise MediaError("Запись пустая или слишком длинная.")
            return duration
        except (subprocess.SubprocessError, ValueError, OSError, wave.Error) as error:
            raise MediaError("Не удалось прочитать аудиодорожку.") from error

    def run(self, source: Path, language: str | None, emit: Callable, cancel: threading.Event):
        started = time.monotonic()

        def check_cancelled():
            if cancel.is_set() or time.monotonic() - started > self.settings.transcribe_timeout_seconds:
                raise MediaError("Обработка прервана или превышено время ожидания.")

        check_cancelled()
        emit({"type": "stage", "stage": "extracting"})
        duration = self.normalize(source, source.parent / "audio.wav")
        check_cancelled()
        emit({"type": "stage", "stage": "transcribing"})
        processed = 0.0
        emit({"type": "progress", "processed_seconds": processed, "duration": duration})
        segments, info = self.model.transcribe(
            str(source.parent / "audio.wav"), language=language, beam_size=self.settings.whisper_beam_size,
            vad_filter=True, condition_on_previous_text=False,
        )
        output = []
        for segment in segments:
            check_cancelled()
            # faster-whisper restores timestamps to the original recording after
            # VAD. Keep progress monotonic even if segment timestamps overlap.
            position = max(processed, min(max(0.0, segment.end), duration))
            if position > processed:
                processed = position
                emit({"type": "progress", "processed_seconds": processed, "duration": duration})
            text = segment.text.strip()
            if text:
                start = max(0.0, min(segment.start, duration))
                end = max(start, min(segment.end, duration))
                output.append(Segment(id=len(output), start=start, end=end, text=text))
        check_cancelled()
        # Exhausting the generator also completes trailing silence / empty audio.
        emit({"type": "progress", "processed_seconds": duration, "duration": duration})
        emit({"type": "stage", "stage": "formatting"})
        return Transcript(
            text=" ".join(s.text for s in output), language=info.language,
            language_probability=info.language_probability, duration=duration, segments=output,
        )
