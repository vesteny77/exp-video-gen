import { convertMCPToolsToActions, type MCPTool } from "@copilotkit/runtime"
import { runJobAndAwait } from "@/lib/backend/runJob"
import { jobStore } from "@/lib/api/jobStore"
import { getAzureClient, getAzureDeploymentName } from "@/lib/backend/azureClient"
import type { VoicePreset } from "@/types/pipeline"

const AUDIO_PRESETS: VoicePreset[] = [
  "belinda",
  "broom_salesman",
  "chadwick",
  "en_man",
  "en_woman",
  "mabel",
  "vex",
  "zh_man_sichuan",
]

function assertVoicePreset(preset: string): asserts preset is VoicePreset {
  if (!AUDIO_PRESETS.includes(preset as VoicePreset)) {
    throw new Error(
      `Unsupported voice preset '${preset}'. Choose one of: ${AUDIO_PRESETS.join(", ")}`,
    )
  }
}

function toJsonSchema(schema: Record<string, any>) {
  return {
    parameters: {
      type: "object",
      properties: schema,
      required: Object.entries(schema)
        .filter(([, value]) => value && value.required)
        .map(([key]) => key),
    },
  }
}

export function getPipelineMcpTools(): Record<string, MCPTool> {
  return {
    modify_script: {
      description:
        "Create or refine an AV script. Provide either a fresh idea or a full script to polish.",
      schema: toJsonSchema({
        mode: {
          type: "string",
          enum: ["idea_to_script", "refine_existing"],
          description:
            "Whether to draft a script from an idea or refine the supplied script.",
          required: true,
        },
        idea: {
          type: "string",
          description: "Optional video concept or summary to expand into a script.",
        },
        script: {
          type: "string",
          description: "Existing script to refine or overwrite.",
        },
        instructions: {
          type: "string",
          description: "Style or tone adjustments to apply to the script.",
        },
      }),
      async execute(params: {
        mode: "idea_to_script" | "refine_existing"
        idea?: string
        script?: string
        instructions?: string
      }) {
        if (params.mode === "idea_to_script" && !params.idea) {
          throw new Error("Provide an idea when mode is 'idea_to_script'.")
        }
        if (params.mode === "refine_existing" && !params.script) {
          throw new Error("Provide a script to refine when mode is 'refine_existing'.")
        }

        const ideaText = params.mode === "idea_to_script" ? params.idea ?? "" : params.idea ?? ""
        const azureClient = getAzureClient()
        const deploymentName = getAzureDeploymentName()

        if (!azureClient || !deploymentName) {
          throw new Error("Azure OpenAI configuration is required for script generation.")
        }

        const systemPrompt = [
          "You are an expert video scriptwriter for an AI avatar studio.",
          "Write engaging, cinematic narratives directly in plain text paragraphs (no markdown, bullet points, or numbering).",
          "Every paragraph should be 3-4 sentences and flow naturally for voiceover delivery.",
          "Always return the full script ready to read aloud and end with a motivating closing paragraph.",
          "Keep the entire script under 150 words.",
        ].join(" ")

        const userPrompt =
          params.mode === "idea_to_script"
            ? [
                `Video idea: ${ideaText || "N/A"}`,
                params.instructions ? `Style instructions: ${params.instructions}` : null,
                "Draft the complete script as continuous paragraphs without headings or lists.",
                "Ensure the script stays under 150 words.",
              ]
                .filter(Boolean)
                .join("\n")
            : [
                "Revise the following script to improve clarity, storytelling, and emotional impact while keeping the core ideas:",
                params.script ?? "",
                params.instructions
                  ? `Additional guidance: ${params.instructions}. Maintain paragraph format—no bullet points or markdown.`
                  : "Maintain paragraph format—no bullet points or markdown.",
                "Keep the entire script under 150 words.",
              ]
                .filter(Boolean)
                .join("\n")

        const completion = await azureClient.chat.completions.create({
          model: deploymentName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        })

        const generatedContent =
          completion.choices?.[0]?.message?.content?.trim() ||
          "Unable to generate script at this time."

        const wordCount = generatedContent.split(/\s+/).filter(Boolean).length
        const estimatedDuration = Math.max(1, Math.round((wordCount / 160) * 60))

        return {
          type: "SCRIPT_READY",
          script: generatedContent,
          wordCount,
          estimatedDuration,
          idea: ideaText || null,
          instructions: params.instructions ?? null,
          completedAt: new Date().toISOString(),
        }
      },
    },
    generate_audio: {
      description:
        "Convert an approved script into narration using one of the supported voice presets.",
      schema: toJsonSchema({
        script: {
          type: "string",
          description: "Finalized script to convert to speech.",
          required: true,
        },
        preset: {
          type: "string",
          enum: AUDIO_PRESETS,
          description: "Voice preset to use for narration.",
          required: true,
        },
      }),
      async execute(params: { script: string; preset: string }) {
        assertVoicePreset(params.preset)

        const { job, result } = await runJobAndAwait("audio", {
          script: params.script,
          preset: params.preset,
        })

        return {
          type: "AUDIO_READY",
          jobId: job.id,
          audioUrl: result.audioUrl,
          duration: result.duration,
          preset: result.preset,
          generatedAt: job.updatedAt,
          message: `Audio generated with the ${params.preset} voice. Approve or regenerate?`,
        }
      },
    },
    generate_video: {
      description:
        "Render an avatar video using the most recent audio track. Requires a completed audio job.",
      schema: toJsonSchema({
        audioUrl: {
          type: "string",
          description: "Audio URL to drive the avatar animation.",
          required: true,
        },
        avatarId: {
          type: "string",
          description: "Optional avatar identifier. Defaults to 'default'.",
        },
      }),
      async execute(params: { audioUrl: string; avatarId?: string }) {
        const job = jobStore.createJob("video", {
          audioUrl: params.audioUrl,
          avatarId: params.avatarId ?? "default",
        })

        return {
          type: "VIDEO_JOB_STARTED",
          jobId: job.id,
          avatarId: params.avatarId ?? "default",
          status: job.status,
          progress: job.progress,
          message: "Video generation started.",
        }
      },
    },
    brainstorm_script_ideas: {
      description:
        "Produce several creative angles or hooks for the requested topic before drafting the script.",
      schema: toJsonSchema({
        topic: {
          type: "string",
          description: "Subject or goal for the video.",
          required: true,
        },
        tone: {
          type: "string",
          description: "Optional tone guidance, e.g., educational, inspirational, playful.",
        },
        audience: {
          type: "string",
          description: "Primary audience to tailor the ideas toward.",
        },
      }),
      async execute(params: { topic: string; tone?: string; audience?: string }) {
        const variations = [
          "Spark curiosity with a narrative opener.",
          "Highlight a surprising statistic.",
          "Share a quick win or actionable tip.",
          "Showcase a real-world success story.",
          "Contrast common mistakes with best practices.",
        ]

        const ideas = variations.map((pattern, index) => ({
          id: `idea_${index}`,
          headline: `${pattern.split(" ")[0]} ${params.topic}`.replace(/\\s+/g, " ").trim(),
          angle: pattern,
          tone: params.tone ?? "balanced",
          audience: params.audience ?? "general viewers",
          callToAction: "Wrap with an invitation to continue the journey.",
        }))

        return {
          type: "IDEA_SUGGESTIONS",
          generatedAt: new Date().toISOString(),
          topic: params.topic,
          tone: params.tone ?? null,
          audience: params.audience ?? null,
          ideas,
        }
      },
    },
  }
}

export function toCopilotActions(endpoint: string) {
  return convertMCPToolsToActions(getPipelineMcpTools(), endpoint)
}

export async function executePipelineTool(toolName: string, params: any) {
  const tool = getPipelineMcpTools()[toolName]
  if (!tool) {
    throw new Error(`Unknown MCP tool '${toolName}'`)
  }
  return tool.execute(params)
}

export { AUDIO_PRESETS }
