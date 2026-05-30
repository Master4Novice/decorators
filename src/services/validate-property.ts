import { registerInstanceSpec } from './injection.js';

/** A validator that throws (e.g. ValidationError) when `value` is invalid. */
export type PropertyValidator = (value: unknown) => void;

interface PropertyMeta {
  validators: PropertyValidator[];
}

// Per-prototype, per-key validator chains, so multiple property decorators on
// the same field (e.g. @Min(3) @Max(20)) compose instead of overwriting.
const registry = new WeakMap<object, Map<string | symbol, PropertyMeta>>();

/**
 * Attach a validator to a property. The first call for a given property installs
 * a validating accessor (prototype, for standalone use) and registers an
 * instance materializer (for `@Configured`, robust under any
 * `useDefineForClassFields` setting). Subsequent calls just add to the chain.
 *
 * Validators run on every assignment, in decorator-evaluation order; if any
 * throws, the assignment is rejected and the previous value is kept.
 * `null`/`undefined` should be allowed by each validator (optional fields).
 */
export function addPropertyValidator(
  target: object,
  propertyKey: string | symbol,
  validate: PropertyValidator,
): void {
  let byKey = registry.get(target);
  if (!byKey) {
    byKey = new Map();
    registry.set(target, byKey);
  }
  let meta = byKey.get(propertyKey);
  const isFirst = !meta;
  if (!meta) {
    meta = { validators: [] };
    byKey.set(propertyKey, meta);
  }
  meta.validators.push(validate);
  if (!isFirst) return; // accessor already installed; chain extended

  const runAll = (value: unknown): void => {
    for (const v of meta!.validators) v(value);
  };

  const defineAccessor = (owner: object): void => {
    const store = Symbol(String(propertyKey));
    Object.defineProperty(owner, propertyKey, {
      get(this: Record<symbol, unknown>) {
        return this[store];
      },
      set(this: Record<symbol, unknown>, value: unknown) {
        runAll(value);
        this[store] = value;
      },
      enumerable: true,
      configurable: true,
    });
  };

  // Standalone: prototype accessor (useDefineForClassFields: false).
  defineAccessor(target);

  // @Configured: own instance accessor, preserving/re-validating any value the
  // constructor already assigned.
  registerInstanceSpec(target, propertyKey, (instance) => {
    const existing = (instance as Record<string | symbol, unknown>)[propertyKey];
    defineAccessor(instance);
    if (existing !== undefined) {
      (instance as Record<string | symbol, unknown>)[propertyKey] = existing;
    }
  });
}
