# Changelog

All notable changes to `@master4n/decorators` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-05-31

A complete rebuild and major expansion of the library, organized into nine
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
- **Agent** — LLM tool registration: `@Tool` (explicit JSON-Schema), `getTools()`,
  `invokeTool()`, `clearTools()`.
- Standalone build & test setup, CI (Node 20/22/24 on Linux/macOS/Windows), an
  `llms.txt` API reference, and a pre-publish built-bundle smoke test.

### Changed

- **BREAKING (vs. the previously published 1.1.5):** `@NotNull` now throws
  `ValidationError` for `null`/`undefined` arguments instead of only logging.

### Fixed

- `@ValidDate` was a no-op in 1.x (its wrapper was clobbered by `__decorate`); it
  is now a proper method decorator that throws on an invalid date.
- Removed an undeclared `winston` dependency issue and the `uuid` dependency
  (now uses Node's built-in `crypto.randomUUID()`).

## [1.1.5] and earlier

Initial published releases: `@Value`, `@GenerateID`, `@NotNull`, `@ValidDate`,
`@Counter`, `@Log`. See the git history for details.

[2.0.0]: https://github.com/Master4Novice/decorators/releases/tag/v2.0.0
