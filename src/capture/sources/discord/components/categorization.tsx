import { flushSync } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import type { LeaderboardState } from "../../../../shared/types"
import type { CaptureCategorizationRuntime } from "../../../types"
import { looksLikeReplyMessageNode } from "../helpers/message-parser"
import categoryControlStyles from "../lib/styles.css?inline"
import {
  DiscordCategorizationControl,
  hasCategoryControlDraft
} from "./categorization-control"

const MESSAGE_SELECTOR = [
  'li[id^="chat-messages-"]',
  'article[id^="chat-messages-"]',
  '[data-list-item-id^="chat-messages_"]'
].join(",")

const hostRoots = new WeakMap<HTMLElement, Root>()

interface MessageRenderContext {
  anchorNode: HTMLElement
  host: HTMLElement
  layout: "header"
  messageKey: string
  runtime: CaptureCategorizationRuntime
}

export async function enhanceCategorizationControls(
  runtime: CaptureCategorizationRuntime
): Promise<void> {
  const state = await runtime.loadState()
  renderAllMessageControls(runtime, state)
}

function renderAllMessageControls(
  runtime: CaptureCategorizationRuntime,
  state: LeaderboardState
): void {
  const capturedTopLevelMessageIds = new Set(
    state.messages
      .filter(
        (message) =>
          message.guildId === runtime.guildId && message.isReply === false
      )
      .map((message) => message.id)
  )

  runtime.document
    .querySelectorAll<HTMLElement>(MESSAGE_SELECTOR)
    .forEach((messageNode) => {
      syncMessageControl({
        capturedTopLevelMessageIds,
        messageNode,
        runtime,
        state
      })
    })
}

function syncMessageControl(input: {
  capturedTopLevelMessageIds: Set<string>
  messageNode: HTMLElement
  runtime: CaptureCategorizationRuntime
  state: LeaderboardState
}): void {
  const messageContext = resolveMessageRenderContext(
    input.messageNode,
    input.runtime
  )
  if (!messageContext) return

  if (looksLikeReplyMessageNode(input.messageNode)) {
    unmountMessageControl(messageContext.host)
    return
  }

  if (!input.capturedTopLevelMessageIds.has(messageContext.messageKey)) {
    unmountMessageControl(messageContext.host)
    return
  }

  renderMessageControl({
    anchorNode: messageContext.anchorNode,
    host: messageContext.host,
    layout: messageContext.layout,
    messageKey: messageContext.messageKey,
    runtime: input.runtime,
    state: input.state
  })
}

function resolveMessageRenderContext(
  messageNode: HTMLElement,
  runtime: CaptureCategorizationRuntime
): MessageRenderContext | null {
  const messageId = extractMessageId(messageNode)
  if (!messageId) return null

  messageNode.classList.add("treem-category-row")

  const messageKey = `${runtime.guildId}:${readChannelId(runtime.document.location?.pathname)}:${messageId}`
  const anchor = resolveAnchorNode(messageNode)
  ensureAnchorPositioning(anchor.anchorNode, anchor.layout)

  const host = ensureHostElement(messageNode, anchor.anchorNode, anchor.layout)

  host.dataset.treemGuildId = runtime.guildId
  host.dataset.treemLayout = anchor.layout
  host.dataset.treemMessageId = messageKey

  return {
    anchorNode: anchor.anchorNode,
    host,
    layout: anchor.layout,
    messageKey,
    runtime
  }
}

function ensureHostElement(
  messageNode: HTMLElement,
  anchorNode: HTMLElement,
  layout: "header"
): HTMLElement {
  const existingHost = messageNode.querySelector<HTMLElement>(
    '[data-treem-role="category-control-host"]'
  )
  if (existingHost) {
    existingHost.dataset.treemLayout = layout
    if (existingHost.parentElement !== anchorNode) {
      anchorNode.append(existingHost)
    }
    return existingHost
  }

  const host = anchorNode.ownerDocument.createElement("div")
  host.dataset.treemRole = "category-control-host"
  host.dataset.treemLayout = layout
  host.hidden = false
  anchorNode.append(host)

  return host
}

