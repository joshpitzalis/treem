import { JSDOM } from "jsdom"
import { beforeEach, describe, expect, it } from "vitest"
import { summarizeTreemap } from "../../shared/leaderboard-query"
import type { LeaderboardState } from "../../shared/types"
import { enhanceCategorizationControls } from "../categorization"

describe("categorization controls", () => {
  beforeEach(() => {
    delete (globalThis as Partial<typeof globalThis>).document
    delete (globalThis as Partial<typeof globalThis>).window
  })

  it("injects hover control near timestamp and creates assigned category", async () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li id="chat-messages-message-1">
              <article>
                <h3><span class="username">Alice</span></h3>
                <div class="header">
                  <time datetime="2026-04-16T10:00:00.000Z"></time>
                </div>
                <div id="message-content-message-1">hello</div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom
    const savedStates: LeaderboardState[] = []

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    await enhanceCategorizationControls({
      document: window.document,
      guildId: "guild-1",
      loadState: async () => createState(),
      saveState: async (state) => {
        savedStates.push(state)
      }
    })

    const control = window.document.querySelector<HTMLElement>(
      '[data-treem-role="category-control"]'
    )
    const time = window.document.querySelector("time")

    expect(control).not.toBeNull()
    expect(control?.closest(".header")?.contains(time)).toBe(true)

    const toggle = window.document.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()

    const input = window.document.querySelector<HTMLInputElement>(
      '[data-treem-role="category-name-input"]'
    )
    if (!input) throw new Error("Expected category input")
    input.value = "Bug"
    input.dispatchEvent(new window.Event("input", { bubbles: true }))

    const form = window.document.querySelector<HTMLFormElement>(
      '[data-treem-role="category-form"]'
    )
    if (!form) throw new Error("Expected category form")
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true })
    )
    await Promise.resolve()

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.categories).toHaveLength(1)
    expect(savedStates[0]?.categories[0]?.name).toBe("Bug")
    expect(savedStates[0]?.messageCategoryAssignments).toEqual([
      expect.objectContaining({
        messageId: "guild-1:channel-1:message-1"
      })
    ])
  })

  it("reassigns message to existing category and clears back to uncategorized", async () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li id="chat-messages-message-1">
              <article>
                <div class="header">
                  <time datetime="2026-04-16T10:00:00.000Z"></time>
                </div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-2" }
    )
    const { window } = dom
    const savedStates: LeaderboardState[] = []
    let state = createState({
      messages: [
        createMessage({
          id: "guild-1:channel-2:message-1",
          channelId: "channel-2",
          channelName: "beta"
        })
      ],
      categories: [
        {
          id: "cat:guild-1:bug",
          guildId: "guild-1",
          name: "Bug",
          normalizedName: "bug",
          createdAt: "2026-04-16T08:00:00.000Z"
        },
        {
          id: "cat:guild-1:feature",
          guildId: "guild-1",
          name: "Feature",
          normalizedName: "feature",
          createdAt: "2026-04-16T08:05:00.000Z"
        }
      ],
      messageCategoryAssignments: [
        {
          messageId: "guild-1:channel-2:message-1",
          guildId: "guild-1",
          categoryId: "cat:guild-1:bug",
          assignedAt: "2026-04-16T10:05:00.000Z"
        }
      ]
    })

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    await enhanceCategorizationControls({
      document: window.document,
      guildId: "guild-1",
      loadState: async () => state,
      saveState: async (nextState) => {
        state = nextState
        savedStates.push(nextState)
      }
    })

    const toggle = window.document.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()

    const existingCategorySelect =
      window.document.querySelector<HTMLSelectElement>(
        '[data-treem-role="category-select"]'
      )
    if (!existingCategorySelect) throw new Error("Expected category select")

    expect(existingCategorySelect.options).toHaveLength(4)
    expect(
      Array.from(existingCategorySelect.options).map((option) => option.text)
    ).toEqual(["Choose category", "Bug", "Feature", "Uncategorized"])

    existingCategorySelect.value = "cat:guild-1:feature"
    existingCategorySelect.dispatchEvent(
      new window.Event("change", { bubbles: true })
    )
    await flushAsyncWork(window)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.messageCategoryAssignments).toEqual([
      expect.objectContaining({
        messageId: "guild-1:channel-2:message-1",
        categoryId: "cat:guild-1:feature"
      })
    ])
    expect(
      summarizeTreemap({
        messages: state.messages,
        categories: state.categories,
        messageCategoryAssignments: state.messageCategoryAssignments
      }).tiles
    ).toEqual([
      {
        id: "cat:guild-1:feature",
        label: "Feature",
        messageCount: 1,
        percentage: 100
      }
    ])

    toggle.click()
    existingCategorySelect.value = "__uncategorized__"
    existingCategorySelect.dispatchEvent(
      new window.Event("change", { bubbles: true })
    )
    await flushAsyncWork(window)

    expect(savedStates).toHaveLength(2)
    expect(savedStates[1]?.messageCategoryAssignments).toEqual([])
    expect(
      summarizeTreemap({
        messages: state.messages,
        categories: state.categories,
        messageCategoryAssignments: state.messageCategoryAssignments
      }).tiles
    ).toEqual([
      {
        id: "uncategorized",
        label: "Uncategorized",
        messageCount: 1,
        percentage: 100
      }
    ])
  })

  it("shows server category created in another channel", async () => {
    const createdState = await createCategoryInChannel("channel-1", "Bug")

    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li id="chat-messages-message-2">
              <article>
                <div class="header">
                  <time datetime="2026-04-16T11:00:00.000Z"></time>
                </div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-2" }
    )
    const { window } = dom

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    await enhanceCategorizationControls({
      document: window.document,
      guildId: "guild-1",
      loadState: async () => ({
        ...createdState,
        messages: [
          ...createdState.messages,
          createMessage({
            id: "guild-1:channel-2:message-2",
            channelId: "channel-2",
            channelName: "beta"
          })
        ]
      }),
      saveState: async () => {}
    })

    const toggle = window.document.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()

    const existingCategorySelect =
      window.document.querySelector<HTMLSelectElement>(
        '[data-treem-role="category-select"]'
      )
    if (!existingCategorySelect) throw new Error("Expected category select")

    expect(
      Array.from(existingCategorySelect.options).map((option) => option.text)
    ).toEqual(["Choose category", "Bug", "Uncategorized"])
  })

  it("blocks duplicate category create and keeps existing categories for picker reuse", async () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li id="chat-messages-message-1">
              <article>
                <div class="header">
                  <time datetime="2026-04-16T10:00:00.000Z"></time>
                </div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom
    const savedStates: LeaderboardState[] = []

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    await enhanceCategorizationControls({
      document: window.document,
      guildId: "guild-1",
      loadState: async () =>
        createState({
          categories: [
            {
              id: "cat:guild-1:bug",
              guildId: "guild-1",
              name: "Bug",
              normalizedName: "bug",
              createdAt: "2026-04-16T08:00:00.000Z"
            }
          ]
        }),
      saveState: async (state) => {
        savedStates.push(state)
      }
    })

    const toggle = window.document.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()

    const input = window.document.querySelector<HTMLInputElement>(
      '[data-treem-role="category-name-input"]'
    )
    if (!input) throw new Error("Expected category input")
    input.value = "bug"

    const form = window.document.querySelector<HTMLFormElement>(
      '[data-treem-role="category-form"]'
    )
    if (!form) throw new Error("Expected category form")
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true })
    )
    await flushAsyncWork(window)

    expect(savedStates).toHaveLength(0)
    expect(input.validationMessage).toBe(
      "Category name already exists in selected server"
    )

    const existingCategorySelect =
      window.document.querySelector<HTMLSelectElement>(
        '[data-treem-role="category-select"]'
      )
    if (!existingCategorySelect) throw new Error("Expected category select")

    expect(
      Array.from(existingCategorySelect.options).map((option) => option.text)
    ).toEqual(["Choose category", "Bug", "Uncategorized"])
  })

  it("updates other mounted pickers when a new category is created", async () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li id="chat-messages-message-1">
              <article>
                <div class="header">
                  <time datetime="2026-04-16T10:00:00.000Z"></time>
                </div>
              </article>
            </li>
            <li id="chat-messages-message-2">
              <article>
                <div class="header">
                  <time datetime="2026-04-16T10:05:00.000Z"></time>
                </div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom
    let state = createState({
      messages: [
        createMessage(),
        createMessage({
          id: "guild-1:channel-1:message-2",
          messageTimestamp: "2026-04-16T10:05:00.000Z",
          capturedAt: "2026-04-16T10:05:00.000Z"
        })
      ]
    })

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    await enhanceCategorizationControls({
      document: window.document,
      guildId: "guild-1",
      loadState: async () => state,
      saveState: async (nextState) => {
        state = nextState
      }
    })

    const toggles = window.document.querySelectorAll<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    expect(toggles).toHaveLength(2)
    toggles[0]?.click()
    toggles[1]?.click()

    const selects = window.document.querySelectorAll<HTMLSelectElement>(
      '[data-treem-role="category-select"]'
    )
    expect(selects).toHaveLength(2)
    expect(
      Array.from(selects[1]?.options ?? []).map((option) => option.text)
    ).toEqual(["Choose category", "Uncategorized"])

    const input = window.document.querySelector<HTMLInputElement>(
      '[data-treem-role="category-name-input"]'
    )
    if (!input) throw new Error("Expected category input")
    input.value = "Bug"

    const form = window.document.querySelector<HTMLFormElement>(
      '[data-treem-role="category-form"]'
    )
    if (!form) throw new Error("Expected category form")
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true })
    )
    await flushAsyncWork(window)

    expect(
      Array.from(selects[1]?.options ?? []).map((option) => option.text)
    ).toEqual(["Choose category", "Bug", "Uncategorized"])
  })

  it("does not inject category controls for reply messages", async () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li id="chat-messages-message-1">
              <article>
                <div class="header">
                  <time datetime="2026-04-16T10:00:00.000Z"></time>
                </div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    await enhanceCategorizationControls({
      document: window.document,
      guildId: "guild-1",
      loadState: async () =>
        createState({
          messages: [
            createMessage({
              isReply: true
            })
          ]
        }),
      saveState: async () => {}
    })

    expect(
      window.document.querySelector('[data-treem-role="category-control"]')
    ).toBeNull()
  })

  it("does not inject category controls when the DOM row looks like a reply", async () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li id="chat-messages-message-1">
              <article>
                <div class="repliedTextPreview">Replying to Alice</div>
                <div class="header">
                  <time datetime="2026-04-16T10:00:00.000Z"></time>
                </div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    await enhanceCategorizationControls({
      document: window.document,
      guildId: "guild-1",
      loadState: async () => createState(),
      saveState: async () => {}
    })

    expect(
      window.document.querySelector('[data-treem-role="category-control"]')
    ).toBeNull()
  })
})

