import type { loadState, savePopupPreferences } from "../shared/storage"
import type { TimeRangeKey } from "../shared/types"

export interface PopupRuntime {
  document: Document
  loadState: typeof loadState
  savePopupPreferences: typeof savePopupPreferences
  subscribeToLeaderboardStateChanges: (listener: () => void) => () => void
}

export interface PopupSelection {
  guildId: string | null
  channelId: string
  timeRange: TimeRangeKey
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
