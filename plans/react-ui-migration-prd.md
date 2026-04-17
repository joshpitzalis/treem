## Problem Statement

The extension's current UI surfaces are implemented with imperative DOM code. That works, but it does not match the developer's normal frontend workflow or mental model. The developer is substantially more comfortable building, reading, and extending React code than maintaining DOM mutation code by hand.

This mismatch makes the popup and injected categorization UI harder for the developer to reason about, slower to extend, and less pleasant to maintain. The current build setup is also oriented around direct `esbuild` entrypoints rather than a UI-focused toolchain that naturally supports React and Tailwind across the extension.

The user wants a migration plan that moves the extension onto a frontend stack that is easier to understand and extend while preserving existing behavior, keeping the Chrome load/unpacked workflow intact, and preserving or improving the current behavior-focused test coverage.

## Solution

Migrate the extension to a Vite-based build and move both user-facing UI surfaces to React in phases.

The migration will keep the extension's domain logic framework-agnostic. Message capture, Discord DOM parsing, storage, and query logic remain in plain TypeScript. React is introduced only where it improves maintainability: the popup UI and the injected categorization UI.

The migration will happen in three phases:

1. Replace the current build pipeline with Vite while preserving behavior and continuing to output the built extension into the existing `extension/` folder.
2. Rewrite the popup UI in React with behavior parity and React Testing Library coverage.
3. Rewrite the Discord injected categorization UI in React, mounted through an imperative host bridge and isolated with Shadow DOM, while preserving first-pass behavior.

Tailwind will be used for both UI surfaces. The popup and Discord UI will be organized as separate feature surfaces with mostly separate components, hooks, styles, and tests. Shared code remains limited to true cross-surface domain/query logic or hard-earned UI primitives with multiple consumers.

## User Stories

1. As the developer, I want the extension build to use Vite, so that React and Tailwind fit naturally into the project.
2. As the developer, I want the extension to keep building into the existing `extension/` folder, so that Chrome load/unpacked usage does not change.
3. As the developer, I want the first migration phase to avoid intentional behavior changes, so that tooling regressions can be isolated from product regressions.
4. As the developer, I want the popup to be implemented in React, so that I can extend it using patterns I already know well.
5. As the developer, I want the Discord injected categorization UI to be implemented in React, so that both UI surfaces use the same mental model.
6. As the developer, I want capture, parsing, storage, and query logic to remain plain TypeScript, so that browser integration concerns stay separate from UI concerns.
7. As a user of the extension, I want the popup to keep the same first-pass behavior during migration, so that the extension remains familiar and reliable.
8. As a user of the extension, I want the popup to preserve the current server, channel, and time-range behavior, so that the React migration does not change how I navigate the data.
9. As a user of the extension, I want the popup leaderboard and treemap to remain aligned to the same scope and time slice, so that the data stays coherent.
10. As a user of the extension, I want popup preference persistence to keep working, so that reopening the extension does not reset my context.
11. As a user of the extension, I want storage-driven popup refresh behavior to keep working, so that newly captured data appears without manual intervention.
12. As a user of the extension, I want the popup empty states and sync states to remain understandable, so that the migration does not reduce clarity.
13. As the developer, I want popup tests to remain behavior-focused, so that they survive internal refactors.
14. As the developer, I want popup tests to move onto React Testing Library, so that the test style matches the new UI stack.
15. As a Discord user, I want the injected categorization controls to keep working inside the Discord page, so that the migration does not interrupt categorization flow.
16. As a Discord user, I want the injected UI to remain scoped to captured top-level messages, so that controls only appear where categorization is valid.
17. As a Discord user, I want existing categories to remain selectable from the injected UI, so that I can keep organizing messages quickly.
18. As a Discord user, I want to create a new category from the injected UI, so that categorization remains possible without leaving context.
19. As a Discord user, I want to clear a category assignment back to `Uncategorized`, so that I can reverse categorization decisions.
20. As a Discord user, I want the injected UI to update after assignment changes, so that the page reflects the saved state immediately.
21. As the developer, I want the Discord injected React UI isolated from Discord's CSS, so that Discord styling changes are less likely to break the controls.
22. As the developer, I want Shadow DOM used for the injected React UI, so that Tailwind styles can be applied safely without leaking into Discord.
23. As the developer, I want an imperative host bridge between Discord's DOM and React roots, so that mounting logic stays separate from UI rendering logic.
24. As the developer, I want the popup feature surface and Discord UI feature surface organized separately, so that each surface is easy to find and reason about.
25. As the developer, I want components, hooks, styles, and tests colocated within each surface, so that extension structure mirrors product structure.
26. As the developer, I want to avoid a large shared UI layer too early, so that the codebase does not accumulate vague abstractions before they are earned.
27. As the developer, I want only truly generic shared primitives to be extracted, so that shared code remains small and defensible.
28. As the developer, I want strong coverage on shared domain/query logic to remain in place, so that UI migrations do not weaken the extension's core correctness.
29. As the developer, I want build and packaging smoke coverage, so that extension output regressions are caught early.
30. As the developer, I want Discord host bridge behavior covered by tests, so that root mounting and synchronization are validated at the integration boundary.
31. As the developer, I want the migration to happen in phases, so that risk stays manageable and regressions are easier to diagnose.
32. As the developer, I want the file structure to make it obvious where popup code lives, where Discord UI code lives, and where shared domain logic lives, so that future changes are easy to place.
33. As the developer, I want the migrated code to be easier to extend after the React conversion, so that future UI changes require less friction.
34. As a future maintainer, I want tests to describe observable behavior rather than component internals, so that refactors remain safe.
35. As a future maintainer, I want the extension to retain a clear boundary between product behavior and build tooling, so that future migrations can happen incrementally.

