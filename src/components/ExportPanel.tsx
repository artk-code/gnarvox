import { useState } from 'react'
import { useStudio } from '../store'
import { encodeWav, linearToDb } from '../lib/audio'
import { buildManifest } from '../lib/manifest'
import { formatDb, formatDuration } from '../lib/format'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ACX-style targets (PLAN §7.10): RMS -23..-18 dB, peak <= -3 dB.
function rmsOk(linear: number): boolean {
  const db = linearToDb(linear)
  return db >= -23 && db <= -18
}
function peakOk(linear: number): boolean {
  return linearToDb(linear) <= -3
}

export function ExportPanel() {
  const stitched = useStudio((s) => s.stitched)
  const sections = useStudio((s) => s.sections)
  const takes = useStudio((s) => s.takes)
  const settings = useStudio((s) => s.settings)
  const [busy, setBusy] = useState(false)

  if (!stitched) {
    return (
      <section className="panel" aria-label="Export">
        <header className="panel-head">
          <h2>5 · Export</h2>
        </header>
        <p className="empty">Generate the lesson to enable WAV + manifest export.</p>
      </section>
    )
  }

  const exportWav = () => {
    const buffer = encodeWav(stitched.samples, stitched.sampleRate)
    download(new Blob([buffer], { type: 'audio/wav' }), 'gnarvox-lesson.wav')
  }

  const exportManifest = async () => {
    setBusy(true)
    try {
      const wav = new Uint8Array(encodeWav(stitched.samples, stitched.sampleRate))
      const manifest = await buildManifest({
        createdAt: new Date().toISOString(),
        settings,
        sections,
        takes,
        wavBytes: wav,
        durationSec: stitched.durationSec,
        rms: stitched.rms,
        peak: stitched.peak,
      })
      download(
        new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }),
        'gnarvox-lesson.manifest.json',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel" aria-label="Export">
      <header className="panel-head">
        <h2>5 · Export</h2>
        <span className="badge subtle">{formatDuration(stitched.durationSec)}</span>
      </header>

      <ul className="metrics">
        <li>
          <span>Duration</span>
          <strong>{formatDuration(stitched.durationSec)}</strong>
        </li>
        <li className={rmsOk(stitched.rms) ? 'ok' : 'warn-metric'}>
          <span>RMS {rmsOk(stitched.rms) ? '✓' : '⚠'}</span>
          <strong>{formatDb(stitched.rms)}</strong>
        </li>
        <li className={peakOk(stitched.peak) ? 'ok' : 'warn-metric'}>
          <span>Peak {peakOk(stitched.peak) ? '✓' : '⚠'}</span>
          <strong>{formatDb(stitched.peak)}</strong>
        </li>
      </ul>
      <p className="hint">
        ACX-style targets: RMS −23…−18 dB, peak ≤ −3 dB. Checks shown above.
      </p>

      <div className="export-actions">
        <button className="primary" onClick={exportWav}>
          ⬇ Download WAV
        </button>
        <button className="ghost" onClick={exportManifest} disabled={busy}>
          {busy ? 'Building…' : '⬇ Download manifest.json'}
        </button>
      </div>
    </section>
  )
}
