# Expressive Video Generator

This repository contains a Next.js front end with copilotkit and AG-UI and a lightweight FastAPI back end. Follow the steps below to install dependencies and run everything locally.

## Prerequisites

- Node.js 18.x or newer and npm 9.x or newer
- Python 3.10 or newer with `pip`
- Recommended: `pyenv` or another virtual environment tool for Python

## Frontend Setup

1. Install JavaScript dependencies:

   ```bash
   npm install
   ```

2. Start the Next.js development server:

   ```bash
   npm run dev
   ```

   The app runs at `http://localhost:3000` by default.

## Backend Setup

The back end lives in `backend/` and exposes stub endpoints that save placeholder files to disk. Replace the stub logic with real integrations when ready.

1. Create and activate a virtual environment (example using `python -m venv`):

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   ```

2. Install Python dependencies:

   ```bash
   pip install fastapi uvicorn
   ```

3. Run the FastAPI server:

   ```bash
   uvicorn app:app --reload --port 8000
   ```

   The endpoints are available at `http://localhost:8000`. Update the front end’s `.env.local` with `NEXT_PUBLIC_BACKEND_URL` if you point to a different host or port.

## Development Notes

- The FastAPI server currently writes text placeholders. Replace the TODO sections in `backend/app.py` with real audio/video generation logic.
- Run `npm run dev` and `uvicorn app:app --reload` in separate terminals during development.

## References

- [Higgs Audio V2 reference](https://github.com/boson-ai/higgs-audio/)
- [BosonAI Hackathon API reference](https://github.com/boson-ai/hackathon-msac-public/)
