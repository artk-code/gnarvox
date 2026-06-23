import { useState } from 'react'
import { useStudio } from '../store'
import { playPcm, stopPreview } from '../lib/preview'
import { isSpeechAvailable, speak } from '../lib/speech'
import { formatDuration } from '../lib/format'
import type { ChunkStatus } from '../lib/types'

const STATUS_LABEL: Record<ChunkStatus, string> = {
  pending: 'pending',
  generating: 'generating…',
  succeeded: 'ready',
  failed_retryable: 'retry',
}

export function ChunksPanel() {
  const sections = useStudio((s) => s.sections)
  const status = useStudio((s) => s.status)
  const takes = useStudio((s) => s.takes)
  const settings = useStudio((s) => s.settings)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const speechOn = isSpeechAvailable()

  if (sections.length === 0) {
    return (
      <section className="panel" aria-label="Sections and chunks">
        <header className="panel-head">
          <h2>3 · Chunks &amp; queue</h2>
        </header>
        <p className="empty">Analyze a script to build the chunk queue.</p>
      </section>
    )
  }

  const playTake = (chunkId: string) => {
    const take = takes[chunkId]
    if (!take) return
    if (playingId === chunkId) {
      stopPreview()
      setPlayingId(null)
      return
    }
    setPlayingId(chunkId)
    playPcm(take.samples, take.sampleRate, () => setPlayingId(null))
  }

  return (
    <section className="panel" aria-label="Sections and chunks">
      <header className="panel-head">
        <h2>3 · Chunks &amp; queue</h2>
        {speechOn && <span className="badge subtle">live voice ✓</span>}
      </header>
      <div className="sections">
        {sections.map((section) => (
          <div className="section-group" key={section.id}>
            <h3>{section.title || 'Untitled section'}</h3>
            <ul className="chunk-list">
              {section.chunks.map((chunk) => {
                const st = status[chunk.id] ?? 'pending'
                const take = takes[chunk.id]
                return (
                  <li className={`chunk-row status-${st}`} key={chunk.id}>
                    <div className="chunk-main">
                      <span className={`status-dot ${st}`} />
                      <p className="chunk-text">{chunk.text}</p>
                    </div>
                    <div className="chunk-meta">
                      <span className="chunk-status">{STATUS_LABEL[st]}</span>
                      <span className="chunk-chars">{chunk.charCount}c</span>
                      {take && (
                        <span className="chunk-dur">
                          {formatDuration(take.durationSec)}
                        </span>
                      )}
                      {take?.warnings.map((w) => (
                        <span className="warn" key={w}>
                          ⚠ {w}
                        </span>
                      ))}
                      {take && (
                        <button
                          className="mini"
                          onClick={() => playTake(chunk.id)}
                        >
                          {playingId === chunk.id ? '■ stop' : '▶ take'}
                        </button>
                      )}
                      {speechOn && (
                        <button
                          className="mini ghost"
                          onClick={() =>
                            speak(chunk.text, { rate: settings.pace })
                          }
                          title="Speak with the browser's system voice"
                        >
                          🔊 voice
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
