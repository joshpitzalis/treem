import { spawnSync } from "node:child_process"

const pnpmArgs = process.argv.slice(2)

if (pnpmArgs.length === 0) {
  console.error("Usage: node scripts/run-pnpm.mjs <pnpm args>")
  process.exit(1)
}

// Prefer the package-manager shim when it exists, but keep hooks working on
// machines that only have pnpm installed directly.
if (runCommand(getCorepackCommand(), ["pnpm", ...pnpmArgs])) {
  process.exit(0)
}

if (runCommand(getPnpmCommand(), pnpmArgs)) {
  process.exit(0)
}

console.error("Could not find either corepack or pnpm on PATH.")
process.exit(1)

function getCorepackCommand() {
  return process.platform === "win32" ? "corepack.cmd" : "corepack"
}

function getPnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm"
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" })

  if (result.error?.code === "ENOENT") {
    return false
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  return true
}
