import { Context, Effect, Layer } from "effect"
import {
  loadState,
  mergeMessages,
  saveScopeObservation,
  saveState,
  saveViewerProfile
} from "../../shared/storage"
import type {
  ContributionMessage,
  LeaderboardState,
  ScopeObservation,
  ViewerProfile
} from "../../shared/types"

export interface CaptureStorageApi {
  loadState: () => Effect.Effect<LeaderboardState>
  saveState: (state: LeaderboardState) => Effect.Effect<void>
  mergeMessages: (messages: ContributionMessage[]) => Effect.Effect<void>
  saveScopeObservation: (observation: ScopeObservation) => Effect.Effect<void>
  saveViewerProfile: (profile: ViewerProfile | null) => Effect.Effect<void>
}

export class CaptureStorage extends Context.Service<CaptureStorage>()(
  "capture/CaptureStorage",
  {
    make: Effect.succeed<CaptureStorageApi>({
      loadState: () => Effect.promise(() => loadState()),
      saveState: (state: LeaderboardState) =>
        Effect.promise(() => saveState(state)),
      mergeMessages: (messages: ContributionMessage[]) =>
        Effect.promise(() => mergeMessages(messages)),
      saveScopeObservation: (observation: ScopeObservation) =>
        Effect.promise(() => saveScopeObservation(observation)),
      saveViewerProfile: (profile: ViewerProfile | null) =>
        Effect.promise(() => saveViewerProfile(profile))
    })
  }
) {
  static layer = Layer.effect(this, this.make)
}
