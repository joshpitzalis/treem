import type { CaptureSource } from "../types"

export const circleCaptureSource: CaptureSource = {
  supportsLocation: (location) =>
    location.hostname === "circle.so" ||
    location.hostname.endsWith(".circle.so"),
  detectCurrentCommunity: () => null,
  detectViewerProfile: () => null,
  detectLiveEdge: () => false,
  extractVisibleMessages: () => [],
  enhanceCategorizationControls: async () => {}
}
