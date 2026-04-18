import { beforeEach, describe, expect, it, vi } from "vitest"

import { loadState, saveState, saveViewerProfile } from "../storage"
import type { LeaderboardState } from "../types"

describe("storage category retention", () => {
  const storage = new Map<string, unknown>()

  beforeEach(() => {
    storage.clear()
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key?: string) => {
            if (typeof key === "string") {
              return { [key]: storage.get(key) }
            }

            return Object.fromEntries(storage.entries())
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(items)) {
              storage.set(key, value)
            }
          })
        },
        onChanged: {
          addListener: vi.fn()
        }
      }
    })
  })

  it("removes categories that have no remaining assigned messages", async () => {
    await saveState(
      createState({
        messages: [],
        categories: [
          {
            id: "cat:guild-1:bug",
            guildId: "guild-1",
            name: "Bug",
            normalizedName: "bug",
            createdAt: "2026-04-16T08:00:00.000Z"
          }
        ],
        messageCategoryAssignments: [
          {
            messageId: "guild-1:channel-1:message-1",
            guildId: "guild-1",
            categoryId: "cat:guild-1:bug",
            assignedAt: "2026-04-16T10:05:00.000Z"
          }
        ]
      })
    )

    const saved = await loadState()

    expect(saved.categories).toEqual([])
    expect(saved.messageCategoryAssignments).toEqual([])
  })

  it("drops legacy messages that do not carry an explicit reply flag", async () => {
    storage.set("discordLeaderboardState", {
      messages: [
        {
          id: "guild-1:channel-1:message-1",
          guildId: "guild-1",
          guildName: "Guild One",
          channelId: "channel-1",
          channelName: "alpha",
          authorKey: "author-1",
          authorName: "Alice",
          authorAvatarUrl: null,
          messageTimestamp: "2026-04-16T10:00:00.000Z",
          capturedAt: "2026-04-16T10:00:00.000Z",
          contentLength: 42,
          reactionCount: 0,
          attachmentCount: 0,
          score: 1
        }
      ]
    })

    const saved = await loadState()

    expect(saved.messages).toEqual([])
  })

  it("preserves category assignments when capture saves viewer state concurrently", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key?: string) => {
            if (typeof key === "string") {
              return { [key]: storage.get(key) }
            }

            return Object.fromEntries(storage.entries())
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            await new Promise((resolve) => setTimeout(resolve, 1))

            for (const [key, value] of Object.entries(items)) {
              storage.set(key, value)
            }
          })
        },
        onChanged: {
          addListener: vi.fn()
        }
      }
    })

    await Promise.all([
      saveState(
        createState({
          messages: [createMessage("guild-1:channel-1:message-1")],
          categories: [createCategory("Bug")],
          messageCategoryAssignments: [
            createAssignment("guild-1:channel-1:message-1", "cat:guild-1:bug")
          ]
        })
      ),
      saveViewerProfile({
        displayName: "Josh",
        avatarUrl: null,
        authorKeys: ["josh"],
        capturedAt: "2026-04-16T10:05:00.000Z"
      })
    ])

    const saved = await loadState()

    expect(saved.categories).toEqual([createCategory("Bug")])
    expect(saved.messageCategoryAssignments).toEqual([
      createAssignment("guild-1:channel-1:message-1", "cat:guild-1:bug")
    ])
    expect(saved.viewerProfile).toEqual({
      displayName: "Josh",
      avatarUrl: null,
      authorKeys: ["josh"],
      capturedAt: "2026-04-16T10:05:00.000Z"
    })
  })
})

function createState(
  overrides: Partial<LeaderboardState> = {}
): LeaderboardState {
  return {
    messages: [],
    viewerProfile: null,
    scopeObservations: [],
    popupPreferences: null,
    categories: [],
    messageCategoryAssignments: [],
    updatedAt: "2026-04-16T12:00:00.000Z",
    ...overrides
  }
}

function createCategory(name: string) {
  return {
    id: "cat:guild-1:bug",
    guildId: "guild-1",
    name,
    normalizedName: name.toLowerCase(),
    createdAt: "2026-04-16T08:00:00.000Z"
  }
}

function createAssignment(messageId: string, categoryId: string) {
  return {
    messageId,
    guildId: "guild-1",
    categoryId,
    assignedAt: "2026-04-16T10:05:00.000Z"
  }
}

function createMessage(messageId: string) {
  return {
    id: messageId,
    guildId: "guild-1",
    guildName: "Guild One",
    channelId: "channel-1",
    channelName: "alpha",
    authorKey: "author-1",
    authorName: "Alice",
    authorAvatarUrl: null,
    messageTimestamp: "2026-04-16T10:00:00.000Z",
    capturedAt: "2026-04-16T10:00:01.000Z",
    contentLength: 42,
    reactionCount: 0,
    attachmentCount: 0,
    isReply: false,
    score: 1
  }
}
