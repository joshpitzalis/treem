import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { JSDOM } from "jsdom"

import type { LeaderboardState, PopupPreferences } from "../shared/types"

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

    const popupModule = await import("./popup")
    await popupModule.bootstrapPopup({
      document: window.document,
      loadState: async () => createState(),
      savePopupPreferences: async (preferences) => {
        savedPreferences.push(preferences)
      },
      addStorageChangeListener: () => {}
    })

    assert.match(
      window.document.querySelector("#leaderboard")?.textContent ?? "",
      /Guild One/
    )
    assert.match(
      window.document.querySelector("#treemap")?.textContent ?? "",
      /Guild One/
    )
    assert.match(
      window.document.querySelector("#treemap")?.textContent ?? "",
      /4 messages/
    )

    const channelSelect =
      window.document.querySelector<HTMLSelectElement>("#channel-select")
    assert.ok(channelSelect)

    channelSelect.value = "channel-1"
    channelSelect.dispatchEvent(new window.Event("change"))

    assert.match(
      window.document.querySelector("#leaderboard")?.textContent ?? "",
      /Guild One \/ #alpha/
    )
    assert.match(
      window.document.querySelector("#treemap")?.textContent ?? "",
      /Guild One \/ #alpha/
    )
    assert.match(
      window.document.querySelector("#treemap")?.textContent ?? "",
      /3 messages/
    )

    const firstDayTab = window.document.querySelector<HTMLButtonElement>(
      '.time-tab[data-range="24h"]'
    )
    assert.ok(firstDayTab)
    firstDayTab.click()

    assert.match(
      window.document.querySelector("#leaderboard")?.textContent ?? "",
      /Alice/
    )
    assert.doesNotMatch(
      window.document.querySelector("#leaderboard")?.textContent ?? "",
      /Bob/
    )
    assert.match(
      window.document.querySelector("#treemap")?.textContent ?? "",
      /1 messages/
    )
    assert.match(
      window.document.querySelector("#treemap")?.textContent ?? "",
      /100%/
    )
    assert.equal(savedPreferences.length, 2)
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
