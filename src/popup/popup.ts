import {
  filterMessagesByView,
  getScrollTargetDate,
  listChannels,
  listGuilds,
  listReadinessStates,
  summarizeCoverage,
  summarizeLeaderboard
} from "../shared/leaderboard-query"
import { loadState, savePopupPreferences } from "../shared/storage"
import type {
  ChannelOption,
  DataReadiness,
  GuildOption,
  LeaderboardState,
  LeaderboardSummary,
  RankedContributor,
  TimeRangeKey
} from "../shared/types"

const ALL_CHANNELS_VALUE = "__all__"
const MIN_PROCESSING_MS = 600

const guildSelect = document.querySelector<HTMLSelectElement>("#guild-select")
const channelSelect =
  document.querySelector<HTMLSelectElement>("#channel-select")
const readinessStrip = document.querySelector<HTMLElement>("#readiness-strip")
const scoreInfoToggle =
  document.querySelector<HTMLButtonElement>("#score-info-toggle")
const scoreInfoPanel = document.querySelector<HTMLElement>("#score-info")
const syncStatusNode = document.querySelector<HTMLElement>("#sync-status")
const statusNode = document.querySelector<HTMLElement>("#status")
const leaderboardNode = document.querySelector<HTMLElement>("#leaderboard")

let currentState: LeaderboardState | null = null
let selectedGuildId: string | null = null
let selectedChannelId: string | null = null
let selectedTimeRange: TimeRangeKey = "30d"
let refreshInFlight = false

async function bootstrapPopup(): Promise<void> {
  if (
    !guildSelect ||
    !channelSelect ||
    !readinessStrip ||
    !statusNode ||
    !leaderboardNode
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
  guildSelect?.addEventListener("change", () => {
    selectedGuildId = guildSelect.value
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

  channelSelect?.addEventListener("change", () => {
    selectedChannelId = channelSelect.value
    void persistPopupPreferences()
    render()
  })

  scoreInfoToggle?.addEventListener("click", toggleScoreInfo)
}

function bindStorageListener(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return
    if (!changes.discordLeaderboardState) return

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
    !leaderboardNode
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

  const readinessStates = listReadinessStates({
    messages: currentState.messages,
    scopeObservations: currentState.scopeObservations,
    guildId: selectedGuildId,
    channelId: scopedChannelId
  })

  renderReadinessStates(readinessStates)
  renderLeaderboard(scopeLabel, leaderboardSummary)
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
  if (!statusNode || !readinessStrip || !leaderboardNode) return

  readinessStrip.innerHTML = `
    <span class="readiness-chip is-scroll">24h: Scroll more</span>
    <span class="readiness-chip is-scroll">7d: Scroll more</span>
    <span class="readiness-chip is-scroll">30d: Scroll more</span>
  `
  statusNode.hidden = false
  statusNode.textContent =
    "Open Discord in Chrome and browse a server to start collecting data."
  leaderboardNode.innerHTML = `<div class="empty-state">No contributors captured yet.</div>`
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

  await savePopupPreferences({
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
  const nextState = await loadState()

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

document.addEventListener("DOMContentLoaded", () => {
  void bootstrapPopup()
})
