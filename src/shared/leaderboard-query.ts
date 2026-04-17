import type {
  CategoryRecord,
  ChannelOption,
  ContributionMessage,
  CoverageSummary,
  DataReadiness,
  GuildOption,
  LeaderboardSummary,
  MessageCategoryAssignment,
  RankedContributor,
  ScopeMode,
  ScopeObservation,
  TimeRangeKey,
  TreemapSummary,
  ViewerProfile
} from "./types"

const DAY_IN_MS = 24 * 60 * 60 * 1000
const STALE_OBSERVATION_WINDOW_MS = 20 * 60 * 1000

export function createAuthorKey(
  authorName: string,
  authorAvatarUrl: string | null
): string {
  const normalizedName = normalizeName(authorName)
  const normalizedAvatar = normalizeAvatar(authorAvatarUrl)

  return normalizedAvatar
    ? `${normalizedName}::${normalizedAvatar}`
    : normalizedName
}

export function listGuilds(messages: ContributionMessage[]): GuildOption[] {
  const byGuild = new Map<string, GuildOption>()

  for (const message of messages) {
    const existing = byGuild.get(message.guildId)

    if (!existing) {
      byGuild.set(message.guildId, {
        guildId: message.guildId,
        guildName: message.guildName,
        messageCount: 1
      })
      continue
    }

    existing.messageCount += 1
    existing.guildName = pickHumanName(existing.guildName, message.guildName)
  }

  return Array.from(byGuild.values()).sort(
    (left, right) => right.messageCount - left.messageCount
  )
}

export function listChannels(
  messages: ContributionMessage[],
  guildId: string
): ChannelOption[] {
  const byChannel = new Map<string, ChannelOption>()

  for (const message of messages) {
    if (message.guildId !== guildId) continue

    const existing = byChannel.get(message.channelId)

    if (!existing) {
      byChannel.set(message.channelId, {
        channelId: message.channelId,
        channelName: message.channelName,
        messageCount: 1
      })
      continue
    }

    existing.messageCount += 1
    existing.channelName = pickHumanName(
      existing.channelName,
      message.channelName
    )
  }

  return Array.from(byChannel.values()).sort(
    (left, right) => right.messageCount - left.messageCount
  )
}

export function summarizeLeaderboard(input: {
  messages: ContributionMessage[]
  viewerProfile: ViewerProfile | null
}): LeaderboardSummary {
  const ranked = rankContributors(input.messages)
  const viewer = findViewerRankedContributor(ranked, input.viewerProfile)
  const tenthContributor = ranked[9] ?? null
  const topTenScore = tenthContributor?.score ?? null

  return {
    ranked,
    viewer,
    topTenScore,
    gapToTopTen: calculateGapToTopTen(viewer, topTenScore, ranked.length),
    isTopTenOpen: ranked.length < 10,
    totalMessages: input.messages.length
  }
}

export function summarizeTreemap(input: {
  messages: ContributionMessage[]
  categories: CategoryRecord[]
  messageCategoryAssignments: MessageCategoryAssignment[]
}): TreemapSummary {
  const topLevelMessages = input.messages.filter((message) => !message.isReply)
  const totalMessages = topLevelMessages.length

  if (totalMessages === 0) {
    return {
      totalMessages,
      tiles: []
    }
  }

  const categoriesById = new Map(
    input.categories.map((category) => [category.id, category] as const)
  )
  const assignmentsByMessageId = new Map(
    input.messageCategoryAssignments.map((assignment) => [
      assignment.messageId,
      assignment
    ])
  )
  const categoryCounts = new Map<string, number>()
  let uncategorizedCount = 0

  for (const message of topLevelMessages) {
    const assignment = assignmentsByMessageId.get(message.id)
    if (!assignment) {
      uncategorizedCount += 1
      continue
    }

    const category = categoriesById.get(assignment.categoryId)
    if (!category) {
      uncategorizedCount += 1
      continue
    }

    categoryCounts.set(category.id, (categoryCounts.get(category.id) ?? 0) + 1)
  }

  const tiles = Array.from(categoryCounts.entries()).map(
    ([categoryId, messageCount]) => {
      const category = categoriesById.get(categoryId)
      if (!category) {
        throw new Error(`Missing category for treemap tile: ${categoryId}`)
      }

      return {
        id: category.id,
        label: category.name,
        messageCount,
        percentage: roundPercentage((messageCount / totalMessages) * 100)
      }
    }
  )

  if (uncategorizedCount > 0) {
    tiles.push({
      id: "uncategorized",
      label: "Uncategorized",
      messageCount: uncategorizedCount,
      percentage: roundPercentage((uncategorizedCount / totalMessages) * 100)
    })
  }

  tiles.sort((left, right) => right.messageCount - left.messageCount)

  return {
    totalMessages,
    tiles
  }
}

