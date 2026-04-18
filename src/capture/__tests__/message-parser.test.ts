import { JSDOM } from "jsdom"
import { beforeEach, describe, expect, it } from "vitest"

import { extractVisibleMessages } from "../message-parser"

describe("extractVisibleMessages", () => {
  beforeEach(() => {
    delete (globalThis as Partial<typeof globalThis>).document
    delete (globalThis as Partial<typeof globalThis>).window
  })

  it("marks Discord reply-preview messages as replies", () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li id="chat-messages-message-1">
              <article>
                <div class="repliedTextPreview">Replying to Alice</div>
                <div class="header">
                  <h3><span class="username">Bob</span></h3>
                  <time datetime="2026-04-17T08:00:00.000Z"></time>
                </div>
                <div id="message-content-message-1">Looks good</div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom
    Object.defineProperty(window.HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent ?? ""
      }
    })

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const messages = extractVisibleMessages({
      guildId: "guild-1",
      guildName: "Guild One",
      channelId: "channel-1",
      channelName: "alpha"
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.isReply).toBe(true)
  })

  it("keeps normal top-level messages as non-replies", () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li id="chat-messages-message-2">
              <article>
                <div class="header">
                  <h3><span class="username">Cara</span></h3>
                  <time datetime="2026-04-17T09:00:00.000Z"></time>
                </div>
                <div id="message-content-message-2">Shipped</div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom
    Object.defineProperty(window.HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent ?? ""
      }
    })

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const messages = extractVisibleMessages({
      guildId: "guild-1",
      guildName: "Guild One",
      channelId: "channel-1",
      channelName: "alpha"
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.isReply).toBe(false)
  })

  it("extracts the real message id from aria-labelledby for top-level Discord rows", () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li>
              <article
                data-list-item-id="chat-messages___chat-messages-1125094089281511474-1490387048681439422"
                aria-labelledby="message-username-1490387048681439422 uid_1 message-content-1490387048681439422 uid_2 message-timestamp-1490387048681439422"
              >
                <div class="header">
                  <h3><span id="message-username-1490387048681439422" class="username">Matias</span></h3>
                  <time id="message-timestamp-1490387048681439422" datetime="2026-04-05T16:26:02.458Z"></time>
                </div>
                <div id="message-content-1490387048681439422">hello world</div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom
    Object.defineProperty(window.HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent ?? ""
      }
    })

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const messages = extractVisibleMessages({
      guildId: "guild-1",
      guildName: "Guild One",
      channelId: "channel-1",
      channelName: "alpha"
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.id).toBe("guild-1:channel-1:1490387048681439422")
    expect(messages[0]?.isReply).toBe(false)
  })

  it("extracts the child message id for reply rows and keeps them marked as replies", () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li>
              <article
                data-list-item-id="chat-messages___chat-messages-1494090630396248104-1494217200415019133"
                aria-labelledby="message-username-1494217200415019133 uid_1 message-content-1494217200415019133 uid_2 message-timestamp-1494217200415019133"
              >
                <div class="repliedTextPreview">Replying to Alice</div>
                <div class="header">
                  <h3><span id="message-username-1494217200415019133" class="username">David</span></h3>
                  <time id="message-timestamp-1494217200415019133" datetime="2026-04-16T06:05:41.792Z"></time>
                </div>
                <div id="message-content-1494217200415019133">looks good</div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom
    Object.defineProperty(window.HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent ?? ""
      }
    })

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const messages = extractVisibleMessages({
      guildId: "guild-1",
      guildName: "Guild One",
      channelId: "channel-1",
      channelName: "alpha"
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.id).toBe("guild-1:channel-1:1494217200415019133")
    expect(messages[0]?.isReply).toBe(true)
  })

  it("marks thread sidebar messages as replies", () => {
    const dom = new JSDOM(
      `
        <body>
          <aside class="threadSidebar">
            <ol data-list-id="chat-messages">
              <li id="chat-messages-thread-message-1">
                <article>
                  <div class="header">
                    <h3><span class="username">Thread Author</span></h3>
                    <time datetime="2026-04-17T09:00:00.000Z"></time>
                  </div>
                  <div id="message-content-thread-message-1">inside thread</div>
                </article>
              </li>
            </ol>
          </aside>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom
    Object.defineProperty(window.HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent ?? ""
      }
    })

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const messages = extractVisibleMessages({
      guildId: "guild-1",
      guildName: "Guild One",
      channelId: "channel-1",
      channelName: "alpha"
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.isReply).toBe(true)
  })

  it("marks complementary thread pane messages as replies", () => {
    const dom = new JSDOM(
      `
        <body>
          <section role="complementary">
            <ol data-list-id="chat-messages">
              <li id="chat-messages-thread-message-2">
                <article>
                  <div class="header">
                    <h3><span class="username">Thread Reply</span></h3>
                    <time datetime="2026-04-17T09:30:00.000Z"></time>
                  </div>
                  <div id="message-content-thread-message-2">second pane</div>
                </article>
              </li>
            </ol>
          </section>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom
    Object.defineProperty(window.HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent ?? ""
      }
    })

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const messages = extractVisibleMessages({
      guildId: "guild-1",
      guildName: "Guild One",
      channelId: "channel-1",
      channelName: "alpha"
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.isReply).toBe(true)
  })

  it("does not mark main channel messages as replies just because thread-open chrome is present", () => {
    const dom = new JSDOM(
      `
        <body>
          <div class="appRoot threadSidebarOpen">
            <main>
              <ol data-list-id="chat-messages">
                <li id="chat-messages-main-message-1">
                  <article>
                    <div class="header">
                      <h3><span class="username">Main Author</span></h3>
                      <time datetime="2026-04-17T09:45:00.000Z"></time>
                    </div>
                    <div id="message-content-main-message-1">main channel row</div>
                  </article>
                </li>
              </ol>
            </main>
          </div>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom
    Object.defineProperty(window.HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent ?? ""
      }
    })

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const messages = extractVisibleMessages({
      guildId: "guild-1",
      guildName: "Guild One",
      channelId: "channel-1",
      channelName: "alpha"
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.isReply).toBe(false)
  })

  it("uses previous author for grouped rows instead of thread accessory usernames", () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li id="chat-messages-message-1">
              <article>
                <div class="contents">
                  <img class="avatar" src="https://cdn.example.com/alice.png">
                  <div class="header">
                    <h3><span class="username">Alice</span></h3>
                    <time datetime="2026-04-17T09:00:00.000Z"></time>
                  </div>
                  <div id="message-content-message-1">top level</div>
                </div>
              </article>
            </li>
            <li id="chat-messages-message-2">
              <article>
                <div class="contents">
                  <div class="header">
                    <time datetime="2026-04-17T09:05:00.000Z"></time>
                  </div>
                  <div id="message-content-message-2">grouped row</div>
                </div>
                <div class="threadMessageAccessory">
                  <img class="avatar" src="https://cdn.example.com/michael.png">
                  <span class="username">Michael Arnaldi</span>
                </div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom
    Object.defineProperty(window.HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent ?? ""
      }
    })

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const messages = extractVisibleMessages({
      guildId: "guild-1",
      guildName: "Guild One",
      channelId: "channel-1",
      channelName: "alpha"
    })

    expect(messages).toHaveLength(2)
    expect(messages[1]?.authorName).toBe("Alice")
    expect(messages[1]?.authorAvatarUrl).toBe(
      "https://cdn.example.com/alice.png"
    )
  })

  it("ignores offscreen message rows that Discord has kept mounted", () => {
    const dom = new JSDOM(
      `
        <body>
          <ol data-list-id="chat-messages">
            <li id="chat-messages-message-visible">
              <article>
                <div class="header">
                  <h3><span class="username">Visible</span></h3>
                  <time datetime="2026-04-17T09:00:00.000Z"></time>
                </div>
                <div id="message-content-message-visible">visible row</div>
              </article>
            </li>
            <li id="chat-messages-message-offscreen">
              <article>
                <div class="header">
                  <h3><span class="username">Offscreen</span></h3>
                  <time datetime="2026-04-17T08:00:00.000Z"></time>
                </div>
                <div id="message-content-message-offscreen">offscreen row</div>
              </article>
            </li>
          </ol>
        </body>
      `,
      { url: "https://discord.com/channels/guild-1/channel-1" }
    )
    const { window } = dom
    Object.defineProperty(window.HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent ?? ""
      }
    })

    Object.assign(globalThis, {
      document: window.document,
      window
    })

    const visibleRow = window.document.getElementById(
      "chat-messages-message-visible"
    )
    const offscreenRow = window.document.getElementById(
      "chat-messages-message-offscreen"
    )
    if (!visibleRow || !offscreenRow) {
      throw new Error("Expected test message rows to exist")
    }

    visibleRow.getBoundingClientRect = () =>
      ({
        top: 120,
        bottom: 180,
        left: 0,
        right: 600,
        width: 600,
        height: 60,
        x: 0,
        y: 120,
        toJSON: () => ({})
      }) as DOMRect
    offscreenRow.getBoundingClientRect = () =>
      ({
        top: -480,
        bottom: -420,
        left: 0,
        right: 600,
        width: 600,
        height: 60,
        x: 0,
        y: -480,
        toJSON: () => ({})
      }) as DOMRect

    const messages = extractVisibleMessages({
      guildId: "guild-1",
      guildName: "Guild One",
      channelId: "channel-1",
      channelName: "alpha"
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.authorName).toBe("Visible")
  })
})
