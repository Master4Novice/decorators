# Changelog

All notable changes to `@master4n/decorators` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.6] — 2026-06-21

Dev-toolchain cleanup + security fix (no code/data changes; consumers
unaffected — the published tarball is byte-identical).

### Security

- Resolved the moderate `js-yaml` DoS advisory (GHSA-h67p-54hq-rp68) pulled
  transitively via `@istanbuljs/load-nyc-config` through jest's coverage chain,
  by forcing `js-yaml@^4.2.0` (load-nyc-config uses `.load`, compatible with
  js-yaml 4.x). `npm audit` now reports 0 vulnerabilities.

### Changed

- Replaced `rollup-plugin-copy` (unmaintained) with a small inline `node:fs`
  rollup plugin (identical dist asset copy + package.json transform) — drops the
  deprecated transitive `glob@7.2.3` and `inflight@1.0.6`.
- Upgraded the jest ecosystem to v30 (`jest`, `@types/jest`) and `ts-jest` to
  `^29.4.11`.
- `overrides`: `test-exclude@^8` (drops glob@7/inflight from the istanbul
  chain) and `glob@^13` (dedupes off the deprecated `glob@10.5.0` that jest 30
  would otherwise pull; glob@13 is current and supports Node 20+). The
  `overrides` field is stripped from the published package.json.

## [2.0.5] — 2026-06-06

Discoverability only (no code changes).

### Changed

- Broadened npm keywords with natural search terms (typescript-decorators,
  retry-decorator, circuit-breaker, validation-decorator, resilience,
  secret-redaction, idempotency, zero-dependency).
- Added a "Part of the @master4n toolkit" README section cross-linking the
  sibling packages.

## [2.0.4] — 2026-06-01

Hardening of the caching/idempotency decorators (`@Cache`, `@Memoize`, `@Dedupe`,
`@Idempotent`). Behaviour-compatible for existing valid usage.

### Fixed

- **Stable cache keys.** All four now key with a deterministic serializer instead
  of `JSON.stringify(args)`: argument-object key order no longer matters (no more
  silent cache misses for `{a,b}` vs `{b,a}`), and `BigInt`/circular args no
  longer throw.
- **`@Cache` no longer caches failures.** A rejected promise was kept for the
  whole TTL and replayed to every caller; it's now evicted on rejection.
- **`@Memoize` no longer memoizes a rejected promise** permanently — the slot is
  cleared on rejection so a transient async failure isn't cached forever.

### Added

- **`@Cache(ttlMs, { maxSize?, keyFn? })`** — optional LRU `maxSize` to bound
  memory, and a custom `keyFn`. Expired entries are also dropped on access.
- **`@Idempotent(keyFn?, { maxSize? })`** — optional LRU `maxSize`.
- Documented `@Meter`'s process-global, name-keyed registry (metrics aggregate
  across instances unless you pass distinct names).

## [2.0.3] — 2026-05-31

Dependency hygiene: the core is now **zero-dependency**. Previously, importing the
package pulled in `winston`, `config`, and `js-yaml` transitively (and node-config
ran an eager filesystem scan + warning on import).

> **Note:** the import-path moves below are technically breaking for anyone who
> relied on transitive installs of `winston`/`config` or imported `@Value` /
> `@Config` / `redactFormat` from the package root. Update imports per
> `MIGRATION.md`.

### Removed

- **`js-yaml`** — was declared as a runtime dependency but never imported. Dropped.

### Changed (breaking)

- **`winston` and `config` are now optional `peerDependencies`** instead of hard
  runtime dependencies. The main entry point imports neither, so a plain
  `import ... from '@master4n/decorators'` adds no third-party packages.
- **`@Value` and `@Config`** (the only node-config-backed decorators) moved to the
  subpath **`@master4n/decorators/config`**. Install `config` to use them.
  ```diff
  - import { Configured, Value, Config } from '@master4n/decorators';
  + import { Configured } from '@master4n/decorators';
  + import { Value, Config } from '@master4n/decorators/config';
  ```
- **`redactFormat`** (the winston `format`) moved to the subpath
  **`@master4n/decorators/winston`**. Install `winston` to use it. `redact()`
  itself stays on the main entry and remains dependency-free.
  ```diff
  - import { redact, redactFormat } from '@master4n/decorators';
  + import { redact } from '@master4n/decorators';
  + import { redactFormat } from '@master4n/decorators/winston';
  ```
- The internal logger used by `@Log`/`@Trace`/`@Audit`/`@Measure` no longer uses
  winston; it writes structured lines to the console (still redaction-aware).
  Default level is `info`; override with `DECORATORS_LOG_LEVEL`.

> All decorators still share one process-global injection registry: the subpaths
> are bundled with code-splitting into a shared chunk, so `@Secret` marked on a
> field is still seen by `redactFormat`, and `@Value` still composes with
> `@Configured`. See `MIGRATION.md`.

## [2.0.2] — 2026-05-31

Fixes from a third independent review.

### Fixed

- **`@Pattern` was stateful with a global/sticky (`/g`, `/y`) regex** —
  `regex.test()` advances `lastIndex`, so repeated assignments alternated
  pass/fail. `lastIndex` is now reset before each test.
- **Docs:** the second resilience example contradicted the `@Fallback`-ordering
  rule (it placed `@Fallback` innermost). Corrected to outermost.
- `@Debounce` no longer keeps the event loop alive — its pending timer is
  `unref`'d.
