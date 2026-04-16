## Parent PRD

#1

## What to build

Extend the Discord-side categorization flow so an already categorized message can be reassigned to a different existing category or cleared back to `Uncategorized`. The popup treemap should recompute counts and percentages correctly after reassignment or clearing.

Reference the parent PRD's `Solution`, `Implementation Decisions`, and `Testing Decisions` sections for the computed `Uncategorized` behavior and single-category-per-message rule.

## Acceptance criteria

- [ ] A categorized message can be reassigned to another existing category from the hover flow.
- [ ] A categorized message can be cleared back to `Uncategorized` from the same flow.
- [ ] The stored assignment model continues to enforce exactly zero or one category per message.
- [ ] Tests cover reassignment, clearing, and resulting popup treemap updates.

## Blocked by

- Blocked by #3

## User stories addressed

- User story 4
- User story 10
- User story 11
- User story 12
- User story 19
- User story 20
- User story 23
- User story 26
- User story 28
- User story 29
- User story 30
