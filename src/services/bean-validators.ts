import { ValidationError } from './errors.js';
import { addPropertyValidator } from './validate-property.js';

// Jakarta Bean Validation-style constraints (the ones not already provided by
// @Min/@Max/@Range/@Email/@Pattern/@Positive/@Integer/@NonEmpty). All are
// property decorators; like Jakarta, they skip null/undefined (combine with a
// presence check) — except @NotBlank, which asserts presence.

interface Msg {
  message?: string;
}

const optional = (v: unknown): boolean => v === undefined || v === null;

function constraint(
  propertyKey: string | symbol,
  ok: boolean,
  message: string,
): void {
  if (!ok) throw new ValidationError(message);
}

/** String must contain at least one non-whitespace char (rejects null/blank). */
export function NotBlank(options: Msg = {}) {
  return (t: object, k: string | symbol) =>
    addPropertyValidator(t, k, (v) =>
      constraint(
        k,
        typeof v === 'string' && v.trim().length > 0,
        options.message ?? `@NotBlank: "${String(k)}" must not be blank.`,
      ),
    );
}

/** String/array length must be within `[min, max]` (Jakarta `@Size`). */
export function Size(min: number, max: number, options: Msg = {}) {
  return (t: object, k: string | symbol) =>
    addPropertyValidator(t, k, (v) => {
      if (optional(v)) return;
      const len =
        typeof v === 'string' || Array.isArray(v) ? (v as { length: number }).length : NaN;
      constraint(
        k,
        !Number.isNaN(len) && len >= min && len <= max,
        options.message ?? `@Size: "${String(k)}" length must be between ${min} and ${max}.`,
      );
    });
}

function numberConstraint(
  label: string,
  predicate: (n: number) => boolean,
  describe: string,
) {
  return (options: Msg = {}) =>
    (t: object, k: string | symbol) =>
      addPropertyValidator(t, k, (v) => {
        if (optional(v)) return;
        constraint(
          k,
          typeof v === 'number' && predicate(v),
          options.message ?? `@${label}: "${String(k)}" must be ${describe}.`,
        );
      });
}

/** Number must be < 0. */
export const Negative = numberConstraint('Negative', (n) => n < 0, 'negative');
/** Number must be >= 0. */
export const PositiveOrZero = numberConstraint(
  'PositiveOrZero',
  (n) => n >= 0,
  'zero or positive',
);
/** Number must be <= 0. */
export const NegativeOrZero = numberConstraint(
  'NegativeOrZero',
  (n) => n <= 0,
  'zero or negative',
);

function toTime(v: unknown): number | null {
  const d = v instanceof Date ? v : new Date(v as string | number);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

function dateConstraint(
  label: string,
  predicate: (time: number, now: number) => boolean,
  describe: string,
) {
  return (options: Msg = {}) =>
    (t: object, k: string | symbol) =>
      addPropertyValidator(t, k, (v) => {
        if (optional(v)) return;
        const time = toTime(v);
        constraint(
          k,
          time !== null && predicate(time, Date.now()),
          options.message ?? `@${label}: "${String(k)}" must be ${describe}.`,
        );
      });
}

/** Date (or date string/number) must be strictly in the past. */
export const Past = dateConstraint('Past', (t, now) => t < now, 'in the past');
/** Date must be strictly in the future. */
export const Future = dateConstraint('Future', (t, now) => t > now, 'in the future');
/** Date must be in the past or now. */
export const PastOrPresent = dateConstraint(
  'PastOrPresent',
  (t, now) => t <= now,
  'in the past or present',
);
/** Date must be now or in the future. */
export const FutureOrPresent = dateConstraint(
  'FutureOrPresent',
  (t, now) => t >= now,
  'in the present or future',
);

/** Value must be boolean `true` (Jakarta `@AssertTrue`). */
export function AssertTrue(options: Msg = {}) {
  return (t: object, k: string | symbol) =>
    addPropertyValidator(t, k, (v) => {
      if (optional(v)) return;
      constraint(k, v === true, options.message ?? `@AssertTrue: "${String(k)}" must be true.`);
    });
}

/** Value must be boolean `false` (Jakarta `@AssertFalse`). */
export function AssertFalse(options: Msg = {}) {
  return (t: object, k: string | symbol) =>
    addPropertyValidator(t, k, (v) => {
      if (optional(v)) return;
      constraint(k, v === false, options.message ?? `@AssertFalse: "${String(k)}" must be false.`);
    });
}

/**
 * Number must have at most `integer` integer digits and `fraction` fractional
 * digits (Jakarta `@Digits`).
 */
export function Digits(integer: number, fraction: number, options: Msg = {}) {
  return (t: object, k: string | symbol) =>
    addPropertyValidator(t, k, (v) => {
      if (optional(v)) return;
      let ok = typeof v === 'number' && Number.isFinite(v);
      if (ok) {
        const [intPart, fracPart = ''] = Math.abs(v as number)
          .toString()
          .split('.');
        const intDigits = intPart.replace(/^0+/, '').length;
        ok = intDigits <= integer && fracPart.length <= fraction;
      }
      constraint(
        k,
        ok,
        options.message ??
          `@Digits: "${String(k)}" must have at most ${integer} integer and ${fraction} fraction digits.`,
      );
    });
}
