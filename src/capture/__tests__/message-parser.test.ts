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
})