function createState(
  overrides: Partial<LeaderboardState> = {}
): LeaderboardState {
  return {
    messages: [createMessage()],
    viewerProfile: null,
    scopeObservations: [],
    popupPreferences: null,
    categories: [],
    messageCategoryAssignments: [],
    updatedAt: null,
    ...overrides
  }
}

function createMessage(
  overrides: Partial<LeaderboardState["messages"][number]> = {}
) {
  return {
    id: "guild-1:channel-1:message-1",
    guildId: "guild-1",
    guildName: "Guild One",
    channelId: "channel-1",
    channelName: "alpha",
    authorKey: "alice",
    authorName: "Alice",
    authorAvatarUrl: null,
    messageTimestamp: "2026-04-16T10:00:00.000Z",
    capturedAt: "2026-04-16T10:00:00.000Z",
    contentLength: 5,
    reactionCount: 0,
    attachmentCount: 0,
    isReply: false,
    score: 1,
    ...overrides
  }
}

async function flushAsyncWork(window: {
  setTimeout: (handler: TimerHandler, timeout?: number) => number
}) {
  await new Promise((resolve) => window.setTimeout(resolve, 0))
}

async function createCategoryInChannel(
  channelId: string,
  categoryName: string
): Promise<LeaderboardState> {
  const dom = new JSDOM(
    `
      <body>
        <ol data-list-id="chat-messages">
          <li id="chat-messages-message-1">
            <article>
              <div class="header">
                <time datetime="2026-04-16T10:00:00.000Z"></time>
              </div>
            </article>
          </li>
        </ol>
      </body>
    `,
    { url: `https://discord.com/channels/guild-1/${channelId}` }
  )
  const { window } = dom
  let state = createState({
    messages: [
      createMessage({
        id: `guild-1:${channelId}:message-1`,
        channelId,
        channelName: channelId === "channel-1" ? "alpha" : "beta"
      })
    ]
  })

  Object.assign(globalThis, {
    document: window.document,
    window
  })

  await enhanceCategorizationControls({
    document: window.document,
    guildId: "guild-1",
    loadState: async () => state,
    saveState: async (nextState) => {
      state = nextState
    }
  })

  const toggle = window.document.querySelector<HTMLButtonElement>(
    '[data-treem-role="category-toggle"]'
  )
  if (!toggle) throw new Error("Expected category toggle")
  toggle.click()

  const input = window.document.querySelector<HTMLInputElement>(
    '[data-treem-role="category-name-input"]'
  )
  if (!input) throw new Error("Expected category input")
  input.value = categoryName

  const form = window.document.querySelector<HTMLFormElement>(
    '[data-treem-role="category-form"]'
  )
  if (!form) throw new Error("Expected category form")
  form.dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true })
  )
  await flushAsyncWork(window)

  return state
}
