import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { extname } from "node:path"

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".tsx",
  ".json",
  ".jsonc",
  ".css",
  ".html",
  ".md"
])

const stagedFiles = getCommandOutput("git", [
  "diff",
  "--cached",
  "--name-only",
  "--diff-filter=ACMR"
])
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => SUPPORTED_EXTENSIONS.has(extname(file)))
  .filter((file) => existsSync(file))

if (stagedFiles.length === 0) {
  process.exit(0)
}

runCommand(getBiomeCommand(), [
  "check",
  "--write",
  "--no-errors-on-unmatched",
  ...stagedFiles
])
runCommand("git", ["add", "--", ...stagedFiles])

function getBiomeCommand() {
  return process.platform === "win32"
    ? "node_modules/.bin/biome.cmd"
    : "node_modules/.bin/biome"
}

function getCommandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" })

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }

  return result.stdout
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
