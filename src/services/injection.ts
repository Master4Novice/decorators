import config from 'config';

/**
 * Thrown when a required configuration value is missing and no default was
 * provided. Surfaces at construction time (with `@Configured`) so that
 * misconfiguration fails loud at startup instead of silently yielding
 * `undefined` deep inside the app.
 */
export class MissingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingConfigError';
  }
}

/** A single field's injection rule: which property, and how to resolve it. */
interface InjectionSpec {
  key: string | symbol;
  resolve: () => unknown;
}

/** Registry of injection specs, keyed by the class prototype that declared them. */
const registry = new WeakMap<object, InjectionSpec[]>();

/** Property names that hold secrets — used by redaction-aware logging. */
const secretKeys = new Set<string>();

/** Names of properties decorated with `@Secret`, for log redaction. */
export function getSecretKeys(): readonly string[] {
  return [...secretKeys];
}

function register(proto: object, spec: InjectionSpec): void {
  const list = registry.get(proto);
  if (list) {
    list.push(spec);
  } else {
    registry.set(proto, [spec]);
  }
}

/** Walk the prototype chain so subclasses inherit base-class injection specs. */
function collectSpecs(proto: object | null): InjectionSpec[] {
  const specs: InjectionSpec[] = [];
  let current = proto;
  while (current && current !== Object.prototype) {
    const list = registry.get(current);
    if (list) specs.push(...list);
    current = Object.getPrototypeOf(current);
  }
  return specs;
}

/**
 * Prototype-accessor fallback. This is what makes a bare `@Value` (without
 * `@Configured`) work — but only when the consumer compiles with
 * `useDefineForClassFields: false`. With `@Configured`, instance materialization
 * takes over and works under both settings.
 */
function definePrototypeAccessor(
  target: object,
  propertyKey: string | symbol,
  resolve: () => unknown,
): void {
  const store = Symbol(String(propertyKey));
  Object.defineProperty(target, propertyKey, {
    get(this: Record<symbol, unknown>) {
      if (!(store in this)) this[store] = resolve();
      return this[store];
    },
    set(this: Record<symbol, unknown>, value: unknown) {
      this[store] = value;
    },
    enumerable: true,
    configurable: true,
  });
}

/**
 * Coerce a raw (usually string) value to the type implied by a sample default.
 * Env vars are always strings; this turns `"5432"` into `5432` and `"true"`
 * into `true` when the default is a number/boolean. Arrays comma-split.
 */
function coerce(raw: unknown, sample: unknown): unknown {
  if (raw === undefined || raw === null || sample === undefined) return raw;
  if (typeof sample === 'number') {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  if (typeof sample === 'boolean') {
    return raw === true || raw === 'true' || raw === '1' || raw === 1;
  }
  if (Array.isArray(sample)) {
    return typeof raw === 'string'
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : raw;
  }
  return raw;
}

function makeDecorator(resolve: () => unknown) {
  return function (target: object, propertyKey: string | symbol): void {
    register(target, { key: propertyKey, resolve });
    definePrototypeAccessor(target, propertyKey, resolve);
  };
}

/**
 * Inject a value read from your config files (YAML/JSON via `node-config`).
 *
 * Replaces a manual `config.get(...)` + try/catch + default-fallback block.
 *
 * @param key   dotted config path, e.g. `"db.url"`.
 * @param fallback default used when the key is missing. If omitted entirely,
 *   a missing key throws {@link MissingConfigError} (fail loud at startup).
 *
 * @example
 * \@Configured
 * class DbConfig {
 *   \@Value('db.url', 'sqlite://memory') url!: string;
 *   \@Value('db.poolSize') poolSize!: number; // required: throws if absent
 * }
 */
export function Value(key: string, fallback?: unknown) {
  const hasFallback = arguments.length > 1;
  return makeDecorator(() => {
    try {
      return config.get(key);
    } catch {
      if (hasFallback) return fallback;
      throw new MissingConfigError(
        `@Value: config key "${key}" is missing and no default was provided.`,
      );
    }
  });
}

/**
 * Inject a value from `process.env`, coerced to the type of the default.
 *
 * Replaces `const x = process.env.X; this.x = x ? Number(x) : 5432;` style code.
 *
 * @param name environment variable name, e.g. `"DB_PORT"`.
 * @param fallback default used when the variable is unset. Its type drives
 *   coercion (number/boolean/array). If omitted, an unset variable throws
 *   {@link MissingConfigError}.
 *
 * @example
 * \@Configured
 * class Server {
 *   \@Env('PORT', 3000) port!: number;     // "3000" -> 3000
 *   \@Env('DEBUG', false) debug!: boolean;  // "true" -> true
 * }
 */
export function Env(name: string, fallback?: unknown) {
  const hasFallback = arguments.length > 1;
  return makeDecorator(() => {
    const raw = process.env[name];
    if (raw === undefined) {
      if (hasFallback) return fallback;
      throw new MissingConfigError(
        `@Env: environment variable "${name}" is not set and no default was provided.`,
      );
    }
    return coerce(raw, fallback);
  });
}

/**
 * Like {@link Env}, but marks the property as a secret so logging utilities can
 * redact it. The value is read from `process.env` exactly like `@Env`.
 *
 * @example
 * \@Configured
 * class Auth {
 *   \@Secret('JWT_SECRET') jwtSecret!: string;
 * }
 */
export function Secret(name: string, fallback?: unknown) {
  const hasFallback = arguments.length > 1;
  return function (target: object, propertyKey: string | symbol): void {
    secretKeys.add(String(propertyKey));
    const resolve = () => {
      const raw = process.env[name];
      if (raw === undefined) {
        if (hasFallback) return fallback;
        throw new MissingConfigError(
          `@Secret: environment variable "${name}" is not set and no default was provided.`,
        );
      }
      return raw;
    };
    register(target, { key: propertyKey, resolve });
    definePrototypeAccessor(target, propertyKey, resolve);
  };
}

/**
 * Inject a config subtree/object by path (required). Useful for grabbing a
 * whole section, e.g. `@Config('redis') redis!: RedisOptions`.
 */
export function Config(path: string) {
  return makeDecorator(() => {
    try {
      return config.get(path);
    } catch {
      throw new MissingConfigError(
        `@Config: config path "${path}" is missing.`,
      );
    }
  });
}

/**
 * Inject a constant/literal default into a property. Equivalent to assigning the
 * value in a constructor, but declarative.
 *
 * @example
 * \@Configured
 * class Feature {
 *   \@Default(42) answer!: number;
 * }
 */
export function Default(value: unknown) {
  return makeDecorator(() => value);
}

/**
 * Class decorator that materializes every injection-decorated property as an
 * **own** instance property after construction. This is the robust mode: it
 * works whether the consumer compiles with `useDefineForClassFields` true or
 * false, because the own property overwrites any field-initializer shadow.
 *
 * Required values are resolved eagerly here, so missing config throws at
 * construction time (fail loud at startup) rather than on first access.
 *
 * @example
 * \@Configured
 * class AppConfig {
 *   \@Value('app.name') name!: string;
 *   \@Env('PORT', 3000) port!: number;
 * }
 */
export function Configured<T extends new (...args: any[]) => object>(
  ctor: T,
): T {
  const wrapped = class extends ctor {
    constructor(...args: any[]) {
      super(...args);
      for (const { key, resolve } of collectSpecs(ctor.prototype)) {
        Object.defineProperty(this, key, {
          value: resolve(),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
  };
  // Preserve the original class name (the subclass would otherwise be anonymous).
  Object.defineProperty(wrapped, 'name', { value: ctor.name });
  return wrapped;
}
