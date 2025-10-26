import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Sparkles, Edit3 } from "lucide-react"
import { useEffect, useState } from "react"

interface ScriptCardProps {
  script: string
  idea: string
  isStale: boolean
  isGenerating: boolean
  isConfirmed: boolean
  onConfirm: () => void
  onScriptChange: (script: string) => void
  onGenerate: () => void
}

export function ScriptCard({
  script,
  idea,
  isStale,
  isGenerating,
  isConfirmed,
  onConfirm,
  onScriptChange,
  onGenerate,
}: ScriptCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedScript, setEditedScript] = useState(script)

  useEffect(() => {
    setEditedScript(script)
    setIsEditing(false)
  }, [script])

  const handleSave = () => {
    onScriptChange(editedScript)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedScript(script)
    setIsEditing(false)
  }

  const wordCount = script ? script.split(/\s+/).filter(Boolean).length : 0

  const showConfirmButton = script.trim().length > 0 && !isGenerating

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <FileText className="w-5 h-5 text-gray-600" />
          <CardTitle>Script</CardTitle>
          {isStale && <Badge variant="warning">Stale</Badge>}
          {isConfirmed && !isStale && <Badge variant="success">Confirmed</Badge>}
          {isGenerating && <Badge variant="info">Generating...</Badge>}
        </div>
        <div className="flex items-center space-x-2">
          {wordCount > 0 && (
            <span className="text-sm text-gray-500">{wordCount} words</span>
          )}
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={isGenerating}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
              >
                Save
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!script && !isGenerating && idea && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Your idea:</strong> {idea}
              </p>
            </div>
            <Button
              onClick={onGenerate}
              className="w-full bg-blue-500 hover:bg-blue-600"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Script
            </Button>
          </div>
        )}

        {isGenerating && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-3">
              <div className="flex space-x-1 justify-center">
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
              </div>
              <p className="text-sm text-gray-500">Generating script...</p>
            </div>
          </div>
        )}

        {script && !isGenerating && (
          <div className="space-y-4">
            {isEditing ? (
              <Textarea
                value={editedScript}
                onChange={(e) => setEditedScript(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder="Enter your script here..."
              />
            ) : (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans bg-gray-50 p-4 rounded-lg">
                  {script}
                </pre>
              </div>
            )}

            {showConfirmButton && (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-600">
                  {isConfirmed
                    ? "Script confirmed. You can proceed to audio."
                    : "Happy with this script? Confirm to move on to narration."}
                </div>
                <Button
                  size="sm"
                  onClick={onConfirm}
                  variant={isConfirmed ? "outline" : "default"}
                  disabled={isConfirmed}
                >
                  {isConfirmed ? "Confirmed" : "Confirm"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
