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
  const reset = useStudio((s) => s.reset)
  const isGenerating = useStudio((s) => s.isGenerating)
  const isLoadingEngine = useStudio((s) => s.isLoadingEngine)
  const generationError = useStudio((s) => s.generationError)
  const progress = useStudio((s) => s.progress)

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
          <button className="ghost" onClick={reset} disabled={isGenerating}>
            Reset
          </button>
        </div>
      </div>

      {isGenerating && (
        <div className="progress-track" aria-label="Generation progress">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {generationError && (
        <div className="error-banner" role="alert">
          ⚠ {generationError}
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
