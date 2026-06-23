import { useEffect, useRef } from 'react'
import { useStudio } from '../store'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { formatDuration } from '../lib/format'

export function AuditionPanel() {
  const stitched = useStudio((s) => s.stitched)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const { isPlaying, currentTime, duration, play, pause, stop, seek } =
    useAudioPlayer(stitched?.samples ?? null, stitched?.sampleRate ?? 24000)

  // Draw the waveform whenever the peaks change.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    if (!stitched) return
    const peaks = stitched.peaks
    const mid = height / 2
    ctx.fillStyle = '#3ddc97'
    const barW = width / peaks.length
    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(1, peaks[i] * (height * 0.92))
      ctx.fillRect(i * barW, mid - h / 2, Math.max(0.6, barW * 0.8), h)
    }
  }, [stitched])

  const progress = duration > 0 ? currentTime / duration : 0

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    seek(ratio * duration)
  }

  return (
    <section className="panel audition" aria-label="Audition">
      <header className="panel-head">
        <h2>4 · Audition</h2>
        {stitched && (
          <span className="badge subtle">
            {formatDuration(stitched.durationSec)}
          </span>
        )}
      </header>

      {!stitched ? (
        <p className="empty">Generate the lesson to render the stitched waveform.</p>
      ) : (
        <>
          <div className="waveform-wrap" onClick={onSeek} role="presentation">
            <canvas ref={canvasRef} className="waveform" />
            <div
              className="playhead"
              style={{ left: `${progress * 100}%` }}
            />
          </div>
          <div className="transport">
            <button className="primary" onClick={isPlaying ? pause : play}>
              {isPlaying ? '❚❚ Pause' : '▶ Play'}
            </button>
            <button className="ghost" onClick={stop}>
              ■ Stop
            </button>
            <span className="time">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>
        </>
      )}
    </section>
  )
}
