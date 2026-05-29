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
  @Secret('DB_PASSWORD')              password!: string; // required + redaction-aware
}
```

### Injection decorators

| Decorator                | Source                          | Notes                                                            |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------- |
| `@Value(key, default?)`  | config files (YAML/JSON)        | via [`node-config`]. Required (throws) when no default is given. |
| `@Env(name, default?)`   | `process.env`                   | coerces to the default's type (number/boolean/array).            |
| `@Secret(name, default?)`| `process.env`                   | like `@Env`; registers the field for log redaction.              |
| `@Config(path)`          | config files                    | injects a whole config subtree/object (required).                |
| `@Default(value)`        | literal                         | injects a constant.                                              |
| `@Configured`            | _class decorator_               | materializes the above as own instance props (robust mode).      |

Missing required values throw `MissingConfigError`. With `@Configured`, that
happens at construction — so misconfiguration fails at startup, not deep in a
request. `getSecretKeys()` returns the names of `@Secret` fields for redaction.

## Utility decorators

| Decorator     | Target          | Description                                            |
| ------------- | --------------- | ------------------------------------------------------ |
| `@GenerateID` | class property  | assigns a lazy UUIDv4 to the property.                 |
| `@Counter`    | static property | turns a static property into an auto-incrementing counter. |
| `@Log()`      | method          | logs entry/exit around the method.                     |
| `@NotNull`    | method          | logs when an argument is `null`/`undefined`.           |
| `@ValidDate`  | method          | date-shape validation. **See [Known Issues](./KNOWN_ISSUES.md).** |

```ts
import { GenerateID, Counter, Log } from '@master4n/decorators';

class Job {
  @GenerateID id!: string;        // unique per instance
  @Counter static runs: number;   // increments on each read

  @Log()
  run() { /* ... */ }
}
```

## Known issues

See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — notably `@ValidDate` is currently a
no-op in published v1.x, and `@NotNull` logs but does not throw.

## Credits

Written by [Master4Novice](https://github.com/Master4Novice).

[`node-config`]: https://github.com/node-config/node-config
