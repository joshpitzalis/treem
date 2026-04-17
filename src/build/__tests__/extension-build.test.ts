import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { buildExtension } from "../extension-build"

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.map(async (tempDir) => {
      await rm(tempDir, { recursive: true, force: true })
    })
  )
  tempDirs.length = 0
})

describe("buildExtension", () => {
  it("emits chrome-loadable extension artifacts with manifest wiring intact", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "treem-extension-build-"))
    tempDirs.push(outDir)

    await buildExtension({ outDir })

    await expect(
      readFile(path.join(outDir, "manifest.json"), "utf8")
    ).resolves.toContain('"default_popup": "popup.html"')
    await expect(
      readFile(path.join(outDir, "popup.html"), "utf8")
    ).resolves.toContain('<script src="popup/popup.js"></script>')
    await expect(
      readFile(path.join(outDir, "popup.css"), "utf8")
    ).resolves.toContain(".app-shell")
    await expect(
      readFile(path.join(outDir, "capture/content.js"), "utf8")
    ).resolves.toContain("MutationObserver")
    await expect(
      readFile(path.join(outDir, "popup/popup.js"), "utf8")
    ).resolves.toContain("bootstrapPopup")
    await expect(
      readFile(path.join(outDir, "icons/icon-16.png"))
    ).resolves.toBeInstanceOf(Buffer)
  })
})
