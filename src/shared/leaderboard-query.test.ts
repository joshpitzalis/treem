import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { filterMessagesByView, summarizeTreemap } from "./leaderboard-query"
import type { ContributionMessage } from "./types"

const NOW = Date.parse("2026-04-16T12:00:00.000Z")

describe("summarizeTreemap", () => {
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
      })
    })
    const last7Days = summarizeTreemap({
      messages: filterMessagesByView({
        messages,
        guildId: "guild-1",
        scopeMode: "server",
        channelId: null,
        timeRange: "7d",
        now: NOW
      })
    })
    const last30Days = summarizeTreemap({
      messages: filterMessagesByView({
        messages,
        guildId: "guild-1",
        scopeMode: "server",
        channelId: null,
        timeRange: "30d",
        now: NOW
      })
    })

    assert.deepEqual(last24Hours, {
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
    assert.equal(last7Days.tiles[0]?.messageCount, 2)
    assert.equal(last30Days.tiles[0]?.messageCount, 3)
  })

  it("returns empty treemap when slice has no messages", () => {
    assert.deepEqual(summarizeTreemap({ messages: [] }), {
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
