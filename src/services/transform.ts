import { addPropertyTransform } from './validate-property.js';

/**
 * Property decorator: trims whitespace from assigned strings. Non-strings and
 * `null`/`undefined` pass through unchanged. Runs before validators, so e.g.
 * `@Trim @Min(3)` checks the trimmed length.
 */
export function Trim(target: object, propertyKey: string | symbol): void {
  addPropertyTransform(target, propertyKey, (value) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

/** Property decorator: lowercases assigned strings. */
export function Lowercase(target: object, propertyKey: string | symbol): void {
  addPropertyTransform(target, propertyKey, (value) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  );
}

/** Property decorator: uppercases assigned strings. */
export function Uppercase(target: object, propertyKey: string | symbol): void {
  addPropertyTransform(target, propertyKey, (value) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  );
}

/**
 * Property decorator: coerces assigned values to `type`. Useful at boundaries
 * where everything arrives as a string (query params, env, form data).
 * `null`/`undefined` pass through.
 *
 * @example
 * class Q {
 *   \@Coerce('number') page!: number;   // "2" -> 2
 *   \@Coerce('boolean') verbose!: boolean; // "true" -> true
 * }
 */
export function Coerce(type: 'number' | 'boolean' | 'string') {
  return function (target: object, propertyKey: string | symbol): void {
    addPropertyTransform(target, propertyKey, (value) => {
      if (value === undefined || value === null) return value;
      if (type === 'number') {
        const n = Number(value);
        return Number.isNaN(n) ? value : n;
      }
      if (type === 'boolean') {
        return value === true || value === 'true' || value === '1' || value === 1;
      }
      return String(value);
    });
  };
}

/**
 * Property decorator: clamps an assigned number into `[min, max]`. Non-numbers
 * and `null`/`undefined` pass through.
 *
 * @example
 * class Settings {
 *   \@Clamp(0, 100) volume!: number; // 150 -> 100, -5 -> 0
 * }
 */
export function Clamp(min: number, max: number) {
  return function (target: object, propertyKey: string | symbol): void {
    addPropertyTransform(target, propertyKey, (value) =>
      typeof value === 'number' ? Math.min(max, Math.max(min, value)) : value,
    );
  };
}
