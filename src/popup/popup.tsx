import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
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

interface PopupSelection {
  guildId: string | null
  channelId: string
  timeRange: TimeRangeKey
}

interface RefreshRequest {
  showLoading: boolean
}

let popupRuntime: PopupRuntime = createBrowserRuntime()
let popupRoot: Root | null = null
let popupMountNode: HTMLElement | null = null
let renderKey = 0

export async function bootstrapPopup(
  runtimeOverrides: Partial<PopupRuntime> = {}
): Promise<void> {
  popupRuntime = {
    ...createBrowserRuntime(),
    ...runtimeOverrides
  }

  const mountNode = ensurePopupMountNode(popupRuntime.document)
  const initialState = await popupRuntime.loadState()
  const initialSelection = resolveInitialSelection(initialState)

  if (!popupRoot || popupMountNode !== mountNode) {
    popupRoot = createRoot(mountNode)
    popupMountNode = mountNode
  }

  renderKey += 1

  flushSync(() => {
    popupRoot?.render(
      <PopupApp
        key={renderKey}
        runtime={popupRuntime}
        initialState={initialState}
        initialSelection={initialSelection}
      />
    )
  })
}

function PopupApp(input: {
  runtime: PopupRuntime
  initialState: LeaderboardState
  initialSelection: PopupSelection
}) {
  const [currentState, setCurrentState] = useState(input.initialState)
  const [selection, setSelection] = useState(input.initialSelection)
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState("")
  const [refreshInFlight, setRefreshInFlight] = useState(false)

  const refreshInFlightRef = useRef(false)
  const queuedRefreshRef = useRef<RefreshRequest | null>(null)
  const syncStatusTimeoutIdRef = useRef<number | null>(null)
  const currentStateRef = useRef(currentState)
  const selectionRef = useRef(selection)
  const runtimeWindow = input.runtime.document.defaultView ?? window

  useEffect(() => {
    currentStateRef.current = currentState
  }, [currentState])

  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  useEffect(() => {
    input.runtime.addStorageChangeListener((changes, areaName) => {
      if (areaName !== "local") return
      if (!("discordLeaderboardState" in changes)) return

      void requestRefresh({ showLoading: true })
    })
  }, [input.runtime])

  useEffect(() => {
    return () => {
      if (syncStatusTimeoutIdRef.current == null) return

      runtimeWindow.clearTimeout(syncStatusTimeoutIdRef.current)
    }
  }, [runtimeWindow])

  const guilds = listGuilds(currentState.messages)

  const selectedGuildId =
    selection.guildId && guilds.some((guild) => guild.guildId === selection.guildId)
      ? selection.guildId
      : guilds[0]?.guildId ?? null
  const channels = selectedGuildId
    ? listChannels(currentState.messages, selectedGuildId)
    : []
  const resolvedChannelId = resolveChannelId(selection.channelId, channels)
  const scopedChannelId =
    resolvedChannelId === ALL_CHANNELS_VALUE ? null : resolvedChannelId
  const scopeLabel =
    guilds.length === 0
      ? "No server selected yet"
      : resolveScopeLabel(guilds, channels, selectedGuildId, resolvedChannelId)

  const filteredMessages =
    selectedGuildId == null
      ? []
      : filterMessagesByView({
          messages: currentState.messages,
          guildId: selectedGuildId,
          scopeMode: scopedChannelId ? "channel" : "server",
          channelId: scopedChannelId,
          timeRange: selection.timeRange
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
  const readinessStates =
    selectedGuildId == null
      ? createEmptyReadinessStates()
      : listReadinessStates({
          messages: currentState.messages,
          scopeObservations: currentState.scopeObservations,
          guildId: selectedGuildId,
          channelId: scopedChannelId
        })

  const statusText =
    guilds.length === 0
      ? "Open Discord in Chrome and browse a server to start collecting data."
      : refreshInFlight
        ? ""
        : getScrollHint(
            currentState,
            selectedGuildId,
            scopedChannelId
          )

  async function requestRefresh(nextRequest: RefreshRequest): Promise<void> {
    if (refreshInFlightRef.current) {
      queuedRefreshRef.current = mergeRefreshRequests(
        queuedRefreshRef.current,
        nextRequest
      )
      return
    }

    refreshInFlightRef.current = true
    setRefreshInFlight(true)

    try {
      let pendingRefresh: RefreshRequest | null = nextRequest

      while (pendingRefresh) {
        queuedRefreshRef.current = null
        await runRefresh(pendingRefresh)
        pendingRefresh = queuedRefreshRef.current
      }
    } finally {
      refreshInFlightRef.current = false
      queuedRefreshRef.current = null
      setRefreshInFlight(false)
    }
  }

  async function runRefresh(request: RefreshRequest): Promise<void> {
    const refreshStartedAt = Date.now()
    setSyncStatusMessage(request.showLoading ? "Updating..." : "")

    const nextState = await input.runtime.loadState()
    const nextSelection = resolvePreservedSelection(
      nextState,
      selectionRef.current
    )

    setCurrentState(nextState)
    setSelection(nextSelection)

    if (request.showLoading) {
      await waitForMinimumProcessingWindow(runtimeWindow, refreshStartedAt)
      flashSyncStatusMessage("Updated")
      return
    }

    setSyncStatusMessage("")
  }

  async function handleGuildChange(nextGuildId: string) {
    const preferredChannelId =
      currentStateRef.current.popupPreferences?.selectedChannelId ??
      ALL_CHANNELS_VALUE
    const nextChannels = listChannels(currentStateRef.current.messages, nextGuildId)
    const nextChannelId = resolveChannelId(preferredChannelId, nextChannels)
    const nextSelection = {
      guildId: nextGuildId,
      channelId: nextChannelId,
      timeRange: selectionRef.current.timeRange
    }

    setSelection(nextSelection)
    await persistPopupPreferences(nextSelection)
  }

  async function handleChannelChange(nextChannelId: string) {
    const nextSelection = {
      ...selectionRef.current,
      channelId: nextChannelId
    }

    setSelection(nextSelection)
    await persistPopupPreferences(nextSelection)
  }

  async function handleTimeRangeChange(nextTimeRange: TimeRangeKey) {
    const nextSelection = {
      ...selectionRef.current,
      timeRange: nextTimeRange
    }

    setSelection(nextSelection)
    await persistPopupPreferences(nextSelection)
  }

  async function persistPopupPreferences(
    nextSelection: PopupSelection
  ): Promise<void> {
    if (!nextSelection.guildId) return

    await input.runtime.savePopupPreferences({
      selectedGuildId: nextSelection.guildId,
      selectedChannelId: nextSelection.channelId,
      selectedTimeRange: nextSelection.timeRange
    })

    setCurrentState((previousState) => ({
      ...previousState,
      popupPreferences: {
        selectedGuildId: nextSelection.guildId,
        selectedChannelId: nextSelection.channelId,
        selectedTimeRange: nextSelection.timeRange
      }
    }))
  }

  function setSyncStatusMessage(message: string): void {
    if (syncStatusTimeoutIdRef.current != null) {
      runtimeWindow.clearTimeout(syncStatusTimeoutIdRef.current)
      syncStatusTimeoutIdRef.current = null
    }

    setSyncStatus(message)
  }

  function flashSyncStatusMessage(message: string): void {
    if (syncStatusTimeoutIdRef.current != null) {
      runtimeWindow.clearTimeout(syncStatusTimeoutIdRef.current)
    }

    setSyncStatus(message)
    syncStatusTimeoutIdRef.current = runtimeWindow.setTimeout(() => {
      setSyncStatus("")
      syncStatusTimeoutIdRef.current = null
    }, 1200)
  }

  return (
    <main className="app-shell">
      <section className="controls">
        <div className="controls-header">
          <div>
            <p className="eyebrow">Discord</p>
            <h1>Contributions Leaderboard</h1>
          </div>
          <button
            id="score-info-toggle"
            className="ghost-button"
            type="button"
            aria-expanded={scoreInfoOpen}
            aria-controls="score-info"
            onClick={() => {
              setScoreInfoOpen((currentValue) => !currentValue)
            }}
          >
            How points work
          </button>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="guild-select">
            Server
          </label>
          <select
            id="guild-select"
            value={selectedGuildId ?? ""}
            disabled={guilds.length === 0}
            onChange={(event) => {
              void handleGuildChange(event.currentTarget.value)
            }}
          >
            {guilds.length === 0 ? (
              <option value="">No captured servers yet</option>
            ) : (
              guilds.map((guild) => (
                <option key={guild.guildId} value={guild.guildId}>
                  {guild.guildName}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="channel-select">
            Channel
          </label>
          <select
            id="channel-select"
            value={resolvedChannelId}
            disabled={guilds.length === 0}
            onChange={(event) => {
              void handleChannelChange(event.currentTarget.value)
            }}
          >
            <option value={ALL_CHANNELS_VALUE}>All channelx</option>
            {channels.map((channel) => (
              <option key={channel.channelId} value={channel.channelId}>
                {channel.channelName}
              </option>
            ))}
          </select>
        </div>

        <div id="readiness-strip" className="readiness-strip">
          {readinessStates.map((state) => (
            <ReadinessChip key={state.label} state={state} />
          ))}
        </div>

        <div
          id="score-info"
          className="score-info"
          hidden={!scoreInfoOpen}
        >
          <p className="score-info-title">Contribution score per message</p>
          <ul className="score-info-list">
            <li>+1 base score for every message</li>
            <li>+1 if message looks like reply</li>
            <li>+1 if message has attachments</li>
            <li>+1 per visible reaction, capped at +3</li>
            <li>+1 if message longer than 280 characters</li>
            <li>-0.5 for messages shorter than 8 characters, minimum score 1</li>
          </ul>
        </div>

        <p id="sync-status" className="sync-status" hidden={syncStatus === ""}>
          {syncStatus}
        </p>
        <p id="status" className="status" hidden={statusText === ""}>
          {statusText}
        </p>
      </section>

      <section
        id="leaderboard"
        data-testid="leaderboard"
        className="leaderboard"
      >
        {guilds.length === 0 ? (
          <div className="empty-state">No contributors captured yet.</div>
        ) : (
          <LeaderboardSection
            scopeLabel={scopeLabel}
            selectedTimeRange={selection.timeRange}
            summary={leaderboardSummary}
            onTimeRangeChange={handleTimeRangeChange}
          />
        )}
      </section>

      <section id="treemap" data-testid="treemap" className="treemap">
        <TreemapSection
          hasSelectedGuild={selectedGuildId != null}
          scopeLabel={scopeLabel}
          summary={treemapSummary}
        />
      </section>
    </main>
  )
}

function ReadinessChip(input: { state: DataReadiness }) {
  const copy =
    input.state.status === "ready"
      ? "Ready"
      : input.state.status === "scroll"
        ? "Scroll more"
        : "Not up to date"

  return (
    <span className={`readiness-chip is-${input.state.status}`}>
      {input.state.label}: {copy}
    </span>
  )
}

function LeaderboardSection(input: {
  onTimeRangeChange: (timeRange: TimeRangeKey) => Promise<void>
  scopeLabel: string
  selectedTimeRange: TimeRangeKey
  summary: LeaderboardSummary
}) {
  const topTen = input.summary.ranked.slice(0, 10)
  const viewerOutsideTopTen =
    input.summary.viewer && input.summary.viewer.rank > 10
      ? input.summary.viewer
      : null

  return (
    <>
      <div className="leaderboard-header">
        <h2 className="leaderboard-title">Discord Contributions Leaderboard</h2>
        <p className="leaderboard-subtitle">{input.scopeLabel}</p>
        <div className="time-tabs" role="tablist" aria-label="Time range">
          {(["24h", "7d", "30d"] as const).map((timeRange) => (
            <button
              key={timeRange}
              className={`time-tab ${
                input.selectedTimeRange === timeRange ? "is-active" : ""
              }`}
              data-range={timeRange}
              type="button"
              onClick={() => {
                void input.onTimeRangeChange(timeRange)
              }}
            >
              {timeRange}
            </button>
          ))}
        </div>
      </div>

      {topTen.length === 0 ? (
        <div className="empty-state">
          No contributors captured for this slice yet.
        </div>
      ) : (
        topTen.map((contributor) => (
          <ContributorCard
            key={contributor.authorKey}
            contributor={contributor}
            viewerAuthorKey={input.summary.viewer?.authorKey ?? null}
          />
        ))
      )}

      {viewerOutsideTopTen ? (
        <>
          <div className="you-divider">Your position</div>
          <ContributorCard
            contributor={viewerOutsideTopTen}
            viewerAuthorKey={viewerOutsideTopTen.authorKey}
          />
        </>
      ) : null}

      <GapCard summary={input.summary} />
    </>
  )
}

function GapCard(input: { summary: LeaderboardSummary }) {
  if (!input.summary.viewer) return null
  if (input.summary.viewer.rank <= 10) return null
  if (input.summary.isTopTenOpen) return null
  if (input.summary.gapToTopTen == null) return null

  return (
    <article className="gap-card">
      <p className="gap-title">Leaderboard gap</p>
      <p className="gap-value">
        {formatScore(input.summary.gapToTopTen)} points to pass #10
      </p>
      <p className="gap-copy">
        Current #10 score: {formatScore(input.summary.topTenScore ?? 0)} points.
      </p>
    </article>
  )
}

function ContributorCard(input: {
  contributor: RankedContributor
  viewerAuthorKey: string | null
}) {
  const isViewer = input.viewerAuthorKey === input.contributor.authorKey

  return (
    <article className={`leader-card ${isViewer ? "is-viewer" : ""}`}>
      <div className="leader-rank">#{input.contributor.rank}</div>
      {input.contributor.authorAvatarUrl ? (
        <img
          className="avatar"
          src={input.contributor.authorAvatarUrl}
          alt={`${input.contributor.authorName} avatar`}
        />
      ) : (
        <div className="avatar-fallback">
          {input.contributor.authorName.trim().charAt(0).toUpperCase() || "?"}
        </div>
      )}
      <div className="leader-main">
        <div className="leader-name-row">
          <div className="leader-name">{input.contributor.authorName}</div>
          {isViewer ? <span className="you-pill">You</span> : null}
        </div>
        <div className="leader-meta">
          {formatScore(input.contributor.score)} points ·{" "}
          {input.contributor.messageCount} messages ·{" "}
          {input.contributor.replyCount} replies
        </div>
      </div>
      <div className="leader-trailing">
        <div>{input.contributor.reactionCount} reactions</div>
        <div>
          {new Date(input.contributor.lastContributionAt).toLocaleDateString()}
        </div>
      </div>
    </article>
  )
}

function TreemapSection(input: {
  hasSelectedGuild: boolean
  scopeLabel: string
  summary: TreemapSummary
}) {
  const layout = createTreemapLayout(input.summary)
  const emptyCopy = input.hasSelectedGuild
    ? "No captured messages in this slice yet."
    : "Capture Discord messages to see category composition."

  return (
    <>
      <div className="treemap-header">
        <h2 className="treemap-title">Category Composition</h2>
        <p className="treemap-subtitle">{input.scopeLabel}</p>
      </div>
      <div className="treemap-frame">
        {input.summary.totalMessages === 0 ? (
          <div className="treemap-empty">{emptyCopy}</div>
        ) : (
          <div
            className="treemap-chart"
            role="img"
            aria-label="Category composition treemap"
          >
            {layout.map(({ tile, rect }) => {
              const density = describeTreemapTileDensity(rect)
              const style = buildTreemapTileStyle(rect, tile.id)

              return (
                <article
                  key={tile.id}
                  className={`treemap-tile is-${density}`}
                  data-tile-id={tile.id}
                  style={style}
                >
                  <p className="treemap-tile-name">{tile.label}</p>
                  {density !== "tiny" ? (
                    <p className="treemap-tile-count">
                      {tile.messageCount} messages
                    </p>
                  ) : null}
                  {density === "large" ||
                  density === "medium" ||
                  tile.percentage >= 8 ? (
                    <p className="treemap-tile-share">
                      {formatPercentage(tile.percentage)} of slice
                    </p>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function ensurePopupMountNode(document: Document): HTMLElement {
  const existingRoot = document.querySelector<HTMLElement>("#popup-root")
  if (existingRoot) return existingRoot

  const root = document.createElement("div")
  root.id = "popup-root"
  document.body.append(root)
  return root
}

function resolveInitialSelection(state: LeaderboardState): PopupSelection {
  const guilds = listGuilds(state.messages)
  const preferredGuildId = state.popupPreferences?.selectedGuildId
  const guildId =
    preferredGuildId && guilds.some((guild) => guild.guildId === preferredGuildId)
      ? preferredGuildId
      : guilds[0]?.guildId ?? null

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

function resolvePreservedSelection(
  state: LeaderboardState,
  previousSelection: PopupSelection
): PopupSelection {
  const guilds = listGuilds(state.messages)
  const preferredGuildId =
    previousSelection.guildId ?? state.popupPreferences?.selectedGuildId
  const guildId =
    preferredGuildId && guilds.some((guild) => guild.guildId === preferredGuildId)
      ? preferredGuildId
      : guilds[0]?.guildId ?? null

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

function mergeRefreshRequests(
  current: RefreshRequest | null,
  next: RefreshRequest
): RefreshRequest {
  if (!current) return next

  return {
    showLoading: current.showLoading || next.showLoading
  }
}

function createEmptyReadinessStates(): DataReadiness[] {
  return [
    { label: "24h", status: "scroll", timeRange: "24h" },
    { label: "7d", status: "scroll", timeRange: "7d" },
    { label: "30d", status: "scroll", timeRange: "30d" }
  ]
}

function getScrollHint(
  state: LeaderboardState,
  guildId: string,
  channelId: string | null
): string {
  const nextTarget = getNextScrollTarget(state, guildId, channelId)
  if (!nextTarget) return ""

  return `Scroll to ${formatScrollTargetDate(nextTarget.targetDate)} to capture ${nextTarget.label}.`
}

function getNextScrollTarget(
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

function resolveChannelId(
  selectedChannelId: string,
  channels: ChannelOption[]
): string {
  if (selectedChannelId === ALL_CHANNELS_VALUE) return ALL_CHANNELS_VALUE
  if (channels.some((channel) => channel.channelId === selectedChannelId)) {
    return selectedChannelId
  }

  return ALL_CHANNELS_VALUE
}

function resolveScopeLabel(
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

function formatScrollTargetDate(targetDate: Date): string {
  const day = String(targetDate.getDate()).padStart(2, "0")
  const month = String(targetDate.getMonth() + 1).padStart(2, "0")
  const year = String(targetDate.getFullYear())

  return `${day}/${month}/${year}`
}

async function waitForMinimumProcessingWindow(
  runtimeWindow: Window,
  refreshStartedAt: number
): Promise<void> {
  const remainingMs = MIN_PROCESSING_MS - (Date.now() - refreshStartedAt)
  if (remainingMs <= 0) return

  await new Promise<void>((resolve) => {
    runtimeWindow.setTimeout(() => resolve(), remainingMs)
  })
}

interface TreemapRect {
  top: number
  left: number
  width: number
  height: number
}

type TreemapTileDensity = "large" | "medium" | "small" | "tiny"

function createTreemapLayout(summary: TreemapSummary): Array<{
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

function describeTreemapTileDensity(rect: TreemapRect): TreemapTileDensity {
  const area = rect.width * rect.height

  if (area >= 2600) return "large"
  if (area >= 1200) return "medium"
  if (area >= 500) return "small"
  return "tiny"
}

function buildTreemapTileStyle(
  rect: TreemapRect,
  tileId: string
): React.CSSProperties {
  const palette = createTreemapTilePalette(tileId)

  return {
    left: `${formatTreemapDimension(rect.left)}%`,
    top: `${formatTreemapDimension(rect.top)}%`,
    width: `${formatTreemapDimension(rect.width)}%`,
    height: `${formatTreemapDimension(rect.height)}%`,
    ["--treemap-fill-start" as string]: palette.start,
    ["--treemap-fill-end" as string]: palette.end,
    ["--treemap-fill-accent" as string]: palette.accent
  }
}

function formatTreemapDimension(value: number): string {
  return value.toFixed(3)
}

function createTreemapTilePalette(tileId: string): {
  start: string
  end: string
  accent: string
} {
  const hash = hashText(tileId)
  const hue = 18 + (hash % 18)
  const saturation = 62 + (hash % 8)
  const startLightness = 52 + (hash % 7)
  const endLightness = 42 + (hash % 6)

  return {
    start: `hsl(${hue} ${saturation}% ${startLightness}%)`,
    end: `hsl(${Math.max(10, hue - 4)} ${Math.min(
      78,
      saturation + 6
    )}% ${endLightness}%)`,
    accent: `hsla(${hue + 8} ${Math.max(46, saturation - 10)}% ${Math.min(
      72,
      startLightness + 10
    )}% / 0.18)`
  }
}

function hashText(value: string): number {
  let hash = 0

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return hash
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function formatPercentage(percentage: number): string {
  return Number.isInteger(percentage)
    ? `${percentage}%`
    : `${percentage.toFixed(1)}%`
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
