import { JSDOM } from "jsdom"
import { describe, expect, it } from "vitest"

import type { LeaderboardState, PopupPreferences } from "../../shared/types"

describe("popup treemap baseline", () => {
  it("keeps leaderboard and treemap on same scope and time range", async () => {
    const dom = new JSDOM(
      `
        <main class="app-shell">
          <section class="controls">
            <button id="score-info-toggle" type="button"></button>
            <select id="guild-select"></select>
            <select id="channel-select"></select>
            <div id="readiness-strip"></div>
            <div id="score-info" hidden></div>
            <p id="sync-status" hidden></p>
            <p id="status"></p>
          </section>
          <section id="leaderboard"></section>
          <section id="treemap"></section>
        </main>
      `,
      {
        url: "https://example.test"
      }
    )

    const { window } = dom
    const savedPreferences: PopupPreferences[] = []

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const popupModule = await import("../popup")
    await popupModule.bootstrapPopup({
      document: window.document,
      loadState: async () => createState(),
      savePopupPreferences: async (preferences) => {
        savedPreferences.push(preferences)
      },
      addStorageChangeListener: () => {}
    })

    expect(
      window.document.querySelector("#leaderboard")?.textContent ?? ""
    ).toMatch(/Guild One/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/Guild One/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/Bug/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/2 messages/)

    const channelSelect =
      window.document.querySelector<HTMLSelectElement>("#channel-select")
    if (!channelSelect) {
      throw new Error("Expected channel select")
    }

    channelSelect.value = "channel-1"
    channelSelect.dispatchEvent(new window.Event("change"))

    expect(
      window.document.querySelector("#leaderboard")?.textContent ?? ""
    ).toMatch(/Guild One \/ #alpha/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/Guild One \/ #alpha/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/Feature/)

    const firstDayTab = window.document.querySelector<HTMLButtonElement>(
      '.time-tab[data-range="24h"]'
    )
    if (!firstDayTab) {
      throw new Error("Expected 24h time tab")
    }
    firstDayTab.click()

    expect(
      window.document.querySelector("#leaderboard")?.textContent ?? ""
    ).toMatch(/Alice/)
    expect(
      window.document.querySelector("#leaderboard")?.textContent ?? ""
    ).not.toMatch(/Bob/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/Bug/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/100%/)
    expect(savedPreferences.length).toBe(2)
  })
})

function createState(): LeaderboardState {
  return {
    messages: [
      createMessage({
        id: "m-1",
        guildId: "guild-1",
        guildName: "Guild One",
        channelId: "channel-1",
        channelName: "alpha",
        authorKey: "alice",
        authorName: "Alice",
        messageTimestamp: "2026-04-16T10:00:00.000Z"
      }),
      createMessage({
        id: "m-2",
        guildId: "guild-1",
        guildName: "Guild One",
        channelId: "channel-1",
        channelName: "alpha",
        authorKey: "bob",
        authorName: "Bob",
        messageTimestamp: "2026-04-13T10:00:00.000Z"
      }),
      createMessage({
        id: "m-3",
        guildId: "guild-1",
        guildName: "Guild One",
        channelId: "channel-1",
        channelName: "alpha",
        authorKey: "alice",
        authorName: "Alice",
        messageTimestamp: "2026-03-30T10:00:00.000Z"
      }),
      createMessage({
        id: "m-4",
        guildId: "guild-1",
        guildName: "Guild One",
        channelId: "channel-2",
        channelName: "beta",
        authorKey: "cara",
        authorName: "Cara",
        messageTimestamp: "2026-04-16T08:00:00.000Z"
      }),
      createMessage({
        id: "m-5",
        guildId: "guild-2",
        guildName: "Guild Two",
        channelId: "channel-3",
        channelName: "gamma",
        authorKey: "drew",
        authorName: "Drew",
        messageTimestamp: "2026-04-16T09:00:00.000Z"
      })
    ],
    viewerProfile: null,
    scopeObservations: [],
    popupPreferences: null,
    categories: [
      {
        id: "cat-bug",
        guildId: "guild-1",
        name: "Bug",
        normalizedName: "bug",
        createdAt: "2026-04-16T07:00:00.000Z"
      },
      {
        id: "cat-feature",
        guildId: "guild-1",
        name: "Feature",
        normalizedName: "feature",
        createdAt: "2026-04-16T07:05:00.000Z"
      }
    ],
    messageCategoryAssignments: [
      {
        messageId: "m-1",
        guildId: "guild-1",
        categoryId: "cat-bug",
        assignedAt: "2026-04-16T10:05:00.000Z"
      },
      {
        messageId: "m-2",
        guildId: "guild-1",
        categoryId: "cat-feature",
        assignedAt: "2026-04-13T10:05:00.000Z"
      },
      {
        messageId: "m-4",
        guildId: "guild-1",
        categoryId: "cat-bug",
        assignedAt: "2026-04-16T08:05:00.000Z"
      }
    ],
    updatedAt: "2026-04-16T12:00:00.000Z"
  }
}

function createMessage(input: {
  id: string
  guildId: string
  guildName: string
  channelId: string
  channelName: string
  authorKey: string
  authorName: string
  messageTimestamp: string
}) {
  return {
    ...input,
    authorAvatarUrl: null,
    capturedAt: input.messageTimestamp,
    contentLength: 48,
    reactionCount: 0,
    attachmentCount: 0,
    isReply: false,
    score: 1
  }
}
