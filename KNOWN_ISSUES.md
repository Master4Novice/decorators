# Known Issues

These are documented, test-pinned behaviors in the currently published `@master4n/decorators`
(v1.x). Fixing any of them changes published runtime behavior, so each fix is gated on an
explicit decision rather than applied silently.

## 1. `@ValidDate` performs no validation (no-op) — FIXED in 2.0.0

**Severity:** medium · **Status:** ✅ fixed in 2.0.0 (now a descriptor-based method
decorator that throws `ValidationError` on an invalid date). History retained below.

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

## 2. `@NotNull` logs but does not guard — CHANGED in 2.0.0 (BREAKING)

**Severity:** low · **Status:** ✅ resolved in 2.0.0

Through 1.x, `@NotNull` logged an error for `null`/`undefined` arguments but still ran the
method. As of **2.0.0 it throws `ValidationError`** instead (the breaking change behind the major
version bump). `@ValidDate` and the new `@Role`/`@Authorize` follow the same throw-on-invalid
contract.

## 3. `winston` was an undeclared dependency (fixed in 1.2.0)

`rollup.config.js` marked `winston` as external, but it was missing from `dependencies`, so the
published tarball imported a package it never declared. Added to `dependencies` in 1.2.0.
