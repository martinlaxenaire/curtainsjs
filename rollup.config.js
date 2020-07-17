import babel from '@rollup/plugin-babel';
import {terser} from 'rollup-plugin-terser';

export default [{
    input: 'src/index.mjs',
    output: [
        {
            file: 'dist/curtainsjs.umd.js',
            format: 'umd',
            name: 'Curtains',
            plugins: [
                babel({
                    allowAllFormats: true,
                    babelrc: false,
                    presets: [
                        '@babel/preset-env',
                        {
                            modules: 'umd'
                        }
                    ]
                })
            ]
        },
        {
            file: 'dist/curtainsjs.umd.min.js',
            format: 'esm',
            name: 'Curtains',
            plugins: [
                babel({
                    allowAllFormats: true,
                    babelrc: false,
                    presets: [
                        '@babel/preset-env',
                        {
                            modules: 'umd'
                        }
                    ]
                }),
                terser()
            ]
        },
    ],
}];