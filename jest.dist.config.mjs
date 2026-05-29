// Pre-publish smoke config: runs ONLY the dist bundle test, and (unlike the
// main config) does NOT ignore dist/. Requires `npm run build` first.
export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/dist/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};
