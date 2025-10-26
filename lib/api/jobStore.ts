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

    // Update to processing
    this.updateJob(jobId, { status: 'processing', progress: 10 })

    // Simulate processing based on job type
    const progressSteps = [20, 40, 60, 80, 90]
    const delay = job.type === 'script' ? 400 : job.type === 'audio' ? 600 : 1000

    for (const progress of progressSteps) {
      await new Promise(resolve => setTimeout(resolve, delay))
      this.updateJob(jobId, { progress })
    }

    // Complete the job with result
    let result: any

    switch (job.type) {
      case 'script': {
        const idea: string | undefined = job.input.idea
        const scriptDraft: string | undefined = job.input.script
        const instructions: string | undefined = job.input.instructions

        const baseScript = scriptDraft
          ? scriptDraft.trim()
          : `Welcome to our presentation about "${idea || 'this amazing topic'}".

In today's video, we'll explore the fundamental concepts and practical applications of this topic.

First, let's understand what makes this subject so important in our current context. ${idea || 'This topic'} represents a significant advancement in its field, offering unique solutions to contemporary challenges.

Throughout this presentation, we'll cover:
- The core principles and foundations
- Real-world applications and benefits
- Future implications and opportunities

By the end of this video, you'll have a comprehensive understanding of how ${idea || 'this'} can transform your perspective and approach.

Let's dive in and discover the fascinating world of ${idea || 'innovation'} together.

Thank you for joining us on this educational journey.`

        const wordCount = baseScript.split(/\s+/).filter(Boolean).length
        const estimatedDuration = Math.max(1, Math.round((wordCount / 160) * 60))

        result = {
          script: baseScript,
          wordCount,
          estimatedDuration,
          idea: idea ?? null,
          instructions: instructions ?? null,
          updatedAt: new Date().toISOString(),
        }
        break
      }

      case 'audio': {
        result = {
          audioUrl: '/samples/demo-audio.wav',
          duration: 14.24,
          preset: job.input.preset,
          script: job.input.script,
          updatedAt: new Date().toISOString(),
        }
        break
      }

      case 'video': {
        result = {
          videoUrl: '/samples/demo-video.mp4',
          duration: 10,
          format: 'mp4',
          audioUrl: job.input.audioUrl,
          updatedAt: new Date().toISOString(),
        }
        break
      }
    }

    // Final update
    await new Promise(resolve => setTimeout(resolve, delay))
    this.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      result,
    })
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

    const audioUrl: string | undefined = job.input?.audioUrl
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
        duration: media?.videoDuration ?? 30,
        format: 'mp4',
        audioUrl,
        message,
        updatedAt: new Date().toISOString(),
      },
    })
  }
}

// Export singleton instance
export const jobStore = new JobStore()
const DEMO_MODE = process.env.DEMO_PIPELINE === 'true' || process.env.NEXT_PUBLIC_DEMO_PIPELINE === 'true'
