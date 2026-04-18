import { Schema } from "effect"
import type {
  ContributionMessage,
  PopupPreferences,
  ScopeObservation,
  ViewerProfile
} from "../types"
import {
  categoryRecordSchema,
  contributionMessageSchema,
  type leaderboardStateSchema,
  messageCategoryAssignmentSchema,
  popupPreferencesSchema,
  scopeObservationSchema,
  viewerProfileSchema
} from "../types"
import {
  decodeArrayItems,
  decodeNullableValue,
  decodeOptionalValue,
  isObject,
  pruneCategories,
  pruneExpiredMessages,
  pruneExpiredObservations,
  pruneMessageCategoryAssignments,
  pruneUnusedCategories,
  toScopeKey
} from "./helpers"

type LeaderboardState = typeof leaderboardStateSchema.Type

const STORAGE_KEY = "discordLeaderboardState"
let storageWriteQueue: Promise<void> = Promise.resolve()

const emptyLeaderboardState: LeaderboardState = {
  messages: [],
  viewerProfile: null,
  scopeObservations: [],
  popupPreferences: null,
  categories: [],
  messageCategoryAssignments: [],
  updatedAt: null
}

export async function loadState() {
  return readStateFromStorage()
}

async function readStateFromStorage() {
  const raw = await chrome.storage.local.get(STORAGE_KEY)
  const stored = raw[STORAGE_KEY]

  if (!stored || typeof stored !== "object") {
    return emptyLeaderboardState
  }

  return decodeStoredLeaderboardState(stored)
}

function decodeStoredLeaderboardState(stored: unknown): LeaderboardState {
  const candidate = isObject(stored) ? stored : {}
  return {
    messages: decodeArrayItems(contributionMessageSchema, candidate.messages),
    viewerProfile: decodeOptionalValue(
      viewerProfileSchema,
      candidate.viewerProfile
    ),
    scopeObservations: decodeArrayItems(
      scopeObservationSchema,
      candidate.scopeObservations
    ),
    popupPreferences: decodeOptionalValue(
      popupPreferencesSchema,
      candidate.popupPreferences
    ),
    categories: decodeArrayItems(categoryRecordSchema, candidate.categories),
    messageCategoryAssignments: decodeArrayItems(
      messageCategoryAssignmentSchema,
      candidate.messageCategoryAssignments
    ),
    updatedAt: decodeNullableValue(Schema.String, candidate.updatedAt)
  }
}

export async function saveState(nextState: LeaderboardState): Promise<void> {
  await queueStateWrite(async () => {
    await persistState(nextState)
  })
}

async function persistState(nextState: LeaderboardState): Promise<void> {
  const messages = pruneExpiredMessages(nextState.messages)
  const categories = pruneCategories(nextState.categories)
  const messageCategoryAssignments = pruneMessageCategoryAssignments({
    assignments: nextState.messageCategoryAssignments,
    messages,
    categories
  })
  const assignedCategories = pruneUnusedCategories(
    categories,
    messageCategoryAssignments
  )

  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      messages,
      viewerProfile: nextState.viewerProfile,
      scopeObservations: pruneExpiredObservations(nextState.scopeObservations),
      popupPreferences: nextState.popupPreferences,
      categories: assignedCategories,
      messageCategoryAssignments,
      updatedAt: nextState.updatedAt
    }
  })
}

async function updateStoredState(
  update: (currentState: LeaderboardState) => LeaderboardState
): Promise<void> {
  await queueStateWrite(async () => {
    const currentState = await readStateFromStorage()
    await persistState(update(currentState))
  })
}

function queueStateWrite(operation: () => Promise<void>): Promise<void> {
  const queuedOperation = storageWriteQueue.then(operation)
  storageWriteQueue = queuedOperation.catch(() => undefined)
  return queuedOperation
}

export async function saveMessages(
  nextMessages: ContributionMessage[]
): Promise<void> {
  await updateStoredState((currentState) => ({
    ...currentState,
    messages: pruneExpiredMessages(nextMessages),
    updatedAt: new Date().toISOString()
  }))
}

export async function mergeMessages(
  incomingMessages: ContributionMessage[]
): Promise<void> {
  if (incomingMessages.length === 0) return

  await updateStoredState((currentState) => {
    const byId = new Map<string, ContributionMessage>()

    for (const message of pruneExpiredMessages(currentState.messages)) {
      byId.set(message.id, message)
    }

    for (const message of incomingMessages) {
      byId.set(message.id, message)
    }

    return {
      ...currentState,
      messages: Array.from(byId.values()),
      updatedAt: new Date().toISOString()
    }
  })
}

export async function saveViewerProfile(
  nextViewerProfile: ViewerProfile | null
): Promise<void> {
  await updateStoredState((currentState) => ({
    ...currentState,
    viewerProfile: nextViewerProfile,
    updatedAt: new Date().toISOString()
  }))
}

export async function saveScopeObservation(
  nextObservation: ScopeObservation
): Promise<void> {
  await updateStoredState((currentState) => {
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

    return {
      ...currentState,
      scopeObservations: Array.from(byScope.values()),
      updatedAt: new Date().toISOString()
    }
  })
}

export async function savePopupPreferences(
  nextPreferences: PopupPreferences
): Promise<void> {
  await updateStoredState((currentState) => ({
    ...currentState,
    popupPreferences: nextPreferences,
    updatedAt: new Date().toISOString()
  }))
}
