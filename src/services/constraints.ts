import { ValidationError } from './errors.js';
import { addPropertyValidator } from './validate-property.js';

export interface ConstraintOptions {
  /** Custom error message thrown when the constraint is violated. */
  message?: string;
}

/**
 * The comparable magnitude of a value: a number compares by its value; a string
 * or array compares by its length. Returns null for anything else.
 */
function measure(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value.length;
  if (Array.isArray(value)) return value.length;
  return null;
}

function describe(propertyKey: string | symbol): string {
  return `"${String(propertyKey)}" (number value, or string/array length)`;
}

/**
 * Property decorator: rejects assignments below `min`. For numbers this is the
 * value; for strings and arrays it is the length. `null`/`undefined` are
 * allowed. Composes with `@Max`/`@Pattern`. Use with `@Configured` for
 * robustness under any `useDefineForClassFields` setting.
 *
 * @example
 * class User {
 *   \@Min(3) username!: string;   // length >= 3
 *   \@Min(18) age!: number;       // value >= 18
 * }
 */
export function Min(min: number, options: ConstraintOptions = {}) {
  return function (target: object, propertyKey: string | symbol): void {
    addPropertyValidator(target, propertyKey, (value) => {
      if (value === undefined || value === null) return;
      const m = measure(value);
      if (m === null || m < min) {
        throw new ValidationError(
          options.message ??
            `@Min: ${describe(propertyKey)} must be >= ${min}.`,
        );
      }
    });
  };
}

/**
 * Property decorator: rejects assignments above `max`. For numbers this is the
 * value; for strings and arrays it is the length. `null`/`undefined` are
 * allowed. Composes with `@Min`/`@Pattern`.
 *
 * @example
 * class User {
 *   \@Max(20) username!: string;  // length <= 20
 *   \@Max(120) age!: number;      // value <= 120
 * }
 */
export function Max(max: number, options: ConstraintOptions = {}) {
  return function (target: object, propertyKey: string | symbol): void {
    addPropertyValidator(target, propertyKey, (value) => {
      if (value === undefined || value === null) return;
      const m = measure(value);
      if (m === null || m > max) {
        throw new ValidationError(
          options.message ??
            `@Max: ${describe(propertyKey)} must be <= ${max}.`,
        );
      }
    });
  };
}

/**
 * Property decorator: rejects assignments outside `[min, max]` (inclusive). For
 * numbers this is the value; for strings and arrays it is the length.
 * `null`/`undefined` are allowed. Equivalent to `@Min(min)` + `@Max(max)`.
 *
 * @example
 * class User {
 *   \@Range(3, 20) username!: string; // length 3..20
 *   \@Range(0, 100) score!: number;   // value 0..100
 * }
 */
export function Range(min: number, max: number, options: ConstraintOptions = {}) {
  return function (target: object, propertyKey: string | symbol): void {
    addPropertyValidator(target, propertyKey, (value) => {
      if (value === undefined || value === null) return;
      const m = measure(value);
      if (m === null || m < min || m > max) {
        throw new ValidationError(
          options.message ??
            `@Range: ${describe(propertyKey)} must be between ${min} and ${max}.`,
        );
      }
    });
  };
}
