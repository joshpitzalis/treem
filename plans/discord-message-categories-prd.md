## Problem Statement

The extension currently captures visible Discord messages and renders a contribution leaderboard in the popup, but it does not let the user organize messages into semantic groups. The user wants to review messages directly inside the Discord web app, assign each message to a category, and then see how those categories are distributed over time in the extension popup. This needs to happen in the page itself rather than in the extension popup because categorization is most useful while reading the conversation in context. The resulting analytics must stay aligned with the extension's existing local-only model: only messages that have been rendered in the browser and stored locally can be categorized or counted.

## Solution

Add a server-scoped message categorization feature that works across both extension surfaces:

- In Discord, inject a hover-only control near each message timestamp that lets the user either assign the message to an existing category or create a new category and assign the message in the same flow.
- Each message can belong to exactly one category within its server.
- Messages without an assigned category are treated as `Uncategorized`.
- In the popup, preserve the existing leaderboard and add a treemap below it.
- The treemap uses the same server selector, channel selector, and shared `24h` / `7d` / `30d` time-range controls that already drive the leaderboard.
- The treemap renders a 1:1 aspect-ratio chart whose tiles are sized by message count and labeled with category name, count, and percentage for the selected slice.
- Only categories with at least one message in the selected window render as tiles. If no named categories have messages in the selected slice, the treemap renders only `Uncategorized`.

## User Stories

1. As a Discord user reviewing a server conversation, I want to categorize a message directly from the message row, so that I do not have to leave the conversation context to organize it.
2. As a Discord user, I want the categorization affordance to appear only on hover, so that the Discord UI stays visually quiet when I am not actively organizing messages.
3. As a Discord user, I want the hover affordance placed near the timestamp area, so that it feels attached to the message metadata instead of bolted onto unrelated parts of the row.
4. As a Discord user, I want to assign a message to an existing category, so that I can classify messages quickly.
5. As a Discord user, I want to create a new category from the same assignment flow, so that I do not need a separate management screen before I can use the feature.
6. As a Discord user, I want category names to be unique within a server, so that I do not end up with duplicate categories that fragment my data.
7. As a Discord user, I want category-name uniqueness treated case-insensitively, so that `Bug` and `bug` do not become separate categories by mistake.
8. As a Discord user, I want categories to belong to the server rather than a single channel, so that I can reuse the same vocabulary across channels in that server.
9. As a Discord user, I want a message to belong to only one category, so that the treemap remains a clean partition of observed messages.
10. As a Discord user, I want to reassign a message from one category to another, so that I can correct mistakes as my understanding changes.
11. As a Discord user, I want to revert a categorized message back to `Uncategorized`, so that I can intentionally clear its assignment.
12. As a Discord user, I want `Uncategorized` to exist automatically for unassigned messages, so that every observed message still belongs to a visible bucket in the popup.
13. As a Discord user, I want previously created categories to remain available even when no current messages are assigned to them, so that I can reuse them later without recreating them.
14. As a Discord user, I want empty categories omitted from the current treemap slice, so that the chart only shows categories that matter for the selected window.
15. As a Discord user, I want the popup to preserve the current leaderboard, so that this feature adds new analysis without removing the existing contribution view.
16. As a Discord user, I want the treemap to appear below the leaderboard in the popup, so that I can move from contributor view to category view in one place.
17. As a Discord user, I want the treemap to respect the selected server, so that I can analyze categories per server.
18. As a Discord user, I want the treemap to respect the selected channel when a channel is chosen, so that I can analyze just one channel while still using server-scoped categories.
19. As a Discord user, I want the treemap to support the same `24h`, `7d`, and `30d` windows as the leaderboard, so that both visualizations stay in sync.
20. As a Discord user, I want the treemap to recompute for each time range, so that I can compare short-term and long-term category composition.
21. As a Discord user, I want the treemap to use a 1:1 aspect ratio, so that it remains visually stable and readable in the popup.
22. As a Discord user, I want treemap tile sizes based on message count, so that larger areas correspond to more messages in that category.
23. As a Discord user, I want each treemap tile labeled with category name, message count, and percentage, so that I can read both absolute and relative weight without separate math.
24. As a Discord user, I want only locally observed messages to appear in these counts, so that the category analytics stay consistent with the extension's capture model.
25. As a Discord user, I want categorization to work on messages the extension has already captured from Discord's rendered DOM, so that assignments map to stable stored message records.
26. As a Discord user, I want category state to survive popup closes and browser restarts, so that my organization work persists over time.
27. As a Discord user, I want category analytics to age out with the same rolling 30-day retention model as message storage, so that old assignments do not outlive the messages they describe.
28. As a developer maintaining the extension, I want category storage and aggregation separated from DOM-specific code, so that the logic can be tested without Discord's UI.
29. As a developer maintaining the extension, I want the Discord-side categorization UI isolated behind a small integration layer, so that Discord DOM changes affect a narrow surface area.
30. As a developer maintaining the extension, I want popup aggregation logic to produce a stable treemap input model, so that rendering can stay simple and testable.

