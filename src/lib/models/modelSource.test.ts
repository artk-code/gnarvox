import { describe, expect, it } from 'vitest'
import {
  cacheKey,
  cacheKeyForUrl,
  DEFAULT_MODEL_SOURCE,
  fileUrl,
  keyToRelPath,
  requiredFiles,
  resolveHost,
} from './modelSource'

describe('model source resolution', () => {
  it('uses the official HF host by default', () => {
    expect(resolveHost(DEFAULT_MODEL_SOURCE)).toBe('https://huggingface.co/')
  })

  it('uses a custom mirror when configured, normalizing the trailing slash', () => {
    const src = {
      ...DEFAULT_MODEL_SOURCE,
      host: 'custom' as const,
      customBaseUrl: 'https://hf-mirror.com',
    }
    expect(resolveHost(src)).toBe('https://hf-mirror.com/')
    expect(fileUrl(src, 'config.json')).toBe(
      'https://hf-mirror.com/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/config.json',
    )
  })

  it('falls back to HF when the custom URL is blank', () => {
    const src = { ...DEFAULT_MODEL_SOURCE, host: 'custom' as const, customBaseUrl: ' ' }
    expect(resolveHost(src)).toBe('https://huggingface.co/')
  })

  it('lists metadata plus the dtype-specific onnx file', () => {
    expect(requiredFiles(DEFAULT_MODEL_SOURCE)).toEqual([
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model_quantized.onnx',
    ])
    expect(requiredFiles({ ...DEFAULT_MODEL_SOURCE, dtype: 'fp32' })).toContain(
      'onnx/model.onnx',
    )
  })

  it('derives host-independent cache keys from download URLs', () => {
    const hf =
      'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx'
    const mirror =
      'https://hf-mirror.com/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx'
    expect(cacheKeyForUrl(hf)).toBe(cacheKeyForUrl(mirror))
    expect(cacheKeyForUrl(hf)).toBe(
      cacheKey(DEFAULT_MODEL_SOURCE, 'onnx/model_quantized.onnx'),
    )
  })

  it('sanitizes cache keys into safe relative paths', () => {
    expect(keyToRelPath('onnx-community/Kokoro-82M-v1.0-ONNX/onnx/model.onnx')).toBe(
      'onnx-community/Kokoro-82M-v1.0-ONNX/onnx/model.onnx',
    )
    expect(keyToRelPath('weird repo/../file name.onnx')).toBe(
      'weird_repo/file_name.onnx',
    )
  })
})
