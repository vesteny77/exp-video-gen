import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Volume2, RefreshCw, Download, Play, Pause } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import type { VoicePreset } from "@/types/pipeline"

interface AudioCardProps {
  audioUrl: string | null
  voicePreset: VoicePreset | null
  isStale: boolean
  isGenerating: boolean
  isEnabled: boolean
  isConfirmed: boolean
  canGenerate: boolean
  onPresetChange: (preset: VoicePreset) => void
  onGenerate: () => void
  onConfirm: () => void
}

const voicePresets: { value: VoicePreset; label: string; description: string }[] = [
  { value: 'belinda', label: 'Belinda', description: 'Warm and reassuring female voice' },
  { value: 'broom_salesman', label: 'Broom Salesman', description: 'Enthusiastic male presenter' },
  { value: 'chadwick', label: 'Chadwick', description: 'Professional male narrator' },
  { value: 'en_man', label: 'English Man', description: 'Standard male voice' },
  { value: 'en_woman', label: 'English Woman', description: 'Standard female voice' },
  { value: 'mabel', label: 'Mabel', description: 'Friendly female voice' },
  { value: 'vex', label: 'Vex', description: 'Energetic character voice' },
  { value: 'zh_man_sichuan', label: 'Sichuan Man', description: 'Chinese male accent' },
]

export function AudioCard({
  audioUrl,
  voicePreset,
  isStale,
  isGenerating,
  isEnabled,
  isConfirmed,
  canGenerate,
  onPresetChange,
  onGenerate,
  onConfirm,
}: AudioCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100)
        setDuration(audio.duration)
      }
    }

    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration))

    return () => {
      audio.removeEventListener('timeupdate', updateProgress)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('loadedmetadata', () => {})
    }
  }, [audioUrl])

  const togglePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <Volume2 className="w-5 h-5 text-gray-600" />
          <CardTitle>Audio</CardTitle>
          {isStale && <Badge variant="warning">Stale</Badge>}
          {isConfirmed && !isStale && <Badge variant="success">Confirmed</Badge>}
          {isGenerating && <Badge variant="info">Generating...</Badge>}
        </div>
        {audioUrl && !isGenerating && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerate}
              disabled={!canGenerate}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href={audioUrl} download="generated-audio.wav">
                <Download className="w-4 h-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Voice Preset Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Voice Preset</label>
            <Select
              value={voicePreset || undefined}
              onValueChange={(value) => onPresetChange(value as VoicePreset)}
              disabled={isGenerating || !isEnabled}
            >
              <SelectTrigger>
                <SelectValue placeholder={isEnabled ? "Select a voice preset" : "Confirm the script first"} />
              </SelectTrigger>
              <SelectContent>
                {voicePresets.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    <div>
                      <div className="font-medium">{preset.label}</div>
                      <div className="text-xs text-gray-500">{preset.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isEnabled && (
              <p className="text-xs text-gray-500">
                Confirm the script to enable audio options.
              </p>
            )}
          </div>

          {/* Generate Button or Player */}
          {!audioUrl && !isGenerating && (
            <Button
              onClick={onGenerate}
              disabled={!canGenerate}
              className="w-full bg-blue-500 hover:bg-blue-600"
            >
              <Volume2 className="w-4 h-4 mr-2" />
              Confirm Audio Generation
            </Button>
          )}

          {isGenerating && (
            <div className="space-y-3">
              <Progress value={33} className="h-2" />
              <p className="text-sm text-gray-500 text-center">Generating audio with {voicePreset}...</p>
            </div>
          )}

          {audioUrl && !isGenerating && (
            <div className="space-y-3">
              <audio ref={audioRef} src={audioUrl} />
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={togglePlayPause}
                    className="w-12 h-12 p-0"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </Button>
                  <span className="text-sm text-gray-600">
                    {formatTime(audioRef.current?.currentTime || 0)} / {formatTime(duration)}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          )}

          {audioUrl && !isGenerating && (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-sm text-gray-600">
                {isConfirmed
                  ? "Audio locked in. You're ready to generate the avatar video."
                  : "Happy with this narration? Confirm so we can move on to the video."}
              </div>
              <Button
                size="sm"
                variant={isConfirmed ? "outline" : "default"}
                onClick={onConfirm}
                disabled={isConfirmed}
              >
                {isConfirmed ? "Confirmed" : "Confirm"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
