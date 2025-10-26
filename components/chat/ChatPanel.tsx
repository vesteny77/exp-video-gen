"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { useCopilotReadable, useCopilotChatHeadless_c, useCopilotAction } from "@copilotkit/react-core"
import { CopilotChat } from "@copilotkit/react-ui"
import { usePipelineState } from "@/lib/state/usePipeline"
import type { VoicePreset } from "@/types/pipeline"
import type { Message } from "@copilotkit/shared"
import { generateScript, generateAudio, generateVideo, subscribeToJob } from "@/lib/api/handlers"

const VOICE_PRESET_SYNONYMS: Array<[string, VoicePreset]> = [
  ["belinda", "belinda"],
  ["broom_salesman", "broom_salesman"],
  ["broom salesman", "broom_salesman"],
  ["chadwick", "chadwick"],
  ["en_man", "en_man"],
  ["english man", "en_man"],
  ["englishman", "en_man"],
  ["en_woman", "en_woman"],
  ["english woman", "en_woman"],
  ["englishwoman", "en_woman"],
  ["mabel", "mabel"],
  ["vex", "vex"],
  ["zh_man_sichuan", "zh_man_sichuan"],
  ["zh man sichuan", "zh_man_sichuan"],
  ["sichuan man", "zh_man_sichuan"],
  ["salesman", "broom_salesman"],
]

const CONFIRM_SCRIPT_REGEX = /(confirm( the)? script|proceed( with| to)? audio|proceed with audio generation|ready for audio)/
const CONFIRM_AUDIO_REGEX = /(confirm( the)? audio|audio (looks|sounds) good|lock in audio|approve audio|audio confirmed)/

interface ChatPanelProps {
  pipelineService: any
  initialMessage?: string
}

