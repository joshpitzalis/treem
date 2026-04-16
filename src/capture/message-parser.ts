import { createAuthorKey } from "../shared/leaderboard-query"
import { scoreMessage } from "../shared/scoring"
import type {
  CommunityRef,
  ContributionMessage,
  ViewerProfile
} from "../shared/types"

const MESSAGE_SELECTOR = [
  'li[id^="chat-messages-"]',
  'article[id^="chat-messages-"]',
  '[data-list-item-id^="chat-messages_"]'
].join(",")

export function detectCurrentCommunity(): CommunityRef | null {
  const match = window.location.pathname.match(/^\/channels\/([^/]+)\/([^/]+)/)
  if (!match) return null

  const guildId = match[1]
  const channelId = match[2]

  if (!guildId || !channelId || guildId === "@me") return null

  return {
    guildId,
    guildName: readGuildName(guildId),
    channelId,
    channelName: readChannelName(channelId)
  }
}

export function extractVisibleMessages(
  community: CommunityRef
): ContributionMessage[] {
  const nodes = document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR)
  const messages: ContributionMessage[] = []
  let previousAuthor: {
    authorName: string
    authorAvatarUrl: string | null
  } | null = null

  nodes.forEach((node) => {
    const parsed = parseMessageNode(node, community, previousAuthor)
    if (parsed) messages.push(parsed)

    const explicitAuthorName = readAuthorName(node)
    if (explicitAuthorName) {
      previousAuthor = {
        authorName: explicitAuthorName,
        authorAvatarUrl: readAuthorAvatarUrl(node)
      }
    }
  })

  return messages
}

export function detectViewerProfile(): ViewerProfile | null {
  const displayName = readViewerDisplayName()
  if (!displayName) return null

  const avatarUrl = readViewerAvatarUrl()

  return {
    displayName,
    avatarUrl,
    authorKeys: [
      createAuthorKey(displayName, avatarUrl),
      createAuthorKey(displayName, null)
    ],
    capturedAt: new Date().toISOString()
  }
}

export function detectLiveEdge(): boolean {
  const scroller = document
    .querySelector<HTMLElement>('[data-list-id="chat-messages"]')
    ?.closest<HTMLElement>('[class*="scroller"]')
  if (!scroller) return false

  const distanceFromBottom =
    scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
  return distanceFromBottom <= 80
}

function parseMessageNode(
  node: HTMLElement,
  community: CommunityRef,
  previousAuthor: { authorName: string; authorAvatarUrl: string | null } | null
): ContributionMessage | null {
  const messageId = extractMessageId(node)
  if (!messageId) return null

  const authorName = readAuthorName(node) ?? previousAuthor?.authorName ?? null
  const authorAvatarUrl =
    readAuthorAvatarUrl(node) ?? previousAuthor?.authorAvatarUrl ?? null
  const timestamp = readTimestamp(node)

  if (!authorName || !timestamp) return null

  const contentLength = readContentLength(node)
  const reactionCount = readReactionCount(node)
  const attachmentCount = countAttachments(node)
  const isReply = looksLikeReply(node)
  const score = scoreMessage({
    contentLength,
    reactionCount,
    attachmentCount,
    isReply
  })

  return {
    id: `${community.guildId}:${community.channelId}:${messageId}`,
    guildId: community.guildId,
    guildName: community.guildName,
    channelId: community.channelId,
    channelName: community.channelName,
    authorKey: createAuthorKey(authorName, authorAvatarUrl),
    authorName,
    authorAvatarUrl,
    messageTimestamp: timestamp,
    capturedAt: new Date().toISOString(),
    contentLength,
    reactionCount,
    attachmentCount,
    isReply,
    score
  }
}

function extractMessageId(node: HTMLElement): string | null {
  if (node.id.startsWith("chat-messages-")) {
    return node.id.replace("chat-messages-", "")
  }

  const dataListItemId = node.dataset.listItemId
  if (!dataListItemId) return null

  const parts = dataListItemId.split("_")
  return parts.length > 0 ? parts[parts.length - 1] : null
}

function readAuthorName(node: HTMLElement): string | null {
  const selectors = [
    '[id^="message-username-"]',
    'h3 span[class*="username"]',
    'span[class*="username"]',
    'h3 span[role="button"]'
  ]

  for (const selector of selectors) {
    const element = node.querySelector<HTMLElement>(selector)
    const text = element?.textContent?.trim()
    if (text) return text
  }

  return null
}

function readTimestamp(node: HTMLElement): string | null {
  const element = node.querySelector<HTMLTimeElement>("time[datetime]")
  return element?.dateTime ?? null
}

