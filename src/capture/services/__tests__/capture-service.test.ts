import { Effect, Layer } from "effect"
import { JSDOM } from "jsdom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
  LeaderboardState,
  ScopeObservation,
  ViewerProfile
} from "../../../shared/types"
import type { CaptureSource } from "../../lib/types"
import { CaptureBrowser } from "../browser-service"
import { CaptureService } from "../capture-service"
import { CaptureStorage } from "../storage-service"

describe("CaptureService", () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it("captures visible messages and delegates categorization state through storage", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-19T08:30:00.000Z"))

    const dom = new JSDOM("<body></body>")
    let state = createState()
    const savedViewerProfiles: Array<ViewerProfile | null> = []
    const savedScopeObservations: ScopeObservation[] = []
    const mergedMessageBatches: Array<LeaderboardState["messages"]> = []
    const savedStates: LeaderboardState[] = []

    const fakeSource: CaptureSource = {
      supportsLocation: () => true,
      detectCurrentCommunity: () => ({
        guildId: "guild-1",
        guildName: "Guild One",
        channelId: "channel-1",
        channelName: "general"
      }),
      detectViewerProfile: () => ({
        displayName: "Jess",
        avatarUrl: "https://example.com/jess.png",
        authorKeys: ["Jess::avatar", "Jess::none"],
        capturedAt: "2026-04-19T08:29:00.000Z"
      }),
      detectLiveEdge: () => true,
      extractVisibleMessages: () => [
        {
          id: "guild-1:channel-1:message-1",
          guildId: "guild-1",
          guildName: "Guild One",
          channelId: "channel-1",
          channelName: "general",
          authorKey: "author-1",
          authorName: "Alice",
          authorAvatarUrl: null,
          messageTimestamp: "2026-04-19T08:00:00.000Z",
          capturedAt: "2026-04-19T08:30:00.000Z",
          contentLength: 12,
          reactionCount: 2,
          attachmentCount: 0,
          isReply: false,
          score: 3
        }
      ],
      enhanceCategorizationControls: async (runtime) => {
        expect(runtime.document).toBe(dom.window.document)
        expect(runtime.guildId).toBe("guild-1")
        expect(await runtime.loadState()).toBe(state)

        const nextState = {
          ...state,
          updatedAt: "2026-04-19T08:31:00.000Z"
        }

        await runtime.saveState(nextState)
      }
    }

    const captureLayer = CaptureService.layer.pipe(
      Layer.provide(
        Layer.succeed(CaptureBrowser)({
          document: dom.window.document,
          resolveCurrentSource: () => fakeSource
        })
      ),
      Layer.provide(
        Layer.succeed(CaptureStorage)({
          loadState: () => Effect.sync(() => state),
          saveState: (nextState: LeaderboardState) =>
            Effect.sync(() => {
              state = nextState
              savedStates.push(nextState)
            }),
          mergeMessages: (messages) =>
            Effect.sync(() => {
              mergedMessageBatches.push(messages)
            }),
          saveScopeObservation: (observation) =>
            Effect.sync(() => {
              savedScopeObservations.push(observation)
            }),
          saveViewerProfile: (profile) =>
            Effect.sync(() => {
              savedViewerProfiles.push(profile)
            })
        })
      )
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const capture = yield* CaptureService
        yield* capture.captureOnce()
      }).pipe(Effect.provide(captureLayer))
    )

    expect(savedViewerProfiles).toEqual([
      {
        displayName: "Jess",
        avatarUrl: "https://example.com/jess.png",
        authorKeys: ["Jess::avatar", "Jess::none"],
        capturedAt: "2026-04-19T08:29:00.000Z"
      }
    ])
    expect(savedScopeObservations).toEqual([
      {
        guildId: "guild-1",
        channelId: "channel-1",
        capturedAt: "2026-04-19T08:30:00.000Z",
        sawLiveEdge: true
      }
    ])
    expect(mergedMessageBatches).toHaveLength(1)
    expect(mergedMessageBatches[0]?.map((message) => message.id)).toEqual([
      "guild-1:channel-1:message-1"
    ])
    expect(savedStates).toEqual([
      {
        ...createState(),
        updatedAt: "2026-04-19T08:31:00.000Z"
      }
    ])
  })

  it("saves the viewer profile before exiting when no community is detected", async () => {
    const dom = new JSDOM("<body></body>")
    const savedViewerProfiles: Array<ViewerProfile | null> = []
    const savedScopeObservations: ScopeObservation[] = []
    const mergedMessageBatches: Array<LeaderboardState["messages"]> = []
    const savedStates: LeaderboardState[] = []

    const fakeSource: CaptureSource = {
      supportsLocation: () => true,
      detectCurrentCommunity: () => null,
      detectViewerProfile: () => ({
        displayName: "Jess",
        avatarUrl: null,
        authorKeys: ["Jess::none"],
        capturedAt: "2026-04-19T08:29:00.000Z"
      }),
      detectLiveEdge: () => false,
      extractVisibleMessages: () => [],
      enhanceCategorizationControls: async () => {
        throw new Error("categorization controls should not run")
      }
    }

    const captureLayer = CaptureService.layer.pipe(
      Layer.provide(
        Layer.succeed(CaptureBrowser)({
          document: dom.window.document,
          resolveCurrentSource: () => fakeSource
        })
      ),
      Layer.provide(
        Layer.succeed(CaptureStorage)({
          loadState: () => Effect.succeed(createState()),
          saveState: (nextState: LeaderboardState) =>
            Effect.sync(() => {
              savedStates.push(nextState)
            }),
          mergeMessages: (messages) =>
            Effect.sync(() => {
              mergedMessageBatches.push(messages)
            }),
          saveScopeObservation: (observation) =>
            Effect.sync(() => {
              savedScopeObservations.push(observation)
            }),
          saveViewerProfile: (profile) =>
            Effect.sync(() => {
              savedViewerProfiles.push(profile)
            })
        })
      )
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const capture = yield* CaptureService
        yield* capture.captureOnce()
      }).pipe(Effect.provide(captureLayer))
    )

    expect(savedViewerProfiles).toEqual([
      {
        displayName: "Jess",
        avatarUrl: null,
        authorKeys: ["Jess::none"],
        capturedAt: "2026-04-19T08:29:00.000Z"
      }
    ])
    expect(savedScopeObservations).toEqual([])
    expect(mergedMessageBatches).toEqual([])
    expect(savedStates).toEqual([])
  })
})

function createState(): LeaderboardState {
  return {
    messages: [],
    viewerProfile: null,
    scopeObservations: [],
    popupPreferences: null,
    categories: [],
    messageCategoryAssignments: [],
    updatedAt: null
  }
}
