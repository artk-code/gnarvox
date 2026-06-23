import { useStudio } from '../store'
import { VOICES } from '../lib/engine'

export function SettingsBar() {
  const settings = useStudio((s) => s.settings)
  const updateSettings = useStudio((s) => s.updateSettings)
  const isGenerating = useStudio((s) => s.isGenerating)

  return (
    <div className="settings-bar" aria-label="Voice and generation settings">
      <label className="field">
        <span>Voice</span>
        <select
          value={settings.voiceId}
          disabled={isGenerating}
          onChange={(e) => updateSettings({ voiceId: e.target.value })}
        >
          {VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Seed</span>
        <input
          type="number"
          value={settings.seed}
          disabled={isGenerating}
          onChange={(e) => updateSettings({ seed: Number(e.target.value) || 0 })}
        />
      </label>

      <label className="field">
        <span>Pace ×{settings.pace.toFixed(2)}</span>
        <input
          type="range"
          min={0.6}
          max={1.6}
          step={0.05}
          value={settings.pace}
          disabled={isGenerating}
          onChange={(e) => updateSettings({ pace: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>Chunk size {settings.targetChunkChars}c</span>
        <input
          type="range"
          min={120}
          max={400}
          step={10}
          value={settings.targetChunkChars}
          disabled={isGenerating}
          onChange={(e) =>
            updateSettings({ targetChunkChars: Number(e.target.value) })
          }
        />
      </label>
    </div>
  )
}
