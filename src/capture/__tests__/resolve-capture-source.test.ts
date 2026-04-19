import { describe, expect, it } from "vitest"
import { discordCaptureSource } from "../discord-capture-source"
import { resolveCaptureSource } from "../resolve-capture-source"

describe("resolveCaptureSource", () => {
  it("returns the discord capture source for discord hosts", () => {
    expect(resolveCaptureSource({ hostname: "discord.com" })).toBe(
      discordCaptureSource
    )
    expect(resolveCaptureSource({ hostname: "ptb.discord.com" })).toBe(
      discordCaptureSource
    )
  })

  it("returns null for unsupported hosts", () => {
    expect(resolveCaptureSource({ hostname: "circle.so" })).toBeNull()
  })
})
