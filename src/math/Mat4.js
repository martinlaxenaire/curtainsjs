/***
 Here we create a Mat4 class object
 This is a really basic Matrix4 class used for matrix calculations
 Highly based on https://github.com/mrdoob/three.js/blob/dev/src/math/Matrix4.js and http://glmatrix.net/docs/mat4.js.html

 params :
 @elements (Float32Array of length 16): our matrix array. Default to identity matrix.

 returns :
 @this: our Mat4 class object
 ***/

// TODO lot of (unused at the time) methods are missing

export class Mat4 {
    constructor(
        elements = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]),
    ) {
        this.type = "Mat4";
        this.elements = elements;
    }

    /***
     Sets the matrix values from an array

     params:
     @array (array): an array of at least 16 elements

     returns:
     @this (Mat4 class object): this matrix after being set
     ***/
    setFromArray(array) {
        for(let i = 0; i < this.elements.length; i++) {
            this.elements[i] = array[i];
        }

        return this;
    }

    /***
     Copy another Mat4

     params:
     @matrix (Mat4 class object): matrix to copy

     returns:
     @this (Mat4 class object): this matrix after copy
     ***/
    copy(matrix) {
        const array = matrix.elements;
        this.elements[0] = array[0];
        this.elements[1] = array[1];
        this.elements[2] = array[2];
        this.elements[3] = array[3];
        this.elements[4] = array[4];
        this.elements[5] = array[5];
        this.elements[6] = array[6];
        this.elements[7] = array[7];
        this.elements[8] = array[8];
        this.elements[9] = array[9];
        this.elements[10] = array[10];
        this.elements[11] = array[11];
        this.elements[12] = array[12];
        this.elements[13] = array[13];
        this.elements[14] = array[14];
        this.elements[15] = array[15];

        return this;
    }


    /***
     Clone a matrix

     returns:
     @clonedMatrix (Mat4 object): cloned matrix
     ***/
    clone() {
        return new Mat4().copy(this);
    }

    /***
     Simple matrix multiplication helper

     params:
     @matrix (Mat4 class object): Mat4 to multiply with

     returns:
     @result (Mat4 class object): Mat4 after multiplication
     ***/
    multiply(matrix) {
        const a = this.elements;
        const b = matrix.elements;

        let result = new Mat4();

        result.elements[0] = b[0] * a[0] + b[1] * a[4] + b[2] * a[8] + b[3] * a[12];
        result.elements[1] = b[0] * a[1] + b[1] * a[5] + b[2] * a[9] + b[3] * a[13];
        result.elements[2] = b[0] * a[2] + b[1] * a[6] + b[2] * a[10] + b[3] * a[14];
        result.elements[3] = b[0] * a[3] + b[1] * a[7] + b[2] * a[11] + b[3] * a[15];

        result.elements[4] = b[4] * a[0] + b[5] * a[4] + b[6] * a[8] + b[7] * a[12];
        result.elements[5] = b[4] * a[1] + b[5] * a[5] + b[6] * a[9] + b[7] * a[13];
        result.elements[6] = b[4] * a[2] + b[5] * a[6] + b[6] * a[10] + b[7] * a[14];
        result.elements[7] = b[4] * a[3] + b[5] * a[7] + b[6] * a[11] + b[7] * a[15];

        result.elements[8] = b[8] * a[0] + b[9] * a[4] + b[10] * a[8] + b[11] * a[12];
        result.elements[9] = b[8] * a[1] + b[9] * a[5] + b[10] * a[9] + b[11] * a[13];
        result.elements[10] = b[8] * a[2] + b[9] * a[6] + b[10] * a[10] + b[11] * a[14];
        result.elements[11] = b[8] * a[3] + b[9] * a[7] + b[10] * a[11] + b[11] * a[15];

        result.elements[12] = b[12] * a[0] + b[13] * a[4] + b[14] * a[8] + b[15] * a[12];
        result.elements[13] = b[12] * a[1] + b[13] * a[5] + b[14] * a[9] + b[15] * a[13];
        result.elements[14] = b[12] * a[2] + b[13] * a[6] + b[14] * a[10] + b[15] * a[14];
        result.elements[15] = b[12] * a[3] + b[13] * a[7] + b[14] * a[11] + b[15] * a[15];

        return result;
    }


    /***
     Get matrix inverse

     returns:
     @result (Mat4 class object): inverted Mat4
     ***/
    getInverse() {
        const te = this.elements;
        const out = new Mat4();
        const oe = out.elements;

        let a00 = te[0],
            a01 = te[1],
            a02 = te[2],
            a03 = te[3];

        let a10 = te[4],
            a11 = te[5],
            a12 = te[6],
            a13 = te[7];

        let a20 = te[8],
            a21 = te[9],
            a22 = te[10],
            a23 = te[11];

        let a30 = te[12],
            a31 = te[13],
            a32 = te[14],
            a33 = te[15];

        let b00 = a00 * a11 - a01 * a10;
        let b01 = a00 * a12 - a02 * a10;
        let b02 = a00 * a13 - a03 * a10;
        let b03 = a01 * a12 - a02 * a11;
        let b04 = a01 * a13 - a03 * a11;
        let b05 = a02 * a13 - a03 * a12;
        let b06 = a20 * a31 - a21 * a30;
        let b07 = a20 * a32 - a22 * a30;
        let b08 = a20 * a33 - a23 * a30;
        let b09 = a21 * a32 - a22 * a31;
        let b10 = a21 * a33 - a23 * a31;
        let b11 = a22 * a33 - a23 * a32;

        // Calculate the determinant

        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        if (!det) {
            return null;
        }
        det = 1 / det;

        oe[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        oe[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        oe[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        oe[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        oe[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        oe[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        oe[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        oe[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        oe[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        oe[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        oe[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        oe[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        oe[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        oe[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        oe[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        oe[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

        return out;
    }


    /***
     Simple Mat4 scaling helper

     params :
     @vector (Vec3 class object): Vec3 representing scale along X, Y and Z axis

     returns :
     @result (Mat4 class object): Mat4 after scaling
     ***/
    scale(vector) {
        let a = this.elements;
        let result = new Mat4();

        result.elements[0] = vector.x * a[0 * 4 + 0];
        result.elements[1] = vector.x * a[0 * 4 + 1];
        result.elements[2] = vector.x * a[0 * 4 + 2];
        result.elements[3] = vector.x * a[0 * 4 + 3];
        result.elements[4] = vector.y * a[1 * 4 + 0];
        result.elements[5] = vector.y * a[1 * 4 + 1];
        result.elements[6] = vector.y * a[1 * 4 + 2];
        result.elements[7] = vector.y * a[1 * 4 + 3];
        result.elements[8] = vector.z * a[2 * 4 + 0];
        result.elements[9] = vector.z * a[2 * 4 + 1];
        result.elements[10] = vector.z * a[2 * 4 + 2];
        result.elements[11] = vector.z * a[2 * 4 + 3];

        if(a !== result.elements) {
            result.elements[12] = a[12];
            result.elements[13] = a[13];
            result.elements[14] = a[14];
            result.elements[15] = a[15];
        }

        return result;
    }


    /***
     Creates a matrix from a quaternion rotation, vector translation and vector scale, rotating and scaling around the given origin
     Equivalent for applying translation, rotation and scale matrices but much faster
     Source code from: http://glmatrix.net/docs/mat4.js.html

     params :
     @translation (Vec3 class object): translation vector
     @quaternion (Quat class object): rotation quaternion
     @scale (Vec3 class object): scale vector
     @origin (Vec3 class object): origin vector around which to scale and rotate

     returns :
     @this (Mat4 class object): matrix after transformations
     ***/
    composeFromOrigin(translation, quaternion, scale, origin) {
        let matrix = this.elements;

        // Quaternion math
        const x = quaternion.elements[0], y = quaternion.elements[1], z = quaternion.elements[2], w = quaternion.elements[3];

        const x2 = x + x;
        const y2 = y + y;
        const z2 = z + z;

        const xx = x * x2;
        const xy = x * y2;
        const xz = x * z2;
        const yy = y * y2;
        const yz = y * z2;
        const zz = z * z2;

        const wx = w * x2;
        const wy = w * y2;
        const wz = w * z2;

        const sx = scale.x;
        const sy = scale.y;
        const sz = scale.z; // scale along Z is always equal to 1 anyway

        const ox = origin.x;
        const oy = origin.y;
        const oz = origin.z;

        const out0 = (1 - (yy + zz)) * sx;
        const out1 = (xy + wz) * sx;
        const out2 = (xz - wy) * sx;
        const out4 = (xy - wz) * sy;
        const out5 = (1 - (xx + zz)) * sy;
        const out6 = (yz + wx) * sy;
        const out8 = (xz + wy) * sz;
        const out9 = (yz - wx) * sz;
        const out10 = (1 - (xx + yy)) * sz;

        matrix[0] = out0;
        matrix[1] = out1;
        matrix[2] = out2;
        matrix[3] = 0;
        matrix[4] = out4;
        matrix[5] = out5;
        matrix[6] = out6;
        matrix[7] = 0;
        matrix[8] = out8;
        matrix[9] = out9;
        matrix[10] = out10;
        matrix[11] = 0;
        matrix[12] = translation.x + ox - (out0 * ox + out4 * oy + out8 * oz);
        matrix[13] = translation.y + oy - (out1 * ox + out5 * oy + out9 * oz);
        matrix[14] = translation.z + oz - (out2 * ox + out6 * oy + out10 * oz);
        matrix[15] = 1;

        return this;
    }
}