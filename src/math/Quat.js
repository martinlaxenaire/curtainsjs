/***
 Here we create a Quat class object
 This is a really basic Quaternion class used for rotation calculations
 Highly based on https://github.com/mrdoob/three.js/blob/dev/src/math/Quaternion.js

 params :
 @elements (Float32Array of length 4): our quaternion array. Default to identity quaternion.

 returns :
 @this: our Quat class object
 ***/

// TODO handle other axis orders in setFromVec3()
// TODO lot of (unused at the time) methods are missing

export class Quat {
    constructor(
        elements = new Float32Array([0, 0, 0, 1])
    ) {
        this.type = "Quat";
        this.elements = elements;
    }

    /***
     Sets the quaternion values from an array

     params:
     @array (array): an array of at least 4 elements
     ***/
    setFromArray(array) {
        this.elements[0] = array[0];
        this.elements[1] = array[1];
        this.elements[2] = array[2];
        this.elements[3] = array[3];
    }

    /***
     Sets a rotation quaternion using Euler angles and XYZ as axis order

     params:
     @vector (Vec3 class object): rotation vector to set our quaternion from
     @order (string): rotation axis order. Default to "XYZ"

     returns :
     @this (Quat class object): quaternion after having applied the rotation
     ***/
    setFromVec3(vector, order) {
        const ax = vector.x * 0.5;
        const ay = vector.y * 0.5;
        const az = vector.z * 0.5;

        const sinx = Math.sin(ax);
        const cosx = Math.cos(ax);
        const siny = Math.sin(ay);
        const cosy = Math.cos(ay);
        const sinz = Math.sin(az);
        const cosz = Math.cos(az);

        // XYZ order
        if(!order || order === "XYZ") {
            this.elements[0] = sinx * cosy * cosz + cosx * siny * sinz;
            this.elements[1] = cosx * siny * cosz - sinx * cosy * sinz;
            this.elements[2] = cosx * cosy * sinz + sinx * siny * cosz;
            this.elements[3] = cosx * cosy * cosz - sinx * siny * sinz;
        }

        return this;
    }
}