## Parent PRD

#1

## What to build

Harden the category model so categories are truly server-scoped, reusable across channels in the same server, and unique by case-insensitive name. Empty named categories should remain stored for future use even when they do not currently appear in the popup treemap.

Reference the parent PRD's `Solution`, `Implementation Decisions`, and `Testing Decisions` sections for uniqueness, persistence, and scope rules.

## Acceptance criteria

- [ ] Creating or using categories in one channel makes those categories available in other channels within the same server.
- [ ] Creating a duplicate category name in the same server is blocked case-insensitively.
- [ ] Empty named categories remain persisted for future reuse even when they have no current message assignments.
- [ ] Tests cover server scoping, case-insensitive uniqueness, and empty-category persistence.

## Blocked by

- Blocked by #3

## User stories addressed

- User story 6
- User story 7
- User story 8
- User story 13
- User story 17
- User story 18
- User story 24
- User story 26
- User story 28
