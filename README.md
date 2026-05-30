# @master4n/decorators

[![CI](https://github.com/Master4Novice/decorators/actions/workflows/ci.yml/badge.svg)](https://github.com/Master4Novice/decorators/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40master4n%2Fdecorators)](https://www.npmjs.com/package/@master4n/decorators)
![npm downloads](https://img.shields.io/npm/dm/%40master4n%2Fdecorators)
![License](https://img.shields.io/npm/l/%40master4n%2Fdecorators)
![Types](https://img.shields.io/npm/types/%40master4n%2Fdecorators)
![Owner](https://img.shields.io/badge/Owner-Master4Novice-orange?style=flat)

**AI-friendly TypeScript decorators for Node/backend apps.** One self-documenting
decorator replaces a block of boilerplate — Spring-style config & value injection,
plus a handful of method/property utilities. Designed so coding agents emit one
correct line instead of ten repetitive ones.

## Installation

```sh
npm install @master4n/decorators
```

## TypeScript setup

Enable legacy (experimental) decorators in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

> **No `useDefineForClassFields` requirement.** Put **`@Configured`** on classes
> that use the injection decorators and they work regardless of your `target` /
> `useDefineForClassFields` setting. (Without `@Configured`, injection relies on
> prototype accessors, which only work when `useDefineForClassFields` is `false`.)

## The flagship: config & value injection

Stop hand-writing `process.env.X ?? config.get(...) ?? default` plus type
coercion, for every field.

```ts
// BEFORE — written by hand (or by an agent) for every single field:
class DbConfig {
  url: string;
  port: number;
  ssl: boolean;
  constructor() {
    this.url = process.env.DB_URL ?? config.get('db.url') ?? 'sqlite://memory';
    const p = process.env.DB_PORT;
    this.port = p ? parseInt(p, 10) : 5432;            // string -> number
    this.ssl = (process.env.DB_SSL ?? 'false') === 'true'; // string -> boolean
  }
}
```

```ts
// AFTER — declarative, coerced, and fails loud on missing required keys:
import { Configured, Value, Env, Secret } from '@master4n/decorators';

@Configured
class DbConfig {
  @Value('db.url', 'sqlite://memory') url!: string;
  @Env('DB_PORT', 5432)               port!: number;   // "5432" -> 5432
  @Env('DB_SSL', false)               ssl!: boolean;    // "true" -> true
  @Secret('DB_PASSWORD')              password!: string; // required; tracked for redaction
}
```

> **Sources:** `@Value`/`@Config` read YAML/JSON via [`node-config`]; `@Env`/`@Secret`
> read `process.env`. Node does **not** load `.env` files automatically — if you keep
> config in a `.env` file, load it first (`node --env-file=.env ...` or the `dotenv`
> package) so the variables are present in `process.env`.

### Injection decorators

| Decorator                | Source                          | Notes                                                            |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------- |
| `@Value(key, default?)`  | config files (YAML/JSON)        | via [`node-config`]. Required (throws) when no default is given. |
| `@Env(name, default?)`   | `process.env`                   | coerces to the default's type (number/boolean/array).            |
| `@Secret(name, default?)`| `process.env`                   | like `@Env`; marks the field as secret so `redact()` / `redactFormat()` mask it (see [Secret redaction](#secret-redaction)). |
| `@Config(path)`          | config files                    | injects a whole config subtree/object (required).                |
| `@Default(value)`        | literal                         | injects a constant.                                              |
| `@Configured`            | _class decorator_               | materializes the above as own instance props (robust mode).      |

Missing required values throw `MissingConfigError`. With `@Configured`, that
happens at construction — so misconfiguration fails at startup, not deep in a
request.

### Secret redaction

`@Secret` doesn't just track names — it makes those values disappear from logs.

- `redact(value, options?)` returns a deep copy with sensitive values masked
  (`'[REDACTED]'`). Sensitive = `@Secret`-marked property names ∪ a built-in list
  (`DEFAULT_SENSITIVE_KEYS`: `password`, `token`, `apiKey`, `authorization`, …) ∪
  `options.keys`. Matching is case- and `_`/`-`-insensitive; nested objects,
  arrays, and circular references are handled.
- `redactFormat(options?)` is a winston format. This package's own logger already
  uses it; add it to your logger's `format.combine(...)` to protect your logs too.

```ts
import { redact, redactFormat } from '@master4n/decorators';
import winston from 'winston';

logger.info('Loaded config', redact(appConfig)); // jwtSecret -> [REDACTED]

const logger = winston.createLogger({
  format: winston.format.combine(redactFormat(), winston.format.json()),
});
```

## Validation & access (these throw)

Guards throw on invalid input — misuse fails fast instead of slipping through.

| Decorator                  | Target | Throws            | Description                                            |
| -------------------------- | ------ | ----------------- | ------------------------------------------------------ |
| `@NotNull`                 | method   | `ValidationError` | rejects `null`/`undefined` arguments.                |
| `@ValidDate`               | method   | `ValidationError` | first arg must be a valid `{ DD, MM, YYYY }` date.   |
| `@Pattern(regex, opts?)`   | property | `ValidationError` | only allows assigning values that match the regex.   |
| `@Min(n)` / `@Max(n)`      | property | `ValidationError` | string/array **length** ≥ n / ≤ n, or **number** value. |
| `@Range(min, max)`         | property | `ValidationError` | inclusive bounds on string/array length or number value. |
| `@Role(...roles)`          | method | `ForbiddenError`  | allows only if the principal has one of the roles.     |
| `@Authorize(predicate)`    | method | `ForbiddenError`  | allows only if `predicate(ctx)` is truthy.             |

`@Role`/`@Authorize` are auth-agnostic. Register how to find the principal once:

```ts
import { Role, Authorize, setRoleResolver } from '@master4n/decorators';

setRoleResolver((ctx) => (ctx.instance as any).user?.roles ?? []);

class AdminApi {
  @Role('admin', 'owner')
  deleteUser(id: string) { /* ... */ }

  @Authorize((ctx) => (ctx.instance as any).user?.can('billing'))
  refund(orderId: string) { /* ... */ }
}
```

Resolvers/predicates may be async (the guarded call then returns a promise).

`@Pattern` guards a **property**: assignments that don't match the regex throw and
the previous value is kept. Add `@Configured` so it works under any
`useDefineForClassFields` setting (like the injection decorators).

```ts
import { Configured, Pattern } from '@master4n/decorators';

@Configured
class User {
  @Pattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { message: 'invalid email' })
  email!: string;

  @Pattern(/^\d{6}$/, { coerce: true }) // accepts 560001 or "560001"
  pincode!: string;
}

new User().email = 'not-an-email'; // throws ValidationError
```

`@Min`/`@Max`/`@Range` are polymorphic — they check **string/array length** or a
**number's value** — and compose with each other and `@Pattern`:

```ts
@Configured
class Account {
  @Pattern(/^[a-z0-9_]+$/) @Min(3) @Max(20)
  username!: string;            // lowercase, 3–20 chars

  @Range(0, 100) score!: number; // 0..100
}
```

## Utility decorators

| Decorator          | Target          | Description                                            |
| ------------------ | --------------- | ------------------------------------------------------ |
| `@GenerateID`      | class property  | assigns a lazy UUIDv4 (via `crypto.randomUUID()`).     |
| `@Counter`         | static property | auto-incrementing counter on each read.                |
| `@Log(opts?)`      | method          | logs entry/exit; `{ args, result }` also log **redacted** args/return; `{ level }` sets the level. |
| `@Retry(n, opts?)` | method          | retries on failure (sync/async); `opts.delayMs` for async. |
| `@Memoize`         | method          | caches results by argument JSON, per instance.         |
| `@Deprecated(msg)` | method          | logs a one-time deprecation warning.                   |
| `@Measure`         | method          | logs execution time (sync/async).                      |

## Resilience & control flow (method decorators)

| Decorator                  | Description                                                        |
| -------------------------- | ----------------------------------------------------------------- |
| `@Timeout(ms)`             | reject an **async** method with `TimeoutError` if it exceeds `ms`. |
| `@Once`                    | run once per instance; cache that result forever.                 |
| `@Cache(ttlMs)`            | memoize with a TTL (vs `@Memoize`, which never expires).          |
| `@Dedupe`                  | coalesce concurrent identical **async** calls (single-flight).    |
| `@Fallback(value\|fn)`     | on error, return a fallback instead of throwing (sync/async).     |
| `@RateLimit(limit, ms)`    | throw `RateLimitError` past `limit` calls per rolling `ms`.        |
| `@Concurrency(max)`        | cap concurrent **async** executions; queue the rest.              |
| `@CircuitBreaker(opts)`    | open after N failures, fast-fail with `CircuitOpenError`, auto-reset. |
| `@Debounce(ms)`            | **void** methods: collapse rapid calls, run on the trailing edge. |
| `@Throttle(ms)`            | **void** methods: run on the leading edge, ignore for `ms`.       |

```ts
import { Timeout, Retry, CircuitBreaker, Fallback } from '@master4n/decorators';

class Upstream {
  @CircuitBreaker({ failureThreshold: 5, resetMs: 30_000 })
  @Retry(3, { delayMs: 200 })
  @Timeout(5_000)
  @Fallback(null)               // last resort: return null instead of throwing
  async fetchUser(id: string) { /* ... */ }
}
```

```ts
import { GenerateID, Counter, Log, Retry, Memoize } from '@master4n/decorators';

class Job {
  @GenerateID id!: string;        // unique per instance
  @Counter static runs: number;   // increments on each read

  @Retry(3, { delayMs: 200 })
  @Log({ args: true, result: true }) // logged args/result are redacted
  async run() { /* ... */ }

  @Memoize
  score(input: string): number { /* expensive, pure */ return input.length; }
}
```

## Breaking change in 2.0.0

`@NotNull` now **throws** `ValidationError` for `null`/`undefined` arguments (it
only logged in 1.x). `@ValidDate` is fixed (it was a no-op) and now throws on an
invalid date. See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for the history.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## Credits

Written by [Master4Novice](https://github.com/Master4Novice).

[`node-config`]: https://github.com/node-config/node-config
