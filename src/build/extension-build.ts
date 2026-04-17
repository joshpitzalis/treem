import { cp, mkdir, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { build, type InlineConfig } from "vite"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const extensionSourceDir = path.join(projectRoot, "extension")

const generatedBundlePaths = new Set([
  "capture/content.js",
  "popup/popup.css",
  "popup/popup.js"
])

const buildTargets = [
  {
    entryPath: "src/capture/content.ts",
    outputPath: "capture/content.js",
    bundleName: "TreemCaptureBundle"
  },
  {
    entryPath: "src/popup/popup.tsx",
    outputPath: "popup/popup.js",
    bundleName: "TreemPopupBundle",
    cssFileName: "popup/popup"
  }
] as const

export interface BuildExtensionOptions {
  outDir?: string
  watch?: boolean
}

export async function buildExtension(
  options: BuildExtensionOptions = {}
): Promise<void> {
  const outDir = options.outDir ?? extensionSourceDir
  const watch = options.watch ?? false

  await copyStaticExtensionFiles({
    sourceDir: extensionSourceDir,
    outDir
  })

  for (const target of buildTargets) {
    await build(createTargetConfig({ outDir, watch, ...target }))
  }
}

function createTargetConfig({
  bundleName,
  cssFileName,
  entryPath,
  outDir,
  outputPath,
  watch
}: {
  bundleName: string
  cssFileName?: string
  entryPath: string
  outDir: string
  outputPath: string
  watch: boolean
}): InlineConfig {
  return {
    configFile: false,
    publicDir: false,
    define: {
      "process.env.NODE_ENV": JSON.stringify("production")
    },
    build: {
      emptyOutDir: false,
      lib: {
        ...(cssFileName ? { cssFileName } : {}),
        entry: path.join(projectRoot, entryPath),
        formats: ["iife"],
        name: bundleName
      },
      minify: false,
      outDir,
      rollupOptions: {
        output: {
          entryFileNames: outputPath
        }
      },
      sourcemap: false,
      target: "es2020",
      watch: watch ? {} : null
    },
    logLevel: "info",
    plugins: [tailwindcss()]
  }
}

async function copyStaticExtensionFiles({
  sourceDir,
  outDir
}: {
  sourceDir: string
  outDir: string
}): Promise<void> {
  await mkdir(outDir, { recursive: true })

  const sourceEntries = await readdir(sourceDir, {
    recursive: true,
    withFileTypes: true
  })

  for (const entry of sourceEntries) {
    if (!entry.isFile()) continue

    const relativePath = path.relative(
      sourceDir,
      path.join(entry.parentPath, entry.name)
    )
    if (generatedBundlePaths.has(relativePath)) continue

    const sourcePath = path.join(sourceDir, relativePath)
    const destinationPath = path.join(outDir, relativePath)

    if (sourcePath === destinationPath) continue

    await mkdir(path.dirname(destinationPath), { recursive: true })
    await cp(sourcePath, destinationPath, { force: true })
  }
}
