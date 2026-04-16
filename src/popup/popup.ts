import {
  filterMessagesByView,
  getScrollTargetDate,
  listChannels,
  listGuilds,
  listReadinessStates,
  summarizeCoverage,
  summarizeLeaderboard,
  summarizeTreemap
} from "../shared/leaderboard-query"
import { loadState, savePopupPreferences } from "../shared/storage"
import type {
  ChannelOption,
  DataReadiness,
  GuildOption,
  LeaderboardState,
  LeaderboardSummary,
  RankedContributor,
  TimeRangeKey,
  TreemapSummary
} from "../shared/types"

const ALL_CHANNELS_VALUE = "__all__"
const MIN_PROCESSING_MS = 600
const TREEMAP_LAYOUT_SCALE = 100

type PopupStorageChangeListener = (
  changes: Record<string, unknown>,
  areaName: string
) => void

interface PopupRuntime {
  document: Document
  loadState: typeof loadState
  savePopupPreferences: typeof savePopupPreferences
  addStorageChangeListener: (listener: PopupStorageChangeListener) => void
}

let popupRuntime: PopupRuntime = createBrowserRuntime()
let guildSelect: HTMLSelectElement | null = null
let channelSelect: HTMLSelectElement | null = null
let readinessStrip: HTMLElement | null = null
let scoreInfoToggle: HTMLButtonElement | null = null
let scoreInfoPanel: HTMLElement | null = null
let syncStatusNode: HTMLElement | null = null
let statusNode: HTMLElement | null = null
let leaderboardNode: HTMLElement | null = null
let treemapNode: HTMLElement | null = null

let currentState: LeaderboardState | null = null
let selectedGuildId: string | null = null
let selectedChannelId: string | null = null
let selectedTimeRange: TimeRangeKey = "30d"
let refreshInFlight = false
let staticEventsBound = false
let storageListenerBound = false

export async function bootstrapPopup(
  runtimeOverrides: Partial<PopupRuntime> = {}
): Promise<void> {
  popupRuntime = {
    ...createBrowserRuntime(),
    ...runtimeOverrides
  }
  bindElements()
  staticEventsBound = false
  storageListenerBound = false

  if (
    !guildSelect ||
    !channelSelect ||
    !readinessStrip ||
    !statusNode ||
    !leaderboardNode ||
    !treemapNode
  )
    return

  await refreshState({ showLoading: true, preserveSelection: false })
  if (!currentState) return

  const guilds = listGuilds(currentState.messages)

  if (guilds.length === 0) {
    renderEmptyState()
    bindStaticEvents()
    bindStorageListener()
    return
  }

  const preferredGuildId = currentState.popupPreferences?.selectedGuildId
  const preferredChannelId = currentState.popupPreferences?.selectedChannelId
  const preferredTimeRange = currentState.popupPreferences?.selectedTimeRange

  selectedGuildId =
    preferredGuildId &&
    guilds.some((guild) => guild.guildId === preferredGuildId)
      ? preferredGuildId
      : guilds[0].guildId
  selectedChannelId = preferredChannelId ?? ALL_CHANNELS_VALUE
  selectedTimeRange = preferredTimeRange ?? "30d"

  bindStaticEvents()
  render()
  bindStorageListener()
}

function bindStaticEvents(): void {
  if (staticEventsBound) return
  staticEventsBound = true

  const boundGuildSelect = guildSelect
  const boundChannelSelect = channelSelect
  const boundScoreInfoToggle = scoreInfoToggle

  boundGuildSelect?.addEventListener("change", () => {
    selectedGuildId = boundGuildSelect.value
    const channels = listChannels(currentState?.messages ?? [], selectedGuildId)
    const preferredChannelId =
      currentState?.popupPreferences?.selectedChannelId ?? ALL_CHANNELS_VALUE
    selectedChannelId =
      preferredChannelId === ALL_CHANNELS_VALUE ||
      channels.some((channel) => channel.channelId === preferredChannelId)
        ? preferredChannelId
        : ALL_CHANNELS_VALUE

    void persistPopupPreferences()
    render()
  })

  boundChannelSelect?.addEventListener("change", () => {
    selectedChannelId = boundChannelSelect.value
    void persistPopupPreferences()
    render()
  })

  boundScoreInfoToggle?.addEventListener("click", toggleScoreInfo)
}

