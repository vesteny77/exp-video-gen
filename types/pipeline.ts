export type PipelineStep = 'idle' | 'ideaInput' | 'scriptGeneration' | 'scriptReady' | 'audioGenerating' | 'audioReady' | 'videoGenerating' | 'videoReady'

export type VoicePreset =
  | 'belinda'
  | 'broom_salesman'
  | 'chadwick'
  | 'en_man'
  | 'en_woman'
  | 'mabel'
  | 'vex'
  | 'zh_man_sichuan'

export interface PipelineContext {
  idea: string
  script: string
  scriptConfirmed: boolean
  audioConfirmed: boolean
  voicePreset: VoicePreset | null
  audioUrl: string | null
  videoUrl: string | null
  jobIds: {
    script: string | null
    audio: string | null
    video: string | null
  }
  videoJob: {
    id: string | null
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed'
    progress: number
    message: string | null
  }
  staleFlags: {
    audio: boolean
    video: boolean
  }
}

export type PipelineEvent =
  | { type: 'SET_IDEA'; idea: string }
  | { type: 'GENERATE_SCRIPT' }
  | { type: 'SCRIPT_READY'; script: string }
  | { type: 'EDIT_SCRIPT'; script: string }
  | { type: 'CONFIRM_SCRIPT' }
  | { type: 'CONFIRM_AUDIO' }
  | { type: 'SELECT_VOICE_PRESET'; preset: VoicePreset }
  | { type: 'GENERATE_AUDIO' }
  | { type: 'AUDIO_READY'; audioUrl: string }
  | { type: 'GENERATE_VIDEO' }
  | { type: 'VIDEO_READY'; videoUrl: string }
  | { type: 'VIDEO_JOB_STATUS'; jobId: string; status: 'queued' | 'processing' | 'completed' | 'failed'; progress: number; message?: string | null }
  | { type: 'GO_BACK_TO_STEP'; step: PipelineStep }
  | { type: 'RESET_PIPELINE' }

export interface Job {
  id: string
  type: 'script' | 'audio' | 'video'
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: any
  error?: string
  createdAt: Date
  updatedAt: Date
}
