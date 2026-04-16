---
name: domain-driven-design
description: Apply Domain-Driven Design principles when modeling a problem space in code. Use this skill whenever building new features, designing data models, creating APIs, structuring a codebase, naming domain concepts, or deciding how to organize modules and boundaries. Also trigger when the user says "model this domain", "how should I structure this", "what entities do I need", "bounded context", "aggregate", "value object", or is working through how business logic maps to code. Use this skill for any greenfield design work or when refactoring toward clearer domain alignment — do not skip it just because the user hasn't said "DDD" explicitly.
---

# Domain-Driven Design

Principles for modeling a problem space in code. Technology-agnostic — these apply regardless of language, framework, ORM, or validation library.

## Core Concepts

### 1. Value Objects vs Entities

**Value Objects** are defined entirely by their attributes. If two value objects have the same attribute values, they are equal. They have no unique identity. Examples: a color, a temperature range, a spacing measurement, an address, a date range.

**Entities** have unique identity and a lifecycle. Equality is based on identity (usually an ID), not attributes. They are persisted and mutable over time. Examples: a user, an order, a project, a garden bed.

**When modeling, ask:** Is this thing defined by *what it is* (value object) or *which one it is* (entity)?

Value objects can (and should) carry domain logic as pure functions. A `Distance` value object might come with `convertToFeet()` and `toHumanReadable()`. An `RGBColor` might come with `toCss()`. These functions belong with the value object because they encode domain knowledge about that concept — distance conversion rules, color formatting conventions. Keep them pure (input in, output out, no side effects) so they're easy to test and reuse.

Value objects also compose. A `Presentation` value object might contain an `RGBColor` and an `iconPath`. This nesting is natural — it groups attributes that travel together and have meaning as a unit. If you find yourself passing the same 2-3 values around together, that's usually a value object waiting to be named.

**Example — a Distance value object with domain logic:**

```typescript
// The type definition
interface IDistance {
  value: number
  unit: 'inches' | 'feet' | 'yards' | 'meters' | 'centimeters'
}

// Domain logic lives alongside the type as pure functions
function convertDistanceToFeet(distance: IDistance): IDistance {
  const conversionFactors = { inches: 1/12, feet: 1, yards: 3, meters: 3.281, centimeters: 0.0328 }
  return { value: distance.value * conversionFactors[distance.unit], unit: 'feet' }
}

function distanceToHumanReadable(distance: IDistance): string {
  return `${distance.value} ${distance.unit}`
}
```

**Example — composite value object:**

```typescript
// RGBColor is a value object
interface RGBColor { red: number; green: number; blue: number; alpha?: number }

// Presentation composes RGBColor with another attribute
interface Presentation {
  accentColor: RGBColor
  iconPath: string
}
```

### 2. Identity Design

How you handle entity identity matters more than it might seem. A good identity scheme prevents "wrong entity" bugs, makes debugging easier, and can encode useful information.

**Prefixed IDs** are a practical pattern: prefix each entity's ID with a short string indicating its type. `plant_550e8400...` is a Plant. `grdn_a3f1b2c0...` is a Garden. You can tell what kind of entity you're looking at from the ID alone, which helps in logs, database queries, and debugging. In typed languages, you can make this a branded type so the compiler catches it when you accidentally pass a Plant ID where a Garden ID is expected.

```typescript
// Branded type — the compiler will catch cross-entity ID mixups
type BaseEntityId<Prefix extends string> = `${Prefix}_${string}`

type PlantId = BaseEntityId<'plant'>   // "plant_..."
type GardenId = BaseEntityId<'grdn'>   // "grdn_..."

// Runtime guard for validation at boundaries
function isIdWithPrefix<P extends string>(prefix: P, id: string): id is `${P}_${string}` {
  return id.startsWith(`${prefix}_`)
}
```

**Base entity classes** can standardize identity generation and common fields like timestamps. Every entity in your system probably needs an ID, a creation date, and a last-modified date. Put that in one place.

```typescript
abstract class BaseEntity<Prefix extends string> {
  id: BaseEntityId<Prefix>
  createdAt: Date
  updatedAt: Date

  constructor(idPrefix: Prefix) {
    this.id = generatePrefixedUUID(idPrefix)
  }
}

// Then entities extend it
class Plant extends BaseEntity<'plant'> {
  constructor() { super('plant') }
  // ...plant-specific fields
}
```

