import { describe, expect, it } from "vitest"
import { resolveCaptureSource } from "../sources"
import { circleCaptureSource } from "../sources/circle"
import { discordCaptureSource } from "../sources/discord"

describe("resolveCaptureSource", () => {
  it("returns the discord capture source for discord hosts", () => {
    expect(resolveCaptureSource({ hostname: "discord.com" })).toBe(
      discordCaptureSource
    )
    expect(resolveCaptureSource({ hostname: "ptb.discord.com" })).toBe(
      discordCaptureSource
    )
  })

  it("returns the circle capture source for circle hosts", () => {
    expect(resolveCaptureSource({ hostname: "circle.so" })).toBe(
      circleCaptureSource
    )
    expect(resolveCaptureSource({ hostname: "app.circle.so" })).toBe(
      circleCaptureSource
    )
  })

  it("returns null for unsupported hosts", () => {
    expect(resolveCaptureSource({ hostname: "example.com" })).toBeNull()
  })
})
