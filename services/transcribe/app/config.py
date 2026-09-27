from pathlib import Path
from tempfile import gettempdir
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=Path(__file__).parents[1] / ".env", extra="ignore")

    whisper_model: Literal["tiny", "base", "small", "medium", "large-v3", "large-v3-turbo"] = "large-v3-turbo"
    whisper_device: Literal["cpu", "cuda"] = "cpu"
    whisper_compute_type: str = "int8"
    whisper_cpu_threads: int = Field(default=4, ge=1)
    whisper_model_dir: Path | None = None
    whisper_download_root: Path = Path(__file__).parents[1] / ".models"
    transcribe_max_concurrent: int = Field(default=1, ge=1, le=8)
    transcribe_max_queue: int = Field(default=2, ge=0, le=20)
    max_upload_size_mb: int = Field(default=500, ge=1)
    transcribe_max_duration_seconds: int = Field(default=7200, ge=1)
    transcribe_timeout_seconds: int = Field(default=3500, ge=1)
    ffmpeg_timeout_seconds: int = Field(default=300, ge=1)
    transcribe_temp_dir: Path = Path(gettempdir()) / "argo-transcribe"

    @property
    def max_bytes(self):
        return self.max_upload_size_mb * 1024 * 1024
