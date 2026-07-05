// Small display formatters shared by the UI.

import { linearToDb } from './audio'

/** Seconds -> "m:ss" (or "h:mm:ss" for long lessons). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`
  return `${m}:${ss}`
}

/** Linear amplitude -> "-19.2 dB" style label. */
export function formatDb(linear: number): string {
  const db = linearToDb(linear)
  if (!Number.isFinite(db)) return '-∞ dB'
  return `${db.toFixed(1)} dB`
}
