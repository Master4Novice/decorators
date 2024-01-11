import { readYMLKey } from '../utilities/read';
import { v4 as uuidv4 } from 'uuid';

/***
 * Decorator can set a class property value from YAML file
 * @param key a key from yaml file.
 */
export function Value(key: string, value?: any) {
    return (target: any, propertyKey: string): any => {
        Reflect.set(target, propertyKey, readYMLKey(key, value));
    };
}

/**
 * Decorator can set a class property as UUIDv4 value
 */
export function GenerateID(target: any, key: string): void {
    const uuidSymbol = Symbol('uuid');
    const getter = function (this: any) {
      if (!this[uuidSymbol]) {
        this[uuidSymbol] = uuidv4();
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
 * Decorator will allow defined and non null values only.
 */
export function NotNull(target: any, key: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    args.forEach((arg, index) => {
      if (arg === null || arg === undefined) {
        throw new Error(`${key} must not be ${null} or ${undefined}`);
      }
    });

    return originalMethod.apply(this, args);
  };

  return descriptor;
}

/**
 * Decorator for date validation.
 */
export function ValidDate(target: any, key: string | symbol, index: number) {
  const originalMethod = target[key];

  target[key] = function (...args: any[]) {
    const dateParam = args[index];

    if (!isValidDate(dateParam) && dateParam !== undefined) {
      throw new Error(`Invalid parameter at index ${index}. Property 'DD', 'MM', and 'YYYY' must represent a valid date.`);
    }

    return originalMethod.apply(this, args);
  };
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

    const isValidJavaScriptDate = !isNaN(year) && !isNaN(month) && !isNaN(day) &&
      month >= 1 && month <= 12 &&
      day >= 1 && day <= new Date(year, month, 0).getDate();

    return isValidJavaScriptDate;
  }

  return false;
}