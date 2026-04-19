import { Context, Effect, Layer } from "effect"
import type { CaptureSource } from "../lib/types"
import { resolveCaptureSource } from "../sources"

export interface CaptureBrowserApi {
  document: Document
  resolveCurrentSource: () => CaptureSource | null
}

export class CaptureBrowser extends Context.Service<CaptureBrowser>()(
  "capture/CaptureBrowser",
  {
    make: Effect.sync<CaptureBrowserApi>(() => ({
      document,
      resolveCurrentSource: (): CaptureSource | null =>
        resolveCaptureSource(window.location)
    }))
  }
) {
  static layer = Layer.effect(this, this.make)
}
