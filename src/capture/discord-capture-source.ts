import type { CaptureSource } from "./capture-source"
import { enhanceCategorizationControls } from "./categorization"
import {
  detectCurrentCommunity,
  detectLiveEdge,
  detectViewerProfile,
  extractVisibleMessages
} from "./message-parser"

export const discordCaptureSource: CaptureSource = {
  supportsLocation: (location) =>
    location.hostname === "discord.com" ||
    location.hostname.endsWith(".discord.com"),
  detectCurrentCommunity,
  detectViewerProfile,
  detectLiveEdge,
  extractVisibleMessages,
  enhanceCategorizationControls
}