### 3. Shared Language (Ubiquitous Language)

The terms in your code should match the terms used by domain experts. Class names, function names, variable names, API endpoints — all should be recognizable to a non-technical stakeholder who understands the domain.

Do not maintain separate vocabularies for "dev speak" and "business speak." The shared language is what keeps the model aligned with reality.

When the language does diverge between contexts, that's a signal you've found a bounded context boundary. A "Garden" in the server's persistence layer and a "Workspace" in the client's UI are both valid names for the same real-world concept in their respective contexts. The important thing is that each context is internally consistent about its terminology, and the translation between them is explicit rather than ad-hoc.

### 4. Bounded Contexts

A bounded context is a boundary within which a specific domain model and language apply. Different parts of a system can use different models for overlapping real-world concepts.

- Each context should be internally consistent
- Communication between contexts happens through well-defined interfaces
- The same real-world thing can have different representations in different contexts — that is expected and correct

In a monorepo, bounded contexts often map to packages. A shared package should hold the **domain model** — types, value objects, schemas, and the vocabulary of the domain. It answers "what are the things in this domain and what shape are they?" Each consuming package then holds its own logic for what it does with that model. The server has services that interact with databases, the client has controllers that handle UI interactions — that logic stays in their respective packages because it depends on infrastructure the shared package shouldn't know about.

This keeps the shared package lightweight (no ORM, no framework, no UI library — just plain types and maybe a schema validation library like Zod), and it means changes to the shared package are always meaningful: the domain model changed, so every consumer needs to adapt. You're not publishing a new version of the shared package just because a server-side business rule changed.

Schema factory functions are useful in the shared package — they let you define a base shape (like a generic "Item") and then parameterize it with context-specific details (like plant metadata vs seed packet metadata) so each context gets a correctly-typed version without duplicating the base definition.

```typescript
// A schema factory — base Item shape parameterized by metadata type
function createItemTypeWithMetadataSchema<M>(metadataSchema: M) {
  return ItemSchema.extend({ metadata: metadataSchema })
}

// Each context gets its own typed version
const PlantSchema = createItemTypeWithMetadataSchema(PlantMetadataSchema)
const PacketSchema = createItemTypeWithMetadataSchema(PacketMetadataSchema)
```

### 5. Anti-Corruption Layers

When your domain model interacts with external systems or other bounded contexts, write adapter code that translates between models. This keeps your core domain clean — it never bends its structure to accommodate another system's model. The translation happens at the boundary.

The **Repository pattern** is one of the most common anti-corruption layers. A repository exposes domain-friendly methods (`findPlantById`, `savePlant`) while internally translating between your domain entities and whatever storage/API format the outside world uses. The key methods are a `toDomainEntity` (external format → your model) and a `toResource` (your model → external format).

```typescript
abstract class Repository<T extends { id: string }> {
  // These two methods are the anti-corruption layer
  protected abstract toDomainEntity(resource: unknown): T
  protected abstract toResource(entity: T): unknown

  protected abstract getEndpoint(): string

  async findAll(): Promise<T[]> {
    const response = await fetch(this.getEndpoint())
    const resources = await response.json()
    return resources.map(r => this.toDomainEntity(r))
  }

  async save(entity: T): Promise<T> {
    const resource = this.toResource(entity)
    const response = await fetch(this.getEndpoint(), {
      method: 'POST',
      body: JSON.stringify(resource)
    })
    return this.toDomainEntity(await response.json())
  }
}
```

**Validate at boundaries.** Whenever data crosses a boundary — an API response, a database query result, user input, a message from another service — validate it before letting it into your domain. Runtime schema validation (Zod, Joi, io-ts, or equivalent in your language) catches the mismatches that type systems alone can't, especially when the data comes from an external source you don't control.

```typescript
class PlantRepository extends Repository<Plant> {
  protected toDomainEntity(resource: unknown): Plant {
    // Validates AND transforms in one step — if the API shape changes,
    // this is the only place that needs updating
    return PlantSchema.parse(resource)
  }
}
```

### 6. Semantic Actions over CRUD

Instead of generic create/read/update/delete operations, model mutations as specific domain operations — the verbs of your domain.

