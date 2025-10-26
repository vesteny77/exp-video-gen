import { createMachine, assign } from 'xstate'
import type { PipelineContext, PipelineEvent, VoicePreset } from '@/types/pipeline'

export const pipelineMachine = createMachine({
  id: 'pipeline',
  initial: 'idle',
  types: {
    context: {} as PipelineContext,
    events: {} as PipelineEvent,
  },
  context: {
    idea: '',
    script: '',
    scriptConfirmed: false,
    audioConfirmed: false,
    audioPath: null,
    voicePreset: null,
    audioUrl: null,
    videoUrl: null,
    jobIds: {
      script: null,
      audio: null,
      video: null,
    },
    videoJob: {
      id: null,
      status: 'idle',
      progress: 0,
      message: null,
    },
    staleFlags: {
      audio: false,
      video: false,
    },
  },
  states: {
    idle: {
      on: {
        SET_IDEA: {
          actions: assign({
            idea: ({ event }) => {
              if (event.type === 'SET_IDEA') return event.idea
              return ''
            },
            scriptConfirmed: () => false,
            audioConfirmed: () => false,
            voicePreset: () => null,
            audioPath: () => null,
            audioUrl: () => null,
            videoUrl: () => null,
            jobIds: ({ context }) => ({ ...context.jobIds, audio: null, video: null }),
            videoJob: () => ({ id: null, status: 'idle', progress: 0, message: null }),
            staleFlags: () => ({ audio: false, video: false }),
          }),
          target: 'ideaInput',
        },
        GENERATE_SCRIPT: {
          target: 'scriptGeneration',
        },
      },
    },
    ideaInput: {
      on: {
        GENERATE_SCRIPT: {
          target: 'scriptGeneration',
        },
        EDIT_SCRIPT: {
          actions: assign({
            script: ({ event }) => {
              if (event.type === 'EDIT_SCRIPT') return event.script
              return ''
            },
            scriptConfirmed: () => false,
            audioConfirmed: () => false,
            staleFlags: () => ({ audio: false, video: false }),
            voicePreset: () => null,
            audioPath: () => null,
            audioUrl: () => null,
            videoUrl: () => null,
            jobIds: ({ context }) => ({ ...context.jobIds, audio: null, video: null }),
            videoJob: () => ({ id: null, status: 'idle', progress: 0, message: null }),
          }),
          target: 'scriptReady',
        },
      },
    },
    scriptGeneration: {
      on: {
        SCRIPT_READY: {
          actions: assign({
            script: ({ event }) => {
              if (event.type === 'SCRIPT_READY') return event.script
              return ''
            },
            scriptConfirmed: () => false,
            audioConfirmed: () => false,
            staleFlags: () => ({ audio: false, video: false }),
            voicePreset: () => null,
            audioPath: () => null,
            audioUrl: () => null,
            videoUrl: () => null,
            jobIds: ({ context }) => ({ ...context.jobIds, audio: null, video: null }),
            videoJob: () => ({ id: null, status: 'idle', progress: 0, message: null }),
          }),
          target: 'scriptReady',
        },
      },
    },
    scriptReady: {
      on: {
        EDIT_SCRIPT: {
          actions: assign({
            script: ({ event }) => {
              if (event.type === 'EDIT_SCRIPT') return event.script
              return ''
            },
            staleFlags: () => ({ audio: true, video: true }),
            scriptConfirmed: () => false,
            audioConfirmed: () => false,
            voicePreset: () => null,
            audioPath: () => null,
            audioUrl: () => null,
            videoUrl: () => null,
            jobIds: ({ context }) => ({ ...context.jobIds, audio: null, video: null }),
            videoJob: () => ({ id: null, status: 'idle', progress: 0, message: null }),
          }),
        },
        SELECT_VOICE_PRESET: {
          actions: assign({
            voicePreset: ({ event, context }) => {
              if (event.type === 'SELECT_VOICE_PRESET') return event.preset
              return context.voicePreset
            },
          }),
        },
        CONFIRM_SCRIPT: {
          guard: ({ context }) => !!context.script && context.script.trim().length > 0,
          actions: assign({
            scriptConfirmed: () => true,
            staleFlags: ({ context }) => ({ ...context.staleFlags, audio: false }),
          }),
        },
        GENERATE_SCRIPT: {
          actions: assign({
            staleFlags: ({ context }) => ({ ...context.staleFlags, audio: true, video: true }),
            scriptConfirmed: () => false,
            audioConfirmed: () => false,
            voicePreset: () => null,
            audioPath: () => null,
            audioUrl: () => null,
            videoUrl: () => null,
            jobIds: ({ context }) => ({ ...context.jobIds, audio: null, video: null }),
            videoJob: () => ({ id: null, status: 'idle', progress: 0, message: null }),
          }),
          target: 'scriptGeneration',
        },
        GENERATE_AUDIO: {
          guard: ({ context }) => context.scriptConfirmed,
          target: 'audioGenerating',
        },
        GO_BACK_TO_STEP: [
          {
            target: 'ideaInput',
            guard: ({ event }) => event.type === 'GO_BACK_TO_STEP' && event.step === 'ideaInput',
          },
        ],
      },
    },
    audioGenerating: {
      entry: assign({
        audioUrl: () => null,
        audioPath: () => null,
        staleFlags: () => ({ audio: false, video: true }),
        audioConfirmed: () => false,
        jobIds: ({ context }) => ({ ...context.jobIds, audio: context.jobIds.audio }),
        videoJob: () => ({ id: null, status: 'idle', progress: 0, message: null }),
      }),
      on: {
        AUDIO_READY: {
          actions: assign({
            audioUrl: ({ event }) => {
              if (event.type === 'AUDIO_READY') return event.audioUrl
              return null
            },
            audioPath: ({ event }) => {
              if (event.type !== 'AUDIO_READY') return null
              return event.audioPath ?? event.audioUrl ?? null
            },
            scriptConfirmed: () => true,
            audioConfirmed: () => false,
            staleFlags: ({ context }) => ({ ...context.staleFlags, video: true }),
          }),
          target: 'audioReady',
        },
      },
    },
    audioReady: {
      on: {
        EDIT_SCRIPT: {
          actions: assign({
            script: ({ event }) => {
              if (event.type === 'EDIT_SCRIPT') return event.script
              return ''
            },
            staleFlags: () => ({ audio: true, video: true }),
            audioUrl: () => null,
            audioPath: () => null,
            videoUrl: () => null,
            scriptConfirmed: () => false,
            audioConfirmed: () => false,
            voicePreset: () => null,
            jobIds: ({ context }) => ({ ...context.jobIds, audio: null, video: null }),
            videoJob: () => ({ id: null, status: 'idle', progress: 0, message: null }),
          }),
          target: 'scriptReady',
        },
        SELECT_VOICE_PRESET: {
          actions: assign({
            voicePreset: ({ event, context }) => {
              if (event.type === 'SELECT_VOICE_PRESET') return event.preset
              return context.voicePreset
            },
          }),
        },
        CONFIRM_SCRIPT: {
          guard: ({ context }) => !!context.script && context.script.trim().length > 0,
          actions: assign({
            scriptConfirmed: () => true,
            staleFlags: ({ context }) => ({ ...context.staleFlags, audio: false }),
          }),
        },
        CONFIRM_AUDIO: {
          guard: ({ context }) => !!context.audioUrl,
          actions: assign({
            audioConfirmed: () => true,
            staleFlags: ({ context }) => ({ ...context.staleFlags, video: false }),
          }),
        },
        GENERATE_AUDIO: {
          guard: ({ context }) => context.scriptConfirmed,
          target: 'audioGenerating',
        },
        GENERATE_VIDEO: {
          guard: ({ context }) => context.audioConfirmed && !!context.audioUrl && !!context.audioPath,
          target: 'videoGenerating',
        },
        GO_BACK_TO_STEP: [
          {
            target: 'scriptReady',
            guard: ({ event }) => event.type === 'GO_BACK_TO_STEP' && event.step === 'scriptReady',
          },
          {
            target: 'ideaInput',
            guard: ({ event }) => event.type === 'GO_BACK_TO_STEP' && event.step === 'ideaInput',
          },
        ],
      },
    },
    videoGenerating: {
      entry: assign({
        videoUrl: () => null,
        staleFlags: ({ context }) => ({ ...context.staleFlags, video: false }),
        videoJob: () => ({ id: null, status: 'processing', progress: 0, message: 'Starting video generation...' }),
      }),
      on: {
        VIDEO_JOB_STATUS: [
          {
            target: 'audioReady',
            guard: ({ event }) => event.type === 'VIDEO_JOB_STATUS' && event.status === 'failed',
            actions: assign({
              videoJob: ({ event, context }) => {
                if (event.type !== 'VIDEO_JOB_STATUS') return context.videoJob
                return {
                  id: event.jobId,
                  status: 'failed',
                  progress: event.progress,
                  message: event.message ?? 'Video generation failed.',
                }
              },
              staleFlags: ({ context }) => ({ ...context.staleFlags, video: true }),
            }),
          },
          {
            guard: ({ event }) => event.type === 'VIDEO_JOB_STATUS',
            actions: assign({
              jobIds: ({ context, event }) => {
                if (event.type !== 'VIDEO_JOB_STATUS') return context.jobIds
                return { ...context.jobIds, video: event.jobId }
              },
              videoJob: ({ event, context }) => {
                if (event.type !== 'VIDEO_JOB_STATUS') return context.videoJob
                return {
                  id: event.jobId,
                  status: event.status,
                  progress: event.progress,
                  message: event.message ?? null,
                }
              },
            }),
          },
        ],
        VIDEO_READY: {
          actions: assign({
            videoUrl: ({ event }) => {
              if (event.type === 'VIDEO_READY') return event.videoUrl
              return null
            },
            scriptConfirmed: () => true,
            videoJob: ({ context }) => ({
              id: context.jobIds.video,
              status: 'completed',
              progress: 100,
              message: 'Video ready.',
            }),
          }),
          target: 'videoReady',
        },
      },
    },
    videoReady: {
      on: {
        EDIT_SCRIPT: {
          actions: assign({
            script: ({ event }) => {
              if (event.type === 'EDIT_SCRIPT') return event.script
              return ''
            },
            staleFlags: () => ({ audio: true, video: true }),
            audioUrl: () => null,
            audioPath: () => null,
            videoUrl: () => null,
            voicePreset: () => null,
            scriptConfirmed: () => false,
            audioConfirmed: () => false,
            jobIds: ({ context }) => ({ ...context.jobIds, audio: null, video: null }),
            videoJob: () => ({ id: null, status: 'idle', progress: 0, message: null }),
          }),
          target: 'scriptReady',
        },
        SELECT_VOICE_PRESET: {
          actions: assign({
            voicePreset: ({ event, context }) => {
              if (event.type === 'SELECT_VOICE_PRESET') return event.preset
              return context.voicePreset
            },
          }),
        },
        CONFIRM_SCRIPT: {
          guard: ({ context }) => !!context.script && context.script.trim().length > 0,
          actions: assign({
            scriptConfirmed: () => true,
            staleFlags: ({ context }) => ({ ...context.staleFlags, audio: false }),
          }),
        },
        GENERATE_AUDIO: {
          target: 'audioGenerating',
        },
        GENERATE_VIDEO: {
          guard: ({ context }) => context.audioConfirmed && !!context.audioUrl && !!context.audioPath,
          target: 'videoGenerating',
        },
        GO_BACK_TO_STEP: [
          {
            target: 'audioReady',
            guard: ({ event }) => event.type === 'GO_BACK_TO_STEP' && event.step === 'audioReady',
          },
          {
            target: 'scriptReady',
            guard: ({ event }) => event.type === 'GO_BACK_TO_STEP' && event.step === 'scriptReady',
          },
          {
            target: 'ideaInput',
            guard: ({ event }) => event.type === 'GO_BACK_TO_STEP' && event.step === 'ideaInput',
          },
        ],
        RESET_PIPELINE: {
          actions: assign({
            idea: () => '',
            script: () => '',
            scriptConfirmed: () => false,
            audioConfirmed: () => false,
            voicePreset: () => null,
            audioUrl: () => null,
            audioPath: () => null,
            videoUrl: () => null,
            jobIds: () => ({ script: null, audio: null, video: null }),
            videoJob: () => ({ id: null, status: 'idle', progress: 0, message: null }),
            staleFlags: () => ({ audio: false, video: false }),
          }),
          target: 'idle',
        },
      },
    },
  },
})
