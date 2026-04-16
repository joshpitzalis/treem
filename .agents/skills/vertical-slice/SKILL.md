---
name: vertical-slice
description: Organize code by feature (vertical slices), not by technical type. Use this skill when building new features, creating new files or folders, refactoring or reorganizing code, working through implementation plans, or any time file placement decisions come up. Also use when the user mentions "vertical slice", "feature folder", "deleteability", or asks where something should live.
---

# Vertical Slicing: File Organization

**The principle:** Organize code by feature, not by technical type. Code that's easy to delete is easy to change.

## Adapting to the Codebase

Before applying these principles, look at the existing project structure. Identify:

- Where features currently live (e.g. `src/features/`, `app/`, `modules/`, or domain folders)
- Whether it's a monorepo (multiple packages) or single project
- What the existing conventions are for shared code, tests, and components

Work with the project's existing layout. If features live in `src/modules/`, put new features there — don't create a competing `src/features/` directory. The principles below are about how to think about organization, not about enforcing a specific folder structure.

## What is a Feature?

A feature is something you think of as its own thing — something you could point at and name. It doesn't have to be big or complex. A single-file empty state display is a feature. A completion percentage hero section is a feature. The test is mental: "would I think of this separately?" If yes, it gets its own folder.

Name features after what you call them in your head, not after their technical implementation. `date-bar/` not `timeline/`. `pending-ops/` not `approval-workflow/`. When someone new opens the features directory, the names should read like a map of the product.

A feature folder can be one file or twenty. Size doesn't determine whether something is a feature — identity does.

## What Goes in a Feature Folder

A feature folder contains everything that feature needs. The specifics depend on your stack, but the pattern is consistent:

**Backend features** typically contain:
- Business logic (commands, queries, services)
- Feature-specific types/interfaces
- Route handlers or controllers
- Response formatting
- Tests

**Frontend features** typically contain:
- Main component(s)
- Data fetching hooks
- Mutation hooks
- Sub-components (forms, modals, etc.)
- Tests

Each operation gets its own file when it's complex enough. Small features can keep everything in one or two files.

## What Stays Inside a Feature (Not Its Own Feature)

Not everything gets its own feature folder. Things that are intrinsic plumbing of a feature stay inside it:

- **Interaction logic** (drag-and-drop, keyboard handlers) — tightly coupled to what it serves
- **Forms** — editing UI for the parent feature's entities
- **Feature-specific hooks or helpers** — used only by this feature

If only one feature uses it, it stays inside that feature. If two features need it, promote to shared code. The question: "would I ever delete this independently?" If no, it's an internal.

## No Cross-Feature Imports

Features must not import from each other. If feature A needs something from feature B, that's a signal the shared piece should be extracted to a shared location.

For example: if multiple features need the same constants, helpers, or base hooks, those belong in a shared module — not inside any one feature.

The one exception: an **orchestrator** or **layout** component imports from child features to compose them. That's consuming, not coupling — the child features don't import back.

If you spot a cross-feature import, fix it immediately:
1. Move the shared piece to the appropriate shared location
2. Update both features to import from there
3. If a hook belongs to a specific feature, move it into that feature and have it import base infrastructure from shared

## The Proximity Rule for Shared Code

Shared code goes as close as possible to the things sharing it. Not automatically at the root.

```
features/
  hierarchy/
    shared/            <- Shared between files inside hierarchy only
  checkout/
  shared/              <- Shared between features (e.g. hierarchy + checkout)
```

In a monorepo, this extends one level further:
```
packages/
  app-a/src/features/shared/   <- Shared within app-a's features
  app-b/src/features/shared/   <- Shared within app-b's features
  shared/                      <- Shared between packages
```

A root-level shared folder becomes a junk drawer. When you want to delete a feature, you have to go spelunking through shared code to find what's safe to remove. If the shared code sits close to the features using it, the dependency is obvious and deletion stays mechanical.

**Promote upward only when a second consumer appears.** Two features need it? Move to feature-level shared. Two packages need it? Move to package-level shared.

## Decision Rules

When placing a new file, follow this sequence:

1. **Is this its own thing — something with a name?** Give it its own feature folder.
2. **Is it plumbing for an existing feature?** Put it inside that feature's folder.
3. **Do two features in the same package/app share it?** Put it in the nearest shared location.
4. **Do two packages share it?** Put it in the cross-package shared location.
5. **Is it a reusable UI primitive with no domain logic?** It can live in a `components/ui/` or equivalent directory.

When splitting a large file:

1. Extract by concept, not by technical layer.
2. Ask: "is this extracted piece its own feature, or is it plumbing?" Features get their own folder. Plumbing stays in the parent feature.
3. If it turns out two features need the extracted piece, then promote it — not before.

## What Makes Code Deletable

- **One job per file.** Describable in one sentence: "Does X, using Y, sends result to Z." Need "and" twice? Split it.
- **Small over big.** Fewer responsibilities, simpler tests, trivially deletable.
- **Explicit deps.** Import what you use. No magic globals. Dependency graph readable from the top of the file.
- **Size tripwires.** Think twice past ~100 lines. Break the limit when justified, but stop and consider whether the file has too many responsibilities.

## The Delete Test

Deleting a feature should be three steps:

1. Delete the folder
2. Delete its import from the consumer
3. Fix breakages the compiler and test suite show you

If you can't do that, the feature is too entangled. Refactor to untangle before adding more.

## Tests and Deletion

Tests exist so deletion has visible consequences. Failed tests = map of what broke.

- Delete code -> build breaks -> delete test -> green. If build stays green after deleting code, it wasn't tested or wasn't doing anything.
- Change tests or code. Never both at the same time. Both = rewrite, not refactor.

## Checklist Before Creating Files

- Can someone new find this feature from the folder structure alone?
- Could they understand, change, remove, or test it without jumping across unrelated folders?
- Is anything in a shared folder that only one consumer uses? Move it closer.
- Could you delete this feature folder in three steps?
