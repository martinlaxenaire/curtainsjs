/***
 Here we create a Vec2 class object
 This is a really basic Vector2 class used for vector calculations
 Highly based on https://github.com/mrdoob/three.js/blob/dev/src/math/Vector2.js and http://glmatrix.net/docs/vec2.js.html

 params :
 @x (float): X component of our vector
 @y (float): Y component of our vector

 returns :
 @this: our Vec2 class object
 ***/

// TODO lot of (unused at the time) methods are missing

export class Vec2 {
    constructor(
        x = 0,
        y = x,
    ) {
        this.type = "Vec2";

        this._x = x;
        this._y = y;
    }

    /***
     Getters and setters (with onChange callback)
     ***/
    get x() {
        return this._x;
    }

    get y() {
        return this._y;
    }

    set x(value) {
        const changed = value !== this._x;
        this._x = value;
        changed && this._onChangeCallback && this._onChangeCallback();
    }

    set y(value) {
        const changed = value !== this._y;
        this._y = value;
        changed && this._onChangeCallback && this._onChangeCallback();
    }

    onChange(callback) {
        if(callback) {
            this._onChangeCallback = callback;
        }
    }

    /***
     Sets the vector from values

     params:
     @x (float): X component of our vector
     @y (float): Y component of our vector

     returns:
     @this (Vec2): this vector after being set
     ***/
    set(x, y) {
        this._x = x;
        this._y = y;

        return this;
    }

    /***
     Adds a vector to this vector

     params:
     @vector (Vec2): vector to add

     returns:
     @this (Vec2): this vector after addition
     ***/
    add(vector) {
        this._x += vector.x;
        this._y += vector.y;

        return this;
    }


    /***
     Adds a scalar to this vector

     params:
     @value (float): number to add

     returns:
     @this (Vec2): this vector after addition
     ***/
    addScalar(value) {
        this._x += value;
        this._y += value;

        return this;
    }


    /***
     Subtracts a vector from this vector

     params:
     @vector (Vec2): vector to use for subtraction

     returns:
     @this (Vec2): this vector after subtraction
     ***/
    sub(vector) {
        this._x -= vector.x;
        this._y -= vector.y;

        return this;
    }


    /***
     Subtracts a scalar to this vector

     params:
     @value (float): number to use for subtraction

     returns:
     @this (Vec2): this vector after subtraction
     ***/
    subScalar(value) {
        this._x -= value;
        this._y -= value;

        return this;
    }


    /***
     Multiplies a vector with this vector

     params:
     @vector (Vec2): vector to use for multiplication

     returns:
     @this (Vec2): this vector after multiplication
     ***/
    multiply(vector) {
        this._x *= vector.x;
        this._y *= vector.y;

        return this;
    }


    /***
     Multiplies a scalar with this vector

     params:
     @value (float): number to use for multiplication

     returns:
     @this (Vec2): this vector after multiplication
     ***/
    multiplyScalar(value) {
        this._x *= value;
        this._y *= value;

        return this;
    }


    /***
     Copy a vector into this vector

     params:
     @vector (Vec2): vector to copy

     returns:
     @this (Vec2): this vector after copy
     ***/
    copy(vector) {
        this._x = vector.x;
        this._y = vector.y;

        return this;
    }


    /***
     Clone this vector

     returns:
     @vector (Vec2): cloned vector
     ***/
    clone() {
        return new Vec2(this._x, this._y);
    }


    /***
     Merges this vector with a vector when values are NaN. Mostly used internally.

     params:
     @vector (Vec2): vector to use for sanitization

     returns:
     @vector (Vec2): sanitized vector
     ***/
    sanitizeNaNValuesWith(vector) {
        this._x = isNaN(this._x) ? vector.x : parseFloat(this._x);
        this._y = isNaN(this._y) ? vector.y : parseFloat(this._y);

        return this;
    }


    /***
     Apply max values to this vector

     params:
     @vector (Vec2): vector representing max values

     returns:
     @vector (Vec2): vector with max values applied
     ***/
    max(vector) {
        this._x = Math.max(this._x, vector.x);
        this._y = Math.max(this._y, vector.y);

        return this;
    }


    /***
     Apply min values to this vector

     params:
     @vector (Vec2): vector representing min values

     returns:
     @vector (Vec2): vector with min values applied
     ***/
    min(vector) {
        this._x = Math.min(this._x, vector.x);
        this._y = Math.min(this._y, vector.y);

        return this;
    }


    /***
     Checks if 2 vectors are equal

     params:
     @vector (Vec2): vector to compare

     returns:
     @isEqual (bool): whether the vectors are equals or not
     ***/
    equals(vector) {
        return this._x === vector.x && this._y === vector.y;
    }


    /***
     Normalize this vector

     returns:
     @this (Vec2): normalized vector
     ***/
    normalize() {
        // normalize
        let len = this._x * this._x + this._y * this._y;
        if (len > 0) {
            len = 1 / Math.sqrt(len);
        }
        this._x *= len;
        this._y *= len;

        return this;
    }


    /***
     Calculates the dot product of 2 vectors

     params:
     @vector (Vec2): vector to use for dot product

     returns:
     @dotProduct (float): dot product of the 2 vectors
     ***/
    dot(vector) {
        return this._x * vector.x + this._y * vector.y;
    }
}