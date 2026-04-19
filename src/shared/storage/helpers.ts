import { Option, Schema } from "effect"
import type {
  CategoryRecord,
  ContributionMessage,
  MessageCategoryAssignment,
  ScopeObservation
} from "../types"

// ---- Schema helpers----

//   decodeOptionalValue(schema, input)   // invalid -> null
export function decodeNullableValue<S extends Schema.Decoder<unknown>>(
  schema: S,
  input: unknown
): S["Type"] | null {
  if (input == null) return null

  const decoded = Schema.decodeUnknownOption(schema)(input)
  return Option.isSome(decoded) ? decoded.value : null
}

//   decodeNullableValue(schema, input)   // invalid -> null
export function decodeOptionalValue<S extends Schema.Decoder<unknown>>(
  schema: S,
  input: unknown
): S["Type"] | null {
  const decoded = Schema.decodeUnknownOption(schema)(input)
  return Option.isSome(decoded) ? decoded.value : null
}

//   decodeArrayItems(schema, input)      // bad items dropped
export function decodeArrayItems<S extends Schema.Decoder<unknown>>(
  schema: S,
  input: unknown
): Array<S["Type"]> {
  if (!Array.isArray(input)) return []

  return input.flatMap((item) => {
    const decoded = Schema.decodeUnknownOption(schema)(item)
    return Option.isSome(decoded) ? [decoded.value] : []
  })
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

// ---- storage helpers----

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000

export function pruneExpiredMessages(
  messages: ContributionMessage[]
): ContributionMessage[] {
  const cutoff = getMessageRetentionCutoff()

  return messages.filter((message) => {
    const timestamp = Date.parse(message.messageTimestamp || message.capturedAt)
    return Number.isFinite(timestamp) && timestamp >= cutoff
  })
}

export function pruneExpiredObservations(
  observations: ScopeObservation[]
): ScopeObservation[] {
  const cutoff = Date.now() - THIRTY_DAYS_IN_MS

  return observations.filter((observation) => {
    const timestamp = Date.parse(observation.capturedAt)
    return Number.isFinite(timestamp) && timestamp >= cutoff
  })
}

export function getMessageRetentionCutoff(): number {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_IN_MS)
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - 1)
  return cutoff.getTime()
}

export function pruneCategories(
  categories: CategoryRecord[]
): CategoryRecord[] {
  return categories.filter(isCategoryRecord)
}

export function pruneMessageCategoryAssignments(input: {
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

export function pruneUnusedCategories(
  categories: CategoryRecord[],
  assignments: MessageCategoryAssignment[]
): CategoryRecord[] {
  const assignedCategoryIds = new Set(
    assignments.map((assignment) => assignment.categoryId)
  )

  return categories.filter((category) => assignedCategoryIds.has(category.id))
}

export function isCategoryRecord(value: unknown): value is CategoryRecord {
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

export function isMessageCategoryAssignment(
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

export function toScopeKey(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`
}
