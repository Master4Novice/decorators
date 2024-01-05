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
export function GenerateID() {
  const uuidSymbol = Symbol('uuid');
  const value = function (key: any) {
    if(!key[uuidSymbol]) {
      key[uuidSymbol] = uuidv4()
    }
    return key[uuidSymbol];
  }
  return (target: any, propertyKey: string): any => {
      Reflect.set(target, propertyKey, value);
  };
}