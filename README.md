# Installation

> `npm install @master4n/decorators`

## Summary

This package contains decorators for any applications. Kindly set true for the below property in your tsconfig.json.

```json
    "experimentalDecorators": true,                 
    "emitDecoratorMetadata": true, 
```

## Available Decorators

|Decorator|Type|Description|
|---|---|---|
|Value|Class Property|Read the value from yaml file and assigned it to class property|
|GenerateID|Class Property|Assigne unique UUID value to class property|
|NotNull|Method Parameter|Check if parameter is not null and undefined

## Credits

These definitions were written by [Master4Novice](https://github.com/Master4Novice).
