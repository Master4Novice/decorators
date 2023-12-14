import config from 'config';

/**
 * Read a value of a key from YAML file.
 * @param key 
 * @param value
 */
export function readYMLKey(key: string, value?: any) {
    try {
        return config.get(key);
    } catch(error){
        return value;
    }
}