export type TimeRangeKey = "24h" | "7d" | "30d"
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

export interface ViewerProfile {
  displayName: string
  avatarUrl: string | null
  authorKeys: string[]
  capturedAt: string
}

export interface ScopeObservation {
  guildId: string
  channelId: string
  capturedAt: string
  sawLiveEdge: boolean
}

export interface PopupPreferences {
  selectedGuildId: string | null
  selectedChannelId: string | null
  selectedTimeRange: TimeRangeKey | null
}

export interface LeaderboardState {
  messages: ContributionMessage[]
  viewerProfile: ViewerProfile | null
  scopeObservations: ScopeObservation[]
  popupPreferences: PopupPreferences | null
  updatedAt: string | null
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
