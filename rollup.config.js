import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';

// Three public entry points. Within each format build they are bundled TOGETHER
// (multi-input + code-splitting) so rollup hoists shared modules — most
// importantly the injection registry singleton in services/injection.ts — into a
// single shared chunk that every entry imports. Independent single-entry bundles
// would duplicate that module and split its WeakMap/Set state, breaking
// @Secret/@Value/@Configured composition. A consumer only ever loads one format
// (ESM or CJS), so per-format builds are safe.
const input = {
  index: 'src/index.ts',
  config: 'src/config.ts',
  winston: 'src/winston.ts',
};

// Optional peer deps + Node built-ins are kept external (never bundled).
const external = [
  'config',
  'winston',
  'os',
  'node:os',
  'fs',
  'node:fs',
  'crypto',
  'node:crypto',
  'async_hooks',
  'node:async_hooks',
];

// @rollup/plugin-typescript validates that tsconfig's `outDir` lives inside the
// rollup output `dir`, so each format build pins its own outDir.
const ts = (outDir) =>
  typescript({
    tsconfig: 'tsconfig.json',
    // The dts pass below emits bundled *.d.ts via rollup-plugin-dts. Disable
    // per-file declarations here to avoid the @rollup/plugin-typescript
    // declaration-path-escaping bug.
    declaration: false,
    declarationDir: undefined,
    outDir,
  });

const config = [
  {
    input,
    output: {
      dir: 'dist/commonjs',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      chunkFileNames: '[name]-[hash].cjs',
      exports: 'named',
      sourcemap: true,
    },
    external,
    plugins: [
      resolve(),
      ts('dist/commonjs'),
      copy({
        targets: [
          { src: ['README.md', 'LICENSE', 'llms.txt'], dest: 'dist' },
          {
            src: 'package.json',
            dest: 'dist',
            transform: (contents) => {
              const pkg = JSON.parse(contents.toString());
              const entry = (name) => ({
                import: `./esm/${name}.js`,
                require: `./commonjs/${name}.cjs`,
                types: `./${name}.d.ts`,
              });
              pkg.main = './commonjs/index.cjs';
              pkg.module = './esm/index.js';
              pkg.types = './index.d.ts';
              pkg.exports = {
                '.': entry('index'),
                './config': entry('config'),
                './winston': entry('winston'),
                './package.json': './package.json',
              };
              // Strip dev-only fields so the published tarball stays lean.
              delete pkg.scripts;
              delete pkg.devDependencies;
              delete pkg.publishConfig;
              return JSON.stringify(pkg, null, 2);
            },
          },
        ],
      }),
    ],
  },
  {
    input,
    output: {
      dir: 'dist/esm',
      format: 'esm',
      entryFileNames: '[name].js',
      chunkFileNames: '[name]-[hash].js',
      sourcemap: true,
    },
    external,
    plugins: [resolve(), ts('dist/esm')],
  },
  {
    input,
    output: {
      dir: 'dist',
      format: 'es',
      entryFileNames: '[name].d.ts',
      chunkFileNames: '[name]-[hash].d.ts',
    },
    external,
    plugins: [dts({ tsconfig: 'tsconfig.json' })],
  },
];

export default config;
