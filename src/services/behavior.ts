import { registerInstanceSpec } from './injection.js';

// ---------------------------------------------------------------------------
// Class & method ergonomics — kill the small repeated boilerplate (binding,
// lazy init, sealing, mixins, change hooks).
// ---------------------------------------------------------------------------

/**
 * Method decorator: auto-bind the method to its instance, so `this` is always
 * correct even when the method is passed as a callback. No more `.bind(this)`.
 *
 * @example
 * class C { \@Bind handle() { return this.value; } }
 * const { handle } = new C(); handle(); // works
 */
export function Bind(
  _target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const original = descriptor.value;
  return {
    configurable: true,
    enumerable: false,
    get(this: object) {
      const bound = original.bind(this);
      Object.defineProperty(this, propertyKey, {
        value: bound,
        configurable: true,
        writable: true,
      });
      return bound;
    },
  };
}

/**
 * Property decorator: lazily compute the value on first access via `factory`,
 * then cache it. Replaces the "private backing field + getter" pattern. Use with
 * `@Configured` for robustness under modern class-field semantics.
 *
 * @example
 * class C { \@Lazy((self) => expensive(self)) result!: Result; }
 */
export function Lazy<T = unknown>(factory: (instance: any) => T) {
  return function (target: object, propertyKey: string | symbol): void {
    const define = (owner: object) => {
      const store = Symbol(String(propertyKey));
      Object.defineProperty(owner, propertyKey, {
        get(this: Record<symbol, unknown>) {
          if (!(store in this)) this[store] = factory(this);
          return this[store];
        },
        set(this: Record<symbol, unknown>, value: unknown) {
          this[store] = value;
        },
        enumerable: true,
        configurable: true,
      });
    };
    define(target);
    registerInstanceSpec(target, propertyKey, (instance) => define(instance));
  };
}

/**
 * Class decorator: `Object.seal` every instance after construction — existing
 * properties stay writable, but none can be added or removed. (Use `@Immutable`
 * to also freeze values.)
 */
export function Sealed<T extends new (...args: any[]) => object>(ctor: T): T {
  const wrapped = class extends ctor {
    constructor(...args: any[]) {
      super(...args);
      Object.seal(this);
    }
  };
  Object.defineProperty(wrapped, 'name', { value: ctor.name });
  return wrapped as T;
}

/**
 * Class decorator: copy the members of each `source` (object or class prototype)
 * onto the class — multiple inheritance without the boilerplate.
 *
 * @example
 * \@Mixin(Timestamped, SoftDeletable)
 * class Entity {}
 */
export function Mixin(
  ...sources: Array<object | (new (...args: any[]) => object)>
) {
  return function (ctor: new (...args: any[]) => object): void {
    for (const source of sources) {
      const proto =
        typeof source === 'function'
          ? (source as { prototype: object }).prototype
          : source;
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === 'constructor') continue;
        const desc = Object.getOwnPropertyDescriptor(proto, key);
        if (desc) Object.defineProperty(ctor.prototype, key, desc);
      }
    }
  };
}

/**
 * Property decorator: call `handler(newValue, oldValue, instance)` whenever the
 * property changes to a different value. A tiny reactive hook with no library.
 * Use with `@Configured` for modern class-field robustness.
 *
 * The **first** assignment establishes the initial value and does not fire (there
 * is no prior value to change from); subsequent changes fire.
 *
 * @example
 * class Form { \@OnChange((v) => save(v)) draft = ''; }
 */
export function OnChange<T = unknown>(
  handler: (newValue: T, oldValue: T, instance: any) => void,
) {
  return function (target: object, propertyKey: string | symbol): void {
    const define = (owner: object, seed?: { value: unknown }) => {
      const store = Symbol(String(propertyKey));
      const ready = Symbol(`${String(propertyKey)}:ready`);
      if (seed) {
        (owner as Record<symbol, unknown>)[store] = seed.value;
        (owner as Record<symbol, unknown>)[ready] = true;
      }
      Object.defineProperty(owner, propertyKey, {
        get(this: Record<symbol, unknown>) {
          return this[store];
        },
        set(this: Record<symbol, unknown>, value: unknown) {
          const old = this[store];
          this[store] = value;
          if (!this[ready]) {
            this[ready] = true; // first set = initialization, no fire
            return;
          }
          if (value !== old) handler.call(this, value as T, old as T, this);
        },
        enumerable: true,
        configurable: true,
      });
    };
    define(target);
    // Under @Configured, seed the constructor's value (marked ready) so the next
    // real change fires but the seed itself does not.
    registerInstanceSpec(target, propertyKey, (instance) => {
      const existing = (instance as Record<string | symbol, unknown>)[propertyKey];
      define(instance, { value: existing });
    });
  };
}
