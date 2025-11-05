# Emotion-Aware Video Generator for Content Creators

An AI-powered system that transforms text ideas into expressive avatar videos with synchronized speech and realistic 3D facial animations. This project demonstrates how large language models can orchestrate complex media generation pipelines through conversational interfaces.

## Video Demo

[![Watch the demo on YouTube](https://img.youtube.com/vi/J9sI_tGFTE4/0.jpg)](https://www.youtube.com/watch?v=J9sI_tGFTE4)

## What This Project Does

The Expressive Video Generator takes you from a simple idea to a fully rendered video in four automated stages:

1. **Idea to Script**: An AI assistant helps you develop your concept into a polished script
2. **Script to Speech**: Text-to-speech technology converts your script into natural-sounding audio
3. **Audio to Animation**: NVIDIA's Audio2Face analyzes the audio and generates facial animation data
4. **Animation to Video**: Blender renders a 3D character performing your script with expressive facial movements

The entire pipeline is controlled through a chat interface where an AI copilot manages the workflow, letting you focus on creative decisions while the system handles technical complexity.

## Architecture: How the System Works Together

This project uses a split architecture with a **Next.js frontend** that provides the user interface and an AI assistant, and a **FastAPI backend** that handles the computationally intensive audio and video generation.

The frontend employs a **state machine** pattern to ensure pipeline steps happen in the correct order—you must have a confirmed script before generating audio, and audio before generating video. This state machine synchronizes with the chat interface, so when the AI assistant performs actions, the UI updates immediately to reflect progress.

Communication between components follows this flow:

```
User Input → AI Assistant (CopilotKit) → Pipeline Tools → Azure OpenAI / Backend Services → State Updates → UI Refresh
```

Real-time progress updates stream from the backend to the frontend using **Server-Sent Events** (SSE), a technology that enables the server to push updates to the browser as video rendering progresses.

## Frontend: CopilotKit and the Agentic UI Pattern

The frontend is built with **Next.js 16** and **React 19**, using **TypeScript** for type safety and **Tailwind CSS** for styling.

### CopilotKit: The AI Assistant Framework

**CopilotKit** is a React framework designed for building AI copilots that can control application state and trigger actions based on natural language. The term "Agentic UI" or "AG-UI" refers to this pattern where the AI acts as an agent capable of performing operations on behalf of the user.

In this project, CopilotKit provides:

- A **chat interface** where users interact with the AI assistant
- **Actions** that the AI can invoke (modify script, generate audio, render video)
- **Readable state** that keeps the AI informed about the current pipeline status
- **Message parsing** to detect user intents like "confirm the script" or "use a different voice"

The AI assistant is powered by Azure OpenAI and can access the entire context of your project, making intelligent suggestions and automating tedious steps.

### MCP: Model Context Protocol for Tool Orchestration

**Model Context Protocol (MCP)** is an abstraction layer that bridges the AI assistant with backend functionality. Think of it as a translator that converts natural language intentions into executable operations.

The system defines four main MCP tools:

1. **modify_script**: Creates or refines scripts using Azure OpenAI's language models
2. **generate_audio**: Triggers text-to-speech audio generation via the backend
3. **generate_video**: Initiates the 3D rendering pipeline for avatar videos
4. **brainstorm_script_ideas**: Generates creative angles and concepts for scripts

When the AI decides to use a tool, the request flows through the MCP layer to either Azure OpenAI (for text generation) or the FastAPI backend (for media generation). The results return to the frontend and update the application state.

### Synchronous UI Updates: XState State Machine

To keep the interface responsive and consistent, the project uses **XState**, a state management library based on finite state machines. A state machine is a pattern that defines specific states the application can be in and the valid transitions between them.

The pipeline state machine defines these states:

```
idle → ideaInput → scriptGeneration → scriptReady → audioGenerating → audioReady → videoGenerating → videoReady
```

**How synchronous updates work:**

1. User sends a chat message or clicks a button
2. CopilotKit action executes and calls an MCP tool
3. Tool completes and returns a result
4. An event is dispatched to the state machine (like `SCRIPT_READY` or `AUDIO_READY`)
5. State machine updates its internal context with new data
6. React components subscribed to the state automatically re-render
7. IndexedDB (a browser database) persists the state for recovery if you refresh

This architecture ensures that when the AI generates a script or the backend finishes rendering a video, the UI reflects those changes instantly and predictably.

### Real-Time Progress: Server-Sent Events

Video rendering can take several minutes, so the system uses **Server-Sent Events (SSE)** to stream progress updates. SSE is a web standard that allows servers to push data to browsers over HTTP, maintaining an open connection for continuous updates.

When you start video generation:

1. Frontend initiates rendering and receives a job ID
2. Frontend opens an SSE connection to `/api/jobs/[id]/events`
3. Backend streams job status updates: `processing`, `rendering`, `encoding`, `completed`
4. Frontend dispatches events to the state machine as updates arrive
5. Progress bar and status text update in real-time

## Backend: The Media Generation Pipeline

The backend is a **FastAPI** application written in Python. FastAPI is a modern web framework known for its speed and automatic API documentation. The backend coordinates three external services to generate videos.

### Audio Generation: Higgs Audio v2 Text-to-Speech

The first step in media generation is converting text to speech. The project uses **Higgs Audio v2**, a high-quality text-to-speech model provided by BosonAI.

**How it works:**

1. Backend receives script text and a voice preset (like "belinda" or "broom_salesman")
2. Makes an API call to BosonAI's Higgs Audio service
3. Receives raw audio data in **PCM format** (Pulse-Code Modulation, a standard digital audio format)
4. Converts PCM to **WAV file** (a container format that adds headers for compatibility)
5. Saves the audio file and returns the URL to the frontend

Voice presets include different characters with distinct personalities:
- **belinda**: Warm, maternal tone suitable for reassuring content
- **broom_salesman**: Enthusiastic, energetic tone perfect for sales pitches
- **chadwick**: Professional, calm narrator voice

The TTS model generates expressive audio where pitch, energy, and rhythm convey emotion—this prosody (the rhythm and intonation of speech) becomes crucial in the next step.

### Facial Animation: NVIDIA Audio2Face

**NVIDIA Audio2Face (A2F)** is an AI-powered system that converts audio into facial animation data. It's part of NVIDIA's Avatar Cloud Engine (ACE), a suite of tools for creating realistic digital humans.

**What Audio2Face does:**

Audio2Face analyzes the audio file and generates **ARKit blendshapes**—a set of 52 facial expression parameters originally created by Apple for the iPhone's Face ID system and now used as an industry standard for facial animation.

Blendshapes are numerical values (0.0 to 1.0) that control specific facial features:
- `jawOpen`: How much the mouth is open
- `mouthSmile`: Smile intensity
- `browInnerUp`: Raised eyebrows (surprise)
- `eyeWideLeft`, `eyeWideRight`: Eye widening
- `cheekSquintLeft`, `cheekSquintRight`: Squinting
- And 47 more parameters for lips, tongue, eyes, and subtle expressions

**The technical process:**

1. Backend reads the WAV audio file and loads it as PCM data
2. Opens a **gRPC connection** to NVIDIA's cloud service (gRPC is a high-performance protocol for remote procedure calls)
3. Authenticates using an NVIDIA API key
4. Streams audio chunks to the Audio2Face service
5. Sends a character-specific configuration file (`config_claire.yml` for Belinda, `config_mark.yml` for Broomsman)
6. Receives time-coded blendshape coefficients as responses
7. Saves the output as a **CSV file** with columns for timecode and all 52 blendshape values

Example CSV row:
```
0.033, 0.15, 0.42, 0.08, 0.93, ...
```
This means at 33 milliseconds into the audio, the jaw should be 15% open, the smile at 42%, etc.

**Character-specific configurations** tune how aggressively Audio2Face applies emotions. Some characters have more exaggerated expressions, while others remain subtle and controlled.

### 3D Rendering: The Blender Pipeline

The final step transforms blendshape data into an actual video using **Blender**, a professional 3D animation software with Python scripting capabilities.

**Character models:**

The project includes two rigged 3D characters (rigs are skeletons that control character deformation):

- **Belinda**: Female character with professional appearance (resources/belinda.blend)
- **Broomsman**: Male character with friendly demeanor (resources/broomsman.blend)

Both characters were created in **Character Creator** software and exported with **ARKit-compatible shape keys**. Shape keys are Blender's term for blendshapes—they store different facial expressions that can be smoothly interpolated.

**The rendering process:**

1. **Launch Blender in headless mode** (no graphical interface):
   ```
   blender -b resources/belinda.blend -P belinda_char.py -- csv_path audio_path output_video fps
   ```

2. **Python script execution inside Blender**:
   - Loads the character's `.blend` file
   - Reads the CSV blendshape data generated by Audio2Face
   - Finds mesh objects with shape keys (body, eyes, teeth, tongue, eyelashes)
   - Maps CSV columns to Blender shape keys by name

3. **Animation keyframing**:
   - For each row in the CSV (each frame of animation):
     - Sets the shape key values for that timestamp
     - Inserts a keyframe (a snapshot of values at a specific time)
   - Calculates timeline length based on audio duration
   - Blender interpolates smoothly between keyframes

4. **Frame rendering**:
   - Renders the 3D scene to a sequence of PNG images
   - Output location: `/tmp/render_frames_0001.png`, `_0002.png`, etc.
   - Renders at 30 frames per second (standard video frame rate)
   - Each frame shows the character with the correct facial expression for that moment

5. **Video encoding with ffmpeg**:
   ```
   ffmpeg -framerate 30 -i /tmp/render_frames_%04d.png -i audio.wav -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest output.mp4
   ```
   - Combines the PNG image sequence with the audio file
   - Encodes video using **H.264 codec** (libx264) for broad compatibility
   - Uses **yuv420p pixel format** for maximum device support
   - Encodes audio with **AAC codec** (modern audio standard)
   - Outputs final `.mp4` video file

The entire process from audio input to final video takes 2-5 minutes depending on video length and system performance.

## Emotion Generation: Creating Context-Aware Expressions

The system generates emotionally appropriate facial expressions through a multi-stage process that interprets both the script's content and the audio's prosody.

### How Emotions Emerge from Audio

**NVIDIA Audio2Face** analyzes audio prosody (pitch variations, energy levels, rhythm patterns) to infer emotional content. When someone speaks with rising pitch and higher energy, Audio2Face increases blendshape values for smiles and raised eyebrows. Low, slow speech might trigger frown blendshapes and lowered eyes.

Key blendshapes for different emotions:

- **Happy/Excited**: `mouthSmile`, `mouthSmileLeft`, `mouthSmileRight`, `cheekPuff`
- **Sad/Disappointed**: `mouthFrown`, `mouthFrownLeft`, `mouthFrownRight`, `browInnerUp` (puppy eyes)
- **Surprised**: `eyeWideLeft`, `eyeWideRight`, `browInnerUp`, `jawOpen`
- **Angry**: `browDownLeft`, `browDownRight`, `eyeSquintLeft`, `eyeSquintRight`
- **Thinking/Uncertain**: `mouthPucker`, `browInnerUp`, `eyeLookDown`

### Voice Presets Set Emotional Baselines

The text-to-speech model generates audio with built-in emotional characteristics based on the chosen voice preset:

- **belinda**: Generates warm, reassuring prosody with gentle pitch variations—appropriate for comforting or maternal content
- **broom_salesman**: Produces enthusiastic, energetic audio with dynamic pitch and emphasis—perfect for sales pitches or exciting announcements
- **chadwick**: Creates professional, measured narration with controlled pitch—ideal for educational or serious content

This means the emotion system is context-aware at the script level: choosing "belinda" for a comforting message will result in different facial expressions than choosing "broom_salesman" for the same text.

### Character-Specific Tuning

Each character has a configuration file that adjusts how Audio2Face interprets audio for that specific face:

- **config_claire.yml** (for Belinda): Calibrated for a feminine face structure with softer expression ranges
- **config_mark.yml** (for Broomsman): Tuned for a masculine face with different proportions

These configs ensure that blendshape values produce natural-looking results for each character's unique facial geometry. A smile value of 0.8 might look perfect on one character but exaggerated on another—these configs normalize the mapping.

### The Complete Emotion Pipeline

Here's how script content influences final facial expressions:

1. **Script Creation**: AI assistant helps craft script with appropriate tone
2. **Voice Selection**: User chooses preset matching desired emotional baseline
3. **TTS Generation**: Higgs Audio synthesizes speech with emotional prosody
4. **Prosody Analysis**: Audio2Face detects pitch, energy, and rhythm patterns
5. **Blendshape Generation**: Prosody maps to facial expression coefficients
6. **Character Application**: Character-specific configs adjust expressions
7. **Rendering**: Blender displays the final emotionally expressive performance

The result is a character that doesn't just mouth words, but genuinely appears to feel and convey the emotional content of the script.

## State Management: XState Orchestration in Detail

The project uses **XState 5.23** to manage the complex pipeline state. XState implements the finite state machine pattern, which prevents invalid operations and provides predictable behavior.

### Why a State Machine?

Without structured state management, users could accidentally:
- Generate audio before confirming a script
- Start video rendering without audio
- Edit a script after video generation and create inconsistency

The state machine enforces business logic through **guards** (conditional checks) and **valid transitions** (allowed state changes).

### Pipeline States

The machine defines these discrete states:

- **idle**: Fresh start, no data
- **ideaInput**: User has provided an initial idea
- **scriptGeneration**: AI is currently generating script
- **scriptReady**: Script exists but not confirmed
- **audioGenerating**: TTS is processing
- **audioReady**: Audio exists and is confirmed
- **videoGenerating**: Blender is rendering
- **videoReady**: Final video is available

### State Context

The machine stores data in a **context object**:

```javascript
{
  idea: string | null,
  script: string | null,
  scriptConfirmed: boolean,
  voicePreset: string,
  audioPath: string | null,
  audioUrl: string | null,
  audioConfirmed: boolean,
  videoPath: string | null,
  videoUrl: string | null,
  currentJobId: string | null,
  jobStatus: string | null
}
```

### Events and Transitions

Events trigger state transitions:

- `IDEA_SUBMITTED` → moves from idle to ideaInput
- `SCRIPT_READY` → moves to scriptReady, stores script in context
- `SCRIPT_CONFIRMED` → marks scriptConfirmed = true
- `AUDIO_GENERATION_STARTED` → moves to audioGenerating
- `AUDIO_READY` → moves to audioReady, stores audio URLs
- `VIDEO_GENERATION_STARTED` → moves to videoGenerating
- `VIDEO_READY` → moves to videoReady, stores video URL
- `VIDEO_JOB_STATUS` → updates job status without changing state

### React Integration

The frontend uses `@xstate/react` to connect the state machine to React components:

```javascript
const state = useSelector(pipelineActor, (state) => state.value);
const context = useSelector(pipelineActor, (state) => state.context);
```

The `useSelector` hook subscribes to state changes. When the machine transitions or updates context, React automatically re-renders affected components.

### Persistence

Every state change persists to **IndexedDB**, a browser-based database. If you refresh the page, the application recovers the exact pipeline state and continues where you left off. This persistence happens automatically through a middleware layer that watches for state changes.

## Technical Stack

### Frontend Technologies

**Core Framework:**
- Next.js 16 (React-based framework with server-side rendering and API routes)
- React 19 (UI component library)
- TypeScript 5.7 (Type-safe JavaScript)

**AI and Chat Interface:**
- CopilotKit (@copilotkit/react-core, @copilotkit/react-ui, @copilotkit/runtime)
- Azure OpenAI SDK (for script generation and brainstorming)

**State Management:**
- XState 5.23 (state machine implementation)
- @xstate/react 6.0 (React integration)
- IndexedDB via idb 8.0 (browser persistence)

**UI Components:**
- Tailwind CSS 3.4 (utility-first styling)
- Radix UI (accessible headless components)
- Lucide React (icon library)
- shadcn/ui patterns (pre-built component designs)

**Data Fetching:**
- @tanstack/react-query 5.90 (server state management)

### Backend Technologies

**Core Framework:**
- FastAPI (modern Python web framework)
- Uvicorn (ASGI server for running FastAPI)
- Python 3.10+

**Media Generation:**
- Higgs Audio v2 (text-to-speech via BosonAI API)
- NVIDIA Audio2Face (facial animation via gRPC)
- Blender (3D rendering and animation)
- ffmpeg (video encoding and audio processing)

**Data Storage:**
- lowdb 7.0 (lightweight JSON database for job metadata)

**Communication:**
- gRPC (high-performance protocol for Audio2Face communication)
- Server-Sent Events (SSE for real-time progress updates)

## Prerequisites

- Node.js 18.x or newer and npm 9.x or newer
- Python 3.10 or newer with `pip`
- Blender 3.x or newer (for video rendering)
- ffmpeg (for video encoding)
- Recommended: `pyenv` or another virtual environment tool for Python

## Frontend Setup

1. Install JavaScript dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   Create a `.env.local` file with:
   ```
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
   AZURE_OPENAI_API_KEY=your_key_here
   AZURE_OPENAI_ENDPOINT=your_endpoint_here
   ```

3. Start the Next.js development server:

   ```bash
   npm run dev
   ```

   The app runs at `http://localhost:3000` by default.

## Backend Setup

The backend lives in `backend/` and orchestrates audio and video generation.

1. Create and activate a virtual environment:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   ```

2. Install Python dependencies:

   ```bash
   pip install fastapi uvicorn python-multipart grpcio grpcio-tools
   ```

3. Ensure Blender and ffmpeg are installed and available in your system PATH:

   ```bash
   blender --version
   ffmpeg -version
   ```

4. Run the FastAPI server:

   ```bash
   uvicorn app:app --reload --port 8000
   ```

   The endpoints are available at `http://localhost:8000`. API documentation is automatically generated at `http://localhost:8000/docs`.

## Development Notes

- Run `npm run dev` and `uvicorn app:app --reload --port 8000` in separate terminals during development
- The state machine prevents invalid operations—follow the pipeline order: script → audio → video
- Video rendering takes 2-5 minutes depending on script length and system performance
- IndexedDB stores pipeline state—use browser DevTools to inspect persisted data
- SSE connections automatically reconnect if interrupted

## References

- [Higgs Audio V2 reference](https://github.com/boson-ai/higgs-audio/)
- [BosonAI Hackathon API reference](https://github.com/boson-ai/hackathon-msac-public/)
- [NVIDIA Audio2Face documentation](https://docs.nvidia.com/ace/latest/modules/a2f/index.html)
- [CopilotKit documentation](https://docs.copilotkit.ai/)
- [XState documentation](https://stately.ai/docs/xstate)
