import { Option, Schema } from "effect"
import type {
  CategoryRecord,
  ContributionMessage,
  MessageCategoryAssignment,
  PopupPreferences,
  ScopeObservation,
  ViewerProfile
} from "./types"

import {
  categoryRecordSchema,
  contributionMessageSchema,
  type leaderboardStateSchema,
  messageCategoryAssignmentSchema,
  popupPreferencesSchema,
  scopeObservationSchema,
  viewerProfileSchema
} from "./types"

type LeaderboardState = typeof leaderboardStateSchema.Type

const STORAGE_KEY = "discordLeaderboardState"
const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000

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
  const raw = await chrome.storage.local.get(STORAGE_KEY)
  const stored = raw[STORAGE_KEY]

  if (!stored || typeof stored !== "object") {
    return emptyLeaderboardState
  }

  return decodeStoredLeaderboardState(stored)
}

//   decodeArrayItems(schema, input)      // bad items dropped
function decodeArrayItems<S extends Schema.Decoder<unknown>>(
  schema: S,
  input: unknown
): Array<S["Type"]> {
  if (!Array.isArray(input)) return []

  return input.flatMap((item) => {
    const decoded = Schema.decodeUnknownOption(schema)(item)
    return Option.isSome(decoded) ? [decoded.value] : []
  })
}

//   decodeOptionalValue(schema, input)   // invalid -> null
function decodeNullableValue<S extends Schema.Decoder<unknown>>(
  schema: S,
  input: unknown
): S["Type"] | null {
  if (input == null) return null

  const decoded = Schema.decodeUnknownOption(schema)(input)
  return Option.isSome(decoded) ? decoded.value : null
}

//   decodeNullableValue(schema, input)   // invalid -> null
function decodeOptionalValue<S extends Schema.Decoder<unknown>>(
  schema: S,
  input: unknown
): S["Type"] | null {
  const decoded = Schema.decodeUnknownOption(schema)(input)
  return Option.isSome(decoded) ? decoded.value : null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
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

export async function saveMessages(
  nextMessages: ContributionMessage[]
): Promise<void> {
  const nextState: LeaderboardState = {
    messages: pruneExpiredMessages(nextMessages),
    viewerProfile: (await loadState()).viewerProfile,
    scopeObservations: (await loadState()).scopeObservations,
    popupPreferences: (await loadState()).popupPreferences,
    categories: (await loadState()).categories,
    messageCategoryAssignments: (await loadState()).messageCategoryAssignments,
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

function pruneCategories(categories: CategoryRecord[]): CategoryRecord[] {
  return categories.filter(isCategoryRecord)
}

function pruneMessageCategoryAssignments(input: {
  assignments: MessageCategoryAssignment[]
  messages: ContributionMessage[]
  categories: CategoryRecord[]
}): MessageCategoryAssignment[] {
  const validMessageIds = new Set(input.messages.map((message) => message.id))
  const validCategoryIds = new Set(
    input.categories.map((category) => category.id)
  )
  const byMessage = new Map<string, MessageCategoryAssignment>()

  for (const assignment of input.assignments) {
    if (!isMessageCategoryAssignment(assignment)) continue
    if (!validMessageIds.has(assignment.messageId)) continue
    if (!validCategoryIds.has(assignment.categoryId)) continue

    byMessage.set(assignment.messageId, assignment)
  }

  return Array.from(byMessage.values())
}

function pruneUnusedCategories(
  categories: CategoryRecord[],
  assignments: MessageCategoryAssignment[]
): CategoryRecord[] {
  const assignedCategoryIds = new Set(
    assignments.map((assignment) => assignment.categoryId)
  )

  return categories.filter((category) => assignedCategoryIds.has(category.id))
}

function isCategoryRecord(value: unknown): value is CategoryRecord {
  if (!value || typeof value !== "object") return false

  const candidate = value as Partial<CategoryRecord>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.guildId === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.normalizedName === "string" &&
    typeof candidate.createdAt === "string"
  )
}

function isMessageCategoryAssignment(
  value: unknown
): value is MessageCategoryAssignment {
  if (!value || typeof value !== "object") return false

  const candidate = value as Partial<MessageCategoryAssignment>
  return (
    typeof candidate.messageId === "string" &&
    typeof candidate.guildId === "string" &&
    typeof candidate.categoryId === "string" &&
    typeof candidate.assignedAt === "string"
  )
}

function toScopeKey(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`
}
