import { Check, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface PipelineTimelineProps {
  currentStep: string
}

const steps = [
  { id: 'ideaInput', label: 'Idea', states: ['ideaInput'] },
  { id: 'scriptReady', label: 'Script', states: ['scriptGeneration', 'scriptReady'] },
  { id: 'audioReady', label: 'Audio', states: ['audioGenerating', 'audioReady'] },
  { id: 'videoReady', label: 'Video', states: ['videoGenerating', 'videoReady'] },
]

export function PipelineTimeline({ currentStep }: PipelineTimelineProps) {
  const getStepStatus = (step: typeof steps[0]) => {
    if (step.states.includes(currentStep)) {
      if (currentStep.includes('Generating')) return 'processing'
      return 'active'
    }

    const currentIndex = steps.findIndex(s => s.states.includes(currentStep))
    const stepIndex = steps.findIndex(s => s.id === step.id)

    if (currentIndex > stepIndex) return 'complete'
    return 'idle'
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(step)

          return (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                  status === 'idle' && "bg-gray-100 text-gray-400",
                  status === 'active' && "bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-2",
                  status === 'processing' && "bg-blue-100 text-blue-700 animate-pulse",
                  status === 'complete' && "bg-green-100 text-green-700"
                )}
              >
                {status === 'complete' ? (
                  <Check className="w-5 h-5" />
                ) : status === 'processing' ? (
                  <div className="flex space-x-1">
                    <span className="loading-dot"></span>
                    <span className="loading-dot"></span>
                    <span className="loading-dot"></span>
                  </div>
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "ml-3 text-sm font-medium",
                  status === 'idle' && "text-gray-400",
                  status === 'active' && "text-blue-700",
                  status === 'processing' && "text-blue-700",
                  status === 'complete' && "text-green-700"
                )}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <ChevronRight className="mx-4 w-5 h-5 text-gray-300" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}