## Implementation Decisions

- The migration is a three-phase effort:
  1. Vite migration with no intentional product behavior changes.
  2. Popup React migration with behavior parity.
  3. Discord injected categorization UI React migration with behavior parity.
- Vite becomes the primary build tool for the whole extension rather than only for selected UI entrypoints.
- The extension must continue to build into the existing `extension/` output folder.
- The popup becomes a React application with a dedicated entrypoint, app shell, and feature-local components/hooks/tests.
- The Discord injected categorization UI becomes a React application mounted into the page through an imperative host bridge.
- The host bridge is responsible for finding valid anchor points in Discord's DOM, creating and managing mount roots, and synchronizing React rendering with Discord page changes.
- The injected React UI is isolated with Shadow DOM to reduce CSS collisions and make Tailwind practical within Discord's page.
- Tailwind is used for both React UI surfaces.
- Popup UI and Discord injected UI remain mostly separate feature surfaces. Shared UI code is only extracted if it earns multiple real consumers.
- Existing shared domain/query logic remains framework-agnostic and stays outside the UI surfaces.
- Message capture, DOM parsing, mutation observation, storage orchestration, category-state transitions, and leaderboard/treemap queries remain in plain TypeScript rather than being rewritten into React abstractions.
- React state is managed with built-in state/hooks rather than a state library.
- State management should stay local to each UI surface unless a deeper shared abstraction proves necessary.
- File organization should follow feature-surface boundaries so that popup concerns, Discord UI concerns, and shared domain concerns are easy to locate.
- The migration should favor deep modules with small public interfaces:
  `extension build pipeline` for packaging and entry orchestration,
  `popup app` for popup UI composition,
  `discord host bridge` for imperative page integration,
  `discord categorization app` for injected UI rendering,
  `shared domain/query layer` for framework-agnostic behavior.
- The first shipped React versions of both UI surfaces should preserve user-visible behavior rather than combining migration with a redesign.
- The popup React migration should preserve existing scope controls, time-range behavior, sync status behavior, and treemap/leaderboard alignment.
- The Discord injected React migration should preserve existing capabilities: show categorization controls near valid messages, create categories, assign existing categories, clear assignments, and refresh visible state after saves.
- Naming and organization should optimize for searchability and permanence rather than implementation detail. Surface names should map to the product concepts the developer already uses mentally.

## Testing Decisions

- Good tests verify external behavior through public interfaces. They should survive internal refactors and avoid coupling to component structure, helper extraction, or hook composition details.
- The migration should keep the current behavior-focused testing posture and extend it where the new architecture introduces risk.
- Shared domain/query logic remains covered with the existing Vitest-style tests because that layer should stay framework-agnostic.
- Popup React behavior should be covered with React Testing Library, with tests focused on what renders and how the user interacts with it rather than component internals.
- Discord injected React behavior should be covered primarily with DOM-level integration tests that exercise realistic flows in a simulated document.
- The Discord host bridge should receive explicit integration-style tests because it is the boundary between Discord's hostile DOM and the injected React roots.
- The Vite migration should include build/packaging smoke coverage to prove the extension still emits the expected artifacts and manifest wiring.
- Tests should prioritize the critical paths of each phase instead of trying to exhaustively test implementation details:
  build output and manifest wiring,
  popup rendering and controls,
  popup storage-refresh behavior,
  injected categorization flows,
  host bridge mounting behavior,
  shared storage/query/category rules.
- Prior art for shared logic tests already exists in the repository's `src/shared` tests.
- Prior art for popup and injected behavior-focused DOM tests already exists in the repository's popup and categorization tests.
- React migrations should adapt those behavior-focused tests rather than replacing them with shallow component tests.

## Out of Scope

- Redesigning the popup during the first React migration pass.
- Redesigning the Discord categorization interaction during the first React migration pass.
- Rewriting message capture, message parsing, storage, or leaderboard/category query logic into React.
- Introducing a client-side state library.
- Creating a broad shared component system before it is justified by multiple consumers.
- Expanding the extension beyond its current local-only data model.
- Changing the Chrome load/unpacked workflow away from the `extension/` folder.
- Adding advanced injected UI behavior that does not already exist, unless required by the migration architecture itself.

## Further Notes

- Success is not just "React compiles." Success means the file structure makes it obvious where things belong and makes future extension work easier to place and extend.
- The migration should reduce cognitive friction for the developer without weakening the boundary between UI code and domain/browser-integration code.
- Each phase should end in a shippable state with behavior preserved and tests green before the next phase begins.
