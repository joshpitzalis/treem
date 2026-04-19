import { DEFAULT_DEBOUNCE_MS, DEFAULT_POLL_INTERVAL_MS } from "../lib/constants"

export interface CaptureLoop {
  start: () => void
  queueCapture: () => void
}

export interface CaptureLoopWindow {
  addEventListener: Window["addEventListener"]
  setInterval: Window["setInterval"]
  setTimeout: Window["setTimeout"]
}

export interface CreateCaptureLoopInput {
  document: Document
  window: CaptureLoopWindow
  observeMutations: (onMutation: () => void) => void
  runCapture: () => Promise<void>
  onCaptureError?: (error: unknown) => void
  debounceMs?: number
  pollIntervalMs?: number
}

export function createCaptureLoop(input: CreateCaptureLoopInput): CaptureLoop {
  const debounceMs = input.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const pollIntervalMs = input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS

  let captureQueued = false
  let captureRunning = false
  let captureRequestedWhileRunning = false
  let started = false

  function queueCapture(): void {
    if (captureRunning) {
      captureRequestedWhileRunning = true
      return
    }

    if (captureQueued) return

    captureQueued = true
    input.window.setTimeout(() => {
      void flushCaptureQueue()
    }, debounceMs)
  }

  async function flushCaptureQueue(): Promise<void> {
    if (!captureQueued || captureRunning) return

    captureQueued = false
    captureRunning = true

    try {
      await input.runCapture()
    } catch (error) {
      input.onCaptureError?.(error)
    } finally {
      captureRunning = false
      const shouldQueueNextCapture = captureRequestedWhileRunning
      captureRequestedWhileRunning = false

      if (shouldQueueNextCapture) {
        queueCapture()
      }
    }
  }

  function start(): void {
    if (started) return

    started = true

    input.observeMutations(queueCapture)

    input.document.addEventListener("scroll", queueCapture, {
      passive: true,
      capture: true
    })
    input.window.addEventListener("popstate", queueCapture)
    input.window.addEventListener("focus", queueCapture)
    input.document.addEventListener("visibilitychange", () => {
      if (input.document.visibilityState !== "visible") return

      queueCapture()
    })

    queueCapture()
    input.window.setInterval(queueCapture, pollIntervalMs)
  }

  return {
    start,
    queueCapture
  }
}