export function ChatPanel({ pipelineService, initialMessage }: ChatPanelProps) {
  const { state, context, send } = usePipelineState(pipelineService)
  const { messages } = useCopilotChatHeadless_c()
  const processedToolMessages = useRef<Set<string>>(new Set())
  const processedAssistantScripts = useRef<Set<string>>(new Set())
  const processedUserMessages = useRef<Set<string>>(new Set())
  const activeVideoJobRef = useRef<string | null>(null)

  const currentScript = context.script
  const currentIdea = context.idea
  const currentVoicePreset = context.voicePreset
  const isScriptConfirmed = context.scriptConfirmed

  const availableVoicePresets = useMemo(
    () => Array.from(new Set(VOICE_PRESET_SYNONYMS.map(([, preset]) => preset))),
    [],
  )

  const presetLookup = useMemo(() => {
    const map = new Map<string, VoicePreset>()
    VOICE_PRESET_SYNONYMS.forEach(([key, value]) => {
      map.set(key.toLowerCase(), value)
    })
    return map
  }, [])

  const resolvePreset = useCallback((raw?: string | null) => {
    if (!raw) return null
    const normalized = raw.trim().toLowerCase()
    if (!normalized) return null
    if (presetLookup.has(normalized)) {
      return presetLookup.get(normalized) ?? null
    }
    const compact = normalized.replace(/[\s-]+/g, "_")
    if (presetLookup.has(compact)) {
      return presetLookup.get(compact) ?? null
    }
    return null
  }, [presetLookup])

  const detectPresetInText = useCallback((text: string) => {
    const normalized = text.toLowerCase()
    for (const [key, preset] of VOICE_PRESET_SYNONYMS) {
      if (normalized.includes(key)) {
        return preset
      }
    }
    return null
  }, [])

  useEffect(
    () => () => {
      activeVideoJobRef.current = null
    },
    [],
  )

  useCopilotAction(
    {
      name: "modify_script",
      handler: async (args: {
        mode?: "idea_to_script" | "refine_existing"
        idea?: string
        script?: string
        instructions?: string
      }) => {
        const desiredMode = args?.mode === "idea_to_script" ? "idea_to_script" : "refine_existing"
        const trimmedIdea = args?.idea?.trim()
        const trimmedScript = args?.script?.trim()
        const trimmedInstructions = args?.instructions?.trim()
        const previousScript = currentScript
        const ideaForGeneration =
          desiredMode === "idea_to_script"
            ? trimmedIdea || currentIdea
            : trimmedIdea || currentIdea || ""

        if (desiredMode === "idea_to_script" && !ideaForGeneration) {
          throw new Error("An idea is required to draft a new script.")
        }

        if (desiredMode === "refine_existing" && !(trimmedScript || previousScript)) {
          throw new Error("No script is available to refine.")
        }

        if (ideaForGeneration) {
          send({ type: "SET_IDEA", idea: ideaForGeneration })
        }

        send({ type: "GENERATE_SCRIPT" })

        try {
          const result = await generateScript(ideaForGeneration ?? "", {
            script: desiredMode === "refine_existing" ? trimmedScript || previousScript : undefined,
            instructions: trimmedInstructions || undefined,
          })

          if (!result?.script) {
            throw new Error("The assistant did not return a script.")
          }

          send({ type: "SCRIPT_READY", script: result.script })
          return result
        } catch (error) {
          if (previousScript) {
            send({ type: "SCRIPT_READY", script: previousScript })
          }
          throw error instanceof Error ? error : new Error("Script generation failed")
        }
      },
    },
    [currentIdea, currentScript, send],
  )

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
              type: "VIDEO_JOB_STATUS",
              jobId,
              status: status as "completed" | "failed",
              progress: status === 'completed' ? 100 : update.progress ?? 0,
              message,
            })

            if (!update.error && update.result?.videoUrl) {
              send({ type: "VIDEO_READY", videoUrl: update.result.videoUrl })
            }
            break
          } else {
            const progress = typeof update.progress === "number" ? update.progress : 0
            const status =
              update.state === "queued" || update.state === "processing"
                ? update.state
                : "processing"

            send({
              type: "VIDEO_JOB_STATUS",
              jobId,
              status: status as "queued" | "processing",
              progress,
              message: update.message ?? null,
            })
          }
        }
      } catch (error) {
        console.error("Video job tracking failed", error)
        send({
          type: "VIDEO_JOB_STATUS",
          jobId,
          status: "failed",
          progress: 0,
          message: error instanceof Error ? error.message : "Video job tracking failed.",
        })
      } finally {
        if (activeVideoJobRef.current === jobId) {
          activeVideoJobRef.current = null
        }
      }
    },
    [send],
  )

  useCopilotAction(
    {
      name: "confirm_script",
      handler: async () => {
        if (!currentScript.trim()) {
          throw new Error("There is no script to confirm yet.")
        }
        if (!isScriptConfirmed) {
          send({ type: "CONFIRM_SCRIPT" })
        }
        return { status: "confirmed" }
      },
    },
    [currentScript, isScriptConfirmed, send],
  )

  useCopilotAction(
    {
      name: "confirm_audio",
      handler: async () => {
        if (!context.audioUrl) {
          throw new Error("No audio is available to confirm yet.")
        }
        if (!context.audioConfirmed) {
          send({ type: "CONFIRM_AUDIO" })
        }
        return { status: "confirmed" }
      },
    },
    [context.audioUrl, context.audioConfirmed, send],
  )

  useCopilotAction(
    {
      name: "select_voice_preset",
      handler: async (args: { preset?: string }) => {
        const resolved = resolvePreset(args?.preset ?? null)
        if (!resolved) {
          throw new Error(`Unknown preset. Choose one of: ${availableVoicePresets.join(", ")}`)
        }
        send({ type: "SELECT_VOICE_PRESET", preset: resolved })
        return { preset: resolved }
      },
    },
    [availableVoicePresets, resolvePreset, send],
  )

  useCopilotAction(
    {
      name: "generate_audio",
      handler: async (args: { script?: string; preset?: string }) => {
        const targetScript = args?.script?.trim() || currentScript
        if (!targetScript) {
          throw new Error("Generate or approve a script before creating audio.")
        }

        const requestedPreset = resolvePreset(args?.preset ?? null)
        if (requestedPreset) {
          send({ type: "SELECT_VOICE_PRESET", preset: requestedPreset })
        }

        const preset = requestedPreset ?? currentVoicePreset
        if (!preset) {
          throw new Error(
            `Select a voice preset before generating audio. Options: ${availableVoicePresets.join(", ")}`,
          )
        }

        if (!isScriptConfirmed) {
          send({ type: "CONFIRM_SCRIPT" })
        }

        send({ type: "GENERATE_AUDIO" })

        const result = await generateAudio(targetScript, preset)
        if (!result?.audioUrl) {
          throw new Error("Audio generation failed.")
        }

        send({ type: "AUDIO_READY", audioUrl: result.audioUrl })
        return {
          message: `Audio generated with the ${preset} voice. Approve or regenerate?`,
        }
      },
    },
    [availableVoicePresets, currentScript, currentVoicePreset, isScriptConfirmed, resolvePreset, send],
  )

  useCopilotAction(
    {
      name: "generate_video",
      handler: async (args: { audioUrl?: string; avatarId?: string }) => {
        const audioUrl = args?.audioUrl || context.audioUrl
        if (!audioUrl) {
          throw new Error("Generate narration audio before rendering the video.")
        }

        if (!context.audioConfirmed && context.audioUrl) {
          send({ type: "CONFIRM_AUDIO" })
        }

        send({ type: "GENERATE_VIDEO" })

        const presetForVideo = context.voicePreset || args?.avatarId || 'belinda'
        const job = await generateVideo(audioUrl, presetForVideo)
        if (!job?.jobId) {
          throw new Error("Video rendering failed to start.")
        }

        send({
          type: "VIDEO_JOB_STATUS",
          jobId: job.jobId,
          status: job.status === "queued" ? "queued" : "processing",
          progress: 0,
          message: job.message ?? null,
        })

        void trackVideoJob(job.jobId)

        return {
          message: "Video generated. Ready to review or rerender if needed.",
        }
      },
    },
    [context.audioUrl, context.audioConfirmed, context.voicePreset, send, trackVideoJob],
  )

  useCopilotReadable({
    description: "Current pipeline state",
    value: {
      currentStep: state,
      hasIdea: !!context.idea,
      hasScript: !!context.script,
      scriptDraft: context.script,
      scriptConfirmed: context.scriptConfirmed,
      audioConfirmed: context.audioConfirmed,
      hasAudio: !!context.audioUrl,
      hasVideo: !!context.videoUrl,
      voicePreset: context.voicePreset,
      videoJob: context.videoJob,
      availableVoicePresets,
      isAudioStale: context.staleFlags.audio,
      isVideoStale: context.staleFlags.video,
    },
  })

  const extractMessageText = (message: Message) => {
    const raw = (message as any).content
    if (typeof raw === "string") {
      return raw
    }
    if (Array.isArray(raw)) {
      return raw
        .map((entry) => {
          if (typeof entry === "string") return entry
          if (entry && typeof entry.text === "string") return entry.text
          if (entry && typeof entry.content === "string") return entry.content
          return ""
        })
        .join(" ")
    }
    return ""
  }

  useEffect(() => {
    messages.forEach((message: Message) => {
      if (message.role === "user") {
        const id = (message as any).id ?? JSON.stringify(message)
        if (!processedUserMessages.current.has(id)) {
          const text = extractMessageText(message)
          const normalized = text.trim().toLowerCase()
          if (normalized.length > 0) {
            processedUserMessages.current.add(id)
            if (CONFIRM_SCRIPT_REGEX.test(normalized)) {
              send({ type: "CONFIRM_SCRIPT" })
            }
            if (CONFIRM_AUDIO_REGEX.test(normalized)) {
              send({ type: "CONFIRM_AUDIO" })
            }
            const presetMention = detectPresetInText(normalized)
            if (presetMention) {
              send({ type: "SELECT_VOICE_PRESET", preset: presetMention })
            }
          }
        }
      }

      if (message.role !== "tool") return

      const toolMessage = message as unknown as { id?: string; toolCallId?: string; content?: string }
      const toolId = toolMessage.id ?? toolMessage.toolCallId
      if (!toolId || processedToolMessages.current.has(toolId)) {
        return
      }
      processedToolMessages.current.add(toolId)

      try {
        const payload = JSON.parse(toolMessage.content ?? "{}")
        switch (payload?.type) {
          case "AUDIO_READY":
            if (typeof payload.audioUrl === "string") {
              if (payload.preset) {
                const resolved = resolvePreset(payload.preset)
                if (resolved) {
                  send({ type: "SELECT_VOICE_PRESET", preset: resolved })
                }
              }
              send({ type: "AUDIO_READY", audioUrl: payload.audioUrl })
            }
            break
          case "VIDEO_JOB_STARTED":
            if (typeof payload.jobId === "string") {
              send({
                type: "VIDEO_JOB_STATUS",
                jobId: payload.jobId,
                status: payload.status === "queued" ? "queued" : "processing",
                progress: typeof payload.progress === "number" ? payload.progress : 0,
                message: payload.message ?? null,
              })
              void trackVideoJob(payload.jobId)
            }
            break
          case "VIDEO_READY":
            if (typeof payload.videoUrl === "string") {
              send({ type: "VIDEO_READY", videoUrl: payload.videoUrl })
            }
            break
          default:
            break
        }
      } catch (error) {
        console.warn("Unable to parse MCP tool result", error)
      }
    })
  }, [messages, send, detectPresetInText, resolvePreset, trackVideoJob])

  useEffect(() => {
    messages.forEach((message: Message) => {
      if (message.role !== "assistant") return

      const assistantMessage = message as unknown as {
        toolCalls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>
      }

      const toolCalls = assistantMessage.toolCalls
      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        return
      }

      const messageId = (message as any).id ?? JSON.stringify(message)
      if (!processedAssistantScripts.current.has(messageId)) {
        const content = extractMessageText(message)
        if (content.trim().length > 0) {
          processedAssistantScripts.current.add(messageId)
          send({ type: "SCRIPT_READY", script: content.trim() })
        }
      }
    })
  }, [messages, send])

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">Assistant</h2>
        <p className="text-xs text-gray-500">I can help you create and refine your video</p>
      </div>

      <div className="flex-1 overflow-hidden">
        <CopilotChat
          instructions="You orchestrate the Avatar Video Generator pipeline. Follow this loop: (1) call modify_script to create or refine scripts and reply with the updated paragraphs only. (2) When the user is satisfied—or says to confirm or proceed—call confirm_script so the pipeline unlocks audio. (3) Make sure narration presets are set via select_voice_preset, then call generate_audio. (4) After the audio comes back, call confirm_audio once the user approves it. (5) When the script and audio are confirmed, call generate_video to start rendering; report progress based on job updates. Do not invent other capabilities."
          labels={{
            title: "Video Creation Assistant",
            initial: initialMessage || "How can I help you create your video today?",
          }}
          className="h-full"
        />
      </div>
    </div>
  )
}
