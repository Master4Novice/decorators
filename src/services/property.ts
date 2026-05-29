import { logger } from '../utilities/logger.js';
import { randomUUID } from 'node:crypto';
import { ValidationError } from './errors.js';

// NOTE: `Value` and the config/value-injection family now live in
// ./injection.ts (registry-backed, robust under `@Configured`). This module
// keeps the utility/method decorators.

/**
 * Decorator can set a class property as UUIDv4 value
 */
export function GenerateID(target: any, key: string) {
  const uuidSymbol = Symbol('uuid');
  const getter = function (this: any) {
    if (!this[uuidSymbol]) {
      this[uuidSymbol] = randomUUID();
    }
    return this[uuidSymbol];
  };
  const setter = function (this: any, value: string) {
    this[uuidSymbol] = value;
  };
  Object.defineProperty(target, key, {
    get: getter,
    set: setter,
    enumerable: true,
    configurable: true,
  });
}

/**
 * Method decorator: rejects `null`/`undefined` arguments.
 *
 * Throws {@link ValidationError} naming the offending argument index. (As of
 * 2.0.0 this throws; in 1.x it only logged. See KNOWN_ISSUES.md history.)
 */
export function NotNull(
  target: any,
  key: string,
  descriptor: PropertyDescriptor,
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    args.forEach((arg, index) => {
      if (arg === null || arg === undefined) {
        throw new ValidationError(
          `@NotNull: argument at index ${index} of "${String(
            key,
          )}" must not be null or undefined.`,
        );
      }
    });

    return originalMethod.apply(this, args);
  };

  return descriptor;
}

/**
 * Method decorator: validates that the first argument is a valid
 * `{ DD, MM, YYYY }` date object. Throws {@link ValidationError} when it is
 * present but invalid (an `undefined` first argument is allowed).
 *
 * Fixed in 2.0.0: previously a no-op because it reassigned `target[key]`
 * instead of returning the descriptor (see KNOWN_ISSUES.md).
 */
export function ValidDate(
  target: any,
  key: string,
  descriptor: PropertyDescriptor,
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    const dateParam = args[0];

    if (dateParam !== undefined && !isValidDate(dateParam)) {
      throw new ValidationError(
        `@ValidDate: argument 0 of "${String(
          key,
        )}" must be a valid { DD, MM, YYYY } date.`,
      );
    }

    return originalMethod.apply(this, args);
  };

  return descriptor;
}

function isValidDate(dateObj: any): boolean {
  if (
    typeof dateObj === 'object' &&
    dateObj !== null &&
    typeof dateObj.DD === 'string' &&
    typeof dateObj.MM === 'string' &&
    typeof dateObj.YYYY === 'string'
  ) {
    const day = parseInt(dateObj.DD, 10);
    const month = parseInt(dateObj.MM, 10);
    const year = parseInt(dateObj.YYYY, 10);

    const isValidJavaScriptDate =
      !isNaN(year) &&
      !isNaN(month) &&
      !isNaN(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= new Date(year, month, 0).getDate();

    return isValidJavaScriptDate;
  }

  return false;
}

/**
 * Decorator for static property of class.
 * It will make static property work as counter
 */
export function Counter(target: any, propertyKey: string) {
  // Ensure the counter is stored on the class constructor
  if (!target.constructor.hasOwnProperty('_counters')) {
    Object.defineProperty(target.constructor, '_counters', {
      value: {},
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }

  // Initialize the counter for the property
  if (!target.constructor._counters[propertyKey]) {
    target.constructor._counters[propertyKey] = 0;
  }

  // Create a getter function to increment and return the counter value
  const getter = function (this: any) {
    target.constructor._counters[propertyKey]++;
    return target.constructor._counters[propertyKey];
  };

  // Redefine the property with the new getter
  Object.defineProperty(target, propertyKey, {
    get: getter,
    enumerable: true,
    configurable: true,
  });
}

/**
 * Decorator logging in and out of method.
 */
export function Log() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      logger.info(`Entering ${propertyKey}`);
      const result = originalMethod.apply(this, args);
      logger.info(`Exiting ${propertyKey}`);
      return result;
    };

    return descriptor;
  };
}
