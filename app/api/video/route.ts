import { NextRequest, NextResponse } from "next/server"
import { jobStore } from "@/lib/api/jobStore"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { audioUrl, avatarId } = body

    if (!audioUrl) {
      return NextResponse.json(
        { error: "Audio URL is required" },
        { status: 400 }
      )
    }

    const job = jobStore.createJob("video", {
      audioUrl,
      avatarId: avatarId || "default",
    })

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      avatarId: avatarId || "default",
      message: "Video generation queued",
    })
  } catch (error) {
    console.error("Video generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate video" },
      { status: 500 }
    )
  }
}
