// Small deterministic hashing helpers.
//
// `hashString` is a non-cryptographic FNV-1a 32-bit hash used to derive
// reproducible per-chunk seeds from text + settings. It runs everywhere
// (browser + Node test runner) with no Web Crypto dependency, which keeps the
// synth engine pure and unit-testable.

/** FNV-1a 32-bit hash of a string, returned as an unsigned 32-bit integer. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    // hash *= 16777619, kept in 32-bit range via Math.imul.
    hash = Math.imul(hash, 0x01000193)
  }
  // Coerce to unsigned 32-bit.
  return hash >>> 0
}

/**
 * SHA-256 hex digest via Web Crypto. Used for provenance hashes in the export
 * manifest. Returns a short placeholder when crypto.subtle is unavailable
 * (e.g. insecure context) so the demo never hard-fails on export.
 */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    return `fnv1a:${hashString(Array.from(bytes.slice(0, 4096)).join(','))
      .toString(16)
      .padStart(8, '0')}`
  }
  const view = new Uint8Array(bytes) // ensure a tightly-bound ArrayBuffer view
  const digest = await subtle.digest('SHA-256', view)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
