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
  /**
   * Reject inputs longer than this many characters BEFORE running the regex.
   * A cheap, strong defense against ReDoS: with a vulnerable (catastrophic-
   * backtracking) regex, a long crafted input can block the event loop for
   * seconds. Set this to the longest value you legitimately expect.
   */
  maxLength?: number;
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
 * ⚠️ **ReDoS:** the regex runs against assigned (possibly untrusted) values. A
 * catastrophic-backtracking pattern (e.g. `/(a+)+$/`) on a crafted long input
 * can block the event loop for seconds. Prefer linear/atomic regexes, and set
 * `maxLength` to bound the worst case on untrusted input.
 *
 * @example
 * \@Configured
 * class User {
 *   \@Pattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { message: 'invalid email', maxLength: 254 })
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
      if (typeof candidate !== 'string') {
        throw new ValidationError(
          options.message ??
            `@Pattern: value for "${String(propertyKey)}" does not match ${regex}.`,
        );
      }
      // ReDoS guard: bail before the regex on over-long input.
      if (
        options.maxLength !== undefined &&
        candidate.length > options.maxLength
      ) {
        throw new ValidationError(
          options.message ??
            `@Pattern: value for "${String(propertyKey)}" exceeds maxLength ${options.maxLength}.`,
        );
      }
      // Reset lastIndex so a global/sticky (/g, /y) regex doesn't give
      // stateful, alternating results across assignments.
      regex.lastIndex = 0;
      if (!regex.test(candidate)) {
        throw new ValidationError(
          options.message ??
            `@Pattern: value for "${String(propertyKey)}" does not match ${regex}.`,
        );
      }
    });
  };
}
