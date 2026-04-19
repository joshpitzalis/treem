import type {
  LeaderboardState,
  PopupPreferences,
  TimeRangeKey
} from "../shared/types"

export interface PopupSelection {
  guildId: string | null
  channelId: string
  timeRange: TimeRangeKey
}

export interface InitialPopupModel {
  state: LeaderboardState
  selection: PopupSelection
}

export interface PopupRuntime {
  document: Document
  loadInitialPopupModel: () => Promise<InitialPopupModel>
  loadState: () => Promise<LeaderboardState>
  savePopupPreferences: (preferences: PopupPreferences) => Promise<void>
  subscribeToLeaderboardStateChanges: (listener: () => void) => () => void
}

export interface RefreshRequest {
  showLoading: boolean
}

export interface TreemapRect {
  top: number
  left: number
  width: number
  height: number
}

export type TreemapTileDensity = "large" | "medium" | "small" | "tiny"
