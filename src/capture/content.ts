import { Effect } from "effect"
import { createCaptureLoop } from "./helpers/capture-loop"
import { CaptureService, runCaptureEffect } from "./services/capture-service"

console.info("[treem] capture loaded", {
  version: __TREEM_EXTENSION_VERSION__,
  build: __TREEM_BUILD_STAMP__
})

async function captureVisibleMessages(): Promise<void> {
  await runCaptureEffect(
    Effect.gen(function* () {
      const capture = yield* CaptureService
      yield* capture.captureOnce()
    })
  )
}

const captureLoop = createCaptureLoop({
  document,
  window,
  observeMutations: (onMutation: () => void) => {
    const observer = new MutationObserver(onMutation)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: false
    })
  },
  runCapture: captureVisibleMessages,
  onCaptureError: (error: unknown) => {
    console.error("[treem] capture failed", error)
  }
})

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => captureLoop.start(), {
    once: true
  })
} else {
  captureLoop.start()
}
