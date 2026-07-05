// Voice engine + model manager panel (PLAN §12.3).
//
// Lets the user pick between the built-in synthetic engine and the Kokoro
// neural TTS, and manages Kokoro model files: explicit download with progress
// (never silent), custom mirror URLs, air-gapped import from a local folder
// (desktop only), status/size on disk, and deletion.

import { useCallback, useEffect, useState } from 'react'
import { useStudio } from '../store'
import { isTauri } from '../lib/tauri'
import { DTYPE_INFO } from '../lib/models/modelSource'
import {
  deleteModel,
  downloadModel,
  getModelStatus,
  importModelFolder,
  type ModelStatus,
} from '../lib/models/modelManager'
import type { ModelSource } from '../lib/types'

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

type Busy =
  | { kind: 'idle' }
  | { kind: 'download'; file: string; pct: number }
  | { kind: 'delete' }
  | { kind: 'import' }

export function EnginePanel() {
  const settings = useStudio((s) => s.settings)
  const updateSettings = useStudio((s) => s.updateSettings)
  const modelSource = useStudio((s) => s.modelSource)
  const updateModelSource = useStudio((s) => s.updateModelSource)
  const isGenerating = useStudio((s) => s.isGenerating)

  const [status, setStatus] = useState<ModelStatus | null>(null)
  const [busy, setBusy] = useState<Busy>({ kind: 'idle' })
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async (source: ModelSource) => {
    try {
      setStatus(await getModelStatus(source))
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    void refresh(modelSource)
  }, [modelSource, refresh])

  const kokoroActive = settings.engineId === 'kokoro'

  const onDownload = async () => {
    setMessage(null)
    setBusy({ kind: 'download', file: '', pct: 0 })
    try {
      await downloadModel(modelSource, (p) => {
        const pct = p.total > 0 ? Math.round((p.loaded / p.total) * 100) : 0
        setBusy({ kind: 'download', file: p.file, pct })
      })
      setMessage('Model downloaded and ready.')
    } catch (err) {
      setMessage(
        `Download failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy({ kind: 'idle' })
      void refresh(modelSource)
    }
  }

  const onDelete = async () => {
    setMessage(null)
    setBusy({ kind: 'delete' })
    try {
      await deleteModel(modelSource)
      setMessage('Model files removed.')
    } catch (err) {
      setMessage(
        `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy({ kind: 'idle' })
      void refresh(modelSource)
    }
  }

  const onImport = async () => {
    setMessage(null)
    setBusy({ kind: 'import' })
    try {
      const imported = await importModelFolder(modelSource)
      setMessage(
        imported.length > 0
          ? `Imported ${imported.length} file(s): ${imported.join(', ')}`
          : 'No recognizable model files found in that folder.',
      )
    } catch (err) {
      setMessage(
        `Import failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy({ kind: 'idle' })
      void refresh(modelSource)
    }
  }

  const busyNow = busy.kind !== 'idle'

  return (
    <section className="panel" aria-label="Voice engine">
      <header className="panel-head">
        <h2>0 · Voice engine</h2>
        {kokoroActive && status && (
          <span className={`badge ${status.ready ? 'ok-badge' : 'warn-badge'}`}>
            {status.ready ? 'model ready' : 'model not installed'}
          </span>
        )}
      </header>

      <div className="engine-picker">
        <label className={`engine-option ${!kokoroActive ? 'active' : ''}`}>
          <input
            type="radio"
            name="engine"
            checked={!kokoroActive}
            disabled={isGenerating}
            onChange={() => updateSettings({ engineId: 'synthetic' })}
          />
          <div>
            <strong>Synthetic demo voice</strong>
            <p>Instant, zero setup. A reproducible DSP placeholder — not real speech.</p>
          </div>
        </label>
        <label className={`engine-option ${kokoroActive ? 'active' : ''}`}>
          <input
            type="radio"
            name="engine"
            checked={kokoroActive}
            disabled={isGenerating}
            onChange={() => updateSettings({ engineId: 'kokoro' })}
          />
          <div>
            <strong>Kokoro-82M neural TTS</strong>
            <p>
              Real narration, runs 100% locally on CPU. Apache-2.0 model,
              one-time download.
            </p>
          </div>
        </label>
      </div>

      {kokoroActive && (
        <div className="model-manager">
          <label className="field wide">
            <span>Model repo id</span>
            <input
              type="text"
              value={modelSource.repoId}
              disabled={busyNow || isGenerating}
              onChange={(e) => updateModelSource({ repoId: e.target.value })}
            />
          </label>

          <label className="field wide">
            <span>Quality / size</span>
            <select
              value={modelSource.dtype}
              disabled={busyNow || isGenerating}
              onChange={(e) =>
                updateModelSource({ dtype: e.target.value as ModelSource['dtype'] })
              }
            >
              {DTYPE_INFO.map((d) => (
                <option key={d.dtype} value={d.dtype}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field wide">
            <span>Download from</span>
            <select
              value={modelSource.host}
              disabled={busyNow || isGenerating}
              onChange={(e) =>
                updateModelSource({ host: e.target.value as ModelSource['host'] })
              }
            >
              <option value="huggingface">Hugging Face (official)</option>
              <option value="custom">Custom mirror / self-hosted URL</option>
            </select>
          </label>

          {modelSource.host === 'custom' && (
            <label className="field wide">
              <span>Mirror base URL</span>
              <input
                type="text"
                placeholder="https://hf-mirror.com/"
                value={modelSource.customBaseUrl}
                disabled={busyNow || isGenerating}
                onChange={(e) =>
                  updateModelSource({ customBaseUrl: e.target.value })
                }
              />
            </label>
          )}

          {status && (
            <ul className="model-files">
              {status.files.map((f) => (
                <li key={f.file} className={f.present ? 'ok' : 'missing'}>
                  <span>{f.present ? '✓' : '·'}</span>
                  <code>{f.file}</code>
                  {f.bytes !== null && <em>{formatBytes(f.bytes)}</em>}
                </li>
              ))}
              <li className="model-location">
                <span>{status.totalBytes > 0 ? formatBytes(status.totalBytes) : ''}</span>
                <em>stored in {status.location}</em>
              </li>
            </ul>
          )}

          {busy.kind === 'download' && (
            <div className="model-progress">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${busy.pct}%` }} />
              </div>
              <span>
                {busy.file ? `${busy.file} — ${busy.pct}%` : 'starting download…'}
              </span>
            </div>
          )}

          <div className="model-actions">
            <button
              className="primary"
              onClick={() => void onDownload()}
              disabled={busyNow || isGenerating}
            >
              {status?.ready ? '⟳ Re-download model' : '⬇ Download model'}
            </button>
            {isTauri() && (
              <button
                className="ghost"
                onClick={() => void onImport()}
                disabled={busyNow || isGenerating}
                title="Point gnarvox at model files you downloaded elsewhere (offline import)"
              >
                Import from folder…
              </button>
            )}
            <button
              className="ghost danger"
              onClick={() => void onDelete()}
              disabled={busyNow || isGenerating || !status?.files.some((f) => f.present)}
            >
              Delete files
            </button>
          </div>

          {message && <p className="model-message">{message}</p>}

          <p className="hint">
            Kokoro-82M is an open Apache-2.0 TTS model. Files download once from
            the source above (or import them from a folder for air-gapped
            machines) and everything runs locally afterwards — no keys, no
            telemetry.
          </p>
        </div>
      )}
    </section>
  )
}
