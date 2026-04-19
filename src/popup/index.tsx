import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import "./lib/styles.css"
import {
  filterMessagesByView,
  listChannels,
  listGuilds,
  listReadinessStates,
  summarizeLeaderboard,
  summarizeTreemap
} from "../shared/leaderboard-query"
import type {
  TimeRangeKey
} from "../shared/types"
import {
  leaderboardStateSchema
} from "../shared/types"
import type { PopupRuntime, PopupSelection, RefreshRequest } from "./types"
import { AtomRegistryProvider } from "./lib/atom-registry-provider";
import { ReadinessChip, LeaderboardSection, TreemapSection } from "./components"
import {
  createEmptyReadinessStates,
  ensurePopupMountNode,
  getScrollHint,
  mergeRefreshRequests,
  resolveChannelId,
  resolveInitialSelection,
  resolvePreservedSelection,
  resolveScopeLabel
} from "./helpers"
import { Effect } from "effect"
import { LeaderboardStorage } from "./services/storage-service"

export type LeaderboardState = typeof leaderboardStateSchema.Type

export const ALL_CHANNELS_VALUE = "__all__"

export let popupRuntime: PopupRuntime = createBrowserRuntime()
export let popupRoot: Root | null = null
export let popupMountNode: HTMLElement | null = null
export let renderKey = 0

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
      <AtomRegistryProvider>
      <PopupApp
        key={renderKey}
        runtime={popupRuntime}
        initialState={initialState}
        initialSelection={initialSelection}
        />
      </AtomRegistryProvider>
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

  const refreshInFlightRef = useRef(false)
  const queuedRefreshRef = useRef<RefreshRequest | null>(null)
  const currentStateRef = useRef(currentState)
  const selectionRef = useRef(selection)

  useEffect(() => {
    currentStateRef.current = currentState
  }, [currentState])

  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  useEffect(() => {
    return input.runtime.subscribeToLeaderboardStateChanges(() => {
      void requestRefresh({ showLoading: true })
    })
  }, [input.runtime])

  const guilds = listGuilds(currentState.messages)

  const selectedGuildId =
    selection.guildId &&
    guilds.some((guild) => guild.guildId === selection.guildId)
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
  const treemapMessages = filteredMessages.filter(
    (message) => message.isReply === false
  )
  const treemapSummary = summarizeTreemap({
    messages: treemapMessages,
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
      : getScrollHint(currentState, selectedGuildId, scopedChannelId)

  async function requestRefresh(nextRequest: RefreshRequest): Promise<void> {
    if (refreshInFlightRef.current) {
      queuedRefreshRef.current = mergeRefreshRequests(
        queuedRefreshRef.current,
        nextRequest
      )
      return
    }

    refreshInFlightRef.current = true

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
    }
  }

  async function runRefresh(_request: RefreshRequest): Promise<void> {
    const nextState = await input.runtime.loadState()
    const nextSelection = resolvePreservedSelection(
      nextState,
      selectionRef.current
    )

    setCurrentState(nextState)
    setSelection(nextSelection)
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
            <option value={ALL_CHANNELS_VALUE}>All channel</option>
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

function runPopupEffect<A>(
  effect: Effect.Effect<A, never, LeaderboardStorage>
): Promise<A> {
  return Effect.runPromise(
    effect.pipe(Effect.provide(LeaderboardStorage.layer))
  )
}

function runPopupSyncEffect<A>(
  effect: Effect.Effect<A, never, LeaderboardStorage>
): A {
  return Effect.runSync(effect.pipe(Effect.provide(LeaderboardStorage.layer)))
}

function createBrowserRuntime(): PopupRuntime {
  return {
    document,
    loadState: () =>
      runPopupEffect(
        Effect.gen(function* () {
          const storage = yield* LeaderboardStorage
          return yield* storage.loadState()
        })
      ),
    savePopupPreferences: (preferences) =>
      runPopupEffect(
        Effect.gen(function* () {
          const storage = yield* LeaderboardStorage
          return yield* storage.savePopupPreferences(preferences)
        })
      ),
    subscribeToLeaderboardStateChanges: (listener) =>
      runPopupSyncEffect(
        Effect.gen(function* () {
          const storage = yield* LeaderboardStorage
          return yield* storage.subscribeToLeaderboardStateChanges(listener)
        })
      )
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void bootstrapPopup()
})
