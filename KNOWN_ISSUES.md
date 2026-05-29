# Known Issues

These are documented, test-pinned behaviors in the currently published `@master4n/decorators`
(v1.x). Fixing any of them changes published runtime behavior, so each fix is gated on an
explicit decision rather than applied silently.

## 1. `@ValidDate` performs no validation (no-op)

**Severity:** medium · **Status:** pinned by tests, fix planned for Phase 3

`@ValidDate` assigns the wrapped function to `target[key]` directly:

```ts
export function ValidDate(target: any, key: string | symbol) {
  const originalMethod = target[key];
  target[key] = function (...args: any[]) { /* validate, then call original */ };
}
```

For a **method** decorator, TypeScript's `__decorate` helper calls the decorator and then
re-applies the property from the original `PropertyDescriptor`. That overwrites the direct
`target[key] = ...` assignment, so the validation wrapper never actually takes effect. The net
result: `@ValidDate` is a no-op in published v1.x — invalid dates are **not** flagged.

**Fix (Phase 3, needs sign-off):** rewrite as a standard method decorator that returns/mutates the
descriptor (like `@Log`/`@NotNull` do), and decide guard semantics (throw vs. log-and-continue).

## 2. `@NotNull` logs but does not guard

**Severity:** low (by design, but surprising) · **Status:** pinned by tests

`@NotNull` logs an error when an argument is `null`/`undefined` but still calls the original
method. It does not throw and does not stop execution. Callers who expect it to *reject* bad input
will be surprised.

**Decision needed (Phase 3):** keep log-and-continue, or switch to throw. Likely add a
`@Required`/strict variant that throws, leaving `@NotNull` as the lenient logger for
back-compat.

## 3. `winston` was an undeclared dependency (fixed in 1.2.0)

`rollup.config.js` marked `winston` as external, but it was missing from `dependencies`, so the
published tarball imported a package it never declared. Added to `dependencies` in 1.2.0.
