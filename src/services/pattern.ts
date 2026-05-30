import { ValidationError } from './errors.js';
import { addPropertyValidator } from './validate-property.js';

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
 * Composes with `@Min`/`@Max`/`@Range` on the same property. Put `@Configured`
 * on the class for this to work under any `useDefineForClassFields` setting
 * (otherwise it needs `useDefineForClassFields: false`).
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
    addPropertyValidator(target, propertyKey, (value) => {
      if (value === undefined || value === null) return;
      const candidate = options.coerce ? String(value) : value;
      if (typeof candidate !== 'string' || !regex.test(candidate)) {
        throw new ValidationError(
          options.message ??
            `@Pattern: value for "${String(
              propertyKey,
            )}" does not match ${regex}.`,
        );
      }
    });
  };
}
