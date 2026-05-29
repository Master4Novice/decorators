// Source uses NodeNext-style ".js" specifiers that resolve to ".ts" in tests.
const moduleNameMapper = { '^(\\.{1,2}/.*)\\.js$': '$1' };

const tsTransform = (tsconfig) => ({
  '^.+\\.tsx?$': ['ts-jest', { tsconfig }],
});

export default {
  // Two projects run the same code under both class-field compilation modes.
  // `legacy` (useDefineForClassFields:false) is the classic decorator setting;
  // `modern` (useDefineForClassFields:true, the default for target >= ES2022)
  // is where prototype-accessor injection silently breaks — so `@Configured`
  // must keep working there.
  projects: [
    {
      displayName: 'legacy',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/*.test.ts'],
      modulePathIgnorePatterns: ['<rootDir>/dist'],
      moduleNameMapper,
      transform: tsTransform('tsconfig.test.json'),
    },
    {
      displayName: 'modern',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/modern/*.test.ts'],
      modulePathIgnorePatterns: ['<rootDir>/dist'],
      moduleNameMapper,
      transform: tsTransform('tsconfig.modern.json'),
    },
  ],
};