function renderMessageControl(input: {
  anchorNode: HTMLElement
  host: HTMLElement
  layout: "header"
  messageKey: string
  runtime: CaptureCategorizationRuntime
  state: LeaderboardState
}): void {
  ensureCategoryControlStyles(input.host.ownerDocument)
  const existingRoot = hostRoots.get(input.host)

  if (
    existingRoot &&
    hasCategoryControlDraft(input.messageKey) &&
    input.host.querySelector('[data-treem-role="category-control"]')
  ) {
    input.host.hidden = false
    return
  }

  const root = getOrCreateRoot(input.host)

  input.host.hidden = false

  flushSync(() => {
    root.render(
      <DiscordCategorizationControl
        guildId={input.runtime.guildId}
        messageId={input.messageKey}
        state={input.state}
        onUiStateChange={() => {
          renderAllMessageControls(input.runtime, input.state)
        }}
        onStateChange={async (nextState) => {
          await input.runtime.saveState(nextState)
          renderAllMessageControls(input.runtime, nextState)
        }}
      />
    )
  })
}

function getOrCreateRoot(host: HTMLElement): Root {
  const existingRoot = hostRoots.get(host)
  if (existingRoot) return existingRoot

  const container = host.querySelector<HTMLElement>(
    '[data-treem-role="category-root"]'
  ) ?? host.ownerDocument.createElement("div")

  if (!container.dataset.treemRole) {
    container.dataset.treemRole = "category-root"
    host.replaceChildren(container)
  }

  if (!container) {
    throw new Error("Category control root missing")
  }

  const root = createRoot(container)
  hostRoots.set(host, root)
  return root
}

function ensureCategoryControlStyles(document: Document): void {
  if (document.getElementById("treem-category-control-styles")) return

  const style = document.createElement("style")
  style.id = "treem-category-control-styles"
  style.textContent = categoryControlStyles.split(":host").join(
    '[data-treem-role="category-control-host"]'
  )
  document.head.append(style)
}

function unmountMessageControl(host: HTMLElement): void {
  hostRoots.get(host)?.unmount()
  hostRoots.delete(host)
  host.remove()
}

function resolveAnchorNode(
  messageNode: HTMLElement
): {
  anchorNode: HTMLElement
  layout: "header"
} {
  const headerNode = resolveHeaderNode(messageNode)
  return {
    anchorNode: headerNode,
    layout: "header"
  }
}

function resolveHeaderNode(messageNode: HTMLElement): HTMLElement {
  const timeNode = messageNode.querySelector<HTMLElement>("time")
  if (!timeNode) return messageNode

  return (
    timeNode.closest<HTMLElement>('h3, [class*="header"], [role="heading"]') ??
    timeNode.parentElement ??
    messageNode
  )
}

function ensureAnchorPositioning(
  anchorNode: HTMLElement,
  layout: "header"
): void {
  anchorNode.classList.add("treem-category-anchor")

  if (!anchorNode.style.position) {
    anchorNode.style.position = "relative"
  }

  if (!anchorNode.style.display) {
    anchorNode.style.display = "inline-block"
  }
}

function extractMessageId(node: HTMLElement): string | null {
  const labelledBy = node.getAttribute("aria-labelledby")
  const labelledByMatch = labelledBy?.match(
    /message-(?:username|content|timestamp)-(\d+)/
  )
  if (labelledByMatch?.[1]) {
    return labelledByMatch[1]
  }

  const descendantIdMatch = node
    .querySelector<HTMLElement>(
      '[id^="message-username-"], [id^="message-content-"], [id^="message-timestamp-"]'
    )
    ?.id.match(/message-(?:username|content|timestamp)-(\d+)/)
  if (descendantIdMatch?.[1]) {
    return descendantIdMatch[1]
  }

  if (node.id.startsWith("chat-messages-")) {
    return node.id.replace("chat-messages-", "")
  }

  const dataListItemId = node.dataset.listItemId
  if (!dataListItemId) return null

  const parts = dataListItemId.split("_")
  return parts.length > 0 ? parts[parts.length - 1] : null
}

function readChannelId(pathname: string | undefined): string {
  const match = pathname?.match(/^\/channels\/[^/]+\/([^/]+)/)
  return match?.[1] ?? "unknown-channel"
}
