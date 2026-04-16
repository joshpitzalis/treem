import { JSDOM } from "jsdom"
import { beforeEach, describe, expect, it } from "vitest"
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
})

function createState(): LeaderboardState {
  return {
    messages: [
      {
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
        score: 1
      }
    ],
    viewerProfile: null,
    scopeObservations: [],
    popupPreferences: null,
    categories: [],
    messageCategoryAssignments: [],
    updatedAt: null
  }
}
