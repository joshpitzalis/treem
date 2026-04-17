# Namer Examples

## Example 1: Domain Concept

Prompt:

```text
What should I call the object that defines when a subscription can renew?
```

Response shape:

```md
Recommended: `RenewalWindow`

Alternatives:
- `SubscriptionRenewalWindow`
- `RenewalPeriod`
- `RenewalSchedule`

Why:
- Short, domain-first, and distinct from billing cycle.

Avoid:
- `RenewalManager`
- `RW`
```

## Example 2: Test Name

Prompt:

```text
Help me rename this test: should_call_api_when_data_is_ok
```

Response shape:

```md
Recommended: `submits_the_order_when_the_cart_is_valid`

Alternatives:
- `creates_an_order_for_a_valid_cart`
- `sends_the_checkout_request_for_a_valid_cart`

Why:
- Names the business behavior, not "API" or "data".
```

## Example 3: File or Module

Prompt:

```text
I have a file called user-service.ts. It mostly looks up users and syncs them from the provider.
```

Response shape:

```md
Recommended: split the responsibilities first

Alternatives:
- `user-directory.ts`
- `user-sync.ts`

Why:
- The current name hides two separate jobs behind a generic pattern word.
```