- Documented that `builder()` / `@Builder` skip the constructor (so `@Configured`
  injection doesn't populate; property validators still fire).

## [2.0.1] — 2026-05-31

Fixes from a second independent production audit.

### Security / Fixed

- **Redaction now catches compound secret names.** `redact()`/`@ToString`/`@Log`
  previously masked only exact keys (`password`, `token`, `apiKey`); names like
  `jwtSecret`, `apiToken`, `userPassword`, `refreshToken` leaked. They are now
  matched by secret "stem" substring and masked.
- **`@Pattern` ReDoS guard.** A catastrophic-backtracking regex on a long crafted
  input could block the event loop. Added a `maxLength` option (rejects over-long
  input before the regex runs) and a prominent ReDoS warning in the docs.
- **`NaN` no longer bypasses numeric guards.** `@Min`/`@Max`/`@Range`/`@Positive`
  silently accepted `NaN` (all comparisons are false); they now reject it.

## [2.0.0] — 2026-05-31

A complete rebuild and major expansion of the library, organized into ten
decorator **families**. First release of all of the following.

### Added

- **Inject** — config & value injection: `@Value`, `@Env` (type coercion),
  `@Secret`, `@Config`, `@Default`, and the `@Configured` class decorator, which
  materializes values as own instance properties (robust under both
  `useDefineForClassFields` settings). `MissingConfigError`, `getSecretKeys()`,
  and zero-dependency `.env` loading (`loadEnv` / `parseEnv`).
- **Guard** — validation that throws `ValidationError` on invalid input:
  `@NotNull`, `@ValidDate`, `@Pattern`, `@Min`, `@Max`, `@Range`, `@Email`,
  `@URL`, `@UUID`, `@Enum`, `@NonEmpty`, `@Integer`, `@Positive`, `@NotBlank`,
  `@Size`, `@Negative`, `@PositiveOrZero`, `@NegativeOrZero`, `@Past`, `@Future`,
  `@PastOrPresent`, `@FutureOrPresent`, `@AssertTrue`, `@AssertFalse`, `@Digits`.
  Property validators compose on one field and run as a chain.
- **Shape** — value transforms applied on assignment (before validators):
  `@Trim`, `@Lowercase`, `@Uppercase`, `@Coerce`, `@Clamp`.
- **Shield** — access control & secret redaction: `@Role`, `@Authorize`
  (throw `ForbiddenError`, `setRoleResolver`), and `redact()` / `redactFormat()`
  driven by `@Secret` + `DEFAULT_SENSITIVE_KEYS`.
- **Flow** — resilience & control flow: `@Timeout`, `@Retry`, `@Once`,
  `@Cache(ttl)`, `@Dedupe`, `@Fallback`, `@RateLimit`, `@Concurrency`,
  `@CircuitBreaker`, `@Debounce`, `@Throttle`. Errors `TimeoutError`,
  `RateLimitError`, `CircuitOpenError`.
- **Insight** — observability: `@Log` (optional redacted args/result), `@Trace`
  (correlation id threaded through nested calls), `@Audit` (`setAuditResolver`),
  `@LogErrors`, `@Measure`, `@Deprecated`.
- **Model** — data/domain classes: `@Data`, `@ToString` (redacts secrets),
  `@Equals`, `@With` (frozen-preserving copy), `@Immutable`, `@Readonly`,
  `@Builder` + fully-typed `builder(Class)`, `@GenerateID`, `@Counter`,
  `@Synchronized`.
- **Route** — decorator-based REST controllers for Express (no `express`
  runtime dependency): `@Controller`, `@Get`/`@Post`/`@Put`/`@Patch`/`@Delete`/
  `@Options`/`@Head`/`@All`, parameter decorators `@Param`/`@Query`/`@Body`/
  `@Header`/`@Cookie`/`@Req`/`@Res`/`@Next`, modifiers `@HttpCode`/`@ContentType`/
  `@Redirect`/`@Use`, familiar aliases, and `registerControllers(app, ...)`.
- **Agent** — LLM tools & safety: `@Tool` (explicit JSON-Schema), `getTools()`,
  `invokeTool()`, `clearTools()`, plus power-ups for the methods an agent calls:
  `@Validate` (input), `@Guardrail` (output, retrying; `GuardrailError`),
  `@Idempotent` (key-based result cache), and `@Meter` + `getMetrics()`.
- **Craft** — class & method ergonomics: `@Bind`, `@Lazy`, `@Sealed`, `@Mixin`,
  `@OnChange`.
- Standalone build & test setup, CI (Node 20/22/24 on Linux/macOS/Windows), an
  `llms.txt` API reference, and a pre-publish built-bundle smoke test.

### Changed

- **BREAKING (vs. the previously published 1.1.5):** `@NotNull` now throws
  `ValidationError` for `null`/`undefined` arguments instead of only logging.

### Fixed

- **Security:** `redact()` no longer leaks values nested beyond `maxDepth` — they
  are replaced with `'[Truncated]'` instead of returned raw (default depth raised
  to 12). It now also redacts inside `Map`/`Set`.
- `@ValidDate` was a no-op in 1.x (its wrapper was clobbered by `__decorate`); it
  is now a proper method decorator that throws on an invalid date.
- Removed an undeclared `winston` dependency issue and the `uuid` dependency
  (now uses Node's built-in `crypto.randomUUID()`).

## [1.1.5] and earlier

Initial published releases: `@Value`, `@GenerateID`, `@NotNull`, `@ValidDate`,
`@Counter`, `@Log`. See the git history for details.

[2.0.2]: https://github.com/Master4Novice/decorators/releases/tag/v2.0.2
[2.0.1]: https://github.com/Master4Novice/decorators/releases/tag/v2.0.1
[2.0.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.0.0
