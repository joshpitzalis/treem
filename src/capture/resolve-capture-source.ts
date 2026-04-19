import type { CaptureSource, CaptureSourceLocation } from "./capture-source"
import { discordCaptureSource } from "./discord-capture-source"

const captureSources: CaptureSource[] = [discordCaptureSource]

export function resolveCaptureSource(
  location: CaptureSourceLocation
): CaptureSource | null {
  return (
    captureSources.find((source) => source.supportsLocation(location)) ?? null
  )
}
