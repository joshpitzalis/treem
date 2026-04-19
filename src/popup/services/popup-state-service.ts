import { Context, Effect, Layer } from "effect"
import type { PopupPreferences } from "../../shared/types"
import { resolveInitialSelection, resolvePreservedSelection } from "../helpers"
import type { PopupModel, PopupSelection } from "../types"
import { LeaderboardStorage } from "./storage-service"

export class PopupStateService extends Context.Service<PopupStateService>()(
  "popup/PopupStateService",
  {
    make: Effect.gen(function* () {
      const storage = yield* LeaderboardStorage

      return {
        loadInitialPopupModel: (): Effect.Effect<PopupModel> =>
          Effect.gen(function* () {
            const state = yield* storage.loadState()

            return {
              state,
              selection: resolveInitialSelection(state)
            }
          }),
        refreshPopupModel: (
          previousSelection: PopupSelection
        ): Effect.Effect<PopupModel> =>
          Effect.gen(function* () {
            const state = yield* storage.loadState()

            return {
              state,
              selection: resolvePreservedSelection(state, previousSelection)
            }
          }),
        saveSelection: (nextSelection: PopupSelection): Effect.Effect<void> =>
          Effect.gen(function* () {
            if (!nextSelection.guildId) return

            yield* storage.savePopupPreferences(
              toPopupPreferences(nextSelection)
            )
          }),
        subscribeToLeaderboardStateChanges: (listener: () => void) =>
          storage.subscribeToLeaderboardStateChanges(listener)
      }
    })
  }
) {
  static layer = Layer.effect(this, this.make)
}

function toPopupPreferences(selection: PopupSelection): PopupPreferences {
  return {
    selectedGuildId: selection.guildId,
    selectedChannelId: selection.channelId,
    selectedTimeRange: selection.timeRange
  }
}
