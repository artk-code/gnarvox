import { createReadStream, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

const VOICES_DIR = path.resolve(__dirname, 'node_modules/kokoro-js/voices')
const ORT_DIR = path.resolve(__dirname, 'node_modules/@huggingface/transformers/dist')
const ORT_FILES = [
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
]

const MIME: Record<string, string> = {
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.mjs': 'text/javascript',
}

/**
 * Ship the Kokoro voice embeddings (~28 MB) under /kokoro-voices/ and the
 * ONNX-runtime WASM (~21 MB) under /ort/ as app assets, so the neural engine
 * works fully offline with no CDN. kokoro-js's hard-coded Hugging Face voice
 * URL is redirected to these files at runtime (see src/lib/engines/kokoro.ts).
 */
function localInferenceAssetsPlugin(): Plugin {
  const serveDir =
    (dir: string, pattern: RegExp) =>
    (req: { url?: string }, res: import('node:http').ServerResponse, next: () => void) => {
      const name = (req.url ?? '').replace(/^\//, '').split('?')[0]
      if (!pattern.test(name)) return next()
      res.setHeader('Content-Type', MIME[path.extname(name)] ?? 'application/octet-stream')
      createReadStream(path.join(dir, name))
        .on('error', () => next())
        .pipe(res)
    }

  return {
    name: 'gnarvox-local-inference-assets',
    configureServer(server) {
      server.middlewares.use(
        '/kokoro-voices',
        serveDir(VOICES_DIR, /^[a-z]+_[a-z]+\.bin$/),
      )
      server.middlewares.use(
        '/ort',
        serveDir(ORT_DIR, /^ort-wasm-simd-threaded\.jsep\.(mjs|wasm)$/),
      )
    },
    generateBundle() {
      for (const file of readdirSync(VOICES_DIR)) {
        if (!file.endsWith('.bin')) continue
        this.emitFile({
          type: 'asset',
          fileName: `kokoro-voices/${file}`,
          source: readFileSync(path.join(VOICES_DIR, file)),
        })
      }
      for (const file of ORT_FILES) {
        this.emitFile({
          type: 'asset',
          fileName: `ort/${file}`,
          source: readFileSync(path.join(ORT_DIR, file)),
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localInferenceAssetsPlugin()],
  // gnarvox Studio is a fully client-side app; relative base keeps the built
  // bundle openable from any static host or the Tauri asset protocol.
  base: './',
  // Tauri dev expects a fixed port and no screen clearing.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    // onnxruntime-web and the ~21 MB wasm asset make chunks big by design.
    chunkSizeWarningLimit: 3000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
