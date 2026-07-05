import { useStudio } from '../store'

export function NormalizationPanel() {
  const normalization = useStudio((s) => s.normalization)

  if (!normalization) {
    return (
      <section className="panel" aria-label="Text normalization">
        <header className="panel-head">
          <h2>2 · Normalize</h2>
        </header>
        <p className="empty">Analyze a script to see spoken-form substitutions.</p>
      </section>
    )
  }

  const { edits } = normalization

  return (
    <section className="panel" aria-label="Text normalization">
      <header className="panel-head">
        <h2>2 · Normalize</h2>
        <span className="badge">{edits.length} edits</span>
      </header>
      <p className="hint">
        Numbers, dates, currency, URLs, and acronyms are expanded to spoken form
        before synthesis.
      </p>
      {edits.length === 0 ? (
        <p className="empty">No substitutions needed.</p>
      ) : (
        <ul className="edits">
          {edits.map((edit, i) => (
            <li key={i}>
              <span className="rule-tag">{edit.rule}</span>
              <span className="from">{edit.original}</span>
              <span className="arrow">→</span>
              <span className="to">{edit.replacement}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
