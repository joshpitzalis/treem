import { createCategoryPalette } from "../shared/category-palette"
import {
  getScrollTargetDate,
  listChannels,
  listGuilds,
  summarizeCoverage
} from "../shared/leaderboard-query"
import type {
  ChannelOption,
  DataReadiness,
  GuildOption,
  LeaderboardState,
  TimeRangeKey,
  TreemapSummary
} from "../shared/types"
import { ALL_CHANNELS_VALUE } from "./constants"
import type {
  PopupSelection,
  RefreshRequest,
  TreemapRect,
  TreemapTileDensity
} from "./types"

const MIN_PROCESSING_MS = 600
const TREEMAP_LAYOUT_SCALE = 100

export function ensurePopupMountNode(document: Document): HTMLElement {
  const existingRoot = document.querySelector<HTMLElement>("#popup-root")
  if (existingRoot) return existingRoot

  const root = document.createElement("div")
  root.id = "popup-root"
  document.body.append(root)
  return root
}

export function resolveInitialSelection(
  state: LeaderboardState
): PopupSelection {
  const guilds = listGuilds(state.messages)
  const preferredGuildId = state.popupPreferences?.selectedGuildId
  const guildId =
    preferredGuildId &&
    guilds.some((guild) => guild.guildId === preferredGuildId)
      ? preferredGuildId
      : (guilds[0]?.guildId ?? null)

  if (!guildId) {
    return {
      guildId: null,
      channelId: ALL_CHANNELS_VALUE,
      timeRange: state.popupPreferences?.selectedTimeRange ?? "30d"
    }
  }

  const channels = listChannels(state.messages, guildId)
  const preferredChannelId =
    state.popupPreferences?.selectedChannelId ?? ALL_CHANNELS_VALUE

  return {
    guildId,
    channelId: resolveChannelId(preferredChannelId, channels),
    timeRange: state.popupPreferences?.selectedTimeRange ?? "30d"
  }
}

export function resolvePreservedSelection(
  state: LeaderboardState,
  previousSelection: PopupSelection
): PopupSelection {
  const guilds = listGuilds(state.messages)
  const preferredGuildId =
    previousSelection.guildId ?? state.popupPreferences?.selectedGuildId
  const guildId =
    preferredGuildId &&
    guilds.some((guild) => guild.guildId === preferredGuildId)
      ? preferredGuildId
      : (guilds[0]?.guildId ?? null)

  if (!guildId) {
    return {
      guildId: null,
      channelId: ALL_CHANNELS_VALUE,
      timeRange: previousSelection.timeRange
    }
  }

  const channels = listChannels(state.messages, guildId)
  const preferredChannelId =
    previousSelection.channelId ??
    state.popupPreferences?.selectedChannelId ??
    ALL_CHANNELS_VALUE

  return {
    guildId,
    channelId: resolveChannelId(preferredChannelId, channels),
    timeRange: previousSelection.timeRange
  }
}

export function mergeRefreshRequests(
  current: RefreshRequest | null,
  next: RefreshRequest
): RefreshRequest {
  if (!current) return next

  return {
    showLoading: current.showLoading || next.showLoading
  }
}

export function createEmptyReadinessStates(): DataReadiness[] {
  return [
    { label: "24h", status: "scroll", timeRange: "24h" },
    { label: "7d", status: "scroll", timeRange: "7d" },
    { label: "30d", status: "scroll", timeRange: "30d" }
  ]
}

export function getScrollHint(
  state: LeaderboardState,
  guildId: string,
  channelId: string | null
): string {
  const nextTarget = getNextScrollTarget(state, guildId, channelId)
  if (!nextTarget) return ""
  return `Scroll to ${formatScrollTargetDate(nextTarget.targetDate)} to capture ${nextTarget.label}.`
}

export function getNextScrollTarget(
  state: LeaderboardState,
  guildId: string,
  channelId: string | null
): { label: string; targetDate: Date } | null {
  const ranges: Array<{ key: TimeRangeKey; label: string }> = [
    { key: "24h", label: "the last 24 hours" },
    { key: "7d", label: "the last 7 days" },
    { key: "30d", label: "the last 30 days" }
  ]

  for (const range of ranges) {
    const coverage = summarizeCoverage({
      messages: state.messages,
      guildId,
      scopeMode: channelId ? "channel" : "server",
      channelId,
      timeRange: range.key
    })

    if (!coverage.isWindowFullyCovered) {
      return {
        label: range.label,
        targetDate: getScrollTargetDate(range.key)
      }
    }
  }

  return null
}

export function resolveChannelId(
  selectedChannelId: string,
  channels: ChannelOption[]
): string {
  if (selectedChannelId === ALL_CHANNELS_VALUE) return ALL_CHANNELS_VALUE
  if (channels.some((channel) => channel.channelId === selectedChannelId)) {
    return selectedChannelId
  }

  return ALL_CHANNELS_VALUE
}