function bindStorageListener(): void {
  if (storageListenerBound) return
  storageListenerBound = true

  popupRuntime.addStorageChangeListener((changes, areaName) => {
    if (areaName !== "local") return
    if (!("discordLeaderboardState" in changes)) return

    void refreshState({
      showLoading: true,
      preserveSelection: true
    })
  })
}

function render(): void {
  if (
    !currentState ||
    !selectedGuildId ||
    !guildSelect ||
    !channelSelect ||
    !readinessStrip ||
    !statusNode ||
    !leaderboardNode ||
    !treemapNode
  ) {
    return
  }

  const guilds = listGuilds(currentState.messages)
  const channels = listChannels(currentState.messages, selectedGuildId)
  const resolvedChannelId = resolveChannelId(channels)
  const scopedChannelId =
    resolvedChannelId === ALL_CHANNELS_VALUE ? null : resolvedChannelId
  const scopeLabel = resolveScopeLabel(guilds, channels, resolvedChannelId)

  renderGuildOptions(guilds)
  renderChannelOptions(channels, resolvedChannelId)

  const filteredMessages = filterMessagesByView({
    messages: currentState.messages,
    guildId: selectedGuildId,
    scopeMode: scopedChannelId ? "channel" : "server",
    channelId: scopedChannelId,
    timeRange: selectedTimeRange
  })

  const leaderboardSummary = summarizeLeaderboard({
    messages: filteredMessages,
    viewerProfile: currentState.viewerProfile
  })
  const treemapSummary = summarizeTreemap({
    messages: filteredMessages,
    categories: currentState.categories,
    messageCategoryAssignments: currentState.messageCategoryAssignments
  })

  const readinessStates = listReadinessStates({
    messages: currentState.messages,
    scopeObservations: currentState.scopeObservations,
    guildId: selectedGuildId,
    channelId: scopedChannelId
  })

  renderReadinessStates(readinessStates)
  renderLeaderboard(scopeLabel, leaderboardSummary)
  renderTreemap(scopeLabel, treemapSummary)
  renderScrollTargetHint(selectedGuildId, scopedChannelId)
}

function renderGuildOptions(guilds: GuildOption[]): void {
  if (!guildSelect || !selectedGuildId) return

  guildSelect.innerHTML = guilds
    .map(
      (guild) =>
        `<option value="${escapeHtml(guild.guildId)}">${escapeHtml(guild.guildName)}</option>`
    )
    .join("")

  guildSelect.value = selectedGuildId
}

function renderChannelOptions(
  channels: ChannelOption[],
  resolvedChannelId: string
): void {
  if (!channelSelect) return

  const allOption = `<option value="${ALL_CHANNELS_VALUE}">All channels</option>`
  const channelOptions = channels
    .map(
      (channel) =>
        `<option value="${escapeHtml(channel.channelId)}">${escapeHtml(channel.channelName)}</option>`
    )
    .join("")

  channelSelect.innerHTML = `${allOption}${channelOptions}`
  channelSelect.value = resolvedChannelId
}

function renderReadinessStates(readinessStates: DataReadiness[]): void {
  if (!readinessStrip) return

  readinessStrip.innerHTML = readinessStates
    .map((state) => {
      const copy =
        state.status === "ready"
          ? "Ready"
          : state.status === "scroll"
            ? "Scroll more"
            : "Not up to date"

      return `<span class="readiness-chip is-${state.status}">${escapeHtml(state.label)}: ${escapeHtml(copy)}</span>`
    })
    .join("")
}

function renderLeaderboard(
  scopeLabel: string,
  summary: LeaderboardSummary
): void {
  if (!leaderboardNode) return

  const topTen = summary.ranked.slice(0, 10)
  const viewerOutsideTopTen =
    summary.viewer && summary.viewer.rank > 10 ? summary.viewer : null
  const bottomGapCard = renderGapCard(summary)

  leaderboardNode.innerHTML = `
    <div class="leaderboard-header">
      <h2 class="leaderboard-title">Discord Contributions Leaderboard</h2>
      <p class="leaderboard-subtitle">${escapeHtml(scopeLabel)}</p>
      <div class="time-tabs" role="tablist" aria-label="Time range">
        ${renderTimeTab("24h", "24h")}
        ${renderTimeTab("7d", "7d")}
        ${renderTimeTab("30d", "30d")}
      </div>
    </div>
    ${renderTopTen(topTen, summary.viewer?.authorKey ?? null)}
    ${viewerOutsideTopTen ? `<div class="you-divider">Your position</div>${renderContributorCard(viewerOutsideTopTen, viewerOutsideTopTen.authorKey)}` : ""}
    ${bottomGapCard}
  `

  bindTimeTabEvents()
}

