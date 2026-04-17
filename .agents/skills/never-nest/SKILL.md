---
name: never-nest
description: >
  Reduce code nesting depth with guard clauses, early exits, and extraction. Use when
  writing, reviewing, or refactoring code that is hard to read because conditions or
  loops are stacked too deeply, or when the user asks to simplify, flatten, denest,
  clean up, add guard clauses, use early returns, or extract helper functions. Also
  use when a function would exceed 3 levels of indentation.
---

# Never Nest

Keep functions at 3 levels of indentation or less. Count the function body as level 1. If a change would push code deeper than level 3, flatten it before continuing.

## Apply two moves

### Invert

Flip conditions so failure paths exit early and the main path stays shallow.

Use `return`, `continue`, or `break` to leave immediately after handling the non-happy path.

```ts
function processUser(user: User | null) {
  if (user == null) return
  if (!user.isActive) return
  if (!user.hasPermission) return

  doImportantThing(user)
}
```

Prefer inversion when:

- Preconditions guard the real work
- One branch is error handling and the other is the main path
- A loop body can skip invalid items with `continue`

### Extract

Move deep or long inner blocks into named helpers. Use names that describe intent, not mechanics.

```ts
function run() {
  processIncomingRequests()
  processCurrentDownloads()
}

function processCurrentDownloads() {
  for (const download of downloads) {
    if (download.state === PENDING) processPending(download)
    else if (download.state === IN_PROGRESS) processInProgress(download)
  }
}
```

Prefer extraction when:

- A nested block is longer than about 10 lines
- A function is doing more than one job
- A block has a clear domain name

## Refactor workflow

1. Count indentation depth and find the deepest branch.
2. Identify the happy path that should remain easiest to read.
3. Invert conditions first when an early exit preserves behavior.
4. Extract helpers when a block is still deep, long, or mixed-purpose.
5. Re-check depth after each edit instead of making one large rewrite.
6. Verify behavior with tests. If tests do not exist, call that out.

## Writing guidance

- Start functions with validation and precondition guards.
- Avoid `else` after a branch that already exits.
- Keep loop bodies thin; push work into helpers.
- Let top-level functions read like a short sequence of domain steps.
- Preserve behavior. This is a structural refactor, not a logic rewrite.

## Review guidance

When reviewing code, flag:

- More than 3 levels of indentation
- Conditions wrapped around the main logic instead of guarding it
- Large blocks inside loops or conditionals
- Helper candidates hidden inside a long function

If deeper nesting is truly the clearest representation, state that explicitly and explain why.
