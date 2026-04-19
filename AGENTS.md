# AGENTS

## Local extension debug workflow

When shipping a new local debug iteration of the Chrome extension:

1. Bump the version in both `package.json` and `extension/manifest.json`.
2. Run `pnpm build`.
3. Reload the extension in `chrome://extensions`.
4. Hard refresh Discord with `Cmd+Shift+R`.
5. Open the Discord page console and confirm the startup log:

```text
[treem] capture loaded { version: "0.1.x", build: "0.1.x+..." }
```

Rules:

- Keep `package.json` and `extension/manifest.json` on the same version.
- Use a new patch version for each meaningful local debug round when the user needs to verify they are on the latest build.
- The Chrome Extensions UI version comes from `extension/manifest.json`.
- The content-script console log uses the package version plus a build timestamp.
- If the console still shows an older build stamp, the Discord tab is still running an old content script and needs a full refresh.

## Notes for future agent work

- This repo builds the unpacked extension into the `extension/` folder.
- The Discord page console is the fastest way to confirm which content-script build is active.
