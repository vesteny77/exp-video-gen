"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Sparkles, Send } from "lucide-react"

export default function LandingPage() {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    setIsLoading(true)
    const isScript = input.length > 200 || input.includes('\n\n')

    // Store the initial input in session storage
    sessionStorage.setItem('initialInput', input)

    try {
      const response = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'modify_script',
          parameters: {
            mode: isScript ? 'refine_existing' : 'idea_to_script',
            idea: isScript ? null : input,
            script: isScript ? input : null,
          },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        sessionStorage.setItem('initialScriptResult', JSON.stringify(data.result))
      } else {
        console.error('Pre-generation failed', await response.text())
      }
    } catch (error) {
      console.error('Failed to pre-generate script', error)
    } finally {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 mb-4">
            <Sparkles className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-semibold text-gray-900">
            Tell me your video ideas
          </h1>
          <p className="text-lg text-gray-600 max-w-md mx-auto">
            Create engaging avatar videos with AI-powered scripts and natural voices
          </p>
        </div>

        {/* Input Card */}
        <Card className="p-6 shadow-lg border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your video idea or paste your script here..."
              className="min-h-[150px] resize-none text-base border-gray-200 focus:border-blue-400"
              disabled={isLoading}
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                You can describe an idea or paste a complete script
              </p>
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                {isLoading ? (
                  <>
                    <span className="loading-dot"></span>
                    <span className="loading-dot"></span>
                    <span className="loading-dot"></span>
                  </>
                ) : (
                  <>
                    Get Started
                    <Send className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        {/* Examples */}
        <div className="space-y-3">
          <p className="text-sm text-gray-500 text-center">Try an example:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              "Create a tutorial about mindfulness meditation",
              "Explain the benefits of renewable energy",
              "Welcome message for a YouTube channel",
            ].map((example, i) => (
              <button
                key={i}
                onClick={() => setInput(example)}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
