import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Video, RefreshCw, Download, Play, Expand } from "lucide-react"
import { useState, useRef } from "react"

interface VideoJobStatus {
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  message: string | null
}

interface VideoCardProps {
  videoUrl: string | null
  isStale: boolean
  isGenerating: boolean
  isEnabled: boolean
  canGenerate: boolean
  jobStatus?: VideoJobStatus | null
  onGenerate: () => void
}

export function VideoCard({
  videoUrl,
  isStale,
  isGenerating,
  isEnabled,
  canGenerate,
  jobStatus,
  onGenerate,
}: VideoCardProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const status = jobStatus?.status ?? 'idle'
  const progress = typeof jobStatus?.progress === 'number' ? jobStatus.progress : 0
  const message = jobStatus?.message ?? null

  const toggleFullscreen = () => {
    if (!videoRef.current) return

    if (!isFullscreen) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
    setIsFullscreen(!isFullscreen)
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <Video className="w-5 h-5 text-gray-600" />
          <CardTitle>Video</CardTitle>
          {isStale && <Badge variant="warning">Stale</Badge>}
          {!isEnabled && <Badge variant="outline">Awaiting audio confirm</Badge>}
          {isGenerating && <Badge variant="info">Generating...</Badge>}
          {status === 'failed' && <Badge variant="destructive">Failed</Badge>}
        </div>
        {videoUrl && !isGenerating && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerate}
              disabled={!canGenerate}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Re-render
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href={videoUrl} download="avatar-video.mp4">
                <Download className="w-4 h-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!videoUrl && !isGenerating && (
            <Button
              onClick={onGenerate}
              disabled={!canGenerate || !isEnabled}
              className="w-full bg-blue-500 hover:bg-blue-600"
            >
              <Video className="w-4 h-4 mr-2" />
              Generate Avatar Video
            </Button>
          )}

          {isGenerating && (
            <div className="space-y-3">
              <div className="bg-gray-100 rounded-lg aspect-video flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
                    <Video className="w-8 h-8 text-blue-600 animate-pulse" />
                  </div>
                  <Progress value={progress || 10} className="w-48" />
                  <p className="text-sm text-gray-600">
                    {message || "Processing avatar animation..."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {videoUrl && !isGenerating && (
            <div className="relative group">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full rounded-lg bg-black"
                poster="/api/placeholder/640/360"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleFullscreen}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Expand className="w-4 h-4" />
              </Button>
            </div>
          )}

          {videoUrl && !isGenerating && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                Your avatar video is ready! You can download it or regenerate with different settings.
              </p>
              {message && status === 'completed' && (
                <p className="text-xs text-blue-700 mt-2">
                  {message}
                </p>
              )}
            </div>
          )}

          {!isEnabled && (
            <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              Confirm the audio narration to unlock video rendering.
            </div>
          )}

          {status === 'failed' && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Video generation failed. Adjust your audio or try again.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
