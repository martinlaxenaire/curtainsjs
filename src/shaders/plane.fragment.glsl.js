import precisionMedium from './chunks/precision.medium.glsl.js';
import defaultVaryings from './chunks/default.varyings.glsl.js';

const planeFS = precisionMedium + defaultVaryings + `
void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;
export default planeFS.replace(/\n/g, '');