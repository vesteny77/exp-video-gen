import { Button } from "@/components/ui/button"
import { Sparkles, RotateCcw } from "lucide-react"

interface AppHeaderProps {
  onReset: () => void
}

export function AppHeader({ onReset }: AppHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Avatar Video Generator</h1>
            <p className="text-xs text-gray-500">AI-powered video creation</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="text-gray-600"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>
    </header>
  )
}