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
    expect(
      window.document.querySelector("#sync-status")?.textContent ?? ""
    ).toBe("")
    expect(
      window.document.querySelector("#status")?.textContent ?? ""
    ).not.toMatch(/Processing/)
    expect(savedPreferences.length).toBe(2)
  })

  it("renders mixed named categories plus uncategorized and omits empty categories per time slice", async () => {
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

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const popupModule = await import("../popup")
    await popupModule.bootstrapPopup({
      document: window.document,
      loadState: async () => createMixedCompositionState(),
      savePopupPreferences: async () => {},
      addStorageChangeListener: () => {}
    })

    expect(readTreemapTileLabels(window.document)).toEqual([
      "Bug",
      "Uncategorized",
      "Feature"
    ])
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/Bug[\s\S]*2 messages[\s\S]*40% of slice/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/Uncategorized[\s\S]*2 messages[\s\S]*40% of slice/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).not.toMatch(/Empty/)

    const range7d = window.document.querySelector<HTMLButtonElement>(
      '.time-tab[data-range="7d"]'
    )
    if (!range7d) {
      throw new Error("Expected 7d time tab")
    }
    range7d.click()

    expect(readTreemapTileLabels(window.document)).toEqual(["Bug", "Feature"])
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/Bug[\s\S]*2 messages[\s\S]*66.7% of slice/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/Feature[\s\S]*1 messages[\s\S]*33.3% of slice/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).not.toMatch(/Uncategorized/)

    const range24h = window.document.querySelector<HTMLButtonElement>(
      '.time-tab[data-range="24h"]'
    )
    if (!range24h) {
      throw new Error("Expected 24h time tab")
    }
    range24h.click()

    expect(readTreemapTileLabels(window.document)).toEqual(["Bug"])
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/Bug[\s\S]*2 messages[\s\S]*100% of slice/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).not.toMatch(/Feature|Uncategorized|Empty/)
  })

  it("sizes treemap tiles by message count", async () => {
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

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const popupModule = await import("../popup")
    await popupModule.bootstrapPopup({
      document: window.document,
      loadState: async () => createState(),
      savePopupPreferences: async () => {},
      addStorageChangeListener: () => {}
    })

    expect(readTreemapTileArea(window.document, "cat-bug")).toBeCloseTo(5000, 0)
    expect(readTreemapTileArea(window.document, "cat-feature")).toBeCloseTo(
      2500,
      0
    )
    expect(readTreemapTileArea(window.document, "cat-bug")).toBeGreaterThan(
      readTreemapTileArea(window.document, "cat-feature")
    )
    expect(readTreemapTileArea(window.document, "cat-bug")).toBeGreaterThan(
      readTreemapTileArea(window.document, "uncategorized")
    )
  })

  it("applies the latest storage change after an in-flight refresh", async () => {
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
    const originalSetTimeout = window.setTimeout.bind(window)
    let storageListenerRegistered = false
    let storageListener = (
      _changes: Record<string, unknown>,
      _areaName: string
    ) => {}
    let state = createState()
    let loadStateCallCount = 0
    let blockedLoadResolverRegistered = false
    let resolveBlockedLoad = (_state: LeaderboardState) => {}

    window.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === "function") {
        handler()
      }

      return 0
    }) as typeof window.setTimeout

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const popupModule = await import("../popup")
    await popupModule.bootstrapPopup({
      document: window.document,
      loadState: async () => {
        loadStateCallCount += 1

        if (loadStateCallCount === 2) {
          return await new Promise<LeaderboardState>((resolve) => {
            blockedLoadResolverRegistered = true
            resolveBlockedLoad = resolve
          })
        }

        return state
      },
      savePopupPreferences: async () => {},
      addStorageChangeListener: (listener) => {
        storageListenerRegistered = true
        storageListener = listener
      }
    })

    if (!storageListenerRegistered) {
      throw new Error("Expected storage listener")
    }

    storageListener({ discordLeaderboardState: {} }, "local")

    state = {
      ...state,
      categories: [
        ...state.categories,
        {
          id: "cat-docs",
          guildId: "guild-1",
          name: "Docs",
          normalizedName: "docs",
          createdAt: "2026-04-16T12:30:00.000Z"
        }
      ],
      messageCategoryAssignments: state.messageCategoryAssignments.map(
        (assignment) =>
          assignment.messageId === "m-2"
            ? {
                ...assignment,
                categoryId: "cat-docs",
                assignedAt: "2026-04-16T12:31:00.000Z"
              }
            : assignment
      ),
      updatedAt: "2026-04-16T12:31:00.000Z"
    }

    storageListener({ discordLeaderboardState: {} }, "local")
    if (!blockedLoadResolverRegistered) {
      throw new Error("Expected blocked load resolver")
    }
    resolveBlockedLoad(createState())
    await new Promise((resolve) => originalSetTimeout(resolve, 0))

    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).toMatch(/Docs/)
    expect(
      window.document.querySelector("#treemap")?.textContent ?? ""
    ).not.toMatch(/Feature/)
    expect(
      window.document.querySelector("#sync-status")?.textContent ?? ""
    ).toBe("")
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

