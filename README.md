# @master4n/decorators

![Owner Badge](https://img.shields.io/badge/Owner-Master4Novice-orange?style=flat)
![Package License](https://img.shields.io/npm/l/%40master4n%2Fdecorators)
![Package Downloads](https://img.shields.io/npm/dm/%40master4n%2Fdecorators)

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
| `@Secret(name, default?)`| `process.env`                   | like `@Env`; registers the field name via `getSecretKeys()` so you can wire it into your logger's redaction (the package does not redact for you yet). |
| `@Config(path)`          | config files                    | injects a whole config subtree/object (required).                |
| `@Default(value)`        | literal                         | injects a constant.                                              |
| `@Configured`            | _class decorator_               | materializes the above as own instance props (robust mode).      |

Missing required values throw `MissingConfigError`. With `@Configured`, that
happens at construction — so misconfiguration fails at startup, not deep in a
request. `getSecretKeys()` returns the names of `@Secret` fields for redaction.

## Validation & access (these throw)

Guards throw on invalid input — misuse fails fast instead of slipping through.

| Decorator                  | Target | Throws            | Description                                            |
| -------------------------- | ------ | ----------------- | ------------------------------------------------------ |
| `@NotNull`                 | method | `ValidationError` | rejects `null`/`undefined` arguments.                  |
| `@ValidDate`               | method | `ValidationError` | first arg must be a valid `{ DD, MM, YYYY }` date.     |
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

## Utility decorators

| Decorator          | Target          | Description                                            |
| ------------------ | --------------- | ------------------------------------------------------ |
| `@GenerateID`      | class property  | assigns a lazy UUIDv4 (via `crypto.randomUUID()`).     |
| `@Counter`         | static property | auto-incrementing counter on each read.                |
| `@Log()`           | method          | logs entry/exit around the method.                     |
| `@Retry(n, opts?)` | method          | retries on failure (sync/async); `opts.delayMs` for async. |
| `@Memoize`         | method          | caches results by argument JSON, per instance.         |
| `@Deprecated(msg)` | method          | logs a one-time deprecation warning.                   |
| `@Measure`         | method          | logs execution time (sync/async).                      |

```ts
import { GenerateID, Counter, Log, Retry, Memoize } from '@master4n/decorators';

class Job {
  @GenerateID id!: string;        // unique per instance
  @Counter static runs: number;   // increments on each read

  @Retry(3, { delayMs: 200 })
  @Log()
  async run() { /* ... */ }

  @Memoize
  score(input: string): number { /* expensive, pure */ return input.length; }
}
```

## Breaking change in 2.0.0

`@NotNull` now **throws** `ValidationError` for `null`/`undefined` arguments (it
only logged in 1.x). `@ValidDate` is fixed (it was a no-op) and now throws on an
invalid date. See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for the history.

## Credits

Written by [Master4Novice](https://github.com/Master4Novice).

[`node-config`]: https://github.com/node-config/node-config
