# Changelog

All notable changes to `@master4n/decorators` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] — 2026-05-30

### Added

- `@Log(options?)` can now optionally log **redacted** arguments (`{ args: true }`)
  and/or the return value (`{ result: true }`), choose a `{ level }`, and pass
  `{ redact }` options. Args/result are masked via `redact()` so secrets never
  reach the logs. Async methods are logged on settlement. `@Log()` with no
  options is unchanged. `LogOptions` type exported.

## [2.1.0] — 2026-05-30

### Added

- **Secret redaction.** `redact(value, options?)` returns a deep copy with
  sensitive values masked (`[REDACTED]`). Sensitive keys = `@Secret`-marked
  property names ∪ `DEFAULT_SENSITIVE_KEYS` (password, token, apiKey,
  authorization, jwt, ssn, aadhaar, …) ∪ `options.keys`. Case- and
  `_`/`-`-insensitive; handles nested objects, arrays, and circular references.
- `redactFormat(options?)` winston format, exported and now applied by the
  package's own logger by default.
- `DEFAULT_SENSITIVE_KEYS` and the `RedactOptions` type are exported.

### Changed

- `@Secret` now drives real redaction (previously it only recorded names via
  `getSecretKeys()`).

## [2.0.0] — 2026-05-30

### Added

- **Access control:** `@Role(...roles)` and `@Authorize(predicate)` (throw
  `ForbiddenError`), with `setRoleResolver()` and the `AccessContext` type.
  Auth-agnostic; sync and async resolvers/predicates supported.
- **Utility decorators:** `@Retry(n, { delayMs })`, `@Memoize`, `@Deprecated(msg)`,
  `@Measure` — all sync/async-aware.
- `ValidationError` and `ForbiddenError` error types.

### Changed

- **BREAKING:** `@NotNull` now **throws** `ValidationError` for `null`/`undefined`
  arguments. In 1.x it only logged and continued.

### Fixed

- **`@ValidDate` was a no-op in 1.x** (it reassigned `target[key]`, which
  TypeScript's `__decorate` then overwrote with the original descriptor). It is
  now a proper descriptor-based method decorator that throws `ValidationError`
  on an invalid `{ DD, MM, YYYY }` date.

## [1.2.0] — 2026-05-29

### Added

- **Config & value injection (flagship):** `@Value`, `@Env` (with type coercion),
  `@Secret`, `@Config`, `@Default`, and the `@Configured` class decorator, which
  materializes injected values as own instance properties — robust under both
  `useDefineForClassFields` settings. `MissingConfigError` for missing required
  values; `getSecretKeys()` helper.
- **`.env` support:** zero-dependency `loadEnv()` / `parseEnv()`; `@Configured`
  auto-loads `.env` once.
- Test suites covering both legacy and modern (`useDefineForClassFields: true`)
  decorator compilation, plus a pre-publish built-bundle smoke test (`npm run
  test:dist`).
- CI workflow (Node 20/22/24 on Linux/macOS/Windows) and `llms.txt`.

### Changed

- Repackaged to build and test standalone (outside the original monorepo).

### Fixed

- Declared the previously-missing `winston` runtime dependency.
- Dropped the `uuid` dependency in favour of Node's built-in
  `crypto.randomUUID()` (avoids the ESM-only `uuid` v14 breaking the CommonJS
  build) — `@GenerateID` is unchanged for consumers.

## [1.1.5] and earlier

Initial published releases: `@Value`, `@GenerateID`, `@NotNull`, `@ValidDate`,
`@Counter`, `@Log`. See the git history for details.

[2.2.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.2.0
[2.1.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.1.0
[2.0.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.0.0
[1.2.0]: https://github.com/Master4Novice/decorators/releases/tag/v1.2.0
