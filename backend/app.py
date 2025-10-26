"""Simple FastAPI scaffolding for audio and video generation.

This module is intentionally lightweight so backend engineers can replace the
stubbed write-to-disk logic with real generation code. The Next.js frontend can
hit these endpoints during local development while the team wires in actual AI
services.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import wave

Preset = Literal[
    "belinda",
    "broom_salesman",
    "chadwick",
    "en_man",
    "en_woman",
    "mabel",
    "vex",
    "zh_man_sichuan",
]


class AudioRequest(BaseModel):
    preset: Preset
    script: str


class VideoRequest(BaseModel):
    preset: Preset
    audio_path: str

BOSON_API_KEY = ""
client = openai.Client(api_key=BOSON_API_KEY, base_url="https://hackathon.boson.ai/v1")

app = FastAPI(title="Demo Generation Backend", version="0.1.0")


BASE_OUTPUT = Path(__file__).resolve().parent / "outputs"
AUDIO_OUTPUT = BASE_OUTPUT / "audio"
VIDEO_OUTPUT = BASE_OUTPUT / "video"

for directory in (AUDIO_OUTPUT, VIDEO_OUTPUT):
    directory.mkdir(parents=True, exist_ok=True)


def _timestamp_slug() -> str:
    return datetime.utcnow().strftime("%Y%m%dT%H%M%S%f")


@app.post("/audio/generate")
async def generate_audio(payload: AudioRequest) -> dict[str, str]:
    """Persist a placeholder audio artifact and return its filesystem path.

    Replace the stubbed file write with real audio
    synthesis using the requested preset. Keep the response contract intact so
    the frontend integration remains stable.
    """

    artifact_name = f"{_timestamp_slug()}_{payload.preset}.wav"
    artifact_path = AUDIO_OUTPUT / artifact_name

    # TODO: Replace this with real audio bytes from TTS.
    tts_response = client.audio.speech.create(
        model="higgs-audio-generation-Hackathon",
        voice=payload.preset,
        input=payload.script,
        response_format="pcm"
    )
    pcm_data = tts_response.content

    num_channels = 1
    sample_width = 2
    sample_rate = 24000

    with wave.open(artifact_path, "wb") as wav_file:
        wav_file.setnchannels(num_channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)

    return {"audio_path": str(artifact_path)}


@app.post("/video/generate")
async def generate_video(payload: VideoRequest) -> dict[str, str]:
    """Persist a placeholder video artifact and return its filesystem path.

    Swap the stub logic with real avatar rendering
    that consumes the provided audio track. The preset parameter is available - you can just map them to male/female.
    """

    source_audio = Path(payload.audio_path)
    if not source_audio.exists():
        raise HTTPException(status_code=400, detail="Provided audio_path does not exist")

    artifact_name = f"{_timestamp_slug()}_{payload.preset}.mp4"
    artifact_path = VIDEO_OUTPUT / artifact_name

    # TODO: Replace this with actual rendered video bytes.
    artifact_path.write_text(
        f"Placeholder video for preset={payload.preset}\n"
        f"Generated at {datetime.now(datetime.timezone.utc).isoformat()}\n"
        f"Source audio: {payload.audio_path}\n"
    )

    return {"video_path": str(artifact_path)}

