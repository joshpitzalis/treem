import { build, context } from "esbuild"

const buildTargets = [
  {
    entryPoints: ["src/capture/content.ts"],
    format: "iife",
    outfile: "extension/capture/content.js"
  },
  {
    entryPoints: ["src/popup/popup.ts"],
    format: "iife",
    outfile: "extension/popup/popup.js"
  }
]

const sharedOptions = {
  bundle: true,
  logLevel: "info",
  platform: "browser",
  sourcemap: false,
  target: "es2020"
}

const isWatchMode = process.argv.includes("--watch")

if (isWatchMode) {
  const contexts = await Promise.all(
    buildTargets.map((target) => context({ ...sharedOptions, ...target }))
  )

  await Promise.all(contexts.map((targetContext) => targetContext.watch()))
  console.log("Watching bundled extension entry points...")
  await new Promise(() => {})
} else {
  await Promise.all(
    buildTargets.map((target) => build({ ...sharedOptions, ...target }))
  )
}
