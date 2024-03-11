import { readYMLKey } from '../utilities/read';
import { logger } from '../utilities/logger';
import { v4 as uuidv4 } from 'uuid';

/***
 * Decorator can set a class property value from YAML file
 * @param ymlKey a key from yaml file.
 * @param ymlValue a default direct value. 
 */
export function Value(ymlKey: string, ymlValue?: any) {
  return function (target: any, propertyKey: string) {
    const ymlSymbol = Symbol('yml');
    const getter = function (this: any) {
      if (!this[ymlSymbol]) {
        this[ymlSymbol] = readYMLKey(ymlKey, ymlValue);
      }
      return this[ymlSymbol];
    };
    const setter = function (this: any, value: string) {
      this[ymlSymbol] = value;
    };
    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    }); 
  };
}

/**
 * Decorator can set a class property as UUIDv4 value
 */
export function GenerateID(target: any, key: string) {
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
        logger.error(`Error: Arguments must not be ${null} or ${undefined}`);
      }
    });

    return originalMethod.apply(this, args);
  };

  return descriptor;
}

/**
 * Decorator for date validation.
 */
export function ValidDate(target: any, key: string | symbol) {
  const originalMethod = target[key];

  target[key] = function (...args: any[]) {
    const dateParam = args[0];

    if (!isValidDate(dateParam) && dateParam !== undefined) {
      logger.error(`Error: Invalid parameter at index ${0}. Property 'DD', 'MM', and 'YYYY' must represent a valid date.`);
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
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
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