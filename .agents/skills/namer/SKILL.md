---
name: namer
description: Provides naming guidance for code, APIs, tests, files, folders, products, and user-facing concepts. Use when someone asks what to call something, wants rename options, is reviewing naming quality, or is introducing a new domain concept, module, endpoint, test, or project asset.
---

# Namer

Use this skill to choose names that are specific, searchable, stable, and aligned with the domain.

## Quick Start

Gather the minimum context before naming:

- What is the thing?
- Who uses it?
- What makes it different from nearby concepts?
- Is the name for code, tests, files, APIs, or a user-facing concept?
- Are there existing terms in the codebase or product that must match?

Then:

1. Name the thing from the consumer's perspective.
2. Generate 3-7 options.
3. Reject names that are vague, abbreviated, overloaded, or implementation-bound.
4. Recommend one option and explain why it wins.
5. Rename adjacent artifacts if consistency is now broken.

## Default Output

When helping with naming, respond with:

- `Recommended:` best option
- `Alternatives:` 2-4 viable backups
- `Why:` short justification tied to domain meaning and searchability
- `Avoid:` names that look plausible but create ambiguity

## Naming Rules

- Prefer domain words over generic technical words.
- Prefer a noun for a thing and a verb-plus-noun for an action.
- Spell words out unless an abbreviation is already standard (`API`, `URL`, `HTML`, `ID`).
- Keep names stable if the implementation changes.
- Optimize for grep/findability, not cleverness.
- Match the surrounding naming system unless it is clearly broken.

## By Artifact Type

- Types, classes, entities, value objects, and folders: noun-based names.
- Functions, commands, jobs, and handlers: verb-plus-noun names.
- Tests: state the behavior or rule, not the implementation detail.
- API paths: resource-oriented names; reserve verbs for command-like operations.
- Files: use the same core term as the exported concept when possible.

## When Naming Gets Hard

If naming feels impossible, treat that as a design signal:

- The thing may do too much.
- The boundary may be wrong.
- Two concepts may be collapsed into one.
- The team may not share a stable term yet.

See [REFERENCE.md](REFERENCE.md) for anti-patterns, evaluation criteria, and examples.