function readAuthorAvatarUrl(node: HTMLElement): string | null {
  const image = node.querySelector<HTMLImageElement>(
    'img[class*="avatar"], [class*="avatar"] img, [data-list-item-id] img'
  )

  const src = image?.src?.trim()
  return src || null
}

function readContentLength(node: HTMLElement): number {
  const contentNodes = node.querySelectorAll<HTMLElement>(
    '[id^="message-content-"], [class*="messageContent"], [class*="markup"]'
  )

  if (contentNodes.length === 0) return 0

  return Array.from(contentNodes)
    .map((contentNode) => contentNode.innerText.trim())
    .join(" ")
    .trim().length
}

function readReactionCount(node: HTMLElement): number {
  const reactionNodes = node.querySelectorAll<HTMLElement>(
    '[role="button"][aria-label*="reaction"]'
  )
  let count = 0

  reactionNodes.forEach((reactionNode) => {
    const label = reactionNode.getAttribute("aria-label") ?? ""
    const match = label.match(/(\d+)/)

    if (match) {
      count += Number(match[1])
    }
  })

  return count
}

function countAttachments(node: HTMLElement): number {
  return node.querySelectorAll("img, video, audio, a[href]").length > 0
    ? node.querySelectorAll(
        '[class*="imageContent"], [class*="embed"], [class*="attachment"]'
      ).length
    : 0
}

function looksLikeReply(node: HTMLElement): boolean {
  return Boolean(
    node.querySelector(
      '[id^="message-reply-context-"], [class*="repliedMessage"], [class*="replyBadge"]'
    )
  )
}

function readGuildName(guildId: string): string {
  const navLabel = document
    .querySelector<HTMLElement>('nav[aria-label$="(server)"]')
    ?.getAttribute("aria-label")
    ?.trim()
  const cleanedNavLabel = cleanGuildName(navLabel)
  if (cleanedNavLabel) return cleanedNavLabel

  const selectedGuild = document.querySelector<HTMLElement>(
    '[aria-label="Servers"] [aria-label][aria-current="page"], nav[aria-label*="Servers"] [aria-label][aria-current="page"]'
  )

  const label = selectedGuild?.getAttribute("aria-label")?.trim()
  const cleanedSelectedLabel = cleanGuildName(label)
  if (cleanedSelectedLabel) return cleanedSelectedLabel

  return `Server ${guildId.slice(0, 6)}`
}

function readChannelName(channelId: string): string {
  const mainLabel = document
    .querySelector<HTMLElement>("main[aria-label]")
    ?.getAttribute("aria-label")
    ?.trim()
  const cleanedMainLabel = cleanChannelName(mainLabel)
  if (cleanedMainLabel) return cleanedMainLabel

  const messageListLabel = document
    .querySelector<HTMLElement>('[data-list-id="chat-messages"][aria-label]')
    ?.getAttribute("aria-label")
    ?.trim()
  const cleanedMessageListLabel = cleanChannelName(messageListLabel)
  if (cleanedMessageListLabel) return cleanedMessageListLabel

  const selectors = [
    '[data-list-item-id^="channels___"] [aria-selected="true"] [class*="name"]',
    "main h1",
    '[class*="title"]'
  ]

  for (const selector of selectors) {
    const text = document
      .querySelector<HTMLElement>(selector)
      ?.textContent?.trim()
    if (text) return text
  }

  return `Channel ${channelId.slice(0, 6)}`
}

function readViewerDisplayName(): string | null {
  const selectors = [
    '[class*="accountProfile"] [class*="title"]',
    '[class*="panels"] [class*="nameTag"] [class*="title"]',
    '[class*="panels"] [class*="panelTitleContainer"] [class*="title"]',
    '[aria-label*="Account"] [class*="title"]'
  ]

  for (const selector of selectors) {
    const text = document
      .querySelector<HTMLElement>(selector)
      ?.textContent?.trim()
    if (text) return text
  }

  return null
}

function readViewerAvatarUrl(): string | null {
  const selectors = [
    '[class*="panels"] [class*="avatarWrapper"] img',
    '[class*="accountProfile"] img[class*="avatar"]',
    '[aria-label*="Account"] img'
  ]

  for (const selector of selectors) {
    const src = document.querySelector<HTMLImageElement>(selector)?.src?.trim()
    if (src) return src
  }

  return null
}

function cleanGuildName(value: string | null | undefined): string | null {
  if (!value) return null

  const cleaned = value
    .replace(/\s*\(server\)$/i, "")
    .replace(/ unread messages?$/i, "")
    .trim()

  return cleaned || null
}

function cleanChannelName(value: string | null | undefined): string | null {
  if (!value) return null

  const cleaned = value
    .replace(/^Messages in\s+/i, "")
    .replace(/\s+chat$/i, "")
    .replace(/\s*\(channel\)$/i, "")
    .trim()

  return cleaned || null
}
