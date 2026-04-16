## Parent PRD

#1

## What to build

Build the first end-to-end category view in the popup by adding a treemap below the existing leaderboard and wiring it to the existing server selector, channel selector, and shared `24h` / `7d` / `30d` tabs. For this slice, the treemap should compute its data entirely from currently captured messages and render a single computed `Uncategorized` bucket so the new popup module is functional before Discord-side assignment exists.

Reference the parent PRD's `Solution`, `Implementation Decisions`, and `Testing Decisions` sections for the expected popup behavior and time-slice rules.

## Acceptance criteria

- [ ] The popup keeps the existing leaderboard and renders a new treemap module below it.
- [ ] The treemap uses the same selected server, selected channel, and selected time range as the leaderboard.
- [ ] The treemap renders a 1:1 chart area and shows an `Uncategorized` tile sized from captured message counts for the selected slice.
- [ ] Popup tests cover the new shared-scope and shared-time-range behavior.

## Blocked by

None - can start immediately

## User stories addressed

- User story 12
- User story 15
- User story 16
- User story 17
- User story 18
- User story 19
- User story 20
- User story 21
- User story 22
- User story 23
- User story 24
- User story 27
- User story 30
