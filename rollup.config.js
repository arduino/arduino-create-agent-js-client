import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import replace from 'rollup-plugin-replace';
// import uglify from 'rollup-plugin-uglify-es';
import { terser } from 'rollup-plugin-terser';

const env = process.env.NODE_ENV;
const isProduction = env === 'production';

export default {
  output: {
    format: 'umd',
    name: 'CreatePlugin',
  },
  plugins: [
    nodeResolve(),
    // due to https://github.com/rollup/rollup/wiki/Troubleshooting#name-is-not-exported-by-module
    commonjs({
      include: 'node_modules/**',
      namedExports: { './node_module/invariant.js': ['default'] }
    }),
    babel({
      exclude: 'node_modules/**'
    }),
    replace({
      'process.env.NODE_ENV': JSON.stringify(env)
    }),
    isProduction && terser({
      compress: {
        pure_getters: true,
        unsafe: true,
        unsafe_comps: true,
        warnings: false
      }
    })
  ]
};
