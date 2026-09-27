from pydantic import BaseModel, Field


class Segment(BaseModel):
    id: int
    start: float = Field(ge=0, allow_inf_nan=False)
    end: float = Field(ge=0, allow_inf_nan=False)
    text: str
    speaker: str | None = None


class Transcript(BaseModel):
    text: str
    language: str
    language_probability: float = Field(ge=0, le=1, allow_inf_nan=False)
    duration: float = Field(ge=0, allow_inf_nan=False)
    segments: list[Segment]
