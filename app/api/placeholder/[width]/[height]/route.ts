import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ width: string; height: string }> }
) {
  const { width: widthStr, height: heightStr } = await params
  const width = parseInt(widthStr) || 640
  const height = parseInt(heightStr) || 360

  // Create a simple SVG placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#f3f4f6"/>
      <text x="50%" y="50%" font-family="system-ui, sans-serif" font-size="20" fill="#6b7280" text-anchor="middle" dy=".3em">
        ${width} × ${height}
      </text>
    </svg>
  `

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000',
    },
  })
}