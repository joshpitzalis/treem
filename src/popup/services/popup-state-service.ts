import { Context, Effect, Layer } from "effect"
import { resolveInitialSelection } from "../helpers"
import type { InitialPopupModel } from "../types"
import { LeaderboardStorage } from "./storage-service"

export class PopupStateService extends Context.Service<PopupStateService>()(
  "popup/PopupStateService",
  {
    make: Effect.gen(function* () {
      const storage = yield* LeaderboardStorage

      return {
        loadInitialPopupModel: (): Effect.Effect<InitialPopupModel> =>
          Effect.gen(function* () {
            const state = yield* storage.loadState()

            return {
              state,
              selection: resolveInitialSelection(state)
            }
          })
      }
    })
  }
) {
  static layer = Layer.effect(this, this.make)
}
