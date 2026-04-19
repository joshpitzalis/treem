import { Context, Effect, Layer } from "effect"
import type {
  CommunityRef,
  LeaderboardState,
  ScopeObservation
} from "../../shared/types"
import type { CaptureCategorizationRuntime, CaptureSource } from "../lib/types"
import { CaptureBrowser } from "./browser-service"
import type { CaptureStorageApi } from "./storage-service"
import { CaptureStorage } from "./storage-service"

export class CaptureService extends Context.Service<CaptureService>()(
  "capture/CaptureService",
  {
    make: Effect.gen(function* () {
      const browser = yield* CaptureBrowser
      const storage = yield* CaptureStorage

      return {
        captureOnce: (): Effect.Effect<void> =>
          Effect.gen(function* () {
            const captureSource = browser.resolveCurrentSource()
            if (!captureSource) return

            const community = captureSource.detectCurrentCommunity()
            const viewerProfile = captureSource.detectViewerProfile()

            if (viewerProfile) {
              yield* storage.saveViewerProfile(viewerProfile)
            }

            if (!community) return

            yield* storage.saveScopeObservation(
              toScopeObservation(community, captureSource)
            )
            yield* mergeVisibleMessages(storage, captureSource, community)
            yield* enhanceCategorizationControls({
              captureSource,
              runtime: createCategorizationRuntime({
                document: browser.document,
                guildId: community.guildId,
                storage
              })
            })
          })
      }
    })
  }
) {
  static layer = Layer.effect(this, this.make)
}

const captureLayer = CaptureService.layer.pipe(
  Layer.provide(CaptureBrowser.layer),
  Layer.provide(CaptureStorage.layer)
)

export function runCaptureEffect<A>(
  effect: Effect.Effect<A, never, CaptureService>
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(captureLayer)))
}

function toScopeObservation(
  community: CommunityRef,
  captureSource: CaptureSource
): ScopeObservation {
  return {
    guildId: community.guildId,
    channelId: community.channelId,
    capturedAt: new Date().toISOString(),
    sawLiveEdge: captureSource.detectLiveEdge()
  }
}

function mergeVisibleMessages(
  storage: CaptureStorageApi,
  captureSource: CaptureSource,
  community: CommunityRef
): Effect.Effect<void> {
  const messages = captureSource.extractVisibleMessages(community)
  if (messages.length === 0) return Effect.void

  return storage.mergeMessages(messages)
}

function enhanceCategorizationControls(input: {
  captureSource: CaptureSource
  runtime: CaptureCategorizationRuntime
}): Effect.Effect<void> {
  return Effect.promise(() =>
    input.captureSource.enhanceCategorizationControls(input.runtime)
  )
}

function createCategorizationRuntime(input: {
  document: Document
  guildId: string
  storage: CaptureStorageApi
}): CaptureCategorizationRuntime {
  return {
    document: input.document,
    guildId: input.guildId,
    loadState: () => Effect.runPromise(input.storage.loadState()),
    saveState: (state: LeaderboardState) =>
      Effect.runPromise(input.storage.saveState(state))
  }
}
