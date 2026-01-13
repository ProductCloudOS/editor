import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const external = Object.keys(pkg.dependencies || {});

export default [
  // ES Module build
  {
    input: 'src/lib/index.ts',
    external,
    output: {
      file: pkg.module,
      format: 'esm',
      sourcemap: true
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.lib.json',
        declaration: false
      })
    ]
  },
  // CommonJS build
  {
    input: 'src/lib/index.ts',
    external,
    output: {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.lib.json',
        declaration: false
      })
    ]
  },
  // UMD build (minified)
  {
    input: 'src/lib/index.ts',
    external,
    output: {
      file: 'dist/pc-editor.min.js',
      format: 'umd',
      name: 'PCEditor',
      sourcemap: true,
      globals: {
        'pdf-lib': 'PDFLib',
        'pdfjs-dist': 'pdfjsLib'
      }
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.lib.json',
        declaration: false
      }),
      terser()
    ]
  }
];