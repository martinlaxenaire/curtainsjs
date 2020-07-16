import precisionMedium from './chunks/precision.medium.glsl.js';
import defaultVaryings from './chunks/default.varyings.glsl.js';

const shaderPassFS = precisionMedium + defaultVaryings + `
uniform sampler2D uRenderTexture;

void main() {
    gl_FragColor = texture2D(uRenderTexture, vTextureCoord);
}
`;
export default shaderPassFS.replace(/\n/g, '');