function renderTreemap(scopeLabel: string, summary: TreemapSummary): void {
  if (!treemapNode) return

  treemapNode.innerHTML = `
    <div class="treemap-header">
      <h2 class="treemap-title">Category Composition</h2>
      <p class="treemap-subtitle">${escapeHtml(scopeLabel)}</p>
    </div>
    <div class="treemap-frame">
      ${renderTreemapSurface(summary)}
    </div>
  `
}

function renderTreemapSurface(summary: TreemapSummary): string {
  if (summary.totalMessages === 0) {
    return `<div class="treemap-empty">No captured messages in this slice yet.</div>`
  }

  const layout = createTreemapLayout(summary)

  return `
    <div class="treemap-chart" role="img" aria-label="Category composition treemap">
      ${layout
        .map(({ tile, rect }) => {
          return `
            <article
              class="treemap-tile"
              data-tile-id="${escapeHtml(tile.id)}"
              style="${buildTreemapTileStyle(rect)}"
            >
              <p class="treemap-tile-name">${escapeHtml(tile.label)}</p>
              <p class="treemap-tile-count">${tile.messageCount} messages</p>
              <p class="treemap-tile-share">${formatPercentage(tile.percentage)} of slice</p>
            </article>
          `
        })
        .join("")}
    </div>
  `
}

interface TreemapRect {
  top: number
  left: number
  width: number
  height: number
}

