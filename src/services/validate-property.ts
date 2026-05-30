import { registerInstanceSpec } from './injection.js';

/** A validator that throws (e.g. ValidationError) when `value` is invalid. */
export type PropertyValidator = (value: unknown) => void;
/** A transform that maps the value before it is validated and stored. */
export type PropertyTransform = (value: unknown) => unknown;

interface PropertyMeta {
  transforms: PropertyTransform[];
  validators: PropertyValidator[];
}

// Per-prototype, per-key interceptor chains, so multiple property decorators on
// the same field compose instead of overwriting.
const registry = new WeakMap<object, Map<string | symbol, PropertyMeta>>();

function ensureMeta(
  target: object,
  propertyKey: string | symbol,
): { meta: PropertyMeta; isFirst: boolean } {
  let byKey = registry.get(target);
  if (!byKey) {
    byKey = new Map();
    registry.set(target, byKey);
  }
  let meta = byKey.get(propertyKey);
  const isFirst = !meta;
  if (!meta) {
    meta = { transforms: [], validators: [] };
    byKey.set(propertyKey, meta);
  }
  return { meta, isFirst };
}

function install(
  target: object,
  propertyKey: string | symbol,
  meta: PropertyMeta,
): void {
  // Transforms run first (in registration order), then validators — regardless
  // of decorator stacking order, so `@Trim` always normalizes before `@Min`
  // checks length.
  const apply = (value: unknown): unknown => {
    let v = value;
    for (const t of meta.transforms) v = t(v);
    for (const validate of meta.validators) validate(v);
    return v;
  };

  const defineAccessor = (owner: object): void => {
    const store = Symbol(String(propertyKey));
    Object.defineProperty(owner, propertyKey, {
      get(this: Record<symbol, unknown>) {
        return this[store];
      },
      set(this: Record<symbol, unknown>, value: unknown) {
        this[store] = apply(value);
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

/**
 * Attach a validator to a property. The first interceptor for a property
 * installs a validating/transforming accessor (prototype, for standalone use)
 * and an instance materializer (for `@Configured`). Validators run on every
 * assignment after all transforms; if any throws, the assignment is rejected and
 * the previous value is kept. `null`/`undefined` should be allowed by each
 * validator (optional fields).
 */
export function addPropertyValidator(
  target: object,
  propertyKey: string | symbol,
  validate: PropertyValidator,
): void {
  const { meta, isFirst } = ensureMeta(target, propertyKey);
  meta.validators.push(validate);
  if (isFirst) install(target, propertyKey, meta);
}

/**
 * Attach a transform to a property. Transforms map the assigned value (e.g.
 * trim, lowercase, coerce) and run before any validators, in registration order.
 */
export function addPropertyTransform(
  target: object,
  propertyKey: string | symbol,
  transform: PropertyTransform,
): void {
  const { meta, isFirst } = ensureMeta(target, propertyKey);
  meta.transforms.push(transform);
  if (isFirst) install(target, propertyKey, meta);
}