function createMixedCompositionState(): LeaderboardState {
  return {
    messages: [
      createMessage({
        id: "mix-1",
        guildId: "guild-1",
        guildName: "Guild One",
        channelId: "channel-1",
        channelName: "alpha",
        authorKey: "alice",
        authorName: "Alice",
        messageTimestamp: "2026-04-16T10:00:00.000Z"
      }),
      createMessage({
        id: "mix-2",
        guildId: "guild-1",
        guildName: "Guild One",
        channelId: "channel-1",
        channelName: "alpha",
        authorKey: "bob",
        authorName: "Bob",
        messageTimestamp: "2026-04-16T09:00:00.000Z"
      }),
      createMessage({
        id: "mix-3",
        guildId: "guild-1",
        guildName: "Guild One",
        channelId: "channel-1",
        channelName: "alpha",
        authorKey: "cara",
        authorName: "Cara",
        messageTimestamp: "2026-04-13T10:00:00.000Z"
      }),
      createMessage({
        id: "mix-4",
        guildId: "guild-1",
        guildName: "Guild One",
        channelId: "channel-2",
        channelName: "beta",
        authorKey: "drew",
        authorName: "Drew",
        messageTimestamp: "2026-03-25T10:00:00.000Z"
      }),
      createMessage({
        id: "mix-5",
        guildId: "guild-1",
        guildName: "Guild One",
        channelId: "channel-2",
        channelName: "beta",
        authorKey: "eve",
        authorName: "Eve",
        messageTimestamp: "2026-03-24T10:00:00.000Z"
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
      },
      {
        id: "cat-empty",
        guildId: "guild-1",
        name: "Empty",
        normalizedName: "empty",
        createdAt: "2026-04-16T07:10:00.000Z"
      }
    ],
    messageCategoryAssignments: [
      {
        messageId: "mix-1",
        guildId: "guild-1",
        categoryId: "cat-bug",
        assignedAt: "2026-04-16T10:05:00.000Z"
      },
      {
        messageId: "mix-2",
        guildId: "guild-1",
        categoryId: "cat-bug",
        assignedAt: "2026-04-16T09:05:00.000Z"
      },
      {
        messageId: "mix-3",
        guildId: "guild-1",
        categoryId: "cat-feature",
        assignedAt: "2026-04-13T10:05:00.000Z"
      }
    ],
    updatedAt: "2026-04-16T12:00:00.000Z"
  }
}

function readTreemapTileLabels(document: Document): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".treemap-tile-name")
  ).map((node) => node.textContent ?? "")
}

function readTreemapTileArea(document: Document, tileId: string): number {
  const tile = document.querySelector<HTMLElement>(`[data-tile-id="${tileId}"]`)
  if (!tile) {
    throw new Error(`Expected treemap tile ${tileId}`)
  }

  const style = tile.getAttribute("style") ?? ""
  const width = readStylePercentage(style, "width")
  const height = readStylePercentage(style, "height")

  return width * height
}

function readStylePercentage(style: string, property: string): number {
  const match = style.match(new RegExp(`${property}:([0-9.]+)%`))
  if (!match) {
    throw new Error(`Expected ${property} in style: ${style}`)
  }

  return Number(match[1])
}
