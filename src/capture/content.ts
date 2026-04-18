import {
  loadState,
  mergeMessages,
  saveScopeObservation,
  saveState,
  saveViewerProfile
} from "../shared/storage"
import { enhanceCategorizationControls } from "./categorization"
import {
  detectCurrentCommunity,
  detectLiveEdge,
  detectViewerProfile,
  extractVisibleMessages
} from "./message-parser"

let captureQueued = false
let observerStarted = false

console.info("[treem] capture loaded", {
  version: __TREEM_EXTENSION_VERSION__,
  build: __TREEM_BUILD_STAMP__
})

function queueCapture(): void {
  if (captureQueued) return

  captureQueued = true

  window.setTimeout(async () => {
    captureQueued = false
    await captureVisibleMessages()
  }, 750)
}

async function captureVisibleMessages(): Promise<void> {
  const community = detectCurrentCommunity()
  const viewerProfile = detectViewerProfile()

  if (viewerProfile) {
    await saveViewerProfile(viewerProfile)
  }

  if (!community) return

  await saveScopeObservation({
    guildId: community.guildId,
    channelId: community.channelId,
    capturedAt: new Date().toISOString(),
    sawLiveEdge: detectLiveEdge()
  })

  const messages = extractVisibleMessages(community)
  if (messages.length > 0) {
    await mergeMessages(messages)
  }

  await enhanceCategorizationControls({
    document,
    guildId: community.guildId,
    loadState,
    saveState
  })
}

function startObserver(): void {
  if (observerStarted) return

  observerStarted = true

  const observer = new MutationObserver(() => {
    queueCapture()
  })

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: false
  })

  document.addEventListener("scroll", queueCapture, {
    passive: true,
    capture: true
  })
  window.addEventListener("popstate", queueCapture)
  window.addEventListener("focus", queueCapture)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") queueCapture()
  })

  queueCapture()
  window.setInterval(queueCapture, 10_000)
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startObserver, { once: true })
} else {
  startObserver()
}