- "Place an item in a zone" not "update zone record"
- "Generate a plant from a seed packet" not "create plant with seed_packet_id"
- "Move item between zones" not "update item.zone_id"
- "Calculate planting date for location" not "GET /dates?location_id=..."

Semantic actions give you a natural place for business logic and validation, and they make the system's capabilities legible to both developers and domain experts.

This applies to API design too. `POST /locations/:id/calculate-date` is a semantic endpoint — it describes a domain operation. Compare that to a generic `POST /dates` that happens to take a location ID. The semantic version tells you what the system *does*; the CRUD version just tells you what table it writes to.

**Example — a domain factory as a semantic action:**

A service method that creates a Plant from a SeedPacket isn't just "create plant." It's a domain operation that encodes business rules: how to derive the variant name, which properties to copy, how to generate the icon path. Name it accordingly.

```typescript
function generatePlantFromSeedPacket(seedPacket: SeedPacket): Plant {
  const variant = toKebabCase(seedPacket.name)
  const iconPath = `icons/${seedPacket.category}/${variant}.svg`

  return new Plant({
    name: seedPacket.name,
    family: seedPacket.category,
    variant,
    iconPath,
    plantingDistance: seedPacket.plantingDistance,  // copied from seed packet
    presentation: seedPacket.presentation,          // copied from seed packet
    seedPacket: seedPacket,                         // maintains the relationship
  })
}
```

### 7. Aggregates and Transaction Boundaries

An aggregate is a cluster of entities and value objects treated as a single unit for data changes. Choose aggregate boundaries based on what needs to change together atomically.

- If an operation spans two aggregates, you risk partial failure
- Design question: what is the smallest boundary that guarantees consistency for the operations you need?
- Operations that only touch one aggregate are simpler and more reliable

A SeedPacket that owns a collection of Plants is an aggregate — the SeedPacket is the aggregate root, and you access Plants through it. This means creating a Plant always goes through the SeedPacket, which can enforce invariants (like maximum quantity).

### 8. Immutable State Transitions

When a domain operation changes state, consider returning a new object rather than mutating the existing one. This is especially valuable for complex operations that touch multiple parts of an aggregate.

```typescript
function moveItemBetweenZones(
  workspace: Workspace,
  sourceZoneId: string,
  targetZoneId: string,
  placement: ItemPlacement,
  newX: number,
  newY: number,
): Workspace {
  // Returns a NEW workspace with the item moved — the original is unchanged
  const sourceZone = findZone(workspace, sourceZoneId)
  const targetZone = findZone(workspace, targetZoneId)

  return {
    ...workspace,
    zones: workspace.zones.map(zone => {
      if (zone.id === sourceZoneId) return removeItemFromZone(zone, placement.id)
      if (zone.id === targetZoneId) return addItemToZone(zone, placement, newX, newY)
      return zone
    })
  }
}
```

This pattern makes operations reversible (you still have the old state), safe for concurrent use, and easy to test (pure function — same inputs always produce the same output). It also sets you up for undo/redo and event sourcing if you need them later.

### 9. Domain Validation as a First-Class Concept

Validation rules are domain knowledge. "An item can't be placed outside the zone boundaries" is a business rule, not a UI concern. Model validation explicitly rather than scattering `if` checks throughout the codebase.

The **Specification pattern** works well here: define validation rules as objects with a `validate` method, then compose them. A controller or service can hold a list of rules and run them in sequence.

```typescript
interface ValidationRule<T> {
  name: string
  validate(context: ValidationContext<T>): ValidationResult
}

interface ValidationResult {
  isValid: boolean
  reason?: string
}

// A concrete rule
const checkBoundaries: ValidationRule<Plant> = {
  name: 'check-boundaries',
  validate(context) {
    if (context.x + context.item.size > context.zone.width) {
      return { isValid: false, reason: 'Item exceeds zone boundary' }
    }
    return { isValid: true }
  }
}

// Controller runs rules in sequence — first failure wins
class WorkspaceController {
  private rules: ValidationRule[] = [checkBoundaries, checkOverlap, checkCompanionPlanting]

  async validatePlacement(context: ValidationContext): Promise<ValidationResult> {
    for (const rule of this.rules) {
      const result = await rule.validate(context)
      if (!result.isValid) return result
    }
    return { isValid: true }
  }
}
```

