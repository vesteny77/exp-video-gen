"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePipeline, usePipelineState } from "@/lib/state/usePipeline"
import { PipelineTimeline } from "@/components/pipeline/PipelineTimeline"
import { ScriptCard } from "@/components/pipeline/ScriptCard"
import { AudioCard } from "@/components/pipeline/AudioCard"
import { VideoCard } from "@/components/pipeline/VideoCard"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { AppHeader } from "@/components/layout/AppHeader"
import { Separator } from "@/components/ui/separator"
import { generateScript, generateAudio, generateVideo, subscribeToJob } from "@/lib/api/handlers"

export default function DashboardPage() {
  const service = usePipeline()
  const {
    state,
    context,
    send,
    isStale,
    isAudioEnabled,
    isAudioConfirmed,
    isVideoEnabled,
    canGenerateAudio,
    canGenerateVideo,
  } = usePipelineState(service)
  const [initialInput, setInitialInput] = useState<string>("")
  const activeVideoJobRef = useRef<string | null>(null)

  useEffect(() => {
    const input = sessionStorage.getItem('initialInput')
    const scriptResultRaw = sessionStorage.getItem('initialScriptResult')

    if (input) {
      setInitialInput(input)
      const isScript = input.length > 200 || input.includes('\n\n')
      if (!scriptResultRaw) {
        if (isScript) {
          send({ type: 'EDIT_SCRIPT', script: input })
        } else {
          send({ type: 'SET_IDEA', idea: input })
        }
      }
    }

    if (scriptResultRaw) {
      try {
        const result = JSON.parse(scriptResultRaw)
        const idea = result?.idea ?? input ?? ''
        if (idea) {
          send({ type: 'SET_IDEA', idea })
        }
        send({ type: 'GENERATE_SCRIPT' })
        if (typeof result?.script === 'string') {
          send({ type: 'SCRIPT_READY', script: result.script })
        }
      } catch (error) {
        console.error('Failed to load pre-generated script', error)
      }
      sessionStorage.removeItem('initialScriptResult')
    }

    sessionStorage.removeItem('initialInput')
  }, [send])

  useEffect(() => {
    return () => {
      activeVideoJobRef.current = null
    }
  }, [])

  const trackVideoJob = useCallback(
    async (jobId: string) => {
      activeVideoJobRef.current = jobId
      try {
        for await (const update of subscribeToJob(jobId)) {
          if (activeVideoJobRef.current !== jobId) {
            continue
          }

          if (update.completed) {
            const status = update.error ? 'failed' : 'completed'
            const message =
              update.error ||
              update.result?.message ||
              (status === 'completed' ? 'Video generation completed.' : 'Video generation failed.')

            send({
              type: 'VIDEO_JOB_STATUS',
              jobId,
              status: status as 'completed' | 'failed',
              progress: status === 'completed' ? 100 : update.progress ?? 0,
              message,
            })

            if (!update.error && update.result?.videoUrl) {
              send({ type: 'VIDEO_READY', videoUrl: update.result.videoUrl })
            }
            break
          } else {
            const progress = typeof update.progress === 'number' ? update.progress : 0
            const status =
              update.state === 'queued' || update.state === 'processing'
                ? update.state
                : 'processing'

            send({
              type: 'VIDEO_JOB_STATUS',
              jobId,
              status: status as 'queued' | 'processing',
              progress,
              message: update.message ?? null,
            })
          }
        }
      } catch (error) {
        console.error('Video job tracking failed', error)
        send({
          type: 'VIDEO_JOB_STATUS',
          jobId,
          status: 'failed',
          progress: 0,
          message: error instanceof Error ? error.message : 'Video job tracking failed.',
        })
      } finally {
        if (activeVideoJobRef.current === jobId) {
          activeVideoJobRef.current = null
        }
      }
    },
    [send],
  )

  const startVideoGeneration = useCallback(async () => {
    const audioUrl = context.audioUrl
    if (!audioUrl) return

    const audioPath = context.audioPath ?? context.audioUrl
    if (!audioPath) return

    if (!context.audioConfirmed) {
      send({ type: 'CONFIRM_AUDIO' })
    }

    send({ type: 'GENERATE_VIDEO' })

    try {
      const preset = context.voicePreset || 'belinda'
      const job = await generateVideo(audioUrl, preset, audioPath)
      if (!job?.jobId) {
        throw new Error('Video generation did not return a job identifier.')
      }

      send({
        type: 'VIDEO_JOB_STATUS',
        jobId: job.jobId,
        status: job.status === 'queued' ? 'queued' : 'processing',
        progress: 0,
        message: job.message ?? null,
      })

      void trackVideoJob(job.jobId)
    } catch (error) {
      console.error('Video generation error', error)
      send({
        type: 'VIDEO_JOB_STATUS',
        jobId: `video_${Date.now()}`,
        status: 'failed',
        progress: 0,
        message: error instanceof Error ? error.message : 'Video generation failed.',
      })
    }
  }, [context.audioUrl, context.audioPath, context.audioConfirmed, context.voicePreset, send, trackVideoJob])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <AppHeader onReset={() => send({ type: 'RESET_PIPELINE' })} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <PipelineTimeline currentStep={state as string} />

          {state !== 'idle' && (
            <ScriptCard
              script={context.script}
              idea={context.idea}
              isStale={false}
              isGenerating={state === 'scriptGeneration'}
              isConfirmed={context.scriptConfirmed}
              onConfirm={() => send({ type: 'CONFIRM_SCRIPT' })}
              onScriptChange={(script) => send({ type: 'EDIT_SCRIPT', script })}
              onGenerate={async () => {
                send({ type: 'GENERATE_SCRIPT' })
                const result = await generateScript(context.idea)
                if (result) {
                  send({ type: 'SCRIPT_READY', script: result.script })
                }
              }}
            />
          )}

          {(state === 'scriptReady' ||
            state === 'audioGenerating' ||
            state === 'audioReady' ||
            state === 'videoGenerating' ||
            state === 'videoReady') && (
            <AudioCard
              audioUrl={context.audioUrl}
              voicePreset={context.voicePreset}
              isStale={isStale.audio}
              isGenerating={state === 'audioGenerating'}
              isEnabled={isAudioEnabled}
              isConfirmed={isAudioConfirmed}
              canGenerate={canGenerateAudio}
              onPresetChange={(preset) => send({ type: 'SELECT_VOICE_PRESET', preset })}
              onGenerate={async () => {
                if (!context.scriptConfirmed) {
                  send({ type: 'CONFIRM_SCRIPT' })
                }
                const preset = context.voicePreset
                if (!preset) {
                  return
                }
                send({ type: 'GENERATE_AUDIO' })
                const result = await generateAudio(context.script, preset)
                if (result) {
                  send({
                    type: 'AUDIO_READY',
                    audioUrl: result.audioUrl,
                    audioPath: result.audioPath ?? null,
                  })
                }
              }}
              onConfirm={() => send({ type: 'CONFIRM_AUDIO' })}
            />
          )}

          {(state === 'audioReady' || state === 'videoGenerating' || state === 'videoReady') && (
            <VideoCard
              videoUrl={context.videoUrl}
              isStale={isStale.video}
              isGenerating={state === 'videoGenerating'}
              isEnabled={isVideoEnabled}
              canGenerate={canGenerateVideo}
              jobStatus={context.videoJob}
              onGenerate={startVideoGeneration}
            />
          )}
        </div>

        <Separator orientation="vertical" className="h-full" />

        <div className="w-[450px] bg-white border-l">
          <ChatPanel pipelineService={service} initialMessage={initialInput} />
        </div>
      </div>
    </div>
  )
}
