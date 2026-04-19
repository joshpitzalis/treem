import { Schema } from "effect"

export type TimeRangeKey = "24h" | "7d" | "30d"
const TimeRangeKeySchema = Schema.Literals(["24h", "7d", "30d"])

export type ScopeMode = "server" | "channel"

export interface CommunityRef {
  guildId: string
  guildName: string
  channelId: string
  channelName: string
}

export interface ContributionMessage {
  id: string
  guildId: string
  guildName: string
  channelId: string
  channelName: string
  authorKey: string
  authorName: string
  authorAvatarUrl: string | null
  messageTimestamp: string
  capturedAt: string
  contentLength: number
  reactionCount: number
  attachmentCount: number
  isReply: boolean
  score: number
}

export const contributionMessageSchema = Schema.Struct({
  id: Schema.String,
  guildId: Schema.String,
  guildName: Schema.String,
  channelId: Schema.String,
  channelName: Schema.String,
  authorKey: Schema.String,
  authorName: Schema.String,
  authorAvatarUrl: Schema.NullOr(Schema.String),
  messageTimestamp: Schema.String,
  capturedAt: Schema.String,
  contentLength: Schema.Number,
  reactionCount: Schema.Number,
  attachmentCount: Schema.Number,
  isReply: Schema.Boolean,
  score: Schema.Number
})

export interface ViewerProfile {
  displayName: string
  avatarUrl: string | null
  authorKeys: string[]
  capturedAt: string
}

export const viewerProfileSchema = Schema.Struct({
  displayName: Schema.String,
  avatarUrl: Schema.NullOr(Schema.String),
  authorKeys: Schema.Array(Schema.String).pipe(Schema.mutable),
  capturedAt: Schema.String
})

export interface ScopeObservation {
  guildId: string
  channelId: string
  capturedAt: string
  sawLiveEdge: boolean
}

export const scopeObservationSchema = Schema.Struct({
  guildId: Schema.String,
  channelId: Schema.String,
  capturedAt: Schema.String,
  sawLiveEdge: Schema.Boolean
})

export interface PopupPreferences {
  selectedGuildId: string | null
  selectedChannelId: string | null
  selectedTimeRange: TimeRangeKey | null
}

export const popupPreferencesSchema = Schema.Struct({
  selectedGuildId: Schema.NullOr(Schema.String),
  selectedChannelId: Schema.NullOr(Schema.String),
  selectedTimeRange: Schema.NullOr(TimeRangeKeySchema)
})

export interface CategoryRecord {
  id: string
  guildId: string
  name: string
  normalizedName: string
  createdAt: string
}

export const categoryRecordSchema = Schema.Struct({
  id: Schema.String,
  guildId: Schema.String,
  name: Schema.String,
  normalizedName: Schema.String,
  createdAt: Schema.String
})

export interface MessageCategoryAssignment {
  messageId: string
  guildId: string
  categoryId: string
  assignedAt: string
}

export const messageCategoryAssignmentSchema = Schema.Struct({
  messageId: Schema.String,
  guildId: Schema.String,
  categoryId: Schema.String,
  assignedAt: Schema.String
})

export interface LeaderboardState {
  messages: ContributionMessage[]
  viewerProfile: ViewerProfile | null
  scopeObservations: ScopeObservation[]
  popupPreferences: PopupPreferences | null
  categories: CategoryRecord[]
  messageCategoryAssignments: MessageCategoryAssignment[]
  updatedAt: string | null
}

export const leaderboardStateSchema = Schema.Struct({
  messages: Schema.Array(contributionMessageSchema).pipe(Schema.mutable),
  viewerProfile: Schema.NullOr(viewerProfileSchema),
  scopeObservations: Schema.Array(scopeObservationSchema).pipe(Schema.mutable),
  popupPreferences: Schema.NullOr(popupPreferencesSchema),
  categories: Schema.Array(categoryRecordSchema).pipe(Schema.mutable),
  messageCategoryAssignments: Schema.Array(
    messageCategoryAssignmentSchema
  ).pipe(Schema.mutable),
  updatedAt: Schema.NullOr(Schema.String)
})

export interface TreemapTile {
  id: string
  label: string
  messageCount: number
  percentage: number
}

export interface TreemapSummary {
  totalMessages: number
  tiles: TreemapTile[]
}

export interface RankedContributor {
  rank: number
  authorKey: string
  authorName: string
  authorAvatarUrl: string | null
  score: number
  messageCount: number
  replyCount: number
  attachmentCount: number
  reactionCount: number
  lastContributionAt: string
}

export interface GuildOption {
  guildId: string
  guildName: string
  messageCount: number
}

export interface ChannelOption {
  channelId: string
  channelName: string
  messageCount: number
}

export interface CoverageSummary {
  targetMs: number
  oldestMessageAt: string | null
  newestMessageAt: string | null
  coverageMs: number
  missingMs: number
  capturedMessageCount: number
  capturedContributorCount: number
  isWindowFullyCovered: boolean
}

export interface DataReadiness {
  timeRange: TimeRangeKey
  status: "ready" | "scroll" | "stale"
  label: string
}

export interface LeaderboardSummary {
  ranked: RankedContributor[]
  viewer: RankedContributor | null
  gapToTopTen: number | null
  topTenScore: number | null
  isTopTenOpen: boolean
  totalMessages: number
}
