// Web Audio playback of a raw Float32 PCM buffer, with a playhead.
//
// Builds an AudioBuffer from the stitched samples and plays it through an
// AudioBufferSourceNode (each play creates a fresh one-shot source). Tracks the
// playhead with requestAnimationFrame and supports play / pause / stop / seek.

import { useCallback, useEffect, useRef, useState } from 'react'

interface PlayerApi {
  isPlaying: boolean
  currentTime: number
  duration: number
  play: () => void
  pause: () => void
  stop: () => void
  seek: (time: number) => void
}

export function useAudioPlayer(
  samples: Float32Array | null,
  sampleRate: number,
): PlayerApi {
  const ctxRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const startedAtRef = useRef(0)
  const offsetRef = useRef(0)
  const rafRef = useRef(0)
  const playingRef = useRef(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  const duration = samples ? samples.length / sampleRate : 0

  const ensureCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      ctxRef.current = new Ctor()
    }
    return ctxRef.current
  }, [])

  const stopSource = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.onended = null
      try {
        sourceRef.current.stop()
      } catch {
        // already stopped
      }
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    cancelAnimationFrame(rafRef.current)
    playingRef.current = false
  }, [])

  // Rebuild the AudioBuffer whenever the source samples change.
  useEffect(() => {
    stopSource()
    offsetRef.current = 0
    setCurrentTime(0)
    setIsPlaying(false)
    if (!samples || samples.length === 0) {
      bufferRef.current = null
      return
    }
    const ctx = ensureCtx()
    const buffer = ctx.createBuffer(1, samples.length, sampleRate)
    // Copy into a fresh ArrayBuffer-backed view (avoids SharedArrayBuffer typing).
    buffer.copyToChannel(new Float32Array(samples), 0)
    bufferRef.current = buffer
  }, [samples, sampleRate, ensureCtx, stopSource])

  // Stop everything on unmount.
  useEffect(() => () => stopSource(), [stopSource])

  const tick = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx || !playingRef.current) return
    const elapsed = ctx.currentTime - startedAtRef.current
    const t = offsetRef.current + elapsed
    if (t >= duration) {
      stopSource()
      offsetRef.current = 0
      setCurrentTime(duration)
      setIsPlaying(false)
      return
    }
    setCurrentTime(t)
    rafRef.current = requestAnimationFrame(tick)
  }, [duration, stopSource])

  const playFrom = useCallback(
    (offset: number) => {
      const buffer = bufferRef.current
      if (!buffer) return
      const ctx = ensureCtx()
      void ctx.resume()
      stopSource()

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.onended = () => {
        if (playingRef.current) {
          stopSource()
          offsetRef.current = 0
          setCurrentTime(0)
          setIsPlaying(false)
        }
      }
      const clamped = Math.max(0, Math.min(offset, Math.max(0, duration - 0.01)))
      source.start(0, clamped)
      sourceRef.current = source
      startedAtRef.current = ctx.currentTime
      offsetRef.current = clamped
      playingRef.current = true
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    },
    [duration, ensureCtx, stopSource, tick],
  )

  const play = useCallback(() => {
    const from = currentTime >= duration - 0.01 ? 0 : currentTime
    playFrom(from)
  }, [currentTime, duration, playFrom])

  const pause = useCallback(() => {
    const ctx = ctxRef.current
    if (ctx && playingRef.current) {
      offsetRef.current += ctx.currentTime - startedAtRef.current
    }
    stopSource()
    setIsPlaying(false)
  }, [stopSource])

  const stop = useCallback(() => {
    stopSource()
    offsetRef.current = 0
    setCurrentTime(0)
    setIsPlaying(false)
  }, [stopSource])

  const seek = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(time, duration))
      if (playingRef.current) {
        playFrom(clamped)
      } else {
        offsetRef.current = clamped
        setCurrentTime(clamped)
      }
    },
    [duration, playFrom],
  )

  return { isPlaying, currentTime, duration, play, pause, stop, seek }
}
