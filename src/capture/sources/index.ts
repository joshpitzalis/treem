import type { CaptureSource, CaptureSourceLocation } from "../types"
import { circleCaptureSource } from "./circle"
import { discordCaptureSource } from "./discord"

const captureSources: CaptureSource[] = [
  discordCaptureSource,
  circleCaptureSource
]

export function resolveCaptureSource(
  location: CaptureSourceLocation
): CaptureSource | null {
  return (
    captureSources.find((source) => source.supportsLocation(location)) ?? null
  )
}
