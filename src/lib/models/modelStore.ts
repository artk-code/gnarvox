// On-disk / in-browser storage for downloaded Kokoro model files.
//
// Two backends behind one interface:
// - Tauri desktop: files live under <appData>/models/<repo>/<file>, visible
//   and deletable by the user, and importable from a local folder (air-gapped
//   installs, PLAN §12.3).
// - Plain browser: the Web Cache API (same store transformers.js uses).
//
// The store is exposed to transformers.js as a custom cache (`match`/`put`
// keyed by download URL), with host-independent keys so a model downloaded
// from a mirror is still recognized afterwards.

import { isTauri } from '../tauri'
import { cacheKeyForUrl, keyToRelPath } from './modelSource'

export interface StoredFile {
  key: string
  bytes: number
}

export interface ModelStoreBackend {
  /** transformers.js custom-cache hook. */
  match(url: string): Promise<Response | undefined>
  /** transformers.js custom-cache hook. */
  put(url: string, response: Response): Promise<void>
  /** Whether a file exists, by cache key. */
  has(key: string): Promise<boolean>
  /** Size in bytes of a stored file, or null when absent. */
  size(key: string): Promise<number | null>
  /** Delete every stored file whose key starts with `keyPrefix`. */
  deletePrefix(keyPrefix: string): Promise<void>
  /** Write raw bytes under a cache key (local folder import). */
  putBytes(key: string, bytes: Uint8Array): Promise<void>
  /** Human-readable location of the store, for the UI. */
  location(): Promise<string>
}

const MODELS_DIR = 'models'

class TauriModelStore implements ModelStoreBackend {
  private baseDirPromise: Promise<string> | null = null

  private async baseDir(): Promise<string> {
    if (!this.baseDirPromise) {
      this.baseDirPromise = (async () => {
        const { appDataDir, join } = await import('@tauri-apps/api/path')
        const { mkdir, exists } = await import('@tauri-apps/plugin-fs')
        const dir = await join(await appDataDir(), MODELS_DIR)
        if (!(await exists(dir))) await mkdir(dir, { recursive: true })
        return dir
      })()
    }
    return this.baseDirPromise
  }

  private async keyPath(key: string): Promise<string> {
    const { join } = await import('@tauri-apps/api/path')
    return join(await this.baseDir(), keyToRelPath(key))
  }

  async match(url: string): Promise<Response | undefined> {
    try {
      const { exists, readFile } = await import('@tauri-apps/plugin-fs')
      const path = await this.keyPath(cacheKeyForUrl(url))
      if (!(await exists(path))) return undefined
      const bytes = await readFile(path)
      return new Response(bytes.buffer as ArrayBuffer, { status: 200 })
    } catch {
      return undefined
    }
  }

  async put(url: string, response: Response): Promise<void> {
    const bytes = new Uint8Array(await response.arrayBuffer())
    await this.putBytes(cacheKeyForUrl(url), bytes)
  }

  async putBytes(key: string, bytes: Uint8Array): Promise<void> {
    const { mkdir, writeFile, exists } = await import('@tauri-apps/plugin-fs')
    const path = await this.keyPath(key)
    // Strip the file name using either separator (Windows paths use "\").
    const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
    const dir = path.slice(0, cut)
    if (!(await exists(dir))) await mkdir(dir, { recursive: true })
    await writeFile(path, bytes)
  }

  async has(key: string): Promise<boolean> {
    try {
      const { exists } = await import('@tauri-apps/plugin-fs')
      return await exists(await this.keyPath(key))
    } catch {
      return false
    }
  }

  async size(key: string): Promise<number | null> {
    try {
      const { stat } = await import('@tauri-apps/plugin-fs')
      const info = await stat(await this.keyPath(key))
      return info.size
    } catch {
      return null
    }
  }

  async deletePrefix(keyPrefix: string): Promise<void> {
    const { remove, exists } = await import('@tauri-apps/plugin-fs')
    const path = await this.keyPath(keyPrefix)
    if (await exists(path)) await remove(path, { recursive: true })
  }

  async location(): Promise<string> {
    return this.baseDir()
  }
}

const CACHE_NAME = 'gnarvox-models'

class BrowserModelStore implements ModelStoreBackend {
  private async open(): Promise<Cache | null> {
    try {
      return await caches.open(CACHE_NAME)
    } catch {
      return null
    }
  }

  private keyUrl(key: string): string {
    // Cache API keys must be URLs; use a synthetic same-origin URL.
    return `${location.origin}/__models__/${keyToRelPath(key)}`
  }

  async match(url: string): Promise<Response | undefined> {
    const cache = await this.open()
    if (!cache) return undefined
    return (await cache.match(this.keyUrl(cacheKeyForUrl(url)))) ?? undefined
  }

  async put(url: string, response: Response): Promise<void> {
    const cache = await this.open()
    if (!cache) return
    await cache.put(this.keyUrl(cacheKeyForUrl(url)), response)
  }

  async putBytes(key: string, bytes: Uint8Array): Promise<void> {
    const cache = await this.open()
    if (!cache) return
    await cache.put(
      this.keyUrl(key),
      new Response(bytes.buffer as ArrayBuffer, { status: 200 }),
    )
  }

  async has(key: string): Promise<boolean> {
    const cache = await this.open()
    if (!cache) return false
    return (await cache.match(this.keyUrl(key))) !== undefined
  }

  async size(key: string): Promise<number | null> {
    const cache = await this.open()
    if (!cache) return null
    const res = await cache.match(this.keyUrl(key))
    if (!res) return null
    const bytes = await res.clone().arrayBuffer()
    return bytes.byteLength
  }

  async deletePrefix(keyPrefix: string): Promise<void> {
    const cache = await this.open()
    if (!cache) return
    const prefix = this.keyUrl(keyPrefix)
    for (const req of await cache.keys()) {
      if (req.url.startsWith(prefix)) await cache.delete(req)
    }
  }

  async location(): Promise<string> {
    return 'browser storage (Cache API)'
  }
}

let store: ModelStoreBackend | null = null

export function getModelStore(): ModelStoreBackend {
  if (!store) store = isTauri() ? new TauriModelStore() : new BrowserModelStore()
  return store
}
