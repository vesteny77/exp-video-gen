const DEMO_AUDIO_DURATION_MS = 10_000
const DEMO_VIDEO_DURATION_MS = 15_000

const DEMO_MEDIA: Record<
  string,
  {
    audio: string
    audioDuration: number
    video: string
    videoDuration: number
  }
> = {
  belinda: {
    audio: '/demo/audio/LLM_belinda.wav',
    audioDuration: 16,
    video: '/demo/video/LLM_belinda.mp4',
    videoDuration: 30,
  },
  broom_salesman: {
    audio: '/demo/audio/LLM_broom_salesman.wav',
    audioDuration: 14,
    video: '/demo/video/LLM_broom_salesman.mp4',
    videoDuration: 27,
  },
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const DEMO_MODE = process.env.DEMO_PIPELINE === 'true' || process.env.NEXT_PUBLIC_DEMO_PIPELINE === 'true'
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000'

// In-memory job storage for mock backend
export interface Job {
  id: string
  type: 'script' | 'audio' | 'video'
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  input: any
  result?: any
  error?: string
  createdAt: Date
  updatedAt: Date
}

class JobStore {
  private jobs: Map<string, Job> = new Map()
  private listeners: Map<string, Set<(job: Job) => void>> = new Map()

  createJob(type: Job['type'], input: any): Job {
    const job: Job = {
      id: `job_${type}_${Date.now()}`,
      type,
      status: 'queued',
      progress: 0,
      input,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.jobs.set(job.id, job)
    this.notifyListeners(job.id)

    // Start processing the job asynchronously
    this.processJob(job.id)

    return job
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id)
  }

  updateJob(id: string, updates: Partial<Job>): Job | undefined {
    const job = this.jobs.get(id)
    if (!job) return undefined

    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: new Date(),
    }

    this.jobs.set(id, updatedJob)
    this.notifyListeners(id)

    return updatedJob
  }

  subscribe(jobId: string, callback: (job: Job) => void): () => void {
    const listeners = this.listeners.get(jobId) || new Set()
    listeners.add(callback)
    this.listeners.set(jobId, listeners)

    // Return unsubscribe function
    return () => {
      listeners.delete(callback)
      if (listeners.size === 0) {
        this.listeners.delete(jobId)
      }
    }
  }

  private notifyListeners(jobId: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    const listeners = this.listeners.get(jobId)
    if (listeners) {
      listeners.forEach(callback => callback(job))
    }
  }

  private async processJob(jobId: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    if (DEMO_MODE && job.type === 'audio') {
      const presetKey = typeof job.input?.preset === 'string' ? job.input.preset.toLowerCase() : ''
      if (DEMO_MEDIA[presetKey]) {
        await this.processDemoAudio(jobId, presetKey)
        return
      }
    }

    if (!DEMO_MODE && job.type === 'audio') {
      await this.processBackendAudio(jobId)
      return
    }

    if (DEMO_MODE && job.type === 'video') {
      const audioUrl: string | undefined = job.input?.audioUrl
      const mediaKey = audioUrl
        ? Object.entries(DEMO_MEDIA).find(([, media]) => media.audio === audioUrl)?.[0]
        : undefined

      if (mediaKey) {
        await this.processDemoVideo(jobId, mediaKey)
        return
      }
    }

    if (!DEMO_MODE && job.type === 'video') {
      await this.processBackendVideo(jobId)
      return
    }

    await defaultJobProcessor(jobId, job, this.updateJob.bind(this))
  }

  private async processDemoAudio(jobId: string, presetKey: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    const media = DEMO_MEDIA[presetKey]
    
    this.updateJob(jobId, { status: 'processing', progress: 10 })

    const steps = [30, 55, 75, 90]
    const interval = Math.max(500, Math.floor(DEMO_AUDIO_DURATION_MS / (steps.length + 1)))

    for (const progress of steps) {
      await sleep(interval)
      this.updateJob(jobId, { progress })
    }

    await sleep(interval)

    this.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      result: {
        audioUrl: media?.audio ?? '/samples/demo-audio.wav',
        audioPath: media?.audio ?? '/samples/demo-audio.wav',
        duration: media?.audioDuration ?? 15,
        preset: job.input?.preset,
        script: job.input?.script,
        updatedAt: new Date().toISOString(),
      },
    })
  }

  private async processDemoVideo(jobId: string, mediaKey: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    this.updateJob(jobId, { status: 'processing', progress: 10 })

    const steps = [25, 45, 65, 85]
    const interval = Math.max(500, Math.floor(DEMO_VIDEO_DURATION_MS / (steps.length + 1)))

    for (const progress of steps) {
      await sleep(interval)
      this.updateJob(jobId, { progress })
    }

    await sleep(interval)

    const audioUrl: string | undefined = job.input?.audioPath ?? job.input?.audioUrl
    const media = DEMO_MEDIA[mediaKey]

    const videoUrl = media?.video ?? '/samples/demo-video.mp4'
    const message = media
      ? `Video ready. Served from ${videoUrl}.`
      : 'Video ready.'

    this.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      result: {
        videoUrl,
        videoPath: media?.video ?? '/samples/demo-video.mp4',
        duration: media?.videoDuration ?? 30,
        format: 'mp4',
        audioUrl,
        audioPath: audioUrl,
        message,
        updatedAt: new Date().toISOString(),
      },
    })
  }

  private async processBackendAudio(jobId: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    const preset = job.input?.preset
    const script = job.input?.script

    if (!preset || !script) {
      this.updateJob(jobId, {
        status: 'failed',
        error: 'Audio job missing preset or script.',
      })
      return
    }

    this.updateJob(jobId, { status: 'processing', progress: 15 })

    try {
      const data = await callBackend<{ audio_path: string; audio_url?: string }>("/audio/generate", {
        preset,
        script,
      })

      this.updateJob(jobId, { progress: 80 })

      this.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        result: {
          audioUrl: toPublicUrl(data.audio_url, data.audio_path, 'audio'),
          audioPath: data.audio_path,
          duration: null,
          preset,
          script,
          updatedAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      console.error('[jobStore] Audio backend request failed, falling back to sample:', error)
      this.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        result: {
          audioUrl: '/samples/demo-audio.wav',
          audioPath: '/samples/demo-audio.wav',
          duration: 15,
          preset,
          script,
          updatedAt: new Date().toISOString(),
          fallback: true,
        },
      })
    }
  }

  private async processBackendVideo(jobId: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    const audioPath: string | undefined = job.input?.audioPath ?? job.input?.audioUrl
    if (!audioPath) {
      this.updateJob(jobId, {
        status: 'failed',
        error: 'Video job missing audio URL.',
      })
      return
    }

    const preset: string = job.input?.avatarId ?? job.input?.preset ?? 'belinda'

    this.updateJob(jobId, { status: 'processing', progress: 15 })

    try {
      const data = await callBackend<{ video_path: string; video_url?: string }>("/video/generate", {
        preset,
        audio_path: audioPath,
      })

      this.updateJob(jobId, { progress: 85 })

      this.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        result: {
          videoUrl: toPublicUrl(data.video_url, data.video_path, 'video'),
          videoPath: data.video_path,
          duration: null,
          format: 'mp4',
          preset,
          audioUrl: toPublicUrl(undefined, audioPath, 'audio'),
          audioPath,
          updatedAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      console.error('[jobStore] Video backend request failed, falling back to sample:', error)
      this.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        result: {
          videoUrl: '/samples/demo-video.mp4',
          videoPath: '/samples/demo-video.mp4',
          duration: 10,
          format: 'mp4',
          preset,
          audioUrl: toPublicUrl(undefined, audioPath, 'audio'),
          audioPath,
          updatedAt: new Date().toISOString(),
          fallback: true,
        },
      })
    }
  }
}

