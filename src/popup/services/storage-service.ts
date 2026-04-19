import { Context, Effect, Layer } from "effect"
import { loadState, savePopupPreferences } from "../../shared/storage"
import type { PopupPreferences } from "../../shared/types"

export class LeaderboardStorage extends Context.Service<LeaderboardStorage>()(
  "popup/LeaderboardStorage",
  {
    make: Effect.succeed({
      loadState: () => Effect.promise(() => loadState()),
      savePopupPreferences: (preferences: PopupPreferences) =>
        Effect.promise(() => savePopupPreferences(preferences))
    })
  }
) {
  static layer = Layer.effect(this, this.make)
}
