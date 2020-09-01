import precisionMedium from './chunks/precision.medium.glsl.js';
import defaultAttributes from './chunks/default.attributes.glsl.js';
import defaultVaryings from './chunks/default.varyings.glsl.js';

const planeVS = precisionMedium + defaultAttributes + defaultVaryings + `
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

void main() {
    vTextureCoord = aTextureCoord;
    vVertexPosition = aVertexPosition;
    
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
}
`;
export default planeVS.replace(/\n/g, '');