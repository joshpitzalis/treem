import { buildExtension } from "./extension-build"

const watch = process.argv.includes("--watch")

void run()

async function run(): Promise<void> {
  await buildExtension({ watch })

  if (watch) {
    console.log("Watching Vite extension entry points...")
  }
}
