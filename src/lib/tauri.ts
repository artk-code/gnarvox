// Small Tauri integration helpers.
//
// gnarvox Studio runs both as a plain web app and inside the Tauri desktop
// shell. Everything Tauri-specific is isolated here behind feature detection
// and dynamic imports, so the web build never pulls in Tauri code paths.

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Save bytes to a user-chosen location. In Tauri this opens a native save
 * dialog and writes the file; in the browser it falls back to a download.
 */
export async function saveBytes(
  bytes: Uint8Array,
  defaultName: string,
  filter: { name: string; extensions: string[] },
  mime: string,
): Promise<'saved' | 'cancelled'> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({ defaultPath: defaultName, filters: [filter] })
    if (!path) return 'cancelled'
    await writeFile(path, bytes)
    return 'saved'
  }

  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = defaultName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'saved'
}
