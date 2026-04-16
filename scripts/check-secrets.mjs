import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { basename } from "node:path"

const mode = process.argv[2]
const files = mode === "--repo" ? listTrackedFiles() : listStagedFiles()
const findings = []

for (const file of files) {
  const blockedPathReason = getBlockedPathReason(file)
  if (blockedPathReason) {
    findings.push({ file, reason: blockedPathReason })
    continue
  }

  const content =
    mode === "--repo" ? readWorkingTreeFile(file) : readStagedFile(file)
  if (content == null || content.includes("\u0000")) continue

  const contentFinding = findSecretInContent(content)
  if (contentFinding) {
    findings.push({
      file,
      reason: contentFinding.reason,
      line: contentFinding.line
    })
  }
}

if (findings.length === 0) {
  runSecretlint(files)
  process.exit(0)
}

console.error("Secret check failed.")
for (const finding of findings) {
  const location = finding.line ? `:${finding.line}` : ""
  console.error(`- ${finding.file}${location} ${finding.reason}`)
}
console.error(
  "Remove the secret, move it to local environment/config, or commit a redacted example file instead."
)
process.exit(1)

function listTrackedFiles() {
  return getCommandOutput("git", ["ls-files"])
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean)
}

function listStagedFiles() {
  return getCommandOutput("git", [
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMR"
  ])
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean)
}

function readWorkingTreeFile(file) {
  if (!existsSync(file)) return null
  return readFileSync(file, "utf8")
}

function readStagedFile(file) {
  const result = spawnSync("git", ["show", `:${file}`], { encoding: "utf8" })

  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }

  return result.stdout
}

function getBlockedPathReason(file) {
  const fileName = basename(file)
  const normalizedName = fileName.toLowerCase()
  const isEnvFile =
    normalizedName === ".env" || normalizedName.startsWith(".env.")
  const isAllowedExample =
    normalizedName === ".env.example" ||
    normalizedName === ".env.sample" ||
    normalizedName === ".env.template" ||
    normalizedName.startsWith(".env.example.")

  if (isEnvFile && !isAllowedExample) {
    return "committing .env files is blocked"
  }

  if (/\.(pem|key|p12|pfx|crt|cer|der)$/i.test(file)) {
    return "committing private key or certificate files is blocked"
  }

  if (/(^|\/)\.npmrc$/i.test(file)) {
    return "committing .npmrc is blocked because it often contains registry tokens"
  }

  return null
}

function findSecretInContent(content) {
  const lineRules = [
    {
      reason: "contains a private key header",
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/
    },
    {
      reason: "contains an AWS access key id",
      pattern: /\bAKIA[0-9A-Z]{16}\b/
    },
    {
      reason: "contains a GitHub personal access token",
      pattern: /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,})\b/
    },
    {
      reason: "contains a Google API key",
      pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/
    },
    {
      reason: "contains a Slack token",
      pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/
    },
    {
      reason: "contains a Stripe secret key",
      pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/
    },
    {
      reason: "looks like a credential assignment",
      pattern:
        /\b(api[_-]?key|secret|token|password|passwd|client[_-]?secret|access[_-]?key)\b\s*[:=]\s*["']?[A-Za-z0-9/_+=.-]{8,}/i
    }
  ]

  const lines = content.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    for (const rule of lineRules) {
      if (rule.pattern.test(line)) {
        return {
          reason: rule.reason,
          line: index + 1
        }
      }
    }
  }

  return null
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

function runSecretlint(files) {
  if (files.length === 0) return

  const result = spawnSync(
    getSecretlintCommand(),
    [
      "--secretlintrc",
      ".secretlintrc.json",
      "--secretlintignore",
      ".secretlintignore",
      "--no-glob",
      ...files
    ],
    { stdio: "inherit" }
  )

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function getSecretlintCommand() {
  return process.platform === "win32"
    ? "node_modules/.bin/secretlint.cmd"
    : "node_modules/.bin/secretlint"
}
