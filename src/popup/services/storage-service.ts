import { Context, Effect, Layer } from "effect"
import { loadState, savePopupPreferences } from "../../shared/storage"
import type { PopupPreferences } from "../../shared/types"

const LEADERBOARD_STORAGE_KEY = "discordLeaderboardState"

export class LeaderboardStorage extends Context.Service<LeaderboardStorage>()(
  "popup/LeaderboardStorage",
  {
    make: Effect.succeed({
      loadState: () => Effect.promise(() => loadState()),
      savePopupPreferences: (preferences: PopupPreferences) =>
        Effect.promise(() => savePopupPreferences(preferences)),
      subscribeToLeaderboardStateChanges: (onChange: () => void) =>
        Effect.sync(() => {
          const handleChange = (
            changes: Record<string, unknown>,
            areaName: string
          ) => {
            if (areaName !== "local") return
            if (!(LEADERBOARD_STORAGE_KEY in changes)) return

            onChange()
          }

          chrome.storage.onChanged.addListener(handleChange)

          return () => {
            chrome.storage.onChanged.removeListener(handleChange)
          }
        })
    })
  }
) {
  static layer = Layer.effect(this, this.make)
}
