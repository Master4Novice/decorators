# @master4n/decorators

![Owner Badge](https://img.shields.io/badge/Owner-Master4Novice-orange?style=flat)
![Package Version](https://img.shields.io/github/package-json/v/Master4Novice/common?filename=packages%2Fdecorators%2Fpackage.json&color=green)
![Package License](https://img.shields.io/npm/l/%40master4n%2Fdecorators)
![Package Downloads](https://img.shields.io/npm/dm/%40master4n%2Fdecorators)

## Installation

```sh
npm install @master4n/decorators
```

## Usage

### As a library

With CommonJS in JavaScript,

```js
const { Value } = require('@master4n/decorators')
```

With ESM or TypeScript,

```ts
import { Value } from '@master4n/decorators'
```

```js
class Token {
    @Value('fix.token')
    fixToken: string
}
```

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
|NotNull|Method Parameter|Check if parameter is not null and undefined|
|Counter|Static Property Parameter|Create static counter|
|Log|Method Parameter|Log in and out of method|

## Credits

These definitions were written by [Master4Novice](https://github.com/Master4Novice).
