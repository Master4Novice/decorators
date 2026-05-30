import { ValidationError } from './errors.js';
import { registerInstanceSpec } from './injection.js';

export interface PatternOptions {
  /** Custom error message thrown on a non-matching assignment. */
  message?: string;
  /**
   * Test `String(value)` instead of requiring a `string`. Lets you validate
   * numbers and other stringifiable values against the pattern. Default false.
   */
  coerce?: boolean;
}

/**
 * Property decorator: only allows assigning values that match `regex`. A
 * non-matching assignment throws {@link ValidationError}; the property keeps its
 * previous value. `null`/`undefined` are allowed (treat the field as optional /
 * clearable) — combine with your own required check if needed.
 *
 * Put `@Configured` on the class for this to work under any
 * `useDefineForClassFields` setting (otherwise it needs
 * `useDefineForClassFields: false`, like the other property decorators).
 *
 * @example
 * \@Configured
 * class User {
 *   \@Pattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { message: 'invalid email' })
 *   email!: string;
 *
 *   \@Pattern(/^\d{6}$/, { coerce: true }) // accepts 560001 or "560001"
 *   pincode!: string;
 * }
 */
export function Pattern(regex: RegExp, options: PatternOptions = {}) {
  return function (target: object, propertyKey: string | symbol): void {
    const validate = (value: unknown): unknown => {
      if (value === undefined || value === null) return value;
      const candidate = options.coerce ? String(value) : value;
      if (typeof candidate !== 'string' || !regex.test(candidate)) {
        throw new ValidationError(
          options.message ??
            `@Pattern: value for "${String(
              propertyKey,
            )}" does not match ${regex}.`,
        );
      }
      return value;
    };

    const defineValidatingAccessor = (owner: object): void => {
      const store = Symbol(String(propertyKey));
      Object.defineProperty(owner, propertyKey, {
        get(this: Record<symbol, unknown>) {
          return this[store];
        },
        set(this: Record<symbol, unknown>, value: unknown) {
          this[store] = validate(value);
        },
        enumerable: true,
        configurable: true,
      });
    };

    // Standalone path: prototype accessor (useDefineForClassFields: false).
    defineValidatingAccessor(target);

    // @Configured path: own instance accessor, robust under both settings.
    // Preserve and re-validate any value the constructor already assigned.
    registerInstanceSpec(target, propertyKey, (instance) => {
      const existing = (instance as Record<string | symbol, unknown>)[
        propertyKey
      ];
      defineValidatingAccessor(instance);
      if (existing !== undefined) {
        (instance as Record<string | symbol, unknown>)[propertyKey] = existing;
      }
    });
  };
}
