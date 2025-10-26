import { NextRequest } from "next/server"
import { jobStore } from "@/lib/api/jobStore"

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params
  const encoder = new TextEncoder()

  // Check if job exists
  const job = jobStore.getJob(jobId)
  if (!job) {
    return new Response('Job not found', { status: 404 })
  }

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      // Send initial connection event with current job status
      sendEvent('connected', {
        jobId,
        currentStatus: job.status,
        progress: job.progress,
        timestamp: Date.now()
      })

      // If job is already completed, send the result and close
      if (job.status === 'completed' || job.status === 'failed') {
        sendEvent('status', {
          jobId,
          state: job.status,
          progress: job.progress,
          message: job.status === 'completed' ? 'Job completed!' : 'Job failed',
          result: job.result,
          error: job.error,
          timestamp: Date.now(),
        })

        sendEvent('completed', {
          jobId,
          result: job.result,
          error: job.error,
          timestamp: Date.now(),
        })

        controller.close()
        return
      }

      // Subscribe to job updates
      const unsubscribe = jobStore.subscribe(jobId, (updatedJob) => {
        // Send status update
        sendEvent('status', {
          jobId,
          state: updatedJob.status,
          progress: updatedJob.progress,
          message: getProgressMessage(updatedJob.status, updatedJob.progress, updatedJob.type),
          timestamp: Date.now(),
        })

        // If job is complete, send completion event and close stream
        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
          sendEvent('completed', {
            jobId,
            result: updatedJob.result,
            error: updatedJob.error,
            timestamp: Date.now(),
          })

          // Clean up and close the stream
          unsubscribe()
          controller.close()
        }
      })

      // Handle client disconnect
      req.signal.addEventListener('abort', () => {
        unsubscribe()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

function getProgressMessage(status: string, progress: number, type: string): string {
  if (status === 'queued') {
    return 'Job queued for processing...'
  }

  if (status === 'processing') {
    const typeMessages = {
      script: [
        'Analyzing your idea...',
        'Generating script structure...',
        'Crafting the narrative...',
        'Refining the script...',
        'Finalizing the content...'
      ],
      audio: [
        'Preparing text for synthesis...',
        'Initializing voice model...',
        'Generating speech...',
        'Processing audio...',
        'Finalizing audio file...'
      ],
      video: [
        'Loading avatar model...',
        'Processing audio input...',
        'Generating lip sync...',
        'Rendering animation...',
        'Finalizing video...'
      ]
    }

    const messages = typeMessages[type as keyof typeof typeMessages] || ['Processing...']
    const index = Math.min(Math.floor((progress / 100) * messages.length), messages.length - 1)
    return messages[index]
  }

  if (status === 'completed') {
    return 'Job completed successfully!'
  }

  if (status === 'failed') {
    return 'Job failed. Please try again.'
  }

  return 'Processing...'
}