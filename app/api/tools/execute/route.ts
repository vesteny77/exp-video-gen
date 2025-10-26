import { NextRequest, NextResponse } from "next/server"
import { executePipelineTool } from "@/lib/mcp/pipelineTools"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tool, parameters } = body

    if (!tool || typeof tool !== "string") {
      return NextResponse.json({ error: "Tool name is required" }, { status: 400 })
    }

    const result = await executePipelineTool(tool, parameters ?? {})

    return NextResponse.json({
      tool,
      result,
    })
  } catch (error) {
    console.error("Pipeline MCP tool execution error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to execute pipeline tool",
      },
      { status: 500 },
    )
  }
}