## Implementation Decisions

- Introduce a server-scoped category catalog and a message-to-category assignment model as first-class extension state rather than deriving categories from popup UI.
- Keep `Uncategorized` as a computed bucket, not a persisted category record. Reverting a message to `Uncategorized` is implemented by clearing its category assignment.
- Store exactly zero or one category assignment per message. This preserves clean treemap partitioning and intuitive percentages.
- Enforce category-name uniqueness per server using case-insensitive normalization.
- Preserve the extension's current local-only capture constraint: only stored messages can be categorized or counted.
- Preserve the existing popup server selector, channel selector, and shared `24h` / `7d` / `30d` tabs. The new treemap uses the same selected scope and selected time window as the leaderboard.
- Add the treemap as a second popup module below the leaderboard rather than replacing the leaderboard.
- Aggregate category counts from filtered messages for the currently selected server, optional channel, and active time window.
- Treat messages with no assignment as `Uncategorized` during aggregation.
- Render only categories with at least one message in the current slice. If all messages in the slice are unassigned, render a single `Uncategorized` tile.
- Persist empty named categories for future reuse even when they do not appear in the current treemap slice.
- Add a Discord in-page hover control near the message timestamp area. The control should remain hidden until hover and should expose both assignment to an existing category and creation of a new category within the same interaction.
- Keep the current category indicator hover-only as well. The category state does not need a persistent always-visible badge in the message row for v1.
- Extend popup query logic with category aggregation output tailored for treemap rendering, including tile label data such as category name, message count, and percentage of the current slice.
- Add a popup rendering component that guarantees a 1:1 chart area and handles narrow tiles and empty-state messaging gracefully.
- Update stored-state validation and pruning so that category records and message assignments remain consistent with the existing 30-day message retention behavior.
- Prefer deep modules around category state management and popup aggregation so the Discord DOM integration and popup rendering layers stay thin.

## Testing Decisions

- Good tests should verify observable behavior and stable contracts, not internal implementation details or DOM selector trivia that can change without changing product behavior.
- Test the category state module, including category creation, case-insensitive uniqueness, assignment, reassignment, clearing to `Uncategorized`, retention behavior, and server scoping.
- Test the popup aggregation/query layer, including server filtering, channel filtering, shared time-range filtering, percentage calculation, omission of zero-count named categories, and `Uncategorized` fallback behavior.
- Test the Discord injected UI behavior at the integration level: hover reveals the control, existing categories can be chosen, new categories can be created in-flow, and assigning or clearing a category persists to storage.
- Test the popup rendering behavior at the integration level: the leaderboard remains present, the treemap renders below it, the same time-range selection drives both views, and treemap labels show category name, count, and percentage.
- Because the repo currently has no established test suite, this work should also define the first testing pattern for the project and choose a lightweight setup that can cover shared logic plus DOM-driven UI behavior.
- Prior art inside this repository is absent, so prior art should be taken from the current architecture boundaries rather than matching existing tests. Shared logic tests should follow the existing pure-query style already present in the codebase, and UI tests should focus on user-observable interactions over implementation structure.

## Out of Scope

- Renaming categories.
- Deleting categories.
- Assigning one message to multiple categories.
- Category hierarchies or nested categories.
- Cross-server shared category libraries.
- Syncing category data across machines or accounts.
- Backfilling categories for messages the browser never rendered.
- Reworking or replacing the existing leaderboard.
- Advanced treemap interactions such as drill-down, zoom, drag-and-drop, or custom color editing.

## Further Notes

- This feature is fundamentally a local annotation system layered on top of the extension's existing observed-message dataset, not a complete Discord history analysis tool.
- The server-scoped category model means the same category vocabulary can be reused across channels while still letting the popup analyze a single selected channel.
- The time-range views are expected to diverge naturally because the treemap is computed from messages in the active slice rather than from all stored assignments.
- The feature should be implemented so Discord DOM volatility is isolated to the injected UI layer and category logic remains reusable across future surfaces.
