import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';

const config = [
  {
    input: 'src/index.ts',
    output: [
        {
           file: 'dist/cjs/index.cjs',
           format: 'cjs',
           sourcemap: true,
        },
        {
            file: 'dist/es/index.mjs',
            format: 'es',
            sourcemap: true,
         }
    ],
    external: [ 'config', 'uuid' ],
    plugins: [
        resolve(),
        typescript(),
        copy({
          targets: [
            { src: ["package.json", "README.md", "../../LICENSE"], dest: "dist" }
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
        dts()
    ]
  }
];
export default config;