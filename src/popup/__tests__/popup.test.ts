import { cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import { JSDOM } from "jsdom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { LeaderboardState } from "../../shared/types"
import { ALL_CHANNELS_VALUE } from "../lib/constants"
import {
  resolveInitialSelection,
  resolvePreservedSelection
} from "../lib/helpers"
import type { PopupSelection } from "../types"

describe("popup React app", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-17T08:30:00.000Z").getTime()
    )
    delete (globalThis as Partial<typeof globalThis>).document
    delete (globalThis as Partial<typeof globalThis>).window
    delete (globalThis as Partial<typeof globalThis>).navigator
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("mounts popup shell through React and keeps leaderboard and treemap on same scope", async () => {
    const { window } = createPopupDom()
    const savedSelections: PopupSelection[] = []

    const popupModule = await loadPopupModule(window)
    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () => createPopupModel(createState()),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(createState(), previousSelection),
      saveSelection: async (selection) => {
        savedSelections.push(selection)
      },
      subscribeToLeaderboardStateChanges: () => () => {}
    })

    const page = within(window.document.body)

    expect(
      page.getByRole("heading", { name: "Contributions Leaderboard" })
    ).toBeTruthy()
    expect(
      page.getByRole("heading", { name: "Discord Contributions Leaderboard" })
    ).toBeTruthy()
    expect(
      page.getByRole("heading", { name: "Category Composition" })
    ).toBeTruthy()

    const channelSelect = page.getByLabelText("Channel")

    expect(
      within(page.getByTestId("leaderboard")).getByText(/Guild One/)
    ).toBeTruthy()
    expect(
      within(page.getByTestId("treemap")).getByText(/Guild One/)
    ).toBeTruthy()
    expect(within(page.getByTestId("treemap")).getByText(/Bug/)).toBeTruthy()
    expect(
      within(page.getByTestId("treemap")).getByText(/2 messages/)
    ).toBeTruthy()

    fireEvent.change(channelSelect, { target: { value: "channel-1" } })

    expect(
      within(page.getByTestId("leaderboard")).getByText(/Guild One \/ #alpha/)
    ).toBeTruthy()
    expect(
      within(page.getByTestId("treemap")).getByText(/Guild One \/ #alpha/)
    ).toBeTruthy()
    expect(
      within(page.getByTestId("treemap")).getByText(/Feature/)
    ).toBeTruthy()

    fireEvent.click(page.getByRole("button", { name: "24h" }))

    expect(
      within(page.getByTestId("leaderboard")).getByText(/Alice/)
    ).toBeTruthy()
    expect(
      within(page.getByTestId("leaderboard")).queryByText(/Bob/)
    ).toBeNull()
    expect(within(page.getByTestId("treemap")).getByText(/Bug/)).toBeTruthy()
    expect(within(page.getByTestId("treemap")).getByText(/100%/)).toBeTruthy()
    expect(window.document.querySelector("#sync-status")).toBeNull()
    expect(
      window.document.querySelector("#status")?.textContent ?? ""
    ).not.toMatch(/Processing/)
    expect(savedSelections).toHaveLength(2)
  })

  it("reinitializes popup state when bootstrapped again on the same document", async () => {
    const { window } = createPopupDom()

    const popupModule = await loadPopupModule(window)
    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () => createPopupModel(createState()),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(createState(), previousSelection),
      saveSelection: async () => {},
      subscribeToLeaderboardStateChanges: () => () => {}
    })

    let page = within(window.document.body)
    expect(page.getByDisplayValue("Guild One")).toBeTruthy()

    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () =>
        createPopupModel(createGuildTwoOnlyState()),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(createGuildTwoOnlyState(), previousSelection),
      saveSelection: async () => {},
      subscribeToLeaderboardStateChanges: () => () => {}
    })

    page = within(window.document.body)
    expect(page.getByDisplayValue("Guild Two")).toBeTruthy()
    expect(page.queryByText(/Guild One/)).toBeNull()
    expect(page.getByText(/Drew/)).toBeTruthy()
  })

  it("persists server selection changes and resets invalid channel scope", async () => {
    const { window } = createPopupDom()
    const savedSelections: PopupSelection[] = []

    const popupModule = await loadPopupModule(window)
    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () => createPopupModel(createState()),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(createState(), previousSelection),
      saveSelection: async (selection) => {
        savedSelections.push(selection)
      },
      subscribeToLeaderboardStateChanges: () => () => {}
    })

    const page = within(window.document.body)

    fireEvent.change(page.getByLabelText("Channel"), {
      target: { value: "channel-1" }
    })
    fireEvent.change(page.getByLabelText("Server"), {
      target: { value: "guild-2" }
    })

    expect(page.getByDisplayValue("Guild Two")).toBeTruthy()
    expect(
      within(page.getByTestId("leaderboard")).getByText(/Guild Two/)
    ).toBeTruthy()

    await waitFor(() => {
      expect(savedSelections).toContainEqual({
        guildId: "guild-2",
        channelId: ALL_CHANNELS_VALUE,
        timeRange: "30d"
      })
    })
  })

  it("renders mixed named categories plus uncategorized and omits empty categories per time slice", async () => {
    const { window } = createPopupDom()

    const popupModule = await loadPopupModule(window)
    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () =>
        createPopupModel(createMixedCompositionState()),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(
          createMixedCompositionState(),
          previousSelection
        ),
      saveSelection: async () => {},
      subscribeToLeaderboardStateChanges: () => () => {}
    })

    const page = within(window.document.body)

    expect(readTreemapTileLabels(window.document)).toEqual([
      "Bug",
      "Uncategorized",
      "Feature"
    ])
    expect(page.getByTestId("treemap").textContent ?? "").toMatch(
      /Bug[\s\S]*2 messages[\s\S]*40% of slice/
    )
    expect(page.getByTestId("treemap").textContent ?? "").toMatch(
      /Uncategorized[\s\S]*2 messages[\s\S]*40% of slice/
    )
    expect(page.getByTestId("treemap").textContent ?? "").not.toMatch(/Empty/)

    fireEvent.click(page.getByRole("button", { name: "7d" }))

    expect(readTreemapTileLabels(window.document)).toEqual(["Bug", "Feature"])
    expect(page.getByTestId("treemap").textContent ?? "").toMatch(
      /Bug[\s\S]*2 messages[\s\S]*66.7% of slice/
    )
    expect(page.getByTestId("treemap").textContent ?? "").toMatch(
      /Feature[\s\S]*1 messages[\s\S]*33.3% of slice/
    )
    expect(page.getByTestId("treemap").textContent ?? "").not.toMatch(
      /Uncategorized/
    )

    fireEvent.click(page.getByRole("button", { name: "24h" }))

    expect(readTreemapTileLabels(window.document)).toEqual(["Bug"])
    expect(page.getByTestId("treemap").textContent ?? "").toMatch(
      /Bug[\s\S]*2 messages[\s\S]*100% of slice/
    )
    expect(page.getByTestId("treemap").textContent ?? "").not.toMatch(
      /Feature|Uncategorized|Empty/
    )
  })

  it("sizes treemap tiles by message count", async () => {
    const { window } = createPopupDom()

    const popupModule = await loadPopupModule(window)
    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () => createPopupModel(createState()),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(createState(), previousSelection),
      saveSelection: async () => {},
      subscribeToLeaderboardStateChanges: () => () => {}
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

  it("applies treemap tile classes so category tiles render with treemap styling", async () => {
    const { window } = createPopupDom()

    const popupModule = await loadPopupModule(window)
    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () => createPopupModel(createState()),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(createState(), previousSelection),
      saveSelection: async () => {},
      subscribeToLeaderboardStateChanges: () => () => {}
    })

    const bugTile = window.document.querySelector<HTMLElement>(
      '[data-tile-id="cat-bug"]'
    )

    expect(bugTile?.className).toContain("treemap-tile")
    expect(bugTile?.className).toContain("is-large")
  })

  it("excludes reply messages from popup treemap composition", async () => {
    const { window } = createPopupDom()

    const popupModule = await loadPopupModule(window)
    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () =>
        createPopupModel({
          ...createState(),
          messages: [
            ...createState().messages,
            {
              ...createMessage({
                id: "reply-1",
                guildId: "guild-1",
                guildName: "Guild One",
                channelId: "channel-1",
                channelName: "alpha",
                authorKey: "reply-author",
                authorName: "Reply Author",
                messageTimestamp: "2026-04-17T08:00:00.000Z"
              }),
              isReply: true
            }
          ],
          messageCategoryAssignments: [
            ...createState().messageCategoryAssignments,
            {
              messageId: "reply-1",
              guildId: "guild-1",
              categoryId: "cat-feature",
              assignedAt: "2026-04-17T08:05:00.000Z"
            }
          ]
        }),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(
          {
            ...createState(),
            messages: [
              ...createState().messages,
              {
                ...createMessage({
                  id: "reply-1",
                  guildId: "guild-1",
                  guildName: "Guild One",
                  channelId: "channel-1",
                  channelName: "alpha",
                  authorKey: "reply-author",
                  authorName: "Reply Author",
                  messageTimestamp: "2026-04-17T08:00:00.000Z"
                }),
                isReply: true
              }
            ],
            messageCategoryAssignments: [
              ...createState().messageCategoryAssignments,
              {
                messageId: "reply-1",
                guildId: "guild-1",
                categoryId: "cat-feature",
                assignedAt: "2026-04-17T08:05:00.000Z"
              }
            ]
          },
          previousSelection
        ),
      saveSelection: async () => {},
      subscribeToLeaderboardStateChanges: () => () => {}
    })

    const treemapText =
      within(window.document.body).getByTestId("treemap").textContent ?? ""

    expect(treemapText).toMatch(/Feature[\s\S]*1 messages/)
    expect(treemapText).not.toMatch(/Feature[\s\S]*2 messages/)
    expect(treemapText).not.toMatch(/20% of slice/)
  })

  it("applies distinct palette variables across treemap tiles", async () => {
    const { window } = createPopupDom()

    const popupModule = await loadPopupModule(window)
    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () => createPopupModel(createState()),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(createState(), previousSelection),
      saveSelection: async () => {},
      subscribeToLeaderboardStateChanges: () => () => {}
    })

    const bugTile = window.document.querySelector<HTMLElement>(
      '[data-tile-id="cat-bug"]'
    )
    const featureTile = window.document.querySelector<HTMLElement>(
      '[data-tile-id="cat-feature"]'
    )

    expect(bugTile?.getAttribute("style") ?? "").toContain(
      "--treemap-fill-start"
    )
    expect(featureTile?.getAttribute("style") ?? "").toContain(
      "--treemap-fill-start"
    )
    expect(bugTile?.getAttribute("style")).not.toBe(
      featureTile?.getAttribute("style")
    )
  })

  it("renders no-server and slice-empty states with popup parity copy", async () => {
    const { window } = createPopupDom()

    const popupModule = await loadPopupModule(window)
    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () => createPopupModel(createEmptyState()),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(createEmptyState(), previousSelection),
      saveSelection: async () => {},
      subscribeToLeaderboardStateChanges: () => () => {}
    })

    let page = within(window.document.body)

    expect(page.getByLabelText("Server")).toHaveProperty("disabled", true)
    expect(page.getByLabelText("Channel")).toHaveProperty("disabled", true)
    expect(page.getByTestId("leaderboard").textContent ?? "").toMatch(
      /No contributors captured yet\./
    )
    expect(page.getByTestId("treemap").textContent ?? "").toMatch(
      /No server selected yet[\s\S]*Capture Discord messages to see category composition\./
    )
    expect(window.document.querySelector("#status")?.textContent ?? "").toBe(
      "Open Discord in Chrome and browse a server to start collecting data."
    )

    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () =>
        createPopupModel(createPastOnlyState()),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(createPastOnlyState(), previousSelection),
      saveSelection: async () => {},
      subscribeToLeaderboardStateChanges: () => () => {}
    })

    page = within(window.document.body)
    fireEvent.click(page.getByRole("button", { name: "24h" }))

    expect(page.getByTestId("leaderboard").textContent ?? "").toMatch(
      /No contributors captured for this slice yet\./
    )
    expect(page.getByTestId("treemap").textContent ?? "").toMatch(
      /No captured messages in this slice yet\./
    )
  })

  it("applies latest storage change after in-flight refresh", async () => {
    const { window } = createPopupDom()
    const originalSetTimeout = window.setTimeout.bind(window)
    let storageListenerRegistered = false
    let stateChangeListener = () => {}
    let state = createState()
    let loadStateCallCount = 0
    let blockedLoadResolverRegistered = false
    let resolveBlockedLoad = (_state: LeaderboardState) => {}
    const loadState = async () => {
      loadStateCallCount += 1

      if (loadStateCallCount === 2) {
        return await new Promise<LeaderboardState>((resolve) => {
          blockedLoadResolverRegistered = true
          resolveBlockedLoad = resolve
        })
      }

      return state
    }

    window.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === "function") {
        handler()
      }

      return 0
    }) as typeof window.setTimeout

    const popupModule = await loadPopupModule(window)
    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () => createPopupModel(await loadState()),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(await loadState(), previousSelection),
      saveSelection: async () => {},
      subscribeToLeaderboardStateChanges: (listener) => {
        storageListenerRegistered = true
        stateChangeListener = listener
        return () => {}
      }
    })

    const page = within(window.document.body)

    expect(storageListenerRegistered).toBe(true)

    stateChangeListener()

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

    stateChangeListener()
    expect(blockedLoadResolverRegistered).toBe(true)
    resolveBlockedLoad(createState())
    await new Promise((resolve) => originalSetTimeout(resolve, 0))

    await waitFor(() => {
      expect(page.getByTestId("treemap").textContent ?? "").toMatch(/Docs/)
    })
    expect(page.getByTestId("treemap").textContent ?? "").not.toMatch(/Feature/)
    expect(window.document.querySelector("#sync-status")).toBeNull()
  })

  it("refreshes popup state without rendering a sync status line", async () => {
    const { window } = createPopupDom()
    let stateChangeListener = () => {}
    let loadStateCallCount = 0
    let resolveBlockedLoadState = (_state: LeaderboardState) => {}
    const loadState = async () => {
      loadStateCallCount += 1

      if (loadStateCallCount === 1) {
        return createState()
      }

      return await new Promise<LeaderboardState>((resolve) => {
        resolveBlockedLoadState = resolve
      })
    }

    const popupModule = await loadPopupModule(window)
    await popupModule.bootstrapPopup({
      document: window.document,
      loadInitialPopupModel: async () => createPopupModel(await loadState()),
      refreshPopupModel: async (previousSelection) =>
        createRefreshedPopupModel(await loadState(), previousSelection),
      saveSelection: async () => {},
      subscribeToLeaderboardStateChanges: (listener) => {
        stateChangeListener = listener
        return () => {}
      }
    })

    stateChangeListener()

    await waitFor(() => {
      expect(window.document.querySelector("#sync-status")).toBeNull()
      expect(
        window.document.querySelector("#status")?.textContent ?? ""
      ).not.toBe("")
    })

    resolveBlockedLoadState(createState())

    await waitFor(() => {
      expect(window.document.querySelector("#sync-status")).toBeNull()
      expect(
        window.document.querySelector("#status")?.textContent ?? ""
      ).not.toBe("")
    })
  })
})

