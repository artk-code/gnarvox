import { useEffect } from 'react'
import { useStudio } from './store'
import { SettingsBar } from './components/SettingsBar'
import { EnginePanel } from './components/EnginePanel'
import { ScriptPanel } from './components/ScriptPanel'
import { NormalizationPanel } from './components/NormalizationPanel'
import { ChunksPanel } from './components/ChunksPanel'
import { AuditionPanel } from './components/AuditionPanel'
import { ExportPanel } from './components/ExportPanel'

export default function App() {
  const generateAll = useStudio((s) => s.generateAll)
  const cancelGeneration = useStudio((s) => s.cancelGeneration)
  const clearError = useStudio((s) => s.clearError)
  const reset = useStudio((s) => s.reset)
  const isGenerating = useStudio((s) => s.isGenerating)
  const isLoadingEngine = useStudio((s) => s.isLoadingEngine)
  const generationError = useStudio((s) => s.generationError)
  const progress = useStudio((s) => s.progress)

  // Last-resort safety net: any unhandled async failure (engine, model I/O,
  // wasm) surfaces as a dismissible error and unlocks the UI instead of
  // leaving it stuck.
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault()
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason)
      useStudio.setState({
        generationError: `Unexpected error: ${reason}`,
        isGenerating: false,
        isLoadingEngine: false,
      })
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])

  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>
            gnarvox <span className="studio">Studio</span>
          </h1>
          <p className="tagline">
            Local lesson-narration workflow · script → normalize → chunk →
            generate → audition → export
          </p>
        </div>
        <div className="header-badges">
          <span className="pill">100% local</span>
          <span className="pill">no API keys</span>
          <span className="pill">reproducible</span>
        </div>
      </header>

      <div className="toolbar">
        <SettingsBar />
        <div className="toolbar-actions">
          <button
            className="generate"
            onClick={() => void generateAll()}
            disabled={isGenerating}
          >
            {isLoadingEngine
              ? 'Loading model…'
              : isGenerating
                ? `Generating ${pct}%`
                : '⚡ Generate lesson'}
          </button>
          {isGenerating ? (
            <button className="ghost" onClick={cancelGeneration}>
              Cancel
            </button>
          ) : (
            <button className="ghost" onClick={reset}>
              Reset
            </button>
          )}
        </div>
      </div>

      {isGenerating && (
        <div className="progress-track" aria-label="Generation progress">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {generationError && (
        <div className="error-banner" role="alert">
          <span className="error-text">⚠ {generationError}</span>
          <span className="error-actions">
            <button className="mini ghost" onClick={clearError}>
              Dismiss
            </button>
            <button
              className="mini ghost"
              onClick={() => window.location.reload()}
              title="Reload the interface if it ever becomes unresponsive; your settings are preserved"
            >
              ⟳ Restart UI
            </button>
          </span>
        </div>
      )}

      <main className="workspace">
        <div className="col col-input">
          <EnginePanel />
          <ScriptPanel />
          <NormalizationPanel />
        </div>
        <div className="col col-queue">
          <ChunksPanel />
        </div>
        <div className="col col-output">
          <AuditionPanel />
          <ExportPanel />
        </div>
      </main>

      <footer className="app-footer">
        <span>
          gnarvox Studio — local lesson narration. Synthetic engine for instant
          demos; Kokoro-82M for real speech, all on your machine. No human voice
          is cloned.
        </span>
      </footer>
    </div>
  )
}
