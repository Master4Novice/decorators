import { readYMLKey } from '../utilities/read';

/***
 * Decorator can set a class property value from YAML file
 * @param key a key from yaml file.
 */
export function Value(key: string, value?: any) {
    return (target: any, propertyKey: string): any => {
        Reflect.set(target, propertyKey, readYMLKey(key, value));
    };
}