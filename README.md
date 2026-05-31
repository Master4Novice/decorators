# @master4n/decorators

[![CI](https://github.com/Master4Novice/decorators/actions/workflows/ci.yml/badge.svg)](https://github.com/Master4Novice/decorators/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40master4n%2Fdecorators)](https://www.npmjs.com/package/@master4n/decorators)
![npm downloads](https://img.shields.io/npm/dm/%40master4n%2Fdecorators)
![License](https://img.shields.io/npm/l/%40master4n%2Fdecorators)
![Types](https://img.shields.io/npm/types/%40master4n%2Fdecorators)
![Owner](https://img.shields.io/badge/Owner-Master4Novice-orange?style=flat)

**AI-friendly TypeScript decorators for Node/backend apps.** One self-documenting
decorator replaces a block of boilerplate. Designed so coding agents emit one
correct line instead of ten repetitive ones.

## Decorator families

Every decorator belongs to one of ten families — a quick mental map for picking
the right one:

| Family | Purpose | Examples |
| ------ | ------- | -------- |
| **Inject** | pull values into fields | `@Value` `@Env` `@Secret` `@Config` `@Default` `@Configured` |
| **Guard** | reject invalid input (throws) | `@NotNull` `@Pattern` `@Min` `@Max` `@Range` `@Email` `@URL` `@UUID` `@Enum` `@Size` `@NotBlank` `@Past` `@Future` `@AssertTrue` `@Digits` … |
| **Shape** | normalize values on assign | `@Trim` `@Lowercase` `@Uppercase` `@Coerce` `@Clamp` |
| **Shield** | access control & secret redaction | `@Role` `@Authorize` `@Secret` + `redact()` |
| **Flow** | resilience & control flow | `@Timeout` `@Retry` `@Cache` `@Dedupe` `@Fallback` `@RateLimit` `@Concurrency` `@CircuitBreaker` `@Debounce` `@Throttle` `@Once` |
| **Insight** | observability | `@Log` `@Trace` `@Audit` `@LogErrors` `@Measure` `@Deprecated` |
| **Model** | data/domain classes | `@Data` `@ToString` `@Equals` `@With` `@Immutable` `@Readonly` `@Builder` `@GenerateID` `@Counter` `@Synchronized` |
| **Route** | HTTP REST controllers | `@Controller` `@Get` `@Post` `@Param` `@Query` `@Body` `@HttpCode` `@Use` … |
| **Agent** | LLM tools & safety | `@Tool` `@Validate` `@Guardrail` `@Idempotent` `@Meter` + `getTools()` / `invokeTool()` / `getMetrics()` |
| **Craft** | class & method ergonomics | `@Bind` `@Lazy` `@Sealed` `@Mixin` `@OnChange` |

## Recipes for AI agents

Real, copy-paste compositions. Each replaces a page of hand-written plumbing with
a stack of declarations.

### A bullet-proof DTO (Shape + Guard)

```ts
import { Configured, Trim, Lowercase, Email, NotBlank, Size, Coerce, Range } from '@master4n/decorators';

@Configured
class SignupDto {
  @Trim @Lowercase @Email()         email!: string;   // normalized, then validated
  @Trim @NotBlank() @Size(3, 20)    username!: string;
  @Coerce('number') @Range(18, 120) age!: number;     // "21" -> 21, bounded
}
// Assigning a bad value throws ValidationError at the source — no manual checks.
```

### A resilient upstream client (Flow)

```ts
import { Fallback, CircuitBreaker, Retry, Timeout, Cache } from '@master4n/decorators';

class UserApi {
  @Fallback(null)                // OUTERMOST = last resort: catch after everything else
  @CircuitBreaker({ failureThreshold: 5, resetMs: 30_000 })
  @Retry(3, { delayMs: 200 })    // retry the timed call
  @Timeout(5_000)
  @Cache(60_000)                 // INNERMOST: memoize the actual fetch
  async getUser(id: string) {
    return (await fetch(`/users/${id}`)).json();
  }
}
```

> **Decorator order matters.** Stacks apply **bottom-up**: the decorator nearest
> the method wraps the original first, and the **top** decorator runs first / sees
> the final outcome. So put recovery (`@Fallback`) **outermost (top)** — otherwise
> it swallows the error before `@Retry`/`@CircuitBreaker` ever see a failure, and
> retries silently never happen.

### A safe, observable AI tool (Agent + Insight)

```ts
import { Tool, Validate, Idempotent, Guardrail, Meter, Trace, getTools, invokeTool, getMetrics } from '@master4n/decorators';

class BookingTools {
  @Tool({
    description: 'Book a room for a guest',
    parameters: {
      type: 'object',
      properties: { guest: { type: 'string' }, nights: { type: 'number' } },
      required: ['guest', 'nights'],
    },
  })
  @Trace()                                            // correlation-id traced
  @Meter('book_room')                                 // counts + timing -> getMetrics()
  @Idempotent((args) => `${args.guest}:${args.nights}`) // safe to retry
  @Validate((args) => (args[0] as any)?.nights > 0)   // reject bad tool input
  @Guardrail((res: { confirmed: boolean }) => res.confirmed, { retries: 1 }) // verify output
  async bookRoom(args: { guest: string; nights: number }) {
    return { confirmed: true, ref: 'BK-123' };
  }
}

const svc = new BookingTools();
const tools = getTools();                       // -> hand to the LLM
// model picks a tool ...
await invokeTool(svc, 'bookRoom', { guest: 'Asha', nights: 2 });
getMetrics().book_room;                          // { calls, errors, avgMs, ... }
```

### An immutable domain model (Model)

```ts
import { Data, Immutable, builder } from '@master4n/decorators';

@Immutable
@Data                                            // toString + equals + with
class Money { constructor(public amount = 0, public currency = 'INR') {} }

const a = new Money(100, 'INR');
const b = (a as any).with({ amount: 250 });      // frozen copy, original untouched
const c = builder(Money).amount(50).currency('USD').build();  // typed builder
```

### Less boilerplate (Craft)

```ts
import { Configured, Bind, Lazy, OnChange } from '@master4n/decorators';

@Configured                                 // required for property decorators under modern TS
class Editor {
  @Lazy((self) => buildHeavyIndex(self))  index!: Index;   // computed once, on first read
  @OnChange((v) => autosave(v))            content = '';     // reacts to real changes
  @Bind                                    onClick() { return this.content; } // safe to detach
}
```

> `@Lazy` and `@OnChange` are **property** decorators — like all of them, add
> `@Configured` to the class when you compile with `useDefineForClassFields: true`
> (the modern default), or they silently no-op (see [TypeScript setup](#typescript-setup)).
> `@Bind` is a method decorator and needs no `@Configured`.

## Installation

```sh
npm install @master4n/decorators
```

## TypeScript setup

This is a legacy-decorator library. A complete, known-good `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

> **The one rule that matters: put `@Configured` on any class that uses a
> _property_ decorator** (`@Value`/`@Env`/`@Secret`/`@Config`/`@Default`, every
> Guard like `@Email`/`@Min`/`@Pattern`, every Shape like `@Trim`, and Craft's
> `@Lazy`/`@OnChange`/`@Readonly`). With modern TS (`useDefineForClassFields: true`,
> the default for `target >= ES2022`) a class field shadows the decorator's
> prototype accessor, so **without `@Configured` those decorators silently
> no-op** — no error, just nothing happens. `@Configured` materializes them as
> own instance properties so they work under any setting. **Method** and
> **class** decorators (`@Get`, `@Retry`, `@Bind`, `@Data`, `@Tool`, …) don't
> need it.

## Inject — config & value injection (flagship)

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

> **Redaction is key-based** — it masks object *fields* whose **name** is
> sensitive. It cannot mask a secret passed as a positional **primitive**
> (e.g. `login(rawToken)`) or one embedded in an error message/stack. Pass
> secrets as named object fields, and don't put them in error messages.
>
> `@Secret` field names are registered **process-globally**, so `redact()` masks
> that field name everywhere — pick distinctive secret field names (`jwtSecret`,
> not `id`) to avoid over-masking unrelated fields.

```ts
import { redact, redactFormat } from '@master4n/decorators';
import winston from 'winston';

logger.info('Loaded config', redact(appConfig)); // jwtSecret -> [REDACTED]

const logger = winston.createLogger({
  format: winston.format.combine(redactFormat(), winston.format.json()),
});
```

## Guard & Shield — validation & access

Guards throw on invalid input — misuse fails fast instead of slipping through.

| Decorator                  | Target | Throws            | Description                                            |
| -------------------------- | ------ | ----------------- | ------------------------------------------------------ |
| `@NotNull`                 | method   | `ValidationError` | rejects `null`/`undefined` arguments.                |
| `@ValidDate`               | method   | `ValidationError` | first arg must be a valid `{ DD, MM, YYYY }` date.   |
| `@Pattern(regex, opts?)`   | property | `ValidationError` | only allows assigning values that match the regex.   |
| `@Min(n)` / `@Max(n)`      | property | `ValidationError` | string/array **length** ≥ n / ≤ n, or **number** value. |
| `@Range(min, max)`         | property | `ValidationError` | inclusive bounds on string/array length or number value. |
| `@Email` `@URL` `@UUID`    | property | `ValidationError` | format checks for email / URL / UUID.                |
| `@Enum(values)`            | property | `ValidationError` | value must be one of `values`.                       |
| `@NonEmpty`                | property | `ValidationError` | rejects `null`/`undefined`/`''`/`[]`.                |
| `@Integer` `@Positive`     | property | `ValidationError` | number must be an integer / greater than zero.       |
| `@NotBlank`                | property | `ValidationError` | string with a non-whitespace char (asserts presence). |
| `@Size(min, max)`          | property | `ValidationError` | string/array length bounds.        |
| `@Negative` `@PositiveOrZero` `@NegativeOrZero` | property | `ValidationError` | number sign constraints. |
| `@Past` `@Future` `@PastOrPresent` `@FutureOrPresent` | property | `ValidationError` | date is before/after now. |
| `@AssertTrue` `@AssertFalse` | property | `ValidationError` | boolean must be true / false.                      |
| `@Digits(int, frac)`       | property | `ValidationError` | max integer + fractional digits. |

**Transforms** normalize the value on assignment (and run *before* validators,
whatever the stacking order):

| Decorator       | Effect                                            |
| --------------- | ------------------------------------------------- |
| `@Trim`         | trim whitespace from assigned strings.            |
| `@Lowercase` / `@Uppercase` | change case of assigned strings.      |
| `@Coerce(type)` | coerce to `'number'`/`'boolean'`/`'string'`.      |
| `@Clamp(min, max)` | clamp an assigned number into `[min, max]`.    |

```ts
@Configured
class Signup {
  @Trim @Lowercase @Email()       email!: string;  // "  A@B.CO " -> "a@b.co", validated
  @Coerce('number') @Range(18, 120) age!: number;  // "21" -> 21, bounded
}
```
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

## Model — data classes

| Decorator        | Adds                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| `@ToString(opts?)` | a `toString()` listing fields — **with `@Secret`/sensitive fields redacted**. `only`/`exclude` options. |
| `@Equals(...keys?)`| an `equals(other)` (same-constructor, field-wise).                      |
| `@With`          | `with(patch)` → shallow copy with overrides (frozen-preserving).          |
| `@Data`          | `@ToString` + `equals()` + `with()` in one.                               |
| `@Immutable`     | `Object.freeze` each instance (immutable value object). Pairs with `@With`.      |
| `@Readonly`      | field: assignable once, then throws (like `final`).                       |
| `@Synchronized`  | method: serialize concurrent async calls per instance (mutex).            |
| `@Builder` / `builder(Class)` | fluent builder. `builder()` is **fully typed** (no codegen). |

```ts
import { Data, Immutable, With, builder } from '@master4n/decorators';

@Immutable
@Data                                   // toString + equals + with
class Money { constructor(public amount = 0, public currency = 'INR') {} }

const a = new Money(100, 'INR');
const b = (a as any).with({ amount: 250 });   // frozen copy
const c = builder(Money).amount(50).currency('USD').build(); // typed builder
```

## Route — REST controllers

Build Express routes declaratively — `@Controller` + `@GetMapping` +
`@PathVariable`/`@RequestParam`/`@RequestBody` — then wire them in with
`registerControllers`. Framework-agnostic (no `express` dependency); works with
any Express-compatible `app`/`Router`.

```ts
import express from 'express';
import {
  Controller, Get, Post, Param, Query, Body, HttpCode, Use, registerControllers,
} from '@master4n/decorators';

@Use(authMiddleware)            // controller-level middleware
@Controller('/users')
class UserController {
  @Get('/:id')
  getUser(@Param('id') id: string, @Query('expand') expand?: string) {
    return this.service.find(id, expand);   // returned value -> res.json(...) (200)
  }

  @Post('/')
  @HttpCode(201)
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);          // -> 201 + JSON
  }
}

const app = express();
app.use(express.json());
registerControllers(app, [new UserController()]);
```

Returned values are sent as JSON with the configured status; throw and it's
routed to `next(err)`. Inject `@Res()` to take over the response yourself.

| Concise            | Alias               | Purpose                                   |
| ------------------ | ------------------- | ----------------------------------------- |
| `@Controller(base)`| `@RestController`   | class: base path + controller middleware. |
| `@Get` `@Post` `@Put` `@Patch` `@Delete` `@Options` `@Head` `@All` | `@GetMapping` … `@RequestMapping` | route a method. |
| `@Param(n)`        | `@PathVariable`     | path variable.                            |
| `@Query(n)`        | `@RequestParam`     | query-string value.                       |
| `@Body(n?)`        | `@RequestBody`      | request body (or one field).              |
| `@Header(n)`       | `@RequestHeader`    | request header.                           |
| `@Cookie(n)` `@Req()` `@Res()` `@Next()` | — | cookie / raw req / res / next.    |
| `@HttpCode(code)`  | `@ResponseStatus`   | success status code.                      |
| `@ContentType(t)`  | `@Produces`         | response content-type.                    |
| `@Redirect(url)` `@Use(...mw)` | —       | redirect / attach middleware (class or route). |

## Agent — LLM tools

Expose class methods as LLM-callable tools, then dispatch the model's tool call
back to the method — the whole agent loop, declaratively.

```ts
import { Tool, getTools, invokeTool } from '@master4n/decorators';

class WeatherService {
  @Tool({
    description: 'Get the current temperature for a city',
    parameters: {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
    },
  })
  getTemperature(args: { city: string }) { /* ... */ }
}

const tools = getTools();
// -> [{ name: 'getTemperature', description: '...', parameters: {...} }]
// Pass `tools` to your LLM (OpenAI `tools`/`parameters`, Anthropic `input_schema`).

// When the model returns a tool call:
const result = invokeTool(new WeatherService(), call.name, call.arguments);
```

`parameters` is an **explicit** JSON Schema — TypeScript parameter types are
erased at runtime, so the library does not (and cannot honestly) infer it.

> Tool names live in a **process-global** registry and must be unique — a
> duplicate name overwrites the earlier one (so `invokeTool` would target the
> wrong method). Give colliding tools an explicit unique `name`.

### Agent power-ups (method decorators)

Wrap the methods an agent calls so they're validated, safe to retry, verified,
and measured:

| Decorator                | Does                                                                  |
| ------------------------ | -------------------------------------------------------------------- |
| `@Validate(check)`       | reject bad **input** args before running (throws `ValidationError`). |
| `@Guardrail(check, opts?)` | verify the **output**; retry up to `opts.retries`, else `GuardrailError`. |
| `@Idempotent(keyFn?)`    | cache the result by an idempotency key — safe to retry (no TTL; failures aren't cached). |
| `@Meter(name?)`          | record calls / errors / timing; read with `getMetrics()`.            |

## Craft — class & method ergonomics

Kill the small repeated boilerplate.

| Decorator         | Does                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| `@Bind`           | auto-bind a method to its instance — no more `.bind(this)` for callbacks.   |
| `@Lazy(factory)`  | compute a property once on first access, then cache.                        |
| `@Sealed`         | `Object.seal` each instance (no added/removed props; values stay writable). |
| `@Mixin(...src)`  | copy members from other objects/classes onto the class.                     |
| `@OnChange(fn)`   | run `fn(new, old, instance)` when a property actually changes (first set initializes silently). |

## Insight — observability

| Decorator         | Description                                                              |
| ----------------- | ----------------------------------------------------------------------- |
| `@Trace(opts?)`   | structured entry/exit/error logs with a **correlation id** threaded through nested calls (AsyncLocalStorage). Args/results redacted. `getTraceId()` reads the current id. |
| `@Audit(action?)` | logs `actor` + `action` + redacted args. Set the "who" via `setAuditResolver`. |
| `@LogErrors()`    | logs errors (redacted args + stack) and **rethrows** (sync/async).      |

```ts
import { Trace, Audit, setAuditResolver, getTraceId } from '@master4n/decorators';

setAuditResolver((ctx) => (ctx.instance as any).user?.id ?? 'system');

class OrderService {
  @Trace({ result: true })           // one trace id flows through the whole call tree
  @Audit('order.refund')
  async refund(orderId: string) { /* getTraceId() to tag your own logs */ }
}
```

## Flow — resilience & control flow

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
