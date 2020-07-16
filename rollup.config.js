// TODO rollup local + babel
import {terser} from 'rollup-plugin-terser';

export default [{
    input: 'src/index.mjs',
    output: [
        {
            file: 'dist/curtainsjs.umd.js',
            format: 'umd',
            name: 'Curtains'
        },
        {
            file: 'dist/curtainsjs.umd.min.js',
            format: 'umd',
            name: 'Curtains',
            plugins: [terser()]
        },
        {
            file: 'dist/curtainsjs.esm.min.js',
            format: 'es',
            plugins: [terser()]
        },
    ],
}];