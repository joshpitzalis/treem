import { JSDOM } from "jsdom"
import { beforeEach, describe, expect, it } from "vitest"
import type { LeaderboardState } from "../../shared/types"
import { enhanceCategorizationControls } from "../categorization"
import { resetCategoryControlDraftsForTests } from "../discord-categorization-control"

describe("discord categorization host bridge", () => {
  beforeEach(() => {
    delete (globalThis as Partial<typeof globalThis>).document
    delete (globalThis as Partial<typeof globalThis>).window
    resetCategoryControlDraftsForTests()
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
    expect(host?.querySelector('[data-treem-role="category-root"]')).not.toBeNull()
    expect(
      host?.querySelector('[data-treem-role="category-control"]')
    ).not.toBeNull()
    expect(host?.hidden).toBe(false)
    expect(
      window.document.querySelectorAll('[data-treem-role="category-control-host"]')
    ).toHaveLength(1)
    expect(host?.closest(".header")).not.toBeNull()
    expect(host?.parentElement?.style.display).toBe("inline-block")
  })

  it("anchors the host to the header even when Discord renders a hover action bar", async () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li>
              <article
                data-list-item-id="chat-messages___chat-messages-1125094089281511474-1490387048681439422"
                aria-labelledby="message-username-1490387048681439422 uid_1 message-content-1490387048681439422 uid_2 message-timestamp-1490387048681439422"
              >
                <h3 class="header">
                  <span id="message-username-1490387048681439422" class="username">Matias</span>
                  <span class="timestamp">
                    <a href="/channels/guild-1/channel-1?jump=1490387048681439422">
                      <time id="message-timestamp-1490387048681439422" datetime="2026-04-16T10:00:00.000Z"></time>
                    </a>
                  </span>
                </h3>
                <div id="message-content-1490387048681439422">hello world</div>
                <div class="buttonContainer">
                  <div class="buttons" role="group" aria-label="Message Actions"></div>
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
              id: "guild-1:channel-1:1490387048681439422",
              messageTimestamp: "2026-04-16T10:00:00.000Z",
              capturedAt: "2026-04-16T10:00:00.000Z"
            })
          ]
        }),
      saveState: async () => {}
    })

    const header = window.document.querySelector<HTMLElement>(".header")
    const host = window.document.querySelector<HTMLElement>(
      '[data-treem-role="category-control-host"]'
    )

    expect(host).not.toBeNull()
    expect(host?.parentElement).toBe(header)
    expect(host?.dataset.treemLayout).toBe("header")
  })

  it("keeps the host on the header when the picker opens on a row with an action bar", async () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li>
              <article
                data-list-item-id="chat-messages___chat-messages-1125094089281511474-1490387048681439422"
                aria-labelledby="message-username-1490387048681439422 uid_1 message-content-1490387048681439422 uid_2 message-timestamp-1490387048681439422"
              >
                <h3 class="header">
                  <span id="message-username-1490387048681439422" class="username">Matias</span>
                  <span class="timestamp">
                    <a href="/channels/guild-1/channel-1?jump=1490387048681439422">
                      <time id="message-timestamp-1490387048681439422" datetime="2026-04-16T10:00:00.000Z"></time>
                    </a>
                  </span>
                </h3>
                <div id="message-content-1490387048681439422">hello world</div>
                <div class="buttonContainer">
                  <div class="buttons" role="group" aria-label="Message Actions"></div>
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
              id: "guild-1:channel-1:1490387048681439422",
              messageTimestamp: "2026-04-16T10:00:00.000Z",
              capturedAt: "2026-04-16T10:00:00.000Z"
            })
          ]
        }),
      saveState: async () => {}
    })

    const controlRoot = getControlRoot(window.document)
    const toggle = controlRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()
    await flushAsyncWork(window)

    const header = window.document.querySelector<HTMLElement>(".header")
    const host = window.document.querySelector<HTMLElement>(
      '[data-treem-role="category-control-host"]'
    )

    expect(host?.parentElement).toBe(header)
    expect(host?.dataset.treemLayout).toBe("header")
    expect(host?.hidden).toBe(false)
  })

  it("keeps the host visible without relying on hover state", async () => {
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
      loadState: async () => createState(),
      saveState: async () => {}
    })

    const messageNode =
      window.document.querySelector<HTMLElement>("#chat-messages-message-1")
    const host = window.document.querySelector<HTMLElement>(
      '[data-treem-role="category-control-host"]'
    )

    if (!messageNode || !host) {
      throw new Error("Expected message node and category host")
    }

    expect(host.hidden).toBe(false)
  })

  it("keeps the host visible while the pointer moves from the row onto the host", async () => {
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
      loadState: async () => createState(),
      saveState: async () => {}
    })

    const messageNode =
      window.document.querySelector<HTMLElement>("#chat-messages-message-1")
    const host = window.document.querySelector<HTMLElement>(
      '[data-treem-role="category-control-host"]'
    )

    if (!messageNode || !host) {
      throw new Error("Expected message node and category host")
    }

    expect(host.hidden).toBe(false)

    host.dispatchEvent(new window.MouseEvent("mouseenter"))
    messageNode.dispatchEvent(new window.MouseEvent("mouseleave"))
    expect(host.hidden).toBe(false)

    host.dispatchEvent(new window.MouseEvent("mouseleave"))
    expect(host.hidden).toBe(false)
  })

  it("does not bubble create-input keyboard events to the page", async () => {
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
      loadState: async () => createState(),
      saveState: async () => {}
    })

    const controlRoot = getControlRoot(window.document)
    const toggle = controlRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()
    await flushAsyncWork(window)

    const createToggle = controlRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-create-toggle"]'
    )
    if (!createToggle) throw new Error("Expected category create toggle")
    createToggle.click()
    await flushAsyncWork(window)

    const input = controlRoot.querySelector<HTMLInputElement>(
      '[data-treem-role="category-create-input"]'
    )
    if (!input) throw new Error("Expected category create input")

    let bubbledKeydown = false
    window.document.addEventListener("keydown", () => {
      bubbledKeydown = true
    })

    input.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "d",
        bubbles: true,
        composed: true
      })
    )

    expect(bubbledKeydown).toBe(false)
  })

  it("restores the create-category draft after the host remounts", async () => {
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

    const runtime = {
      document: window.document,
      guildId: "guild-1",
      loadState: async () => createState(),
      saveState: async () => {}
    } satisfies Parameters<typeof enhanceCategorizationControls>[0]

    await enhanceCategorizationControls(runtime)

    let controlRoot = getControlRoot(window.document)
    const toggle = controlRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()
    await flushAsyncWork(window)

    const createToggle = controlRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-create-toggle"]'
    )
    if (!createToggle) throw new Error("Expected category create toggle")
    createToggle.click()
    await flushAsyncWork(window)

    const input = controlRoot.querySelector<HTMLInputElement>(
      '[data-treem-role="category-create-input"]'
    )
    if (!input) throw new Error("Expected category create input")
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set
    if (!valueSetter) throw new Error("Expected HTMLInputElement value setter")
    valueSetter.call(input, "Docs")
    input.dispatchEvent(new window.Event("input", { bubbles: true }))
    await flushAsyncWork(window)

    window.document
      .querySelector<HTMLElement>('[data-treem-role="category-control-host"]')
      ?.remove()

    await enhanceCategorizationControls(runtime)
    controlRoot = getControlRoot(window.document)

    const remountedInput = controlRoot.querySelector<HTMLInputElement>(
      '[data-treem-role="category-create-input"]'
    )
    if (!remountedInput) throw new Error("Expected remounted category create input")

    expect(remountedInput.value).toBe("Docs")
  })

  it("keeps the create-category draft during background rerenders", async () => {
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

    const runtime = {
      document: window.document,
      guildId: "guild-1",
      loadState: async () => createState(),
      saveState: async () => {}
    } satisfies Parameters<typeof enhanceCategorizationControls>[0]

    await enhanceCategorizationControls(runtime)

    let controlRoot = getControlRoot(window.document)
    const toggle = controlRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()
    await flushAsyncWork(window)

    const createToggle = controlRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-create-toggle"]'
    )
    if (!createToggle) throw new Error("Expected category create toggle")
    createToggle.click()
    await flushAsyncWork(window)

    const input = controlRoot.querySelector<HTMLInputElement>(
      '[data-treem-role="category-create-input"]'
    )
    if (!input) throw new Error("Expected category create input")
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set
    if (!valueSetter) throw new Error("Expected HTMLInputElement value setter")
    valueSetter.call(input, "Docs")
    input.dispatchEvent(new window.Event("input", { bubbles: true }))
    await flushAsyncWork(window)

    await enhanceCategorizationControls(runtime)
    controlRoot = getControlRoot(window.document)

    const rerenderedInput = controlRoot.querySelector<HTMLInputElement>(
      '[data-treem-role="category-create-input"]'
    )
    if (!rerenderedInput) throw new Error("Expected rerendered category create input")

    expect(rerenderedInput.value).toBe("Docs")
  })

  it("falls back to the header container when the action bar is absent", async () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li>
              <article
                data-list-item-id="chat-messages___chat-messages-1125094089281511474-1490387048681439422"
                aria-labelledby="message-username-1490387048681439422 uid_1 message-content-1490387048681439422 uid_2 message-timestamp-1490387048681439422"
              >
                <h3 class="header">
                  <span id="message-username-1490387048681439422" class="username">Matias</span>
                  <span class="timestamp">
                    <a href="/channels/guild-1/channel-1?jump=1490387048681439422">
                      <time id="message-timestamp-1490387048681439422" datetime="2026-04-16T10:00:00.000Z"></time>
                    </a>
                  </span>
                </h3>
                <div id="message-content-1490387048681439422">hello world</div>
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
              id: "guild-1:channel-1:1490387048681439422",
              messageTimestamp: "2026-04-16T10:00:00.000Z",
              capturedAt: "2026-04-16T10:00:00.000Z"
            })
          ]
        }),
      saveState: async () => {}
    })

    const header = window.document.querySelector<HTMLElement>(".header")
    const link = window.document.querySelector("a")
    const host = window.document.querySelector<HTMLElement>(
      '[data-treem-role="category-control-host"]'
    )

    expect(host).not.toBeNull()
    expect(host?.parentElement).toBe(header)
    expect(link?.querySelector('[data-treem-role="category-control-host"]')).toBeNull()
    expect(host?.dataset.treemLayout).toBe("header")
    expect(header?.style.position).toBe("relative")
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

    const controlRoot = getControlRoot(window.document)
    const toggle = controlRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()
    await flushAsyncWork(window)

    const select = controlRoot.querySelector<HTMLSelectElement>(
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
    expect(toggle.textContent).toBe("Feature")
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

    const controlRoot = getControlRoot(window.document)
    const toggle = controlRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()
    await flushAsyncWork(window)

    const select = controlRoot.querySelector<HTMLSelectElement>(
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

  it("creates category and assigns it from React control", async () => {
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

    const controlRoot = getControlRoot(window.document)
    const toggle = controlRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!toggle) throw new Error("Expected category toggle")
    toggle.click()
    await flushAsyncWork(window)

    const createToggle = controlRoot.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-create-toggle"]'
    )
    if (!createToggle) throw new Error("Expected category create toggle")
    createToggle.click()
    await flushAsyncWork(window)

    const input = controlRoot.querySelector<HTMLInputElement>(
      '[data-treem-role="category-create-input"]'
    )
    if (!input) throw new Error("Expected category create input")
    input.value = "Docs"
    input.dispatchEvent(new window.Event("input", { bubbles: true }))
    await flushAsyncWork(window)

    const createForm = controlRoot.querySelector<HTMLFormElement>(
      '[data-treem-role="category-create-form"]'
    )
    if (!createForm) throw new Error("Expected category create form")
    createForm.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true })
    )
    await flushAsyncWork(window)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.categories).toEqual([
      expect.objectContaining({
        id: "cat:guild-1:docs",
        guildId: "guild-1",
        name: "Docs",
        normalizedName: "docs"
      })
    ])
    expect(savedStates[0]?.messageCategoryAssignments).toEqual([
      expect.objectContaining({
        messageId: "guild-1:channel-2:message-1",
        categoryId: "cat:guild-1:docs"
      })
    ])
    expect(toggle.textContent).toBe("Docs")
  })

  it("rerenders all visible controls after save so duplicate message controls stay in sync", async () => {
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
            <div data-list-item-id="chat-messages_channel-2_message-1">
              <div class="header">
                <time datetime="2026-04-16T10:00:01.000Z"></time>
              </div>
            </div>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-2" }
    )
    const { window } = dom
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
      }
    })

    const controlRoots = getControlRoots(window.document)
    const firstToggle = controlRoots[0]?.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    const secondToggle = controlRoots[1]?.querySelector<HTMLButtonElement>(
      '[data-treem-role="category-toggle"]'
    )
    if (!firstToggle || !secondToggle) {
      throw new Error("Expected category toggles")
    }

    firstToggle.click()
    await flushAsyncWork(window)

    const firstSelect = controlRoots[0]?.querySelector<HTMLSelectElement>(
      '[data-treem-role="category-select"]'
    )
    if (!firstSelect) throw new Error("Expected category select")

    firstSelect.value = "cat:guild-1:feature"
    firstSelect.dispatchEvent(new window.Event("change", { bubbles: true }))
    await flushAsyncWork(window)

    expect(firstToggle.textContent).toBe("Feature")
    expect(secondToggle.textContent).toBe("Feature")
  })
})

function getControlRoot(document: Document): HTMLElement {
  const [host] = getControlHosts(document)
  const root = host?.querySelector<HTMLElement>('[data-treem-role="category-root"]')
  if (!root) throw new Error("Expected category control host")

  return root
}

function getControlRoots(document: Document): HTMLElement[] {
  return getControlHosts(document).flatMap((host) => {
    const root = host.querySelector<HTMLElement>('[data-treem-role="category-root"]')
    return root ? [root] : []
  }
  )
}

function getControlHosts(document: Document): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-treem-role="category-control-host"]'
    )
  )
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
