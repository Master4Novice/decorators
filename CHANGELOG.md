# Changelog

All notable changes to `@master4n/decorators` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.11.0] — 2026-05-30

### Added

- **Jakarta Bean-Validation-style constraints** (the ones not already covered):
  `@NotBlank`, `@Size(min, max)`, `@Negative`, `@PositiveOrZero`,
  `@NegativeOrZero`, `@Past`, `@Future`, `@PastOrPresent`, `@FutureOrPresent`,
  `@AssertTrue`, `@AssertFalse`, `@Digits(integer, fraction)`. Property
  decorators that throw `ValidationError` on assignment; they compose with the
  existing validators/transforms and skip null/undefined (except `@NotBlank`).

## [2.10.0] — 2026-05-30

### Added

- **Lombok-style data-class decorators** (more capable than Lombok): `@ToString`
  (redacts secrets), `@Equals`, `@With` (frozen-preserving copy), `@Data`
  (toString+equals+with), `@Immutable` (freeze), `@Readonly` (final field),
  `@Synchronized` (async mutex), and `@Builder` + a fully-typed `builder(Class)`
  fluent builder (no codegen). Types `ToStringOptions`, `BuilderOf<T>`.

## [2.9.0] — 2026-05-30

### Added

- **Express REST controllers — Spring-MVC-style** (a routing layer on top of
  Express, with no `express` runtime dependency):
  - Class: `@Controller(basePath?)` / `@RestController`.
  - Methods: `@Get` `@Post` `@Put` `@Patch` `@Delete` `@Options` `@Head` `@All`
    (+ `@GetMapping`…`@DeleteMapping`, `@RequestMapping(path, method?)`).
  - Parameter decorators (only possible because we use legacy decorators):
    `@Param`/`@PathVariable`, `@Query`/`@RequestParam`, `@Body`/`@RequestBody`,
    `@Header`/`@RequestHeader`, `@Cookie`, `@Req`, `@Res`, `@Next`.
  - Modifiers: `@HttpCode`/`@ResponseStatus`, `@ContentType`/`@Produces`,
    `@Redirect`, `@Use(...middleware)` (class- or method-level).
  - `registerControllers(app, controllers)` wires it into any Express-compatible
    app/router. Returned values are sent as JSON with the status; thrown errors
    go to `next(err)`; `@Res()` hands the response to your method. Types:
    `HttpRequest`, `HttpResponse`, `HttpApp`, `RequestHandler`.

## [2.8.0] — 2026-05-30

### Added

- **AI tools** — `@Tool({ description, name?, parameters? })` registers a method
  as an LLM-callable tool (with an explicit JSON-Schema `parameters`, since
  runtime types are erased and cannot be honestly inferred). `getTools()` returns
  the `{ name, description, parameters }` manifest for an LLM's tool list;
  `invokeTool(instance, name, args)` dispatches a model tool call back to the
  method; `clearTools()` resets the registry. Types `ToolOptions`,
  `ToolManifest`, `ToolParameters`.

## [2.7.0] — 2026-05-30

### Added

- **Observability method decorators**: `@Trace` (structured entry/exit/error
  logging with a correlation id threaded through nested calls via
  AsyncLocalStorage; `getTraceId()` helper), `@Audit(action?)` (actor + action,
  with `setAuditResolver` for the "who"), and `@LogErrors` (log + rethrow). All
  redact logged args/results via `redact()`.

## [2.6.0] — 2026-05-30

### Added

- **Transform decorators** (normalize on assign): `@Trim`, `@Lowercase`,
  `@Uppercase`, `@Coerce('number'|'boolean'|'string')`, `@Clamp(min, max)`.
- **Format/value validators**: `@Email`, `@URL`, `@UUID`, `@Enum(values)`,
  `@NonEmpty`, `@Integer`, `@Positive`.

### Changed

- The property interceptor chain now distinguishes **transform** and **validate**
  phases: all transforms run before all validators regardless of decorator
  stacking order (so `@Trim @Min(3)` checks the trimmed length either way). No
  behavior change for existing validators.

## [2.5.0] — 2026-05-30

### Added

- **Resilience & control-flow method decorators** (first of the "AI-friendly"
  expansion): `@Timeout` (async-only), `@Once`, `@Cache(ttl)`, `@Dedupe`
  (single-flight), `@Fallback`, `@RateLimit`, `@Concurrency`, `@CircuitBreaker`,
  `@Debounce` (void), `@Throttle` (void). New error types `TimeoutError`,
  `RateLimitError`, `CircuitOpenError`.
- Guard decorators (`@RateLimit`, `@CircuitBreaker`) reject instead of
  synchronously throwing once they've observed the method is async, so callers
  can `.catch()` consistently.

## [2.4.0] — 2026-05-30

### Added

- `@Min(n)`, `@Max(n)`, `@Range(min, max)` property decorators. Polymorphic:
  they compare a number's value, or a string/array's length. A violating
  assignment throws `ValidationError` and the property keeps its previous value;
  `null`/`undefined` are allowed. `ConstraintOptions` (`{ message }`) exported.
- Property validators now **compose**: `@Pattern`, `@Min`, `@Max`, `@Range` can
  be stacked on the same property and all run (previously a second property
  decorator would overwrite the first's accessor).

### Changed

- Internal: extracted a shared `addPropertyValidator` helper (chained validators
  per property) that `@Pattern` and the new constraints share. No public behavior
  change for existing decorators.

## [2.3.0] — 2026-05-30

### Added

- `@Pattern(regex, options?)` property decorator — only allows assigning values
  that match the regex; a non-matching assignment throws `ValidationError` and
  the property keeps its previous value. `null`/`undefined` are allowed;
  `{ coerce: true }` tests `String(value)`; `{ message }` customizes the error.
  Works standalone (`useDefineForClassFields: false`) and, with `@Configured`,
  under both settings — including re-validating values set in the constructor.
  `PatternOptions` type exported.

### Changed

- Internal: `@Configured`'s registry now materializes generic per-instance specs
  (`registerInstanceSpec`), so property decorators beyond value injection can be
  robust under modern class-field semantics. No public behavior change for
  existing decorators.

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

[2.11.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.11.0
[2.10.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.10.0
[2.9.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.9.0
[2.8.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.8.0
[2.7.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.7.0
[2.6.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.6.0
[2.5.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.5.0
[2.4.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.4.0
[2.3.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.3.0
[2.2.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.2.0
[2.1.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.1.0
[2.0.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.0.0
[1.2.0]: https://github.com/Master4Novice/decorators/releases/tag/v1.2.0
