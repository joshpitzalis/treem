import type { CaptureSource } from "../../lib/types"
import { enhanceCategorizationControls } from "./components/categorization"
import {
  detectCurrentCommunity,
  detectLiveEdge,
  detectViewerProfile,
  extractVisibleMessages
} from "./helpers/message-parser"

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
