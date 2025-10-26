"use client"

import { useActorRef, useSelector } from '@xstate/react'
import { pipelineMachine } from './pipeline.machine'
import { useEffect } from 'react'
import { saveToIndexedDB, loadFromIndexedDB } from '@/lib/db/operations'

export function usePipeline() {
  const service = useActorRef(pipelineMachine, {
    inspect: process.env.NODE_ENV === 'development' ? console.log : undefined,
  })

  // Persist state changes
  useEffect(() => {
    const subscription = service.subscribe((state) => {
      saveToIndexedDB('pipelineState', {
        value: state.value,
        context: state.context,
      })
    })

    // Load saved state on mount
    loadFromIndexedDB('pipelineState').then((saved) => {
      if (saved) {
        // TODO: Implement state restoration
        // service.send({ type: 'RESTORE_STATE', state: saved })
      }
    })

    return () => subscription.unsubscribe()
  }, [service])

  return service
}

export function usePipelineState(service: ReturnType<typeof useActorRef<typeof pipelineMachine>>) {
  const state = useSelector(service, (state) => state.value)
  const context = useSelector(service, (state) => state.context)
  const isStale = useSelector(service, (state) => state.context.staleFlags)

  const isAudioEnabled = !!context.script && context.scriptConfirmed
  const isAudioConfirmed = !!context.audioUrl && context.audioConfirmed
  const canGenerateAudio =
    ['scriptReady', 'audioReady', 'videoReady'].includes(state as string) &&
    isAudioEnabled &&
    !!context.voicePreset
  const isVideoEnabled = !!context.audioUrl && !!context.audioPath && context.audioConfirmed
  const canGenerateVideo =
    ['audioReady', 'videoReady'].includes(state as string) &&
    isVideoEnabled &&
    !context.staleFlags.video
  const isProcessing = ['scriptGeneration', 'audioGenerating', 'videoGenerating'].includes(state as string)

  return {
    state,
    context,
    isStale,
    isAudioEnabled,
    isAudioConfirmed,
    isVideoEnabled,
    canGenerateAudio,
    canGenerateVideo,
    isProcessing,
    audioPath: context.audioPath,
    send: service.send,
  }
}
