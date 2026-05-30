import { ValidationError } from './errors.js';
import { addPropertyValidator } from './validate-property.js';

interface MessageOption {
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const optional = (value: unknown): boolean =>
  value === undefined || value === null;

/** Property decorator: assigned value must be a valid email address. */
export function Email(options: MessageOption = {}) {
  return function (target: object, propertyKey: string | symbol): void {
    addPropertyValidator(target, propertyKey, (value) => {
      if (optional(value)) return;
      if (typeof value !== 'string' || !EMAIL_RE.test(value)) {
        throw new ValidationError(
          options.message ??
            `@Email: "${String(propertyKey)}" must be a valid email address.`,
        );
      }
    });
  };
}

/** Property decorator: assigned value must be a parseable URL. */
export function URL(options: MessageOption = {}) {
  return function (target: object, propertyKey: string | symbol): void {
    addPropertyValidator(target, propertyKey, (value) => {
      if (optional(value)) return;
      let ok = false;
      if (typeof value === 'string') {
        try {
          new globalThis.URL(value);
          ok = true;
        } catch {
          ok = false;
        }
      }
      if (!ok) {
        throw new ValidationError(
          options.message ??
            `@URL: "${String(propertyKey)}" must be a valid URL.`,
        );
      }
    });
  };
}

/** Property decorator: assigned value must be a UUID (v1–v5). */
export function UUID(options: MessageOption = {}) {
  return function (target: object, propertyKey: string | symbol): void {
    addPropertyValidator(target, propertyKey, (value) => {
      if (optional(value)) return;
      if (typeof value !== 'string' || !UUID_RE.test(value)) {
        throw new ValidationError(
          options.message ??
            `@UUID: "${String(propertyKey)}" must be a valid UUID.`,
        );
      }
    });
  };
}

/**
 * Property decorator: assigned value must be one of `allowed`.
 *
 * @example
 * class Job { \@Enum(['queued', 'running', 'done']) status!: string; }
 */
export function Enum<T>(allowed: readonly T[], options: MessageOption = {}) {
  return function (target: object, propertyKey: string | symbol): void {
    addPropertyValidator(target, propertyKey, (value) => {
      if (optional(value)) return;
      if (!allowed.includes(value as T)) {
        throw new ValidationError(
          options.message ??
            `@Enum: "${String(propertyKey)}" must be one of: ${allowed
              .map(String)
              .join(', ')}.`,
        );
      }
    });
  };
}

/**
 * Property decorator: rejects empty values — `null`, `undefined`, `''`, or `[]`.
 * (Unlike most validators, this also rejects null/undefined: "non-empty" implies
 * presence.)
 */
export function NonEmpty(options: MessageOption = {}) {
  return function (target: object, propertyKey: string | symbol): void {
    addPropertyValidator(target, propertyKey, (value) => {
      const empty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.length === 0) ||
        (Array.isArray(value) && value.length === 0);
      if (empty) {
        throw new ValidationError(
          options.message ?? `@NonEmpty: "${String(propertyKey)}" must not be empty.`,
        );
      }
    });
  };
}

/** Property decorator: assigned number must be an integer. */
export function Integer(options: MessageOption = {}) {
  return function (target: object, propertyKey: string | symbol): void {
    addPropertyValidator(target, propertyKey, (value) => {
      if (optional(value)) return;
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new ValidationError(
          options.message ??
            `@Integer: "${String(propertyKey)}" must be an integer.`,
        );
      }
    });
  };
}

/** Property decorator: assigned number must be greater than zero. */
export function Positive(options: MessageOption = {}) {
  return function (target: object, propertyKey: string | symbol): void {
    addPropertyValidator(target, propertyKey, (value) => {
      if (optional(value)) return;
      if (typeof value !== 'number' || value <= 0) {
        throw new ValidationError(
          options.message ??
            `@Positive: "${String(propertyKey)}" must be a positive number.`,
        );
      }
    });
  };
}
