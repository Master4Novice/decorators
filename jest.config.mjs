export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist'],
  testPathIgnorePatterns: ['/node_modules/'],
  // Source uses NodeNext-style ".js" specifiers that resolve to ".ts" in tests.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // CommonJS + legacy-decorator semantics, isolated from the NodeNext build.
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
};
