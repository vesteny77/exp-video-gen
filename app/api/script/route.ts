import { NextRequest, NextResponse } from "next/server"
import { executePipelineTool } from "@/lib/mcp/pipelineTools"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { idea, script, instructions } = body

    if (!idea && !script) {
      return NextResponse.json(
        { error: "Either idea or script content must be provided" },
        { status: 400 },
      )
    }

    const result = await executePipelineTool("modify_script", {
      mode: script ? "refine_existing" : "idea_to_script",
      idea: idea ?? null,
      script: script ?? null,
      instructions: instructions ?? null,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Script generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate script" },
      { status: 500 }
    )
  }
}