function createTreemapLayout(summary: TreemapSummary): Array<{
  tile: TreemapSummary["tiles"][number]
  rect: TreemapRect
}> {
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

function layoutTreemapTiles(
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

function findBalancedSplitIndex(tiles: TreemapSummary["tiles"]): number {
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

function sumTileCounts(tiles: TreemapSummary["tiles"]): number {
  return tiles.reduce((sum, tile) => sum + tile.messageCount, 0)
}

function buildTreemapTileStyle(rect: TreemapRect): string {
  return [
    `left:${formatTreemapDimension(rect.left)}%`,
    `top:${formatTreemapDimension(rect.top)}%`,
    `width:${formatTreemapDimension(rect.width)}%`,
    `height:${formatTreemapDimension(rect.height)}%`
  ].join(";")
}

function formatTreemapDimension(value: number): string {
  return value.toFixed(3)
}

function renderTopTen(
  topTen: RankedContributor[],
  viewerAuthorKey: string | null
): string {
  if (topTen.length === 0) {
    return `<div class="empty-state">No contributors captured for this slice yet.</div>`
  }

  return topTen
    .map((contributor) => renderContributorCard(contributor, viewerAuthorKey))
    .join("")
}

function renderGapCard(summary: LeaderboardSummary): string {
  if (!summary.viewer) return ""
  if (summary.viewer.rank <= 10) return ""
  if (summary.isTopTenOpen) return ""
  if (summary.gapToTopTen == null) return ""

  return `
    <article class="gap-card">
      <p class="gap-title">Leaderboard gap</p>
      <p class="gap-value">${formatScore(summary.gapToTopTen)} points to pass #10</p>
      <p class="gap-copy">Current #10 score: ${formatScore(summary.topTenScore ?? 0)} points.</p>
    </article>
  `
}

function renderContributorCard(
  contributor: RankedContributor,
  viewerAuthorKey: string | null
): string {
  const isViewer = viewerAuthorKey === contributor.authorKey

  return `
    <article class="leader-card ${isViewer ? "is-viewer" : ""}">
      <div class="leader-rank">#${contributor.rank}</div>
      ${renderAvatar(contributor.authorAvatarUrl, contributor.authorName)}
      <div class="leader-main">
        <div class="leader-name-row">
          <div class="leader-name">${escapeHtml(contributor.authorName)}</div>
          ${isViewer ? `<span class="you-pill">You</span>` : ""}
        </div>
        <div class="leader-meta">
          ${formatScore(contributor.score)} points · ${contributor.messageCount} messages · ${contributor.replyCount} replies
        </div>
      </div>
      <div class="leader-trailing">
        <div>${contributor.reactionCount} reactions</div>
        <div>${new Date(contributor.lastContributionAt).toLocaleDateString()}</div>
      </div>
    </article>
  `
}

function renderAvatar(avatarUrl: string | null, authorName: string): string {
  if (avatarUrl) {
    return `<img class="avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(authorName)} avatar" />`
  }

  return `<div class="avatar-fallback">${escapeHtml(authorName.trim().charAt(0).toUpperCase() || "?")}</div>`
}

function renderTimeTab(label: string, timeRange: TimeRangeKey): string {
  const isActive = selectedTimeRange === timeRange
  return `<button class="time-tab ${isActive ? "is-active" : ""}" data-range="${timeRange}" type="button">${label}</button>`
}

function bindTimeTabEvents(): void {
  leaderboardNode
    ?.querySelectorAll<HTMLButtonElement>(".time-tab")
    .forEach((button) => {
      button.addEventListener("click", () => {
        selectedTimeRange = button.dataset.range as TimeRangeKey
        void persistPopupPreferences()
        render()
      })
    })
}

function renderEmptyState(): void {
  if (!statusNode || !readinessStrip || !leaderboardNode || !treemapNode) return

  readinessStrip.innerHTML = `
    <span class="readiness-chip is-scroll">24h: Scroll more</span>
    <span class="readiness-chip is-scroll">7d: Scroll more</span>
    <span class="readiness-chip is-scroll">30d: Scroll more</span>
  `
  statusNode.hidden = false
  statusNode.textContent =
    "Open Discord in Chrome and browse a server to start collecting data."
  leaderboardNode.innerHTML = `<div class="empty-state">No contributors captured yet.</div>`
  treemapNode.innerHTML = `
    <div class="treemap-header">
      <h2 class="treemap-title">Category Composition</h2>
      <p class="treemap-subtitle">No server selected yet</p>
    </div>
    <div class="treemap-frame">
      <div class="treemap-empty">Capture Discord messages to see category composition.</div>
    </div>
  `
}

function resolveChannelId(channels: ChannelOption[]): string {
  if (selectedChannelId === ALL_CHANNELS_VALUE) return ALL_CHANNELS_VALUE
  if (
    selectedChannelId &&
    channels.some((channel) => channel.channelId === selectedChannelId)
  )
    return selectedChannelId

  selectedChannelId = ALL_CHANNELS_VALUE
  return ALL_CHANNELS_VALUE
}

async function persistPopupPreferences(): Promise<void> {
  if (!selectedGuildId || !selectedChannelId) return

  await popupRuntime.savePopupPreferences({
    selectedGuildId,
    selectedChannelId,
    selectedTimeRange
  })

  if (currentState) {
    currentState.popupPreferences = {
      selectedGuildId,
      selectedChannelId,
      selectedTimeRange
    }
  }
}

function renderScrollTargetHint(
  guildId: string,
  channelId: string | null
): void {
  if (!currentState || !statusNode) return

  if (refreshInFlight) {
    statusNode.hidden = false
    statusNode.textContent = "Processing..."
    return
  }

  const nextTarget = getNextScrollTarget(guildId, channelId)
  if (!nextTarget) {
    statusNode.hidden = true
    statusNode.textContent = ""
    return
  }

  statusNode.hidden = false
  statusNode.textContent = `Scroll to ${formatScrollTargetDate(nextTarget.targetDate)} to capture ${nextTarget.label}.`
}

function getNextScrollTarget(
  guildId: string,
  channelId: string | null
): { label: string; targetDate: Date } | null {
  if (!currentState) return null

  const ranges: Array<{ key: TimeRangeKey; label: string }> = [
    { key: "24h", label: "the last 24 hours" },
    { key: "7d", label: "the last 7 days" },
    { key: "30d", label: "the last 30 days" }
  ]

  for (const range of ranges) {
    const coverage = summarizeCoverage({
      messages: currentState.messages,
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

function formatScrollTargetDate(targetDate: Date): string {
  const day = String(targetDate.getDate()).padStart(2, "0")
  const month = String(targetDate.getMonth() + 1).padStart(2, "0")
  const year = String(targetDate.getFullYear())

  return `${day}/${month}/${year}`
}

async function refreshState(input: {
  showLoading: boolean
  preserveSelection: boolean
}): Promise<void> {
  if (refreshInFlight) return

  const refreshStartedAt = Date.now()
  refreshInFlight = true
  setSyncStatus(input.showLoading)

  const previousGuildId = selectedGuildId
  const previousChannelId = selectedChannelId
  const nextState = await popupRuntime.loadState()

  currentState = nextState

  if (!input.preserveSelection) {
    refreshInFlight = false
    setSyncStatus(false)
    return
  }

  const guilds = listGuilds(nextState.messages)
  if (guilds.length === 0) {
    refreshInFlight = false
    setSyncStatus(false)
    renderEmptyState()
    return
  }

  const preferredGuildId =
    previousGuildId ?? nextState.popupPreferences?.selectedGuildId
  selectedGuildId =
    preferredGuildId &&
    guilds.some((guild) => guild.guildId === preferredGuildId)
      ? preferredGuildId
      : guilds[0].guildId

  if (!selectedGuildId) {
    refreshInFlight = false
    setSyncStatus(false)
    return
  }

  const resolvedGuildId = selectedGuildId
  const channels = listChannels(nextState.messages, resolvedGuildId)
  const preferredChannelId =
    previousChannelId ??
    nextState.popupPreferences?.selectedChannelId ??
    ALL_CHANNELS_VALUE
  selectedChannelId =
    preferredChannelId === ALL_CHANNELS_VALUE ||
    channels.some((channel) => channel.channelId === preferredChannelId)
      ? preferredChannelId
      : ALL_CHANNELS_VALUE

  if (input.showLoading) {
    await waitForMinimumProcessingWindow(refreshStartedAt)
  }

  refreshInFlight = false
  setSyncStatus(false)
  render()
}

function setSyncStatus(isVisible: boolean): void {
  if (syncStatusNode) {
    syncStatusNode.hidden = true
  }

  if (!statusNode) return
  if (!isVisible) return

  statusNode.hidden = false
  statusNode.textContent = "Processing..."
}

async function waitForMinimumProcessingWindow(
  refreshStartedAt: number
): Promise<void> {
  const remainingMs = MIN_PROCESSING_MS - (Date.now() - refreshStartedAt)
  if (remainingMs <= 0) return

  await new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), remainingMs)
  })
}

function resolveScopeLabel(
  guilds: GuildOption[],
  channels: ChannelOption[],
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

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function formatPercentage(percentage: number): string {
  return Number.isInteger(percentage)
    ? `${percentage}%`
    : `${percentage.toFixed(1)}%`
}

function toggleScoreInfo(): void {
  if (!scoreInfoPanel || !scoreInfoToggle) return

  const nextExpanded = scoreInfoPanel.hidden
  scoreInfoPanel.hidden = !nextExpanded
  scoreInfoToggle.setAttribute("aria-expanded", String(nextExpanded))
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function bindElements(): void {
  const { document } = popupRuntime

  guildSelect = document.querySelector<HTMLSelectElement>("#guild-select")
  channelSelect = document.querySelector<HTMLSelectElement>("#channel-select")
  readinessStrip = document.querySelector<HTMLElement>("#readiness-strip")
  scoreInfoToggle =
    document.querySelector<HTMLButtonElement>("#score-info-toggle")
  scoreInfoPanel = document.querySelector<HTMLElement>("#score-info")
  syncStatusNode = document.querySelector<HTMLElement>("#sync-status")
  statusNode = document.querySelector<HTMLElement>("#status")
  leaderboardNode = document.querySelector<HTMLElement>("#leaderboard")
  treemapNode = document.querySelector<HTMLElement>("#treemap")
}

function createBrowserRuntime(): PopupRuntime {
  return {
    document,
    loadState,
    savePopupPreferences,
    addStorageChangeListener: (listener) => {
      chrome.storage.onChanged.addListener(listener)
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void bootstrapPopup()
})