export function rankContributors(
  messages: ContributionMessage[]
): RankedContributor[] {
  const byContributor = new Map<string, RankedContributor>()

  for (const message of messages) {
    const existing = byContributor.get(message.authorKey)

    if (!existing) {
      byContributor.set(message.authorKey, {
        rank: 0,
        authorKey: message.authorKey,
        authorName: message.authorName,
        authorAvatarUrl: message.authorAvatarUrl,
        score: message.score,
        messageCount: 1,
        replyCount: message.isReply ? 1 : 0,
        attachmentCount: message.attachmentCount,
        reactionCount: message.reactionCount,
        lastContributionAt: message.messageTimestamp
      })
      continue
    }

    existing.score += message.score
    existing.messageCount += 1
    existing.replyCount += message.isReply ? 1 : 0
    existing.attachmentCount += message.attachmentCount
    existing.reactionCount += message.reactionCount
    existing.authorAvatarUrl =
      existing.authorAvatarUrl ?? message.authorAvatarUrl
    existing.authorName = pickHumanName(existing.authorName, message.authorName)

    if (
      Date.parse(message.messageTimestamp) >
      Date.parse(existing.lastContributionAt)
    ) {
      existing.lastContributionAt = message.messageTimestamp
    }
  }

  return Array.from(byContributor.values())
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (right.messageCount !== left.messageCount)
        return right.messageCount - left.messageCount
      return (
        Date.parse(right.lastContributionAt) -
        Date.parse(left.lastContributionAt)
      )
    })
    .map((contributor, index) => ({
      ...contributor,
      rank: index + 1
    }))
}

export function filterMessagesByView(input: {
  messages: ContributionMessage[]
  guildId: string
  scopeMode: ScopeMode
  channelId: string | null
  timeRange: TimeRangeKey
  now?: number
}): ContributionMessage[] {
  const cutoff = getTimeWindowStart(input.timeRange, input.now ?? Date.now())

  return input.messages.filter((message) => {
    if (message.guildId !== input.guildId) return false
    if (input.scopeMode === "channel" && message.channelId !== input.channelId)
      return false

    const timestamp = Date.parse(message.messageTimestamp)
    return Number.isFinite(timestamp) && timestamp >= cutoff
  })
}

export function summarizeCoverage(input: {
  messages: ContributionMessage[]
  guildId: string
  scopeMode: ScopeMode
  channelId: string | null
  timeRange: TimeRangeKey
  now?: number
}): CoverageSummary {
  const now = input.now ?? Date.now()
  const targetMs = getTimeWindowDuration(input.timeRange)
  const scopedMessages = input.messages.filter((message) => {
    if (message.guildId !== input.guildId) return false
    if (input.scopeMode === "channel" && message.channelId !== input.channelId)
      return false
    return true
  })

  const sortedTimestamps = scopedMessages
    .map((message) => Date.parse(message.messageTimestamp))
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((left, right) => left - right)

  if (sortedTimestamps.length === 0) {
    return {
      targetMs,
      oldestMessageAt: null,
      newestMessageAt: null,
      coverageMs: 0,
      missingMs: targetMs,
      capturedMessageCount: 0,
      capturedContributorCount: 0,
      isWindowFullyCovered: false
    }
  }

  const oldestTimestamp = sortedTimestamps[0]
  const newestTimestamp = sortedTimestamps[sortedTimestamps.length - 1]
  const coverageMs = Math.min(targetMs, Math.max(0, now - oldestTimestamp))
  const contributorCount = rankContributors(scopedMessages).length
  const scrollTargetDate = getScrollTargetDate(input.timeRange, now)
  const oldestCapturedDate = toLocalDayStart(oldestTimestamp)

  return {
    targetMs,
    oldestMessageAt: new Date(oldestTimestamp).toISOString(),
    newestMessageAt: new Date(newestTimestamp).toISOString(),
    coverageMs,
    missingMs: Math.max(0, targetMs - coverageMs),
    capturedMessageCount: scopedMessages.length,
    capturedContributorCount: contributorCount,
    isWindowFullyCovered: oldestCapturedDate <= scrollTargetDate.getTime()
  }
}

export function listReadinessStates(input: {
  messages: ContributionMessage[]
  scopeObservations: ScopeObservation[]
  guildId: string
  channelId: string | null
  now?: number
}): DataReadiness[] {
  return (["24h", "7d", "30d"] as TimeRangeKey[]).map((timeRange) => {
    const coverage = summarizeCoverage({
      messages: input.messages,
      guildId: input.guildId,
      scopeMode: input.channelId ? "channel" : "server",
      channelId: input.channelId,
      timeRange,
      now: input.now
    })

    const hasFreshObservation = scopeHasFreshObservation({
      scopeObservations: input.scopeObservations,
      guildId: input.guildId,
      channelId: input.channelId,
      now: input.now ?? Date.now()
    })

    return {
      timeRange,
      status: toReadinessStatus(coverage, hasFreshObservation),
      label: getCompactTimeWindowLabel(timeRange)
    }
  })
}

