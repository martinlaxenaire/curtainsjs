import precisionMedium from './chunks/precision.medium.glsl.js';
import defaultAttributes from './chunks/default.attributes.glsl.js';
import defaultVaryings from './chunks/default.varyings.glsl.js';

const shaderPassVS = precisionMedium + defaultAttributes + defaultVaryings + `
void main() {
    vTextureCoord = aTextureCoord;
    vVertexPosition = aVertexPosition;
    
    gl_Position = vec4(aVertexPosition, 1.0);
}
`;
export default shaderPassVS.replace(/\n/g, '');