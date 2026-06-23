import { useStudio } from '../store'

export function ScriptPanel() {
  const scriptText = useStudio((s) => s.scriptText)
  const setScriptText = useStudio((s) => s.setScriptText)
  const analyze = useStudio((s) => s.analyze)
  const loadSample = useStudio((s) => s.loadSample)
  const isGenerating = useStudio((s) => s.isGenerating)
  const sections = useStudio((s) => s.sections)

  const chunkCount = sections.reduce((n, s) => n + s.chunks.length, 0)

  return (
    <section className="panel" aria-label="Lesson script">
      <header className="panel-head">
        <h2>1 · Script</h2>
        <div className="panel-actions">
          <button className="ghost" onClick={loadSample} disabled={isGenerating}>
            Load sample
          </button>
          <button className="primary" onClick={analyze} disabled={isGenerating}>
            Analyze →
          </button>
        </div>
      </header>
      <p className="hint">
        Paste a lesson. Headings (<code>#</code>) become chapters; paragraphs are
        chunked into 1–4 sentence units.
      </p>
      <textarea
        className="script-input"
        value={scriptText}
        spellCheck={false}
        disabled={isGenerating}
        onChange={(e) => setScriptText(e.target.value)}
        aria-label="Lesson script text"
      />
      <div className="counts">
        <span>{scriptText.length.toLocaleString()} chars</span>
        {sections.length > 0 && (
          <span>
            {sections.length} sections · {chunkCount} chunks
          </span>
        )}
      </div>
    </section>
  )
}
