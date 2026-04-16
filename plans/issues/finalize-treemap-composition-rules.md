## Parent PRD

#1

## What to build

Finalize the popup treemap so it renders the full category composition for real assignment data, including named categories plus the computed `Uncategorized` bucket, correct percentages, and omission of zero-count named categories in the selected slice. This slice should leave the popup behavior aligned with the PRD's final composition rules.

Reference the parent PRD's `Solution`, `Implementation Decisions`, and `Testing Decisions` sections for rendering, percentage, and empty-state rules.

## Acceptance criteria

- [ ] The treemap renders only categories with at least one message in the selected server, optional channel, and time slice.
- [ ] `Uncategorized` appears when messages in the selected slice have no assignment and is omitted when its count is zero.
- [ ] Tile labels show category name, message count, and percentage of the current slice.
- [ ] Tests cover mixed category compositions, zero-count omission, and percentage correctness across `24h`, `7d`, and `30d`.

## Blocked by

- Blocked by #4
- Blocked by #5

## User stories addressed

- User story 14
- User story 19
- User story 20
- User story 21
- User story 22
- User story 23
- User story 27
- User story 30
