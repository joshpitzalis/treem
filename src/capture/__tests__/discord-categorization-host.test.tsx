import { JSDOM } from "jsdom"
import { beforeEach, describe, expect, it } from "vitest"
import type { LeaderboardState } from "../../shared/types"
import { enhanceCategorizationControls } from "../categorization"

describe("discord categorization host bridge", () => {
  beforeEach(() => {
    delete (globalThis as Partial<typeof globalThis>).document
    delete (globalThis as Partial<typeof globalThis>).window
  })

  it("mounts React controls into shadow roots for captured top-level messages", async () => {
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
                <div class="repliedTextPreview">Replying to Alice</div>
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
            createMessage(),
            createMessage({
              id: "guild-1:channel-1:message-2",
              isReply: true,
              messageTimestamp: "2026-04-16T10:05:00.000Z",
              capturedAt: "2026-04-16T10:05:00.000Z"
            })
          ]
        }),
      saveState: async () => {}
    })

    const host = window.document.querySelector<HTMLElement>(
      '[data-treem-role="category-control-host"]'
    )

    expect(host).not.toBeNull()
    expect(host?.shadowRoot).not.toBeNull()
    expect(
      host?.shadowRoot?.querySelector('[data-treem-role="category-control"]')
    ).not.toBeNull()
    expect(
      window.document.querySelectorAll('[data-treem-role="category-control-host"]')
    ).toHaveLength(1)
    expect(host?.closest(".header")).not.toBeNull()
  })

  it("assigns message to existing category from React control", async () => {
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

    const shadowRoot = getControlShadowRoot(window.document)
    const toggle = shadowRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()
    await flushAsyncWork(window)

    const select = shadowRoot.querySelector<HTMLSelectElement>(
      '[data-treem-role="category-select"]'
    )
    if (!select) throw new Error("Expected category select")

    expect(Array.from(select.options).map((option) => option.text)).toEqual([
      "Choose category",
      "Bug",
      "Feature",
      "Uncategorized"
    ])

    select.value = "cat:guild-1:feature"
    select.dispatchEvent(new window.Event("change", { bubbles: true }))
    await flushAsyncWork(window)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.messageCategoryAssignments).toEqual([
      expect.objectContaining({
        messageId: "guild-1:channel-2:message-1",
        categoryId: "cat:guild-1:feature"
      })
    ])
    expect(toggle.textContent).toBe("Category: Feature")
  })

  it("clears message back to uncategorized from React control", async () => {
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

    const shadowRoot = getControlShadowRoot(window.document)
    const toggle = shadowRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()
    await flushAsyncWork(window)

    const select = shadowRoot.querySelector<HTMLSelectElement>(
      '[data-treem-role="category-select"]'
    )
    if (!select) throw new Error("Expected category select")

    select.value = "__uncategorized__"
    select.dispatchEvent(new window.Event("change", { bubbles: true }))
    await flushAsyncWork(window)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.messageCategoryAssignments).toEqual([])
    expect(toggle.textContent).toBe("Categorize")
  })
})

function getControlShadowRoot(document: Document): ShadowRoot {
  const host = document.querySelector<HTMLElement>(
    '[data-treem-role="category-control-host"]'
  )
  if (!host?.shadowRoot) throw new Error("Expected category control host")

  return host.shadowRoot
}

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