This is better than a monolithic `validate()` function because rules are named (good for debugging and logging), composable (add or remove rules without changing the controller), and testable individually. You can also toggle rules with feature flags — useful when rolling out new business rules gradually.

### 10. Metadata and Extensibility

When different subtypes of an entity need different data, use a metadata pattern rather than building deep inheritance hierarchies. Define a base entity shape with a generic `metadata` field, then narrow the metadata type for each subtype.

```typescript
// Base item — metadata is generic
interface Item {
  id: string
  category: string
  displayName: string
  size: Distance
  presentation: Presentation
  metadata: unknown
}

// Plant narrows metadata to plant-specific concerns
interface PlantMetadata { plantingDistance: Distance }
type Plant = Item & { metadata: PlantMetadata }

// Packet narrows it differently
interface PacketMetadata { quantity: number }
type Packet = Item & { metadata: PacketMetadata }
```

This is the open/closed principle applied to domain modeling — the base type is open for extension (add new metadata shapes) without modification (the base Item definition never changes).

## Applying These Principles

When starting new work:

1. **Identify the core domain** — what is the central problem this software solves?
2. **Establish the shared language** — what terms do domain experts use? Use those exact terms in code.
3. **Distinguish value objects from entities** — is this thing defined by what it is, or which one it is? Give value objects their own domain functions.
4. **Design your identity scheme** — prefixed IDs, branded types, base entity classes. Decide this once and apply it consistently.
5. **Define bounded contexts** if the system spans multiple sub-domains. In a monorepo, put the domain model in a shared package (types, value objects, schemas) and keep logic in each consuming package.
6. **Model mutations as semantic actions**, not CRUD. Name services and API endpoints after what the domain *does*.
7. **Choose aggregate boundaries** based on transactional consistency needs. What must change together atomically?
8. **Write anti-corruption layers** at boundaries with external systems or other contexts. Repositories with `toDomainEntity`/`toResource` mapping. Validate at every boundary.
9. **Model validation as domain rules** — specifications, not scattered `if` checks.
10. **Prefer immutable transitions** for complex state changes — return new objects rather than mutating in place.

### Where Does Logic Live?

In a monorepo, the first question is: does this belong in the shared package or in a consuming package?

**Shared package (the domain model):** Types, value objects, schemas, and pure functions that operate on domain types. The test: if it takes and returns only types from the shared package, with no side effects and no infrastructure imports, it belongs here. Value object utilities (distance conversion, color formatting), immutable state transition functions, schema factories, type guards — all shared.

**Consuming packages (domain logic + application logic):** Anything that depends on infrastructure specific to that package. The server's services that talk to a database, the client's controllers that handle drag-and-drop validation, API routers that map HTTP to domain operations — these stay in their respective packages.

Within each consuming package, the breakdown is:

- **Domain services**: Operations that involve multiple entities or encode business rules specific to this application. Stateless — they coordinate, they don't hold state. "Generate a Plant from a SeedPacket" is a service operation because it spans two entities and needs to know about file system paths.
- **Application services / routers**: Translation between the outside world (HTTP, CLI, events) and the domain. They call domain services, they don't contain domain logic. They handle mapping domain entities to API response shapes.
- **Repositories**: Data access abstraction. They translate between domain entities and storage formats. They don't contain business logic.

### Structuring a Monorepo

A typical DDD-influenced monorepo structure:

```
packages/
  shared/             — The domain model (no infrastructure dependencies)
    entities/         — Entity type definitions, base entity, identity scheme
    values/           — Value object types with pure domain functions
    schemas/          — Zod schemas, schema factories, type guards
    utils/            — Comparators, formatters, pure helpers

  server/             — Server-side bounded context
    services/         — Domain services (use shared types, talk to DB)
    application/      — Routers, middleware, error handling
    repositories/     — Data access with toDomainEntity/toResource mapping
    data/             — Raw data, seed scripts, migrations

  client/             — Client-side bounded context
    controllers/      — Orchestration, validation rules
    repositories/     — API client with domain mapping
    adapters/         — Anti-corruption layers for UI frameworks
    state/            — State management using shared types
```

The key principle: dependencies point inward. The shared package depends on nothing. Every other package depends on the shared package. No consuming package depends on another consuming package.
