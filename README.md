# Installation

> `npm install @master4n/decorators`

## Summary

This package contains decorators for Master4Novice. Kindly set true for the below property in your tsconfig.json.

```json
    "experimentalDecorators": true,                 
    "emitDecoratorMetadata": true, 
```

## Details

Files were exported from the package.

````ts
 @Value('server.port') // Set any class property from environment specific YAML file in config folder
 @GenerateID // Set any class property as a UUID value.
````

### Additional Details

* Last updated: Fri, 05 Jan 2024
* Dependencies: none

## Credits

These definitions were written by [Master4Novice](https://github.com/Master4Novice).
