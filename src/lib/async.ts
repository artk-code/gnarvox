// Timeout helpers so no engine/model operation can hang the UI forever.

/** Reject if `promise` does not settle within `ms`. */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`),
        ),
      ms,
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

export interface StallGuard {
  /** Rejects when the guard trips; race this against the watched work. */
  promise: Promise<never>
  /** Signal liveness (e.g. from a progress callback) to reset the timer. */
  kick: () => void
  /** Stop the guard (call in finally). */
  clear: () => void
}

/**
 * A watchdog for long operations that emit progress: trips only when no
 * `kick()` arrives for `ms`, so slow-but-alive downloads are never aborted.
 */
export function createStallGuard(ms: number, label: string): StallGuard {
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectFn: (err: Error) => void = () => {}
  let cleared = false

  const promise = new Promise<never>((_, reject) => {
    rejectFn = reject
  })

  const arm = () => {
    if (cleared) return
    clearTimeout(timer)
    timer = setTimeout(
      () =>
        rejectFn(
          new Error(
            `${label} stalled (no progress for ${Math.round(ms / 1000)}s) and was aborted.`,
          ),
        ),
      ms,
    )
  }
  arm()

  return {
    promise,
    kick: arm,
    clear: () => {
      cleared = true
      clearTimeout(timer)
    },
  }
}
