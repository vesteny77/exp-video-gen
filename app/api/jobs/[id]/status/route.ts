import { NextRequest, NextResponse } from "next/server"
import { jobStore } from "@/lib/api/jobStore"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params

    // Get job from store
    const job = jobStore.getJob(jobId)

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error("Job status error:", error)
    return NextResponse.json(
      { error: "Failed to get job status" },
      { status: 500 }
    )
  }
}