export function resolveScopeLabel(
  guilds: GuildOption[],
  channels: ChannelOption[],
  selectedGuildId: string | null,
  resolvedChannelId: string
): string {
  const guildName =
    guilds.find((guild) => guild.guildId === selectedGuildId)?.guildName ??
    "Server"
  if (resolvedChannelId === ALL_CHANNELS_VALUE) return guildName

  const channelName =
    channels.find((channel) => channel.channelId === resolvedChannelId)
      ?.channelName ?? "Channel"
  return `${guildName} / #${channelName}`
}

export function formatScrollTargetDate(targetDate: Date): string {
  const day = String(targetDate.getDate()).padStart(2, "0")
  const month = String(targetDate.getMonth() + 1).padStart(2, "0")
  const year = String(targetDate.getFullYear())

  return `${day}/${month}/${year}`
}

export async function waitForMinimumProcessingWindow(
  runtimeWindow: Window,
  refreshStartedAt: number
): Promise<void> {
  const remainingMs = MIN_PROCESSING_MS - (Date.now() - refreshStartedAt)
  if (remainingMs <= 0) return

  await new Promise<void>((resolve) => {
    runtimeWindow.setTimeout(() => resolve(), remainingMs)
  })
}

export function createTreemapLayout(summary: TreemapSummary): Array<{
  tile: TreemapSummary["tiles"][number]
  rect: TreemapRect
}> {
  if (summary.totalMessages === 0) return []

  return layoutTreemapTiles(
    summary.tiles,
    {
      top: 0,
      left: 0,
      width: TREEMAP_LAYOUT_SCALE,
      height: TREEMAP_LAYOUT_SCALE
    },
    "vertical"
  )
}

export function layoutTreemapTiles(
  tiles: TreemapSummary["tiles"],
  bounds: TreemapRect,
  orientation: "horizontal" | "vertical"
): Array<{ tile: TreemapSummary["tiles"][number]; rect: TreemapRect }> {
  if (tiles.length === 0) return []

  if (tiles.length === 1) {
    return [{ tile: tiles[0], rect: bounds }]
  }

  const splitIndex = findBalancedSplitIndex(tiles)
  const firstGroup = tiles.slice(0, splitIndex)
  const secondGroup = tiles.slice(splitIndex)
  const firstCount = sumTileCounts(firstGroup)
  const totalCount = firstCount + sumTileCounts(secondGroup)
  const firstRatio = totalCount === 0 ? 0 : firstCount / totalCount

  if (orientation === "vertical") {
    const firstWidth = bounds.width * firstRatio

    return [
      ...layoutTreemapTiles(
        firstGroup,
        {
          ...bounds,
          width: firstWidth
        },
        "horizontal"
      ),
      ...layoutTreemapTiles(
        secondGroup,
        {
          ...bounds,
          left: bounds.left + firstWidth,
          width: bounds.width - firstWidth
        },
        "horizontal"
      )
    ]
  }

  const firstHeight = bounds.height * firstRatio

  return [
    ...layoutTreemapTiles(
      firstGroup,
      {
        ...bounds,
        height: firstHeight
      },
      "vertical"
    ),
    ...layoutTreemapTiles(
      secondGroup,
      {
        ...bounds,
        top: bounds.top + firstHeight,
        height: bounds.height - firstHeight
      },
      "vertical"
    )
  ]
}

export function findBalancedSplitIndex(tiles: TreemapSummary["tiles"]): number {
  const totalCount = sumTileCounts(tiles)
  let runningCount = 0

  for (const [index, tile] of tiles.entries()) {
    runningCount += tile.messageCount
    if (runningCount >= totalCount / 2) {
      return Math.min(index + 1, tiles.length - 1)
    }
  }

  return 1
}

export function sumTileCounts(tiles: TreemapSummary["tiles"]): number {
  return tiles.reduce((sum, tile) => sum + tile.messageCount, 0)
}

export function describeTreemapTileDensity(
  rect: TreemapRect
): TreemapTileDensity {
  const area = rect.width * rect.height

  if (area >= 2600) return "large"
  if (area >= 1200) return "medium"
  if (area >= 500) return "small"
  return "tiny"
}

export function buildTreemapTileStyle(
  rect: TreemapRect,
  tileId: string,
  variantIndex = 0
): React.CSSProperties {
  const palette = createTreemapTilePalette(tileId)
  const separatorOpacity = 0.86 + (variantIndex % 3) * 0.04

  return {
    left: `${formatTreemapDimension(rect.left)}%`,
    top: `${formatTreemapDimension(rect.top)}%`,
    width: `${formatTreemapDimension(rect.width)}%`,
    height: `${formatTreemapDimension(rect.height)}%`,
    ["--treemap-fill-start" as string]: palette.start,
    ["--treemap-fill-end" as string]: palette.end,
    ["--treemap-fill-accent" as string]: palette.accent,
    ["--treemap-separator" as string]: `rgba(255, 248, 239, ${separatorOpacity})`
  }
}

export function formatTreemapDimension(value: number): string {
  return value.toFixed(3)
}

export function createTreemapTilePalette(tileId: string): {
  start: string
  end: string
  accent: string
} {
  return createCategoryPalette(tileId)
}

export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

export function formatPercentage(percentage: number): string {
  return Number.isInteger(percentage)
    ? `${percentage}%`
    : `${percentage.toFixed(1)}%`
}
