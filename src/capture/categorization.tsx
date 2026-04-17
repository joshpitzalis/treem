import { flushSync } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import type { LeaderboardState } from "../shared/types"
import { looksLikeReplyMessageNode } from "./message-parser"
import { DiscordCategorizationControl } from "./discord-categorization-control"

const MESSAGE_SELECTOR = [
  'li[id^="chat-messages-"]',
  'article[id^="chat-messages-"]',
  '[data-list-item-id^="chat-messages_"]'
].join(",")

const hostRoots = new WeakMap<HTMLElement, Root>()

interface CategorizationRuntime {
  document: Document
  guildId: string
  loadState: () => Promise<LeaderboardState>
  saveState: (state: LeaderboardState) => Promise<void>
}

interface MessageRenderContext {
  headerNode: HTMLElement
  host: HTMLElement
  messageKey: string
  runtime: CategorizationRuntime
}

export async function enhanceCategorizationControls(
  runtime: CategorizationRuntime
): Promise<void> {
  const state = await runtime.loadState()
  renderAllMessageControls(runtime, state)
}

function renderAllMessageControls(
  runtime: CategorizationRuntime,
  state: LeaderboardState
): void {
  const capturedTopLevelMessageIds = new Set(
    state.messages
      .filter(
        (message) => message.guildId === runtime.guildId && !message.isReply
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
  runtime: CategorizationRuntime
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
    headerNode: messageContext.headerNode,
    host: messageContext.host,
    messageKey: messageContext.messageKey,
    runtime: input.runtime,
    state: input.state
  })
}

function resolveMessageRenderContext(
  messageNode: HTMLElement,
  runtime: CategorizationRuntime
): MessageRenderContext | null {
  const messageId = extractMessageId(messageNode)
  if (!messageId) return null

  const headerNode =
    messageNode.querySelector<HTMLElement>("time")?.parentElement ?? messageNode
  headerNode.classList.add("treem-category-anchor")

  const host = ensureHostElement(headerNode)
  const messageKey = `${runtime.guildId}:${readChannelId(runtime.document.location?.pathname)}:${messageId}`

  host.dataset.treemGuildId = runtime.guildId
  host.dataset.treemMessageId = messageKey

  return {
    headerNode,
    host,
    messageKey,
    runtime
  }
}

function ensureHostElement(headerNode: HTMLElement): HTMLElement {
  const existingHost = headerNode.querySelector<HTMLElement>(
    '[data-treem-role="category-control-host"]'
  )
  if (existingHost) return existingHost

  const host = headerNode.ownerDocument.createElement("div")
  host.dataset.treemRole = "category-control-host"
  headerNode.append(host)

  return host
}

function renderMessageControl(input: {
  headerNode: HTMLElement
  host: HTMLElement
  messageKey: string
  runtime: CategorizationRuntime
  state: LeaderboardState
}): void {
  input.headerNode.classList.add("treem-category-anchor")

  const root = getOrCreateRoot(input.host)
  const shadowRoot = input.host.shadowRoot
  if (!shadowRoot) return

  flushSync(() => {
    root.render(
      <DiscordCategorizationControl
        guildId={input.runtime.guildId}
        messageId={input.messageKey}
        state={input.state}
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

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" })
  shadowRoot.innerHTML = `
    <style>
      :host {
        position: absolute;
        inset-inline-start: calc(100% + 8px);
        top: 50%;
        transform: translateY(-50%);
        z-index: 2;
      }
      .treem-category-control {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        white-space: nowrap;
      }
      .treem-category-picker,
      .treem-category-create-form {
        display: inline-flex;
        gap: 6px;
        align-items: center;
      }
      .treem-category-picker {
        flex-wrap: wrap;
      }
      .treem-category-toggle,
      .treem-category-select,
      .treem-category-create-toggle,
      .treem-category-create-input,
      .treem-category-create-submit {
        min-width: 120px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.24);
        color: inherit;
        font: inherit;
      }
      .treem-category-toggle {
        background: rgba(88, 101, 242, 0.16);
        padding: 2px 8px;
        cursor: pointer;
      }
      .treem-category-select {
        background: rgba(0, 0, 0, 0.2);
        padding: 2px 10px;
      }
      .treem-category-create-toggle,
      .treem-category-create-submit {
        background: rgba(88, 101, 242, 0.12);
        padding: 2px 10px;
        cursor: pointer;
      }
      .treem-category-create-input {
        min-width: 140px;
        background: rgba(0, 0, 0, 0.2);
        padding: 2px 10px;
      }
      .treem-category-create-error {
        margin: 0;
        color: #ffb3ba;
        font-size: 12px;
      }
    </style>
    <div data-treem-role="category-root"></div>
  `

  const container = shadowRoot.querySelector<HTMLElement>(
    '[data-treem-role="category-root"]'
  )
  if (!container) {
    throw new Error("Category control root missing")
  }

  const root = createRoot(container)
  hostRoots.set(host, root)
  return root
}

function unmountMessageControl(host: HTMLElement): void {
  hostRoots.get(host)?.unmount()
  hostRoots.delete(host)
  host.remove()
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
