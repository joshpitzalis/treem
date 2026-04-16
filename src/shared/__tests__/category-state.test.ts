import { describe, expect, it } from "vitest"

import { createCategoryAndAssign } from "../category-state"
import type { LeaderboardState } from "../types"

describe("createCategoryAndAssign", () => {
  it("creates server-scoped category and assigns stored message", () => {
    const state = createState()

    const result = createCategoryAndAssign({
      state,
      guildId: "guild-1",
      messageId: "guild-1:channel-1:message-1",
      categoryName: "Bug",
      now: "2026-04-16T12:00:00.000Z"
    })

    expect(result.category).toMatchObject({
      guildId: "guild-1",
      name: "Bug",
      normalizedName: "bug"
    })
    expect(result.state.categories).toHaveLength(1)
    expect(result.state.messageCategoryAssignments).toEqual([
      {
        messageId: "guild-1:channel-1:message-1",
        guildId: "guild-1",
        categoryId: result.category.id,
        assignedAt: "2026-04-16T12:00:00.000Z"
      }
    ])
  })

  it("reuses same server category case-insensitively", () => {
    const first = createCategoryAndAssign({
      state: createState(),
      guildId: "guild-1",
      messageId: "guild-1:channel-1:message-1",
      categoryName: "Bug",
      now: "2026-04-16T12:00:00.000Z"
    })

    const second = createCategoryAndAssign({
      state: {
        ...first.state,
        messages: [
          ...first.state.messages,
          createMessage("guild-1:channel-1:message-2")
        ]
      },
      guildId: "guild-1",
      messageId: "guild-1:channel-1:message-2",
      categoryName: "bug",
      now: "2026-04-16T12:05:00.000Z"
    })

    expect(second.state.categories).toHaveLength(1)
    expect(second.category.id).toBe(first.category.id)
    expect(second.state.messageCategoryAssignments).toEqual([
      {
        messageId: "guild-1:channel-1:message-1",
        guildId: "guild-1",
        categoryId: first.category.id,
        assignedAt: "2026-04-16T12:00:00.000Z"
      },
      {
        messageId: "guild-1:channel-1:message-2",
        guildId: "guild-1",
        categoryId: first.category.id,
        assignedAt: "2026-04-16T12:05:00.000Z"
      }
    ])
  })
})

function createState(): LeaderboardState {
  return {
    messages: [createMessage("guild-1:channel-1:message-1")],
    viewerProfile: null,
    scopeObservations: [],
    popupPreferences: null,
    categories: [],
    messageCategoryAssignments: [],
    updatedAt: null
  }
}

function createMessage(id: string) {
  return {
    id,
    guildId: "guild-1",
    guildName: "Guild One",
    channelId: "channel-1",
    channelName: "alpha",
    authorKey: `author-${id}`,
    authorName: `Author ${id}`,
    authorAvatarUrl: null,
    messageTimestamp: "2026-04-16T10:00:00.000Z",
    capturedAt: "2026-04-16T10:00:00.000Z",
    contentLength: 42,
    reactionCount: 0,
    attachmentCount: 0,
    isReply: false,
    score: 1
  }
}