async function defaultJobProcessor(jobId: string, job: Job, updateJob: JobStore['updateJob']) {
  updateJob(jobId, { status: 'processing', progress: 10 })

  const progressSteps = [25, 45, 65, 85]
  const delay = job.type === 'script' ? 400 : 800

  for (const progress of progressSteps) {
    await sleep(delay)
    updateJob(jobId, { progress })
  }

  let result: any = null

  if (job.type === 'script') {
    const baseScript = (job.input?.script || job.input?.idea || 'Script placeholder').toString()

    result = {
      script: baseScript,
      wordCount: baseScript.split(/\s+/).filter(Boolean).length,
      estimatedDuration: 60,
      updatedAt: new Date().toISOString(),
    }
  }

  updateJob(jobId, {
    status: 'completed',
    progress: 100,
    result,
  })
}

// Export singleton instance
export const jobStore = new JobStore()
async function callBackend<T>(path: string, body: Record<string, any>) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.detail || errorBody.error || `Backend request failed (${response.status})`)
  }

  return (await response.json()) as T
}

function toPublicUrl(providedUrl: string | undefined, filePath: string | undefined, type: 'audio' | 'video'): string {
  if (providedUrl) {
    try {
      return new URL(providedUrl, BACKEND_URL).toString()
    } catch {
      return providedUrl
    }
  }

  if (!filePath) {
    return ''
  }

  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath
  }

  if (filePath.startsWith('/samples/') || filePath.startsWith('/demo/')) {
    return filePath
  }

  const filename = filePath.split(/[/\\]/).pop()
  if (!filename) {
    return filePath
  }

  const mount = type === 'audio' ? '/media/audio/' : '/media/video/'
  try {
    return new URL(mount + filename, BACKEND_URL).toString()
  } catch {
    return mount + filename
  }
}