export function getTimeWindowDuration(timeRange: TimeRangeKey): number {
  if (timeRange === "24h") return DAY_IN_MS
  if (timeRange === "7d") return 7 * DAY_IN_MS
  return 30 * DAY_IN_MS
}

export function getTimeWindowLabel(timeRange: TimeRangeKey): string {
  if (timeRange === "24h") return "Last 24 hours"
  if (timeRange === "7d") return "Last 7 days"
  return "Last 30 days"
}

export function getCompactTimeWindowLabel(timeRange: TimeRangeKey): string {
  if (timeRange === "24h") return "24H"
  if (timeRange === "7d") return "7D"
  return "30D"
}

export function formatCoverageDistance(durationMs: number): string {
  const hours = durationMs / (60 * 60 * 1000)

  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`

  const days = durationMs / DAY_IN_MS
  return `${days.toFixed(days < 10 ? 1 : 0)}d`
}

export function getScrollTargetDate(
  timeRange: TimeRangeKey,
  now: number = Date.now()
): Date {
  const target = new Date(now - getTimeWindowDuration(timeRange))
  target.setHours(0, 0, 0, 0)
  target.setDate(target.getDate() - 1)
  return target
}

function findViewerRankedContributor(
  ranked: RankedContributor[],
  viewerProfile: ViewerProfile | null
): RankedContributor | null {
  if (!viewerProfile) return null

  const keySet = new Set(viewerProfile.authorKeys)
  const normalizedDisplayName = normalizeName(viewerProfile.displayName)

  return (
    ranked.find((contributor) => {
      if (keySet.has(contributor.authorKey)) return true
      return normalizeName(contributor.authorName) === normalizedDisplayName
    }) ?? null
  )
}

function calculateGapToTopTen(
  viewer: RankedContributor | null,
  topTenScore: number | null,
  contributorCount: number
): number | null {
  if (viewer && viewer.rank <= 10) return 0
  if (contributorCount < 10) return 0
  if (topTenScore == null) return null

  const viewerScore = viewer?.score ?? 0
  return Math.max(0, roundScore(topTenScore - viewerScore + 0.5))
}

function getTimeWindowStart(timeRange: TimeRangeKey, now: number): number {
  return now - getTimeWindowDuration(timeRange)
}

function scopeHasFreshObservation(input: {
  scopeObservations: ScopeObservation[]
  guildId: string
  channelId: string | null
  now: number
}): boolean {
  if (input.channelId) {
    return input.scopeObservations.some((observation) => {
      if (observation.guildId !== input.guildId) return false
      if (observation.channelId !== input.channelId) return false
      if (!observation.sawLiveEdge) return false

      const capturedAt = Date.parse(observation.capturedAt)
      return (
        Number.isFinite(capturedAt) &&
        capturedAt >= input.now - STALE_OBSERVATION_WINDOW_MS
      )
    })
  }

  const guildObservations = input.scopeObservations.filter(
    (observation) => observation.guildId === input.guildId
  )
  if (guildObservations.length === 0) return false

  const channelIds = new Set(
    guildObservations.map((observation) => observation.channelId)
  )
  if (channelIds.size === 0) return false

  for (const channelId of channelIds) {
    const hasFreshChannelObservation = guildObservations.some((observation) => {
      if (observation.channelId !== channelId) return false
      if (!observation.sawLiveEdge) return false

      const capturedAt = Date.parse(observation.capturedAt)
      return (
        Number.isFinite(capturedAt) &&
        capturedAt >= input.now - STALE_OBSERVATION_WINDOW_MS
      )
    })

    if (!hasFreshChannelObservation) return false
  }

  return true
}

function toReadinessStatus(
  coverage: CoverageSummary,
  hasFreshObservation: boolean
): DataReadiness["status"] {
  if (!coverage.isWindowFullyCovered) return "scroll"
  return hasFreshObservation ? "ready" : "stale"
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeAvatar(value: string | null): string {
  if (!value) return ""

  try {
    const url = new URL(value)
    url.search = ""
    return url.toString()
  } catch {
    return value
  }
}

function pickHumanName(currentName: string, nextName: string): string {
  const currentLooksLikeFallback = /^(Server|Channel)\s/.test(currentName)
  const nextLooksLikeFallback = /^(Server|Channel)\s/.test(nextName)

  if (currentLooksLikeFallback && !nextLooksLikeFallback) return nextName
  if (!currentLooksLikeFallback && nextLooksLikeFallback) return currentName

  return nextName.length > currentName.length ? nextName : currentName
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10
}

function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10
}

function toLocalDayStart(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}
