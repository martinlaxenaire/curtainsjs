/***
 Here we create a Vec3 class object
 This is a really basic Vector3 class used for vector calculations
 Highly based on https://github.com/mrdoob/three.js/blob/dev/src/math/Vector3.js and http://glmatrix.net/docs/vec3.js.html

 params :
 @x (float): X component of our vector
 @y (float): Y component of our vector
 @z (float): Z component of our vector

 returns :
 @this: our Vec3 class object
 ***/

// TODO lot of (unused at the time) methods are missing

export class Vec3 {
    constructor(
        x = 0,
        y = 0,
        z = 0,
    ) {
        this.type = "Vec3";
        this.set(x, y, z);
    }

    /***
     Sets the vector from values

     params:
     @x (float): X component of our vector
     @y (float): Y component of our vector
     @z (float): Z component of our vector
     ***/
    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }


    /***
     Adds a vector to this vector

     params:
     @vector (Vec3): vector to add

     returns:
     @this (Vec3): this vector after addition
     ***/
    add(vector) {
        this.x += vector.x;
        this.y += vector.y;
        this.z += vector.z;

        return this;
    }


    /***
     Adds a scalar to this vector

     params:
     @value (float): number to add

     returns:
     @this (Vec3): this vector after addition
     ***/
    addScalar(value) {
        this.x += value;
        this.y += value;
        this.z += value;

        return this;
    }


    /***
     Subtracts a vector from this vector

     params:
     @vector (Vec3): vector to use for subtraction

     returns:
     @this (Vec3): this vector after subtraction
     ***/
    sub(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
        this.z -= vector.z;

        return this;
    }


    /***
     Subtracts a scalar to this vector

     params:
     @value (float): number to use for subtraction

     returns:
     @this (Vec3): this vector after subtraction
     ***/
    subScalar(value) {
        this.x -= value;
        this.y -= value;
        this.z -= value;

        return this;
    }


    /***
     Copy a vector into this vector

     params:
     @vector (Vec3): vector to copy

     returns:
     @this (Vec3): this vector after copy
     ***/
    copy(vector) {
        this.x = vector.x;
        this.y = vector.y;
        this.z = vector.z;

        return this;
    }


    /***
     Clone this vector

     returns:
     @vector (Vec3): cloned vector
     ***/
    clone() {
        return new Vec3(this.x, this.y, this.z);
    }


    /***
     Checks if 2 vectors are equal

     returns:
     @isEqual (bool): whether the vectors are equals or not
     ***/
    equals(vector) {
        return this.x === vector.x && this.y === vector.y && this.z === vector.z;
    }


    /***
     Normalize this vector

     returns:
     @this (Vec3): normalized vector
     ***/
    normalize() {
        // normalize
        let len = this.x * this.x + this.y * this.y + this.z * this.z;
        if (len > 0) {
            len = 1 / Math.sqrt(len);
        }
        this.x *= len;
        this.y *= len;
        this.z *= len;

        return this;
    }


    /***
     Calculates the dot product of 2 vectors

     returns:
     @dotProduct (float): dot product of the 2 vectors
     ***/
    dot(vector) {
        return this.x * vector.x + this.y * vector.y + this.z * vector.z;
    }

    /***
     Apply a matrix 4 to a point (vec3)
     Useful to convert a point position from plane local world to webgl space using projection view matrix for example
     Source code from: http://glmatrix.net/docs/vec3.js.html

     params :
     @matrix (array): 4x4 matrix used

     returns :
     @this (Vec3): this vector after matrix application
     ***/
    applyMat4(matrix) {
        const x = this.x, y = this.y, z = this.z;
        const mArray = matrix.elements;

        let w = mArray[3] * x + mArray[7] * y + mArray[11] * z + mArray[15];
        w = w || 1;

        this.x = (mArray[0] * x + mArray[4] * y + mArray[8] * z + mArray[12]) / w;
        this.y = (mArray[1] * x + mArray[5] * y + mArray[9] * z + mArray[13]) / w;
        this.z = (mArray[2] * x + mArray[6] * y + mArray[10] * z + mArray[14]) / w;

        return this;
    }
}