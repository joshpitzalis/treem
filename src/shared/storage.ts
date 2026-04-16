import type {
  ContributionMessage,
  LeaderboardState,
  PopupPreferences,
  ScopeObservation,
  ViewerProfile
} from "./types"

const STORAGE_KEY = "discordLeaderboardState"
const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000

export async function loadState(): Promise<LeaderboardState> {
  const raw = await chrome.storage.local.get(STORAGE_KEY)
  const stored = raw[STORAGE_KEY]

  if (!stored || typeof stored !== "object") {
    return {
      messages: [],
      viewerProfile: null,
      scopeObservations: [],
      popupPreferences: null,
      updatedAt: null
    }
  }

  const state = stored as Partial<LeaderboardState>
  return {
    messages: Array.isArray(state.messages) ? state.messages : [],
    viewerProfile: isViewerProfile(state.viewerProfile)
      ? state.viewerProfile
      : null,
    scopeObservations: Array.isArray(state.scopeObservations)
      ? state.scopeObservations.filter(isScopeObservation)
      : [],
    popupPreferences: isPopupPreferences(state.popupPreferences)
      ? state.popupPreferences
      : null,
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : null
  }
}

export async function saveState(nextState: LeaderboardState): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      messages: pruneExpiredMessages(nextState.messages),
      viewerProfile: nextState.viewerProfile,
      scopeObservations: pruneExpiredObservations(nextState.scopeObservations),
      popupPreferences: nextState.popupPreferences,
      updatedAt: nextState.updatedAt
    }
  })
}

export async function saveMessages(
  nextMessages: ContributionMessage[]
): Promise<void> {
  const nextState: LeaderboardState = {
    messages: pruneExpiredMessages(nextMessages),
    viewerProfile: (await loadState()).viewerProfile,
    scopeObservations: (await loadState()).scopeObservations,
    popupPreferences: (await loadState()).popupPreferences,
    updatedAt: new Date().toISOString()
  }

  await saveState(nextState)
}

export async function mergeMessages(
  incomingMessages: ContributionMessage[]
): Promise<void> {
  if (incomingMessages.length === 0) return

  const currentState = await loadState()
  const byId = new Map<string, ContributionMessage>()

  for (const message of pruneExpiredMessages(currentState.messages)) {
    byId.set(message.id, message)
  }

  for (const message of incomingMessages) {
    byId.set(message.id, message)
  }

  await saveMessages(Array.from(byId.values()))
}

export async function saveViewerProfile(
  nextViewerProfile: ViewerProfile | null
): Promise<void> {
  const currentState = await loadState()

  await saveState({
    ...currentState,
    viewerProfile: nextViewerProfile,
    updatedAt: new Date().toISOString()
  })
}

export async function saveScopeObservation(
  nextObservation: ScopeObservation
): Promise<void> {
  const currentState = await loadState()
  const byScope = new Map<string, ScopeObservation>()

  for (const observation of pruneExpiredObservations(
    currentState.scopeObservations
  )) {
    byScope.set(
      toScopeKey(observation.guildId, observation.channelId),
      observation
    )
  }

  byScope.set(
    toScopeKey(nextObservation.guildId, nextObservation.channelId),
    nextObservation
  )

  await saveState({
    ...currentState,
    scopeObservations: Array.from(byScope.values()),
    updatedAt: new Date().toISOString()
  })
}

export async function savePopupPreferences(
  nextPreferences: PopupPreferences
): Promise<void> {
  const currentState = await loadState()

  await saveState({
    ...currentState,
    popupPreferences: nextPreferences,
    updatedAt: new Date().toISOString()
  })
}

function pruneExpiredMessages(
  messages: ContributionMessage[]
): ContributionMessage[] {
  const cutoff = getMessageRetentionCutoff()

  return messages.filter((message) => {
    const timestamp = Date.parse(message.messageTimestamp || message.capturedAt)
    return Number.isFinite(timestamp) && timestamp >= cutoff
  })
}

function pruneExpiredObservations(
  observations: ScopeObservation[]
): ScopeObservation[] {
  const cutoff = Date.now() - THIRTY_DAYS_IN_MS

  return observations.filter((observation) => {
    const timestamp = Date.parse(observation.capturedAt)
    return Number.isFinite(timestamp) && timestamp >= cutoff
  })
}

function getMessageRetentionCutoff(): number {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_IN_MS)
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - 1)
  return cutoff.getTime()
}

function isViewerProfile(value: unknown): value is ViewerProfile {
  if (!value || typeof value !== "object") return false

  const candidate = value as Partial<ViewerProfile>
  return (
    typeof candidate.displayName === "string" &&
    Array.isArray(candidate.authorKeys) &&
    typeof candidate.capturedAt === "string"
  )
}

function isScopeObservation(value: unknown): value is ScopeObservation {
  if (!value || typeof value !== "object") return false

  const candidate = value as Partial<ScopeObservation>
  return (
    typeof candidate.guildId === "string" &&
    typeof candidate.channelId === "string" &&
    typeof candidate.capturedAt === "string" &&
    typeof candidate.sawLiveEdge === "boolean"
  )
}

function isPopupPreferences(value: unknown): value is PopupPreferences {
  if (!value || typeof value !== "object") return false

  const candidate = value as Partial<PopupPreferences>
  const guildValid =
    candidate.selectedGuildId === null ||
    typeof candidate.selectedGuildId === "string"
  const channelValid =
    candidate.selectedChannelId === null ||
    typeof candidate.selectedChannelId === "string"
  const timeRangeValid =
    candidate.selectedTimeRange === null ||
    candidate.selectedTimeRange === "24h" ||
    candidate.selectedTimeRange === "7d" ||
    candidate.selectedTimeRange === "30d"

  return guildValid && channelValid && timeRangeValid
}

function toScopeKey(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`
}
