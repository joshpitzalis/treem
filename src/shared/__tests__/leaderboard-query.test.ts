import { describe, expect, it } from "vitest"

import { filterMessagesByView, summarizeTreemap } from "../leaderboard-query"
import type { ContributionMessage } from "../types"

const NOW = Date.parse("2026-04-16T12:00:00.000Z")

describe("summarizeTreemap", () => {
  it("returns named category plus uncategorized composition", () => {
    const messages = [
      createMessage("m-1", "2026-04-16T10:00:00.000Z"),
      createMessage("m-2", "2026-04-16T09:00:00.000Z"),
      createMessage("m-3", "2026-04-16T08:00:00.000Z")
    ]

    expect(
      summarizeTreemap({
        messages,
        categories: [
          {
            id: "cat-bug",
            guildId: "guild-1",
            name: "Bug",
            normalizedName: "bug",
            createdAt: "2026-04-16T07:00:00.000Z"
          }
        ],
        messageCategoryAssignments: [
          {
            messageId: "m-1",
            guildId: "guild-1",
            categoryId: "cat-bug",
            assignedAt: "2026-04-16T10:30:00.000Z"
          },
          {
            messageId: "m-2",
            guildId: "guild-1",
            categoryId: "cat-bug",
            assignedAt: "2026-04-16T09:30:00.000Z"
          }
        ]
      })
    ).toEqual({
      totalMessages: 3,
      tiles: [
        {
          id: "cat-bug",
          label: "Bug",
          messageCount: 2,
          percentage: 66.7
        },
        {
          id: "uncategorized",
          label: "Uncategorized",
          messageCount: 1,
          percentage: 33.3
        }
      ]
    })
  })

  it("returns uncategorized counts for each popup time slice", () => {
    const messages = [
      createMessage("m-24h", "2026-04-16T10:00:00.000Z"),
      createMessage("m-7d", "2026-04-13T09:00:00.000Z"),
      createMessage("m-30d", "2026-03-25T09:00:00.000Z")
    ]

    const last24Hours = summarizeTreemap({
      messages: filterMessagesByView({
        messages,
        guildId: "guild-1",
        scopeMode: "server",
        channelId: null,
        timeRange: "24h",
        now: NOW
      }),
      categories: [],
      messageCategoryAssignments: []
    })
    const last7Days = summarizeTreemap({
      messages: filterMessagesByView({
        messages,
        guildId: "guild-1",
        scopeMode: "server",
        channelId: null,
        timeRange: "7d",
        now: NOW
      }),
      categories: [],
      messageCategoryAssignments: []
    })
    const last30Days = summarizeTreemap({
      messages: filterMessagesByView({
        messages,
        guildId: "guild-1",
        scopeMode: "server",
        channelId: null,
        timeRange: "30d",
        now: NOW
      }),
      categories: [],
      messageCategoryAssignments: []
    })

    expect(last24Hours).toEqual({
      totalMessages: 1,
      tiles: [
        {
          id: "uncategorized",
          label: "Uncategorized",
          messageCount: 1,
          percentage: 100
        }
      ]
    })
    expect(last7Days.tiles[0]?.messageCount).toBe(2)
    expect(last30Days.tiles[0]?.messageCount).toBe(3)
  })

  it("returns empty treemap when slice has no messages", () => {
    expect(
      summarizeTreemap({
        messages: [],
        categories: [],
        messageCategoryAssignments: []
      })
    ).toEqual({
      totalMessages: 0,
      tiles: []
    })
  })
})

function createMessage(
  id: string,
  messageTimestamp: string
): ContributionMessage {
  return {
    id,
    guildId: "guild-1",
    guildName: "Guild One",
    channelId: "channel-1",
    channelName: "alpha",
    authorKey: `author-${id}`,
    authorName: `Author ${id}`,
    authorAvatarUrl: null,
    messageTimestamp,
    capturedAt: messageTimestamp,
    contentLength: 42,
    reactionCount: 0,
    attachmentCount: 0,
    isReply: false,
    score: 1
  }
}
