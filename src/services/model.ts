import { ValidationError } from './errors.js';
import { registerInstanceSpec } from './injection.js';
import { redact, type RedactOptions } from './../utilities/redact.js';

// ---------------------------------------------------------------------------
// Model — data/domain class decorators. @ToString redacts secrets, @With preserves frozen-ness, builders are typed via `builder()`.
// ---------------------------------------------------------------------------

export interface ToStringOptions {
  /** Only include these fields. */
  only?: string[];
  /** Exclude these fields. */
  exclude?: string[];
  /** Redaction options for sensitive fields (always redacted via `redact`). */
  redact?: RedactOptions;
}

function installToString(proto: any, options: ToStringOptions = {}): void {
  proto.toString = function (this: Record<string, unknown>) {
    const safe = redact({ ...this }, options.redact) as Record<string, unknown>;
    const entries = Object.entries(safe)
      .filter(([k]) => (options.only ? options.only.includes(k) : true))
      .filter(([k]) => !options.exclude?.includes(k))
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
    const name = this.constructor?.name ?? 'Object';
    return `${name}(${entries.join(', ')})`;
  };
}

function installEquals(proto: any, keys?: string[]): void {
  proto.equals = function (this: Record<string, unknown>, other: unknown) {
    if (
      other === null ||
      typeof other !== 'object' ||
      this.constructor !== (other as object).constructor
    ) {
      return false;
    }
    const o = other as Record<string, unknown>;
    const compareKeys = keys ?? Object.keys(this);
    return compareKeys.every((k) => this[k] === o[k]);
  };
}

function installWith(proto: any): void {
  proto.with = function (
    this: Record<string, unknown>,
    patch: Record<string, unknown>,
  ) {
    const copy = Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      this,
      patch,
    );
    return Object.isFrozen(this) ? Object.freeze(copy) : copy;
  };
}

/**
 * Class decorator: adds a `toString()` that lists the instance's fields —
 * **with secrets redacted** (`@Secret` names + {@link DEFAULT_SENSITIVE_KEYS}),
 * which plain serialization does not do.
 *
 * @example
 * \@ToString()
 * class User { name = 'a'; password = 'x'; }
 * String(new User()); // "User(name=a, password=[REDACTED])"
 */
export function ToString(options: ToStringOptions = {}) {
  return function (ctor: new (...args: any[]) => object): void {
    installToString(ctor.prototype, options);
  };
}

/**
 * Class decorator: adds `equals(other)` comparing fields (all own fields, or the
 * given `keys`). Same-constructor, shallow `===` per field.
 */
export function Equals(...keys: string[]) {
  return function (ctor: new (...args: any[]) => object): void {
    installEquals(ctor.prototype, keys.length ? keys : undefined);
  };
}

/**
 * Class decorator: adds `with(patch)` returning a shallow copy with `patch`
 * applied — ideal for immutable updates. If the source is frozen
 * (`@Immutable`), the copy is frozen too.
 *
 * @example
 * const next = user.with({ name: 'b' });
 */
export function With(ctor: new (...args: any[]) => object): void {
  installWith(ctor.prototype);
}

/**
 * Class decorator: `@Data` — `@ToString` + `equals()` + `with()`.
 */
export function Data(ctor: new (...args: any[]) => object): void {
  installToString(ctor.prototype);
  installEquals(ctor.prototype);
  installWith(ctor.prototype);
}

/**
 * Class decorator: freeze every instance after construction (`Object.freeze`),
 * making it immutable. Pair with `@With` for copy-on-write.
 *
 * Note: don't combine with decorators that mutate the instance after
 * construction (e.g. `@Configured`) — freezing blocks them. Pairs cleanly with
 * `@ToString`/`@Equals`/`@With`.
 */
export function Immutable<T extends new (...args: any[]) => object>(ctor: T): T {
  const wrapped = class extends ctor {
    constructor(...args: any[]) {
      super(...args);
      Object.freeze(this);
    }
  };
  Object.defineProperty(wrapped, 'name', { value: ctor.name });
  return wrapped as T;
}

/**
 * Field decorator: the property may be assigned once (e.g. in the constructor);
 * any later reassignment throws {@link ValidationError} — like a `final` field.
 * Use with `@Configured` for robustness under modern class-field semantics.
 */
export function Readonly(target: object, propertyKey: string | symbol): void {
  const define = (owner: object) => {
    const store = Symbol(String(propertyKey));
    const setFlag = Symbol(`${String(propertyKey)}:set`);
    Object.defineProperty(owner, propertyKey, {
      get(this: Record<symbol, unknown>) {
        return this[store];
      },
      set(this: Record<symbol, unknown>, value: unknown) {
        if (this[setFlag]) {
          throw new ValidationError(
            `@Readonly: "${String(propertyKey)}" cannot be reassigned.`,
          );
        }
        this[setFlag] = true;
        this[store] = value;
      },
      enumerable: true,
      configurable: true,
    });
  };

  define(target); // standalone (useDefineForClassFields: false)
  registerInstanceSpec(target, propertyKey, (instance) => {
    const existing = (instance as Record<string | symbol, unknown>)[propertyKey];
    define(instance); // fresh own accessor with its own set-flag
    if (existing !== undefined) {
      (instance as Record<string | symbol, unknown>)[propertyKey] = existing;
    }
  });
}

/**
 * Method decorator: serialize concurrent **async** calls per instance — each
 * call waits for the previous to settle (a mutex). The
 * decorated method returns a promise.
 */
export function Synchronized(
  _t: any,
  _methodName: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const original = descriptor.value;
  const tails = new WeakMap<object, Promise<unknown>>();
  descriptor.value = function (this: object, ...args: any[]) {
    const prev = tails.get(this) ?? Promise.resolve();
    const result = prev.then(
      () => original.apply(this, args),
      () => original.apply(this, args),
    );
    // Keep the chain alive regardless of this call's outcome.
    tails.set(
      this,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  };
  return descriptor;
}

/** A typed fluent builder for `T`. */
export type BuilderOf<T> = {
  [K in keyof T]-?: (value: T[K]) => BuilderOf<T>;
} & { build(): T };

function makeBuilder<T extends object>(ctor: new () => T): BuilderOf<T> {
  const values: Record<string, unknown> = {};
  const proxy: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'build') {
          return () =>
            Object.assign(Object.create(ctor.prototype), values) as T;
        }
        return (value: unknown) => {
          values[prop] = value;
          return proxy;
        };
      },
    },
  );
  return proxy as BuilderOf<T>;
}

/**
 * Typed fluent builder for a class — `builder(User).name('a').age(5).build()`.
 * This needs no codegen and is fully typed via {@link BuilderOf}.
 * (`@Builder` also adds a runtime `.builder()` static for JS callers.)
 *
 * Note: `build()` uses `Object.create(prototype)` + assignment — it does **not**
 * run the class constructor, so constructor logic and `@Configured` injection
 * (`@Value`/`@Env` defaults) won't populate. Property validators still fire on
 * each set. Use it for plain data classes, not ones that rely on the constructor.
 */
export function builder<T extends object>(ctor: new () => T): BuilderOf<T> {
  return makeBuilder(ctor);
}

/**
 * Class decorator: adds a static `builder()` returning a fluent builder. For
 * full typing in TypeScript, prefer the standalone {@link builder} function
 * (legacy class decorators can't augment the static type).
 */
export function Builder<T extends new () => object>(ctor: T): T {
  (ctor as unknown as { builder: () => unknown }).builder = () =>
    makeBuilder(ctor as unknown as new () => object);
  return ctor;
}
