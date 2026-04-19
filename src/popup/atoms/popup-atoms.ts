import { Effect } from "effect"
import * as Atom from "effect/unstable/reactivity/Atom"
import {
  filterMessagesByView,
  listChannels,
  listGuilds,
  listReadinessStates,
  summarizeLeaderboard,
  summarizeTreemap
} from "../../shared/leaderboard-query"
import type { LeaderboardState } from "../../shared/types"
import { ALL_CHANNELS_VALUE } from "../lib/constants"
import {
  createEmptyReadinessStates,
  getScrollHint,
  resolveChannelId,
  resolveScopeLabel
} from "../lib/helpers"
import type { PopupModel, PopupRuntime, PopupSelection } from "../types"

export interface PopupRefreshRequest {
  id: number
  selection: PopupSelection
}

export interface PopupSelectionSaveRequest {
  id: number
  selection: PopupSelection
}

export const popupRuntimeAtom = Atom.make<PopupRuntime | null>(null)

export const popupStateAtom = Atom.make<LeaderboardState>(createEmptyState())

export const popupSelectionAtom = Atom.make<PopupSelection>({
  guildId: null,
  channelId: ALL_CHANNELS_VALUE,
  timeRange: "30d"
})

export const popupRefreshRequestAtom = Atom.make<PopupRefreshRequest | null>(
  null
)

export const popupSelectionSaveRequestAtom =
  Atom.make<PopupSelectionSaveRequest | null>(null)

export const popupRefreshModelAtom = Atom.make(
  (get) => {
    const runtime = get(popupRuntimeAtom)
    const request = get(popupRefreshRequestAtom)

    if (!runtime || !request) {
      return Effect.succeed<PopupModel | null>(null)
    }

    return Effect.promise(() => runtime.refreshPopupModel(request.selection))
  },
  {
    initialValue: null
  }
)

export const popupPersistSelectionAtom = Atom.make(
  (get) => {
    const runtime = get(popupRuntimeAtom)
    const request = get(popupSelectionSaveRequestAtom)

    if (!runtime || !request) {
      return Effect.succeed<PopupSelection | null>(null)
    }

    return Effect.promise(() => runtime.saveSelection(request.selection)).pipe(
      Effect.as(request.selection)
    )
  },
  {
    initialValue: null
  }
)

export const popupSelectGuildAtom = Atom.writable(
  (get) => get(popupSelectionAtom),
  (ctx, nextGuildId: string) => {
    const selection = ctx.get(popupSelectionAtom)
    const preferredChannelId = selection.channelId ?? ALL_CHANNELS_VALUE
    const nextChannels = listChannels(
      ctx.get(popupStateAtom).messages,
      nextGuildId
    )

    commitPopupSelection(ctx, {
      guildId: nextGuildId,
      channelId: resolveChannelId(preferredChannelId, nextChannels),
      timeRange: selection.timeRange
    })
  }
)

export const popupSelectChannelAtom = Atom.writable(
  (get) => get(popupSelectionAtom),
  (ctx, nextChannelId: string) => {
    commitPopupSelection(ctx, {
      ...ctx.get(popupSelectionAtom),
      channelId: nextChannelId
    })
  }
)

export const popupSelectTimeRangeAtom = Atom.writable(
  (get) => get(popupSelectionAtom),
  (ctx, nextTimeRange: PopupSelection["timeRange"]) => {
    commitPopupSelection(ctx, {
      ...ctx.get(popupSelectionAtom),
      timeRange: nextTimeRange
    })
  }
)

export const popupGuildsAtom = Atom.make((get) =>
  listGuilds(get(popupStateAtom).messages)
)

export const popupSelectedGuildIdAtom = Atom.make((get) => {
  const selection = get(popupSelectionAtom)
  const guilds = get(popupGuildsAtom)

  return selection.guildId &&
    guilds.some((guild) => guild.guildId === selection.guildId)
    ? selection.guildId
    : (guilds[0]?.guildId ?? null)
})

export const popupChannelsAtom = Atom.make((get) => {
  const selectedGuildId = get(popupSelectedGuildIdAtom)
  if (!selectedGuildId) return []

  return listChannels(get(popupStateAtom).messages, selectedGuildId)
})

export const popupResolvedChannelIdAtom = Atom.make((get) =>
  resolveChannelId(get(popupSelectionAtom).channelId, get(popupChannelsAtom))
)

export const popupScopedChannelIdAtom = Atom.make((get) => {
  const resolvedChannelId = get(popupResolvedChannelIdAtom)
  return resolvedChannelId === ALL_CHANNELS_VALUE ? null : resolvedChannelId
})

export const popupScopeLabelAtom = Atom.make((get) => {
  const guilds = get(popupGuildsAtom)
  if (guilds.length === 0) return "No server selected yet"

  return resolveScopeLabel(
    guilds,
    get(popupChannelsAtom),
    get(popupSelectedGuildIdAtom),
    get(popupResolvedChannelIdAtom)
  )
})

export const popupFilteredMessagesAtom = Atom.make((get) => {
  const selectedGuildId = get(popupSelectedGuildIdAtom)
  if (selectedGuildId == null) return []

  const state = get(popupStateAtom)
  const selection = get(popupSelectionAtom)
  const scopedChannelId = get(popupScopedChannelIdAtom)

  return filterMessagesByView({
    messages: state.messages,
    guildId: selectedGuildId,
    scopeMode: scopedChannelId ? "channel" : "server",
    channelId: scopedChannelId,
    timeRange: selection.timeRange
  })
})

export const popupLeaderboardSummaryAtom = Atom.make((get) =>
  summarizeLeaderboard({
    messages: get(popupFilteredMessagesAtom),
    viewerProfile: get(popupStateAtom).viewerProfile
  })
)

export const popupTreemapSummaryAtom = Atom.make((get) => {
  const state = get(popupStateAtom)
  const messages = get(popupFilteredMessagesAtom).filter(
    (message) => message.isReply === false
  )

  return summarizeTreemap({
    messages,
    categories: state.categories,
    messageCategoryAssignments: state.messageCategoryAssignments
  })
})

export const popupReadinessStatesAtom = Atom.make((get) => {
  const selectedGuildId = get(popupSelectedGuildIdAtom)
  if (selectedGuildId == null) return createEmptyReadinessStates()

  const state = get(popupStateAtom)

  return listReadinessStates({
    messages: state.messages,
    scopeObservations: state.scopeObservations,
    guildId: selectedGuildId,
    channelId: get(popupScopedChannelIdAtom)
  })
})

export const popupStatusTextAtom = Atom.make((get) => {
  const guilds = get(popupGuildsAtom)
  if (guilds.length === 0) {
    return "Open Discord in Chrome and browse a server to start collecting data."
  }

  const selectedGuildId = get(popupSelectedGuildIdAtom)
  if (!selectedGuildId) return ""

  return getScrollHint(
    get(popupStateAtom),
    selectedGuildId,
    get(popupScopedChannelIdAtom)
  )
})

function createEmptyState(): LeaderboardState {
  return {
    messages: [],
    viewerProfile: null,
    scopeObservations: [],
    popupPreferences: null,
    categories: [],
    messageCategoryAssignments: [],
    updatedAt: null
  }
}

function commitPopupSelection(
  ctx: Atom.WriteContext<PopupSelection>,
  nextSelection: PopupSelection
): void {
  const previousRequest = ctx.get(popupSelectionSaveRequestAtom)

  ctx.set(popupSelectionAtom, nextSelection)
  ctx.set(popupSelectionSaveRequestAtom, {
    id: (previousRequest?.id ?? 0) + 1,
    selection: nextSelection
  })
}
