import type { CaptureSource } from "./capture-source"
import { enhanceCategorizationControls } from "./categorization"
import {
  detectCurrentCommunity,
  detectLiveEdge,
  detectViewerProfile,
  extractVisibleMessages
} from "./message-parser"

export const discordCaptureSource: CaptureSource = {
  detectCurrentCommunity,
  detectViewerProfile,
  detectLiveEdge,
  extractVisibleMessages,
  enhanceCategorizationControls
}
