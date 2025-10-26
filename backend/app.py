"""Simple FastAPI scaffolding for audio and video generation.

This module is intentionally lightweight so backend engineers can replace the
stubbed write-to-disk logic with real generation code. The Next.js frontend can
hit these endpoints during local development while the team wires in actual AI
services.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import wave
import logging
import subprocess
import openai
import os
from audio2face_api_client.nim_a2f_client import run
from broomsman_char import run_blend_external
from belinda_char import run_named_external


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

BLENDER_PATH="/Applications/Blender.app/Contents/MacOS/Blender"
NVIDIA_API_KEY = "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"
BOSON_API_KEY = "bai-C3A4nRfSkAGBZixYLVlmoOfHTjnOxv64lg-ji0I1FZIrSeN4"
if openai and BOSON_API_KEY:
    client = openai.Client(api_key=BOSON_API_KEY, base_url="https://hackathon.boson.ai/v1")
else:
    client = None

app = FastAPI(title="Demo Generation Backend", version="0.1.0")


BASE_OUTPUT = Path(__file__).resolve().parent / "outputs"
AUDIO_OUTPUT = BASE_OUTPUT / "audio"
VIDEO_OUTPUT = BASE_OUTPUT / "video"

for directory in (AUDIO_OUTPUT, VIDEO_OUTPUT):
    directory.mkdir(parents=True, exist_ok=True)

app.mount("/media/audio", StaticFiles(directory=AUDIO_OUTPUT), name="audio-files")
app.mount("/media/video", StaticFiles(directory=VIDEO_OUTPUT), name="video-files")


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

    num_channels = 1
    sample_width = 2
    sample_rate = 24000

    pcm_data: bytes
    if client:
        try:
            logging.info("Generating audio with Higgs Audio ...")
            tts_response = client.audio.speech.create(
                model="higgs-audio-generation-Hackathon",
                voice=payload.preset,
                input=payload.script,
                response_format="pcm",
            )
            logging.info("Generation completed!")
            pcm_data = tts_response.content  # type: ignore[attr-defined]
        except Exception as exc:
            print(f"[backend] TTS generation failed, falling back to silence: {exc}")
            pcm_data = b"\x00\x00" * sample_rate
    else:
        # Fallback: write 1 second of silence so the frontend always receives a valid WAV.
        pcm_data = b"\x00\x00" * sample_rate

    with wave.open(str(artifact_path), "wb") as wav_file:
        wav_file.setnchannels(num_channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)

    return {
        "audio_path": str(artifact_path),
        "audio_url": f"/media/audio/{artifact_name}",
    }


@app.post("/video/generate")
async def generate_video(payload: VideoRequest) -> dict[str, str]:
    """Persist a placeholder video artifact and return its filesystem path.

    Swap the stub logic with real avatar rendering
    that consumes the provided audio track. The preset parameter is available - you can just map them to male/female.
    """

    source_audio = Path(payload.audio_path)
    if not source_audio.exists():
        raise HTTPException(status_code=400, detail="Provided audio_path does not exist")
    fps=30
    artifact_name = f"{_timestamp_slug()}_{payload.preset}.mp4"
    print(payload.preset)
    artifact_path = VIDEO_OUTPUT / artifact_name
    if payload.preset=="belinda":
        blend_file="./resources/belinda.blend"
        csv_path=await run(source_audio, "./audio2face_api_client/config/config_claire.yml")
        run_named_external(BLENDER_PATH, blend_file, csv_path, source_audio, artifact_path, fps)
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-framerate", str(fps),
            "-i", "/tmp/render_frames_%04d.png",
            "-i", str(source_audio),
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-shortest",
            str(artifact_path)
        ]
        import time
        print("Running ffmpeg:", " ".join(ffmpeg_cmd))
        # time.sleep(10)
        subprocess.run(ffmpeg_cmd, check=True)
        # time.sleep(10)
        print("✅ Done! Video saved at:", artifact_path)

    elif payload.preset=="broom_salesman":
        blend_file="./resources/broomsman.blend"
        csv_path=await run(source_audio, "./audio2face_api_client/config/config_mark.yml")
        run_blend_external(BLENDER_PATH, blend_file, str(csv_path), source_audio, artifact_path, fps)        
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-framerate", str(fps),
            "-i", "/tmp/render_frames_%04d.png",
            "-i", str(source_audio),
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-shortest",
            str(artifact_path)
        ]
        print("Running ffmpeg:", " ".join(ffmpeg_cmd))
        # time.sleep(10)
        subprocess.run(ffmpeg_cmd, check=True)
        # time.sleep(10)
        print("✅ Done! Video saved at:", artifact_path)

    return {
        "video_path": str(artifact_path),
        "video_url": f"/media/video/{artifact_name}",
    }
