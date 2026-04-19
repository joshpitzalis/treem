import {
  useAtomInitialValues,
  useAtomMount,
  useAtomSet,
  useAtomSubscribe,
  useAtomValue
} from "@effect/atom-react"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { useEffect, useRef, useState } from "react"
import "./lib/styles.css"
import type { LeaderboardState } from "../shared/types"
import {
  popupChannelsAtom,
  popupGuildsAtom,
  popupLeaderboardSummaryAtom,
  popupPersistSelectionAtom,
  popupReadinessStatesAtom,
  popupRefreshModelAtom,
  popupRefreshRequestAtom,
  popupResolvedChannelIdAtom,
  popupRuntimeAtom,
  popupSelectChannelAtom,
  popupSelectGuildAtom,
  popupSelectTimeRangeAtom,
  popupScopeLabelAtom,
  popupSelectedGuildIdAtom,
  popupSelectionAtom,
  popupStateAtom,
  popupStatusTextAtom,
  popupTreemapSummaryAtom
} from "./atoms/popup-atoms"
import { ALL_CHANNELS_VALUE } from "./lib/constants"
import type { PopupModel, PopupRuntime, PopupSelection } from "./types"
import { ReadinessChip, LeaderboardSection, TreemapSection } from "./components"

export function PopupApp(input: {
  runtime: PopupRuntime
  initialState: LeaderboardState
  initialSelection: PopupSelection
}) {
  useAtomInitialValues([
    [popupRuntimeAtom, input.runtime],
    [popupStateAtom, input.initialState],
    [popupSelectionAtom, input.initialSelection]
  ])

  useAtomMount(popupRefreshModelAtom)
  useAtomMount(popupPersistSelectionAtom)

  const selection = useAtomValue(popupSelectionAtom)
  const guilds = useAtomValue(popupGuildsAtom)
  const selectedGuildId = useAtomValue(popupSelectedGuildIdAtom)
  const channels = useAtomValue(popupChannelsAtom)
  const resolvedChannelId = useAtomValue(popupResolvedChannelIdAtom)
  const scopeLabel = useAtomValue(popupScopeLabelAtom)
  const leaderboardSummary = useAtomValue(popupLeaderboardSummaryAtom)
  const treemapSummary = useAtomValue(popupTreemapSummaryAtom)
  const readinessStates = useAtomValue(popupReadinessStatesAtom)
  const statusText = useAtomValue(popupStatusTextAtom)
  const setCurrentState = useAtomSet(popupStateAtom)
  const requestRefresh = useAtomSet(popupRefreshRequestAtom)
  const selectGuild = useAtomSet(popupSelectGuildAtom)
  const selectChannel = useAtomSet(popupSelectChannelAtom)
  const selectTimeRange = useAtomSet(popupSelectTimeRangeAtom)
  const setSelection = useAtomSet(popupSelectionAtom)
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false)

  const refreshRequestIdRef = useRef(0)
  const selectionRef = useRef(selection)

  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  useEffect(() => {
    return input.runtime.subscribeToLeaderboardStateChanges(() => {
      refreshRequestIdRef.current += 1
      requestRefresh({
        id: refreshRequestIdRef.current,
        selection: selectionRef.current
      })
    })
  }, [input.runtime, requestRefresh])

  useAtomSubscribe(popupRefreshModelAtom, (result) => {
    if (!AsyncResult.isSuccess(result)) return
    if (!result.value) return

    applyRefreshedPopupModel(result.value)
  })

  function applyRefreshedPopupModel(nextModel: PopupModel): void {
    setCurrentState(nextModel.state)
    setSelection(nextModel.selection)
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
              selectGuild(event.currentTarget.value)
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
              selectChannel(event.currentTarget.value)
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
            onTimeRangeChange={selectTimeRange}
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