async function loadPopupModule(window: {
  document: Document
  navigator: Navigator
}) {
  Object.assign(globalThis, {
    document: window.document,
    navigator: window.navigator,
    window
  })

  return await import("../runTime")
}

function createPopupDom() {
  return new JSDOM(
    `
      <body>
        <div id="popup-root"></div>
      </body>
    `,
    {
      url: "https://example.test"
    }
  )
}

function createPopupModel(state: LeaderboardState) {
  return {
    state,
    selection: resolveInitialSelection(state)
  }
}

function createRefreshedPopupModel(
  state: LeaderboardState,
  previousSelection: Parameters<typeof resolvePreservedSelection>[1]
) {
  return {
    state,
    selection: resolvePreservedSelection(state, previousSelection)
  }
}

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

function createGuildTwoOnlyState(): LeaderboardState {
  return {
    messages: [
      createMessage({
        id: "guild-two-1",
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
    categories: [],
    messageCategoryAssignments: [],
    updatedAt: "2026-04-16T12:00:00.000Z"
  }
}

function createEmptyState(): LeaderboardState {
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

function createPastOnlyState(): LeaderboardState {
  return {
    ...createState(),
    messages: [
      createMessage({
        id: "old-1",
        guildId: "guild-1",
        guildName: "Guild One",
        channelId: "channel-1",
        channelName: "alpha",
        authorKey: "alice",
        authorName: "Alice",
        messageTimestamp: "2026-04-10T10:00:00.000Z"
      }),
      createMessage({
        id: "old-2",
        guildId: "guild-1",
        guildName: "Guild One",
        channelId: "channel-2",
        channelName: "beta",
        authorKey: "bob",
        authorName: "Bob",
        messageTimestamp: "2026-04-09T10:00:00.000Z"
      })
    ],
    messageCategoryAssignments: [
      {
        messageId: "old-1",
        guildId: "guild-1",
        categoryId: "cat-bug",
        assignedAt: "2026-04-10T10:05:00.000Z"
      }
    ]
  }
}

function readTreemapTileLabels(document: Document): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".treemap-tile-name")
  ).map((node) => node.textContent ?? "")
}

function readTreemapTileArea(document: Document, tileId: string): number {
  const tile = document.querySelector<HTMLElement>(`[data-tile-id="${tileId}"]`)
  if (!tile) throw new Error(`Expected treemap tile ${tileId}`)

  const style = tile.getAttribute("style") ?? ""
  const width = Number.parseFloat(
    style.match(/width:\s*([0-9.]+)%/)?.[1] ?? "0"
  )
  const height = Number.parseFloat(
    style.match(/height:\s*([0-9.]+)%/)?.[1] ?? "0"
  )

  return width * height
}
