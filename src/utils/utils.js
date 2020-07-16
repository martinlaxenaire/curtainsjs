/***
 Throw a console warning with the passed arguments
 ***/
export function throwWarning() {
    const args = Array.prototype.slice.call(arguments);
    console.warn.apply(console, args);
}


/***
 Throw a console error with the passed arguments
 ***/
export function throwError() {
    const args = Array.prototype.slice.call(arguments);
    console.error.apply(console, args);
}


/***
 Generates an universal unique identifier
 ***/
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16).toUpperCase();
    });
}


/***
 Check whether a number is power of 2

 params:
 @value (float): number to check
 ***/
export function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}


/***
 Linear interpolation between two numbers

 params:
 @start (float): value to lerp
 @end (float): end value to use for lerp
 @amount (float): amount of lerp
 ***/
export function lerp(start, end, amount) {
    return (1 - amount) * start + amount * end;
}