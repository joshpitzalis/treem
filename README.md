# Discord Contribution Leaderboard

A local Chrome extension that watches the Discord web app, captures message activity that is already rendered in your browser, and computes a simple per-server leaderboard.

## What it does

- Runs only on `https://discord.com/*`
- Captures visible message metadata from the current channel view
- Stores the last 30 days of captured activity in `chrome.storage.local`
- Shows a leaderboard in the extension popup

## Honest limitation

This extension does **not** know the full history of a server. It only scores messages that Discord has actually rendered in your browser while the extension is active.

That means the leaderboard is best interpreted as:

> "Among the messages my browser has observed recently, who is contributing the most?"

## Scoring

The MVP contribution score is intentionally simple:

- `+1` base score per message
- `+1` if the message looks like a reply
- `+1` if the message has attachments
- `+1` for each visible reaction, capped at `+3`
- very short messages are slightly discounted

## Load the extension

1. Run `pnpm install`
2. Run `pnpm run build`
3. Open `chrome://extensions`
4. Enable Developer Mode
5. Click `Load unpacked`
6. Select the repo's `extension` folder: `/Users/jxsh/Desktop/projects/treem/extension`

## Project structure

- `src/shared`: common types, storage, and scoring
- `src/capture`: Discord DOM extraction and message capture
- `src/popup`: popup leaderboard UI
- `extension`: extension assets plus bundled runtime scripts
