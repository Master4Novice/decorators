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