# Namer Reference

## What Good Names Do

Good names let someone predict what a thing is without opening it. They reduce lookup cost, improve searchability, and keep the domain model legible.

Use these criteria when comparing options:

- Specific: names one thing, not a category of things
- Searchable: easy to grep, search, or find in a file tree
- Stable: survives implementation changes
- Aligned: matches product and domain language already in use
- Proportional: short enough to scan, long enough to be unambiguous

## Anti-Patterns

### 1. Terse or cryptic names

Avoid `x`, `tmp`, `mgr`, `cfg`, `misc`, `proc`.

These names force the reader to recover context from surrounding code or folder structure.

### 2. Ambiguous abbreviations

Avoid abbreviations unless the community already agrees on them.

- Good: `api`, `url`, `html`, `id`
- Risky: `auth`, `svc`, `ctx`, `cfg`, `proc`

If the abbreviation could mean more than one thing, spell it out.

### 3. Metadata in the name

Avoid names like:

- `proposal_final_v2`
- `stringUserName`
- `report_pdf`
- `newCheckoutFlow`

Version, type, status, and format belong in tooling, metadata, or structure around the name.

### 4. Catch-all containers

Avoid `utils`, `helpers`, `common`, `shared`, `misc` unless the codebase already has a precise, constrained meaning for them.

These names usually hide missing abstractions or poor placement.

### 5. Implementation leakage

Avoid names that expose how something works instead of what it means.

- Prefer `UserStore` over `PostgresUserStore` unless the storage technology matters to the consumer.
- Prefer `Cache` over `RedisCache` unless Redis-specific behavior is part of the contract.
- Prefer `Truck` over `BaseTruck` for the core abstraction.

### 6. Generic search-hostile names

Avoid names like `data`, `core`, `manager`, `service`, `process`, `handler` without a domain qualifier.

These are hard to find and easy to confuse.

## Positive Patterns

### Consumer-first naming

Name the thing the way a consumer thinks about it, not the way the implementer built it.

- Better: `InvoiceReminder`
- Worse: `CronEmailJob`

### Nouns for things

Use nouns for concepts, entities, value objects, files, and folders.

- `Subscription`
- `RenewalWindow`
- `DashboardSummary`

### Verb-plus-noun for actions

Use clear actions for functions, commands, and jobs.

- `CreateInvoice`
- `SendReminder`
- `FetchAccountBalance`

### Stable qualifiers

Qualify the name with the business distinction that will still matter later.

- Better: `TrialSubscription`
- Worse: `NewSubscription`

`new`, `old`, `temp`, and `legacy` are usually time-bound and decay quickly.

## By Artifact Type

### Domain concepts

Start from the business language. If two teams use different words, surface the ambiguity instead of papering over it.

### Functions

Use a concrete verb and a concrete object.

- Better: `CalculateRenewalDate`
- Worse: `HandleDate`

If the name becomes too long, the function may be doing too much.

### Tests

Name the rule or outcome:

- `creates_an_invoice_for_an_active_subscription`
- `rejects_a_renewal_when_the_payment_method_is_expired`

Avoid names that restate the method call without the behavior.

### Files and folders

Prefer the domain term over the pattern name.

- Better: `renewal-window.ts`
- Worse: `renewal-window-service.ts`

Add pattern words only when they disambiguate a real role already established in the codebase.

### APIs

Use resource names for ordinary CRUD paths.

- `/subscriptions`
- `/subscriptions/{id}/renewals`

Use action names only when the endpoint is truly command-shaped.

- `/subscriptions/{id}:pause`
- `/subscriptions/{id}:resume`

## Naming Workflow

1. Define the thing in one sentence.
2. Identify the primary consumer.
3. Identify the nearest competing concepts.
4. Generate several names using the domain vocabulary.
5. Remove options that are vague, overloaded, or implementation-bound.
6. Pick the name that is easiest to understand in isolation.
7. Check neighboring names for consistency.

## Output Template

Use this structure when proposing names:

```md
Recommended: `RenewalWindow`

Alternatives:
- `SubscriptionRenewalWindow`
- `RenewalPeriod`
- `RenewalSchedule`

Why:
- "Renewal" matches the domain term already in use.
- "Window" describes the bounded period without implying implementation.
- It is distinct from billing cycle and invoice schedule.

Avoid:
- `RenewalManager`: generic and implementation-shaped
- `RW`: not searchable
- `NewRenewalWindow`: time-bound
```

## Rename Checklist

Before finalizing a name, check:

- Does it collide with an existing concept?
- Would a new teammate understand it in a file list?
- Will it still make sense if the implementation changes?
- Is the same concept called something else nearby?
- Is the name searchable in logs, code search, and docs?

## Common Transformations

- `UserService` -> `UserDirectory` or `UserProvisioner`
- `DataProcessor` -> `InvoiceNormalizer` or `OrderImporter`
- `misc.ts` -> split by concept
- `auth` -> `authentication` or `authorization`
- `handle()` -> `CreateInvoice`, `PauseSubscription`, `ParseWebhook`
