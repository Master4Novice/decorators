import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';

const config = [
  {
    input: 'src/index.ts',
    output: [
        {
           file: 'dist/commonjs/index.cjs',
           format: 'cjs',
           sourcemap: true,
        },
        {
            file: 'dist/esm/index.js',
            format: 'esm',
            sourcemap: true,
         }
    ],
    external: [ 'config', 'uuid', 'js-yaml', 'winston', 'os', 'node:fs' ],
    plugins: [
        resolve(),
        // Not minifying with terser: @rollup/plugin-terser's serialize-javascript
        // dependency is fragile across Node versions, and this bundle is tiny.
        // Downstream bundlers minify in apps that need it.
        typescript({
          tsconfig: 'tsconfig.json',
          // The dts pass below emits a single bundled dist/index.d.ts via
          // rollup-plugin-dts. Disable per-file declarations here to avoid the
          // @rollup/plugin-typescript declaration-path-escaping bug.
          declaration: false,
          declarationDir: undefined,
        }),
        copy({
          targets: [
            { src: ["README.md", "LICENSE", "llms.txt"], dest: "dist" },
            {
              src: 'package.json',
              dest: 'dist',
              transform: (contents) => {
                const pkg = JSON.parse(contents.toString());
                const importType = "./esm/index.js";
                const requireType = "./commonjs/index.cjs";
                const types = "./index.d.ts";
                pkg.main = requireType;
                pkg.module = importType;
                pkg.types = types;
                pkg.exports = {
                  import: importType,
                  require: requireType,
                  types: types
                }
                // Strip dev-only fields so the published tarball stays lean.
                delete pkg.scripts;
                delete pkg.devDependencies;
                delete pkg.publishConfig;
                return JSON.stringify(pkg, null, 2);
              }
            }
          ]
        })
    ]
  }, {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es'
    },
    plugins: [
        dts({
          tsconfig: 'tsconfig.json'
        })
    ]
  }
];
export default config;