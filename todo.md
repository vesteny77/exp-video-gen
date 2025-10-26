# Backend Integration TODO

This repo now includes a minimal FastAPI server (`backend/app.py`) that exposes
two stub endpoints:

| Endpoint | Request Body | Returns | Notes |
| --- | --- | --- | --- |
| `POST /audio/generate` | `{ preset, script }` | `{ audio_path }` | Should stream TTS output to disk and return the absolute file path that the Next.js frontend can fetch. |
| `POST /video/generate` | `{ preset, audio_path }` | `{ video_path }` | Should render avatar video using the supplied audio track and return the saved file path. |

**When `DEMO_PIPELINE=true`, the front end serves pre-generated audio and video from `public/demo/**` for the Belinda and Broom Salesman presets.**

## TODO

1. **Replace stub writes**
   - Implement real audio synthesis in `generate_audio` using the supported presets.
   - Implement real avatar rendering in `generate_video`, consuming the generated audio file.
   - Ensure both endpoints return paths that the frontend can access (e.g., under `public/generated/**`).

2. **Add demo videos**
   - add demo videos to public/demo/video
   - name them as LLM_belinda.mp4 and LLM_broom_salesman.mp4

3. **Wire authentication / config** (if needed)
   - Add any required API keys, model configs, or environment variables. Document them in `README.md` once finalized.
