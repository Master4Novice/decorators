import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

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
    external: [ 'config', 'uuid', 'js-yaml', 'winston', 'os' ],
    plugins: [
        resolve(),
        terser(),
        typescript({
          tsconfig: 'tsconfig.json'
        }),
        copy({
          targets: [
            { src: ["README.md", "../../LICENSE"], dest: "dist" },
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