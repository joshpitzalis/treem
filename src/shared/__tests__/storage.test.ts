import { beforeEach, describe, expect, it, vi } from "vitest"

import { loadState, saveState } from "../storage"
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
