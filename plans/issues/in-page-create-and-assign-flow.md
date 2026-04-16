## Parent PRD

#1

## What to build

Add the first Discord-side categorization flow by injecting a hover-only control near the message timestamp that lets the user create a server-scoped category inline and assign the current captured message to it. The popup treemap should immediately reflect that named category within the current server, channel, and time slice.

Reference the parent PRD's `Solution`, `Implementation Decisions`, and `Testing Decisions` sections for placement, storage, and popup synchronization requirements.

## Acceptance criteria

- [ ] Hovering a captured Discord message reveals a categorization control near the timestamp area.
- [ ] The control supports creating a new category and assigning the current message in one flow.
- [ ] The assignment persists locally and the popup treemap shows the named category for the relevant scope and time window.
- [ ] Integration tests cover the injected hover UI and the end-to-end create-and-assign behavior.

## Blocked by

- Blocked by #2

## User stories addressed

- User story 1
- User story 2
- User story 3
- User story 4
- User story 5
- User story 8
- User story 9
- User story 12
- User story 15
- User story 16
- User story 17
- User story 18
- User story 19
- User story 20
- User story 24
- User story 25
- User story 26
- User story 28
- User story 29
- User story 30
