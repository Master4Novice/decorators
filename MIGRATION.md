# Migrating to `@master4n/decorators` 2.0.3

2.0.3 makes the package **zero-dependency**. `winston` and `config` are no longer
installed transitively — they are now optional peer dependencies, used only by
two clearly-scoped subpaths. Nothing about how the decorators *behave* changed;
only a few import paths moved.

## TL;DR

| If you used…                         | Change the import to…                          | Also run        |
| ------------------------------------ | ---------------------------------------------- | --------------- |
| `Value`, `Config`                    | `@master4n/decorators/config`                  | `npm i config`  |
| `redactFormat`                       | `@master4n/decorators/winston`                 | `npm i winston` |
| everything else (`Env`, `Secret`, `Configured`, `redact`, all guards/flow/model/route/agent decorators) | **no change** | — |

## 1. `@Value` / `@Config`

These are the only decorators that read config files via
[`node-config`](https://www.npmjs.com/package/config). They moved to a subpath so
that the main entry point doesn't import (or eagerly scan for) node-config.

```diff
- import { Configured, Value, Config, Env, Secret } from '@master4n/decorators';
+ import { Configured, Env, Secret } from '@master4n/decorators';
+ import { Value, Config } from '@master4n/decorators/config';
```

```sh
npm i config
```

`@Value` and `@Config` still register against the **same** injection registry as
`@Configured`, so existing classes work unchanged once the import is updated.

## 2. `redactFormat`

The winston `format` moved to a subpath. `redact()` (the pure, dependency-free
function) stays on the main entry.

```diff
- import { redact, redactFormat } from '@master4n/decorators';
+ import { redact } from '@master4n/decorators';
+ import { redactFormat } from '@master4n/decorators/winston';
```

```sh
npm i winston
```

`@Secret`-marked field names are still honoured by `redactFormat` — the subpaths
share a single registry chunk.

## 3. Internal logger

`@Log`, `@Trace`, `@Audit`, `@Measure`, and `@LogErrors` previously logged through
winston. They now use a built-in, zero-dependency console logger.

- Output format is `<ISO timestamp> [Master4Novice] <level>: <message>`.
- Default level is `info` (matching the previous winston default). Set
  `DECORATORS_LOG_LEVEL=debug|info|warn|error` to change it.
- Structured metadata is still redacted before it reaches the console.

If you want these decorators to feed your own winston/pino pipeline, wire your
logger's transports as before and use `redactFormat` from the `/winston` subpath
to keep secrets out of structured fields.

## 4. `js-yaml`

`js-yaml` was declared as a dependency but never used by the library. It has been
removed. If your own code imported `js-yaml` transitively through this package,
add it to your own dependencies (`npm i js-yaml`).
