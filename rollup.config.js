import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import {terser} from 'rollup-plugin-terser';

export default [{
    input: 'src/index.mjs',
    output: [
        {
            file: 'dist/curtains.umd.js',
            format: 'umd',
            name: 'Curtains',
            plugins: [
                getBabelOutputPlugin({
                    allowAllFormats: true,
                    babelrc: false,
                    presets: [
                        '@babel/preset-env',
                    ]
                })
            ]
        },
        {
            file: 'dist/curtains.umd.min.js',
            format: 'umd',
            name: 'Curtains',
            plugins: [
                getBabelOutputPlugin({
                    allowAllFormats: true,
                    babelrc: false,
                    presets: [
                        '@babel/preset-env',
                    ]
                }),
                terser()
            ]
        },
    ],
}];