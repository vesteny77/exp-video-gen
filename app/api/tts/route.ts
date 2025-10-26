import { NextRequest, NextResponse } from "next/server"
import { runJobAndAwait } from "@/lib/backend/runJob"
import type { VoicePreset } from "@/types/pipeline"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { script, preset } = body

    if (!script) {
      return NextResponse.json(
        { error: "Script is required" },
        { status: 400 }
      )
    }

    if (!preset) {
      return NextResponse.json(
        { error: "Voice preset is required" },
        { status: 400 }
      )
    }

    const validPresets: VoicePreset[] = ['belinda', 'broom_salesman', 'chadwick', 'en_man', 'en_woman', 'mabel', 'vex', 'zh_man_sichuan']
    if (!validPresets.includes(preset as VoicePreset)) {
      return NextResponse.json(
        { error: "Invalid voice preset" },
        { status: 400 }
      )
    }

    const { job, result } = await runJobAndAwait("audio", {
      script,
      preset,
    })

    return NextResponse.json({
      jobId: job.id,
      status: "completed",
      preset,
      ...result,
      message: `Audio generation completed with ${preset} voice`,
    })
  } catch (error) {
    console.error("TTS generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate audio" },
      { status: 500 }
    )
  }
}
