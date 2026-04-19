import type {
  CommunityRef,
  ContributionMessage,
  LeaderboardState,
  ViewerProfile
} from "../shared/types"

export interface CaptureCategorizationRuntime {
  document: Document
  guildId: string
  loadState: () => Promise<LeaderboardState>
  saveState: (state: LeaderboardState) => Promise<void>
}

export interface CaptureSource {
  detectCurrentCommunity(): CommunityRef | null
  detectViewerProfile(): ViewerProfile | null
  detectLiveEdge(): boolean
  extractVisibleMessages(community: CommunityRef): ContributionMessage[]
  enhanceCategorizationControls(
    runtime: CaptureCategorizationRuntime
  ): Promise<void>
}
