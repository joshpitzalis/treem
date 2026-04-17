---
name: coding-best-practices
description: Coding best practices combining TDD, vertical-slice architecture, Domain-Driven Design, shallow control flow, and naming clarity. Use this skill whenever the user starts building features, writing tests, organizing code, creating new files or folders, fixing bugs, reviewing code, refactoring, or doing any implementation work. Triggers on "best practices", "coding standards", "how should I structure this", or any development task where test strategy, code organization, domain modeling, naming quality, and code readability matter.
---

# Coding Best Practices

This skill combines five foundational practices. **Always invoke all five** when doing implementation work.

## 1. Test-Driven Development

Invoke the `$tdd` skill for all guidance on testing strategy, red-green-refactor workflow, and what makes a good test.

## 2. Vertical-Slice Architecture

Invoke the `$vertical-slice` skill for all guidance on file organization, feature folders, and code structure.

## 3. Domain-Driven Design

Invoke the `$domain-driven-design` skill for all guidance on modeling the problem space — value objects vs entities, bounded contexts, shared language, semantic actions, aggregates, anti-corruption layers, and where domain logic should live.

## 4. Never Nest

Invoke the `$never-nest` skill for all guidance on keeping control flow shallow with guard clauses, early exits, extraction, and functions that stay within 3 levels of indentation.

## 5. Naming

Invoke the `$namer` skill whenever you need to choose or review names for domain concepts, functions, files, tests, APIs, modules, folders, or user-facing concepts. Use it to keep naming specific, searchable, and aligned with the domain model.

If `$namer` is unavailable in the current environment, apply the same baseline rules directly:

- prefer domain words over generic technical words
- prefer nouns for things and verb-plus-noun names for actions
- spell terms out unless the abbreviation is already standard
- keep names stable if the implementation changes
- optimize for searchability and consistency with nearby domain language

## When to apply

These aren't separate concerns — they reinforce each other. TDD's tracer-bullet approach naturally produces vertical slices (one behavior at a time, end-to-end), vertical-slice organization keeps test files colocated with the code they verify, DDD ensures the domain model driving both is well-structured and aligned with the problem space, never-nest keeps those slices readable as they evolve, and naming guidance from `$namer` helps the concepts, files, and behaviors stay legible and searchable.

When starting any implementation task:
1. Invoke `$tdd` to guide your test-first workflow
2. Invoke `$vertical-slice` to guide where new code and tests should live
3. Invoke `$domain-driven-design` to guide how you model the domain — entities, value objects, boundaries, and naming
4. Invoke `$never-nest` to keep new and edited code flat, readable, and easy to review
5. Invoke `$namer` whenever a new concept, module, API, test, or abstraction needs a strong name
6. Follow all five sets of instructions together
