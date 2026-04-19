import { JSDOM } from "jsdom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createCaptureLoop } from "../helpers/capture-loop"

describe("createCaptureLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("coalesces repeated capture requests and reruns once after an in-flight capture", async () => {
    const dom = new JSDOM("<body></body>")
    const firstCapture = createDeferredPromise<void>()
    const runCapture = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(firstCapture.promise)
      .mockResolvedValueOnce(undefined)

    const captureLoop = createCaptureLoop({
      document: dom.window.document,
      window: dom.window,
      observeMutations: () => {},
      runCapture,
      debounceMs: 25,
      pollIntervalMs: 10_000
    })

    captureLoop.queueCapture()
    captureLoop.queueCapture()

    await vi.advanceTimersByTimeAsync(25)
    expect(runCapture).toHaveBeenCalledTimes(1)

    captureLoop.queueCapture()
    captureLoop.queueCapture()
    expect(runCapture).toHaveBeenCalledTimes(1)

    firstCapture.resolve()
    await flushMicrotasks()

    expect(runCapture).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(25)
    expect(runCapture).toHaveBeenCalledTimes(2)
  })

  it("reports capture failures and keeps the loop runnable", async () => {
    const dom = new JSDOM("<body></body>")
    const onCaptureError = vi.fn()
    const runCapture = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined)

    const captureLoop = createCaptureLoop({
      document: dom.window.document,
      window: dom.window,
      observeMutations: () => {},
      runCapture,
      onCaptureError,
      debounceMs: 25,
      pollIntervalMs: 10_000
    })

    captureLoop.queueCapture()
    await vi.advanceTimersByTimeAsync(25)
    await flushMicrotasks()

    expect(onCaptureError).toHaveBeenCalledTimes(1)
    expect(runCapture).toHaveBeenCalledTimes(1)

    captureLoop.queueCapture()
    await vi.advanceTimersByTimeAsync(25)

    expect(runCapture).toHaveBeenCalledTimes(2)
  })

  it("starts once, schedules an initial capture, and reacts to mutation callbacks", async () => {
    const dom = new JSDOM("<body></body>")
    const runCapture = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const mutationCallbacks: Array<() => void> = []

    const captureLoop = createCaptureLoop({
      document: dom.window.document,
      window: dom.window,
      observeMutations: (onMutation) => {
        mutationCallbacks.push(onMutation)
      },
      runCapture,
      debounceMs: 25,
      pollIntervalMs: 10_000
    })

    captureLoop.start()
    captureLoop.start()

    await vi.advanceTimersByTimeAsync(25)
    expect(runCapture).toHaveBeenCalledTimes(1)

    const onMutation = requireValue(
      mutationCallbacks[0],
      "Expected mutation callback to be registered"
    )

    onMutation()
    await vi.advanceTimersByTimeAsync(25)

    expect(runCapture).toHaveBeenCalledTimes(2)
  })
})

function createDeferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return {
    promise,
    resolve
  }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function requireValue<T>(
  value: T | null | undefined,
  message: string
): NonNullable<T> {
  if (value == null) {
    throw new Error(message)
  }

  return value
}
