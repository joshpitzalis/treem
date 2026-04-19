import { Context, Effect, Layer } from "effect"
import { loadState } from "../../shared/storage"

export class LeaderboardStorage extends Context.Service<LeaderboardStorage>()(
  "popup/LeaderboardStorage",
  {
    make: Effect.succeed({
      loadState: () => Effect.promise(() => loadState())
    })
  }
) {
  static layer = Layer.effect(this, this.make)
}
