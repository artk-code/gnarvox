// Model lifecycle management for the Kokoro engine (PLAN §12.3):
// status inspection, explicit download (never silent), deletion, and
// air-gapped import from a local folder (Tauri only).

import type { ModelSource } from '../types'
import { cacheKey, DTYPE_FILES, requiredFiles } from './modelSource'
import { getModelStore } from './modelStore'

export interface ModelFileStatus {
  file: string
  present: boolean
  bytes: number | null
}

export interface ModelStatus {
  ready: boolean
  files: ModelFileStatus[]
  totalBytes: number
  location: string
}

/** Inspect the model store: which files are present and how big they are. */
export async function getModelStatus(source: ModelSource): Promise<ModelStatus> {
  const store = getModelStore()
  const files: ModelFileStatus[] = []
  for (const file of requiredFiles(source)) {
    const key = cacheKey(source, file)
    const bytes = await store.size(key)
    files.push({ file, present: bytes !== null, bytes })
  }
  return {
    ready: files.every((f) => f.present),
    files,
    totalBytes: files.reduce((sum, f) => sum + (f.bytes ?? 0), 0),
    location: await store.location(),
  }
}

export interface DownloadState {
  file: string
  loaded: number
  total: number
}

/**
 * Explicitly download the model by loading the engine with network access
 * allowed. Files stream into the model store; the loaded engine stays warm.
 */
export async function downloadModel(
  source: ModelSource,
  onProgress: (p: DownloadState) => void,
): Promise<void> {
  const { loadKokoro, unloadKokoro } = await import('../engines/kokoro')
  unloadKokoro() // force a fresh load so every file passes through the store
  await loadKokoro(source, { allowDownload: true, onProgress })
}

/** Remove all stored files of this model (all dtypes of the repo). */
export async function deleteModel(source: ModelSource): Promise<void> {
  const store = getModelStore()
  await store.deletePrefix(source.repoId)
  const { unloadKokoro } = await import('../engines/kokoro')
  unloadKokoro()
}

/**
 * Import model files from a local folder (Tauri only): supports fully
 * offline installs. Recognizes config.json / tokenizer.json /
 * tokenizer_config.json at the folder root and .onnx weights either at the
 * root or in an onnx/ subfolder. Returns the imported file names.
 */
export async function importModelFolder(source: ModelSource): Promise<string[]> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readDir, readFile } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')

  const dir = await open({ directory: true, title: 'Select a Kokoro model folder' })
  if (!dir || Array.isArray(dir)) return []

  const store = getModelStore()
  const imported: string[] = []

  const putFile = async (absPath: string, key: string, name: string) => {
    const bytes = await readFile(absPath)
    await store.putBytes(key, bytes)
    imported.push(name)
  }

  const metaNames = new Set(['config.json', 'tokenizer.json', 'tokenizer_config.json'])
  const onnxTargets = new Set(Object.values(DTYPE_FILES).map((f) => f.split('/')[1]))

  const rootEntries = await readDir(dir)
  for (const entry of rootEntries) {
    if (entry.isFile && metaNames.has(entry.name)) {
      await putFile(await join(dir, entry.name), cacheKey(source, entry.name), entry.name)
    }
    if (entry.isFile && entry.name.endsWith('.onnx') && onnxTargets.has(entry.name)) {
      await putFile(
        await join(dir, entry.name),
        cacheKey(source, `onnx/${entry.name}`),
        `onnx/${entry.name}`,
      )
    }
    if (entry.isDirectory && entry.name === 'onnx') {
      const onnxDir = await join(dir, 'onnx')
      for (const sub of await readDir(onnxDir)) {
        if (sub.isFile && sub.name.endsWith('.onnx') && onnxTargets.has(sub.name)) {
          await putFile(
            await join(onnxDir, sub.name),
            cacheKey(source, `onnx/${sub.name}`),
            `onnx/${sub.name}`,
          )
        }
      }
    }
  }

  const { unloadKokoro } = await import('../engines/kokoro')
  unloadKokoro()
  return imported
}
