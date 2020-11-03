import {throwError, throwWarning} from '../utils/utils.js';

/***
 Uniforms class manages uniforms setting and updating

 params:
 @renderer (Renderer class object): our renderer class object
 @program (object): our mesh's Program (see Program class object)
 @shared (bool): whether the program is shared or not

 @uniforms (object): our uniforms object:
 - name (string): uniform name to use in your shaders
 - type (uniform type): uniform type. Will try to detect it if not set (see https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/uniform)
 - value (float / int / Vec2 / Vec3 / Mat4 / array): initial value of the uniform

 returns:
 @this: our Uniforms manager
 ***/

export class Uniforms {
    constructor(renderer, program, shared, uniforms) {
        this.type = "Uniforms";
        if(!renderer || renderer.type !== "Renderer") {
            throwError(this.type + ": Renderer not passed as first argument", renderer);
        }
        else if(!renderer.gl) {
            throwError(this.type + ": Renderer WebGL context is undefined", renderer);
        }
        this.renderer = renderer;
        this.gl = renderer.gl;
        this.program = program;
        this.shared = shared;

        this.uniforms = {};

        if(uniforms) {
            for(const key in uniforms) {
                const uniform = uniforms[key];

                // fill our uniform object
                this.uniforms[key] = {
                    name: uniform.name,
                    type: uniform.type,
                    // clone value if possible, use original value else
                    value: uniform.value.clone && typeof uniform.value.clone === "function" ? uniform.value.clone() : uniform.value,
                    update: null,
                };
            }
        }
    }

    /***
     Set uniforms WebGL function based on their types

     params :
     @uniform (object): the uniform
     ***/
    handleUniformSetting(uniform) {
        switch(uniform.type) {
            case "1i":
                uniform.update = this.setUniform1i.bind(this);
                break;
            case "1iv":
                uniform.update = this.setUniform1iv.bind(this);
                break;
            case "1f":
                uniform.update = this.setUniform1f.bind(this);
                break;
            case "1fv":
                uniform.update = this.setUniform1fv.bind(this);
                break;

            case "2i":
                uniform.update = this.setUniform2i.bind(this);
                break;
            case "2iv":
                uniform.update = this.setUniform2iv.bind(this);
                break;
            case "2f":
                uniform.update = this.setUniform2f.bind(this);
                break;
            case "2fv":
                uniform.update = this.setUniform2fv.bind(this);
                break;

            case "3i":
                uniform.update = this.setUniform3i.bind(this);
                break;
            case "3iv":
                uniform.update = this.setUniform3iv.bind(this);
                break;
            case "3f":
                uniform.update = this.setUniform3f.bind(this);
                break;
            case "3fv":
                uniform.update = this.setUniform3fv.bind(this);
                break;

            case "4i":
                uniform.update = this.setUniform4i.bind(this);
                break;
            case "4iv":
                uniform.update = this.setUniform4iv.bind(this);
                break;
            case "4f":
                uniform.update = this.setUniform4f.bind(this);
                break;
            case "4fv":
                uniform.update = this.setUniform4fv.bind(this);
                break;

            case "mat2":
                uniform.update = this.setUniformMatrix2fv.bind(this);
                break;
            case "mat3":
                uniform.update = this.setUniformMatrix3fv.bind(this);
                break;
            case "mat4":
                uniform.update = this.setUniformMatrix4fv.bind(this);
                break;

            default:
                if(!this.renderer.production) throwWarning(this.type + ": This uniform type is not handled : ", uniform.type);
        }
    }


    /***
     Auto detect the format of the uniform (check if its a float, an integer, a Vector, a Matrix, an array...)
     Also set a lastValue property that we'll use to compare to our value property and update the uniform if it changed

     params :
     @uniform (object): the uniform
     ***/
    setInternalFormat(uniform) {
        if(uniform.value.type === "Vec2") {
            uniform._internalFormat = "Vec2";
            uniform.lastValue = uniform.value.clone();
        }
        else if(uniform.value.type === "Vec3") {
            uniform._internalFormat = "Vec3";
            uniform.lastValue = uniform.value.clone();
        }
        else if(uniform.value.type === "Mat4") {
            uniform._internalFormat = "Mat4";
            uniform.lastValue = uniform.value.clone();
        }
        else if(uniform.value.type === "Quat") {
            uniform._internalFormat = "Quat";
            uniform.lastValue = uniform.value.clone();
        }
        else if(Array.isArray(uniform.value)) {
            uniform._internalFormat = "array";
            uniform.lastValue = Array.from(uniform.value);
        }
        else if(uniform.value.constructor === Float32Array) {
            uniform._internalFormat = "mat";
            uniform.lastValue = uniform.value;
        }
        else {
            uniform._internalFormat = "float";
            uniform.lastValue = uniform.value;
        }
    }

    /***
     This inits our uniforms
     Sets its internal format and type if not provided then upload the uniform
     ***/
    setUniforms() {
        // set our uniforms if we got some
        if(this.uniforms) {
            for(const key in this.uniforms) {
                let uniform = this.uniforms[key];

                // set our uniform location
                uniform.location = this.gl.getUniformLocation(this.program, uniform.name);

                // handle Vec2, Vec3, Mat4, floats, arrays, etc
                if(!uniform._internalFormat) {
                    this.setInternalFormat(uniform);
                }

                if(!uniform.type) {
                    if(uniform._internalFormat === "Vec2") {
                        uniform.type = "2f";
                    }
                    else if(uniform._internalFormat === "Vec3") {
                        uniform.type = "3f";
                    }
                    else if(uniform._internalFormat === "Mat4") {
                        uniform.type = "mat4";
                    }
                    else if(uniform._internalFormat === "array") {
                        if(uniform.value.length === 4) {
                            uniform.type = "4f";

                            if(!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a 4f (array of 4 floats) uniform type");
                        }
                        else if(uniform.value.length === 3) {
                            uniform.type = "3f";

                            if(!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a 3f (array of 3 floats) uniform type");
                        }
                        else if(uniform.value.length === 2) {
                            uniform.type = "2f";

                            if(!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a 2f (array of 2 floats) uniform type");
                        }
                    }
                    else if(uniform._internalFormat === "mat") {
                        if(uniform.value.length === 16) {
                            uniform.type = "mat4";

                            if(!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a mat4 (4x4 matrix array) uniform type");
                        }
                        else if(uniform.value.length === 9) {
                            uniform.type = "mat3";

                            if(!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a mat3 (3x3 matrix array) uniform type");
                        }
                        else  if(uniform.value.length === 4) {
                            uniform.type = "mat2";

                            if(!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a mat2 (2x2 matrix array) uniform type");
                        }
                    }
                    else {
                        uniform.type = "1f";

                        if(!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a 1f (float) uniform type");
                    }
                }

                // set the uniforms update functions
                this.handleUniformSetting(uniform);

                // update the uniform
                uniform.update && uniform.update(uniform);
            }
        }
    }


    /***
     This updates all uniforms of an object that were set by the user
     It is called at each draw call
     ***/
    updateUniforms() {
        if(this.uniforms) {
            for(const key in this.uniforms) {
                const uniform = this.uniforms[key];
                let shouldUpdate = false;

                if(!this.shared) {
                    if(uniform._internalFormat === "Vec2") {
                        if(!uniform.value.equals(uniform.lastValue)) {
                            shouldUpdate = true;
                            uniform.lastValue.copy(uniform.value);
                        }
                    }
                    else if(uniform._internalFormat === "Vec3") {
                        if(!uniform.value.equals(uniform.lastValue)) {
                            shouldUpdate = true;
                            uniform.lastValue.copy(uniform.value);
                        }
                    }
                    else if(uniform._internalFormat === "Quat") {
                        if(!uniform.value.equals(uniform.lastValue)) {
                            shouldUpdate = true;
                            uniform.lastValue.copy(uniform.value);
                        }
                    }
                    else if(!uniform.value.length) {
                        if(uniform.value !== uniform.lastValue) {
                            shouldUpdate = true;
                            uniform.lastValue = uniform.value;
                        }
                    }
                    else if(JSON.stringify(uniform.value) !== JSON.stringify(uniform.lastValue)) { // compare two arrays
                        shouldUpdate = true;
                        // copy array
                        uniform.lastValue = Array.from(uniform.value);
                    }
                }
                else {
                    shouldUpdate = true;
                }

                if(shouldUpdate) {
                    // update our uniforms
                    uniform.update && uniform.update(uniform);
                }
            }
        }
    }


    /***
     Use appropriate WebGL uniform setting function based on the uniform type

     params :
     @uniform (object): the uniform
     ***/
    setUniform1i(uniform) {
        this.gl.uniform1i(uniform.location, uniform.value);
    }

    setUniform1iv(uniform) {
        this.gl.uniform1iv(uniform.location, uniform.value);
    }

    setUniform1f(uniform) {
        this.gl.uniform1f(uniform.location, uniform.value);
    }

    setUniform1fv(uniform) {
        this.gl.uniform1fv(uniform.location, uniform.value);
    }


    setUniform2i(uniform) {
        uniform._internalFormat === "Vec2" ?
            this.gl.uniform2i(uniform.location, uniform.value.x, uniform.value.y)
            : this.gl.uniform2i(uniform.location, uniform.value[0], uniform.value[1]);
    }

    setUniform2iv(uniform) {
        uniform._internalFormat === "Vec2" ?
            this.gl.uniform2iv(uniform.location, [uniform.value.x, uniform.value.y])
            : this.gl.uniform2iv(uniform.location, uniform.value);
    }

    setUniform2f(uniform) {
        uniform._internalFormat === "Vec2" ?
            this.gl.uniform2f(uniform.location, uniform.value.x, uniform.value.y)
            : this.gl.uniform2f(uniform.location, uniform.value[0], uniform.value[1]);
    }

    setUniform2fv(uniform) {
        uniform._internalFormat === "Vec2" ?
            this.gl.uniform2fv(uniform.location, [uniform.value.x, uniform.value.y])
            : this.gl.uniform2fv(uniform.location, uniform.value);
    }


    setUniform3i(uniform) {
        uniform._internalFormat === "Vec3" ?
            this.gl.uniform3i(uniform.location, uniform.value.x, uniform.value.y, uniform.value.z)
            : this.gl.uniform3i(uniform.location, uniform.value[0], uniform.value[1], uniform.value[2]);
    }

    setUniform3iv(uniform) {
        uniform._internalFormat === "Vec3" ?
            this.gl.uniform3iv(uniform.location, [uniform.value.x, uniform.value.y, uniform.value.z])
            : this.gl.uniform3iv(uniform.location, uniform.value);
    }

    setUniform3f(uniform) {
        uniform._internalFormat === "Vec3" ?
            this.gl.uniform3f(uniform.location, uniform.value.x, uniform.value.y, uniform.value.z)
            : this.gl.uniform3f(uniform.location, uniform.value[0], uniform.value[1], uniform.value[2]);
    }

    setUniform3fv(uniform) {
        uniform._internalFormat === "Vec3" ?
            this.gl.uniform3fv(uniform.location, [uniform.value.x, uniform.value.y, uniform.value.z])
            : this.gl.uniform3fv(uniform.location, uniform.value);
    }


    setUniform4i(uniform) {
        uniform._internalFormat === "Quat" ?
            this.gl.uniform4i(uniform.location, uniform.value.elements[0], uniform.value.elements[1], uniform.value.elements[2], uniform.value[3])
            : this.gl.uniform4i(uniform.location, uniform.value[0], uniform.value[1], uniform.value[2], uniform.value[3]);
    }

    setUniform4iv(uniform) {
        uniform._internalFormat === "Quat" ?
            this.gl.uniform4iv(uniform.location, [uniform.value.elements[0], uniform.value.elements[1], uniform.value.elements[2], uniform.value[3]])
            : this.gl.uniform4iv(uniform.location, uniform.value);
    }

    setUniform4f(uniform) {
        uniform._internalFormat === "Quat" ?
            this.gl.uniform4f(uniform.location, uniform.value.elements[0], uniform.value.elements[1], uniform.value.elements[2], uniform.value[3])
            : this.gl.uniform4f(uniform.location, uniform.value[0], uniform.value[1], uniform.value[2], uniform.value[3]);
    }

    setUniform4fv(uniform) {
        uniform._internalFormat === "Quat" ?
            this.gl.uniform4fv(uniform.location, [uniform.value.elements[0], uniform.value.elements[1], uniform.value.elements[2], uniform.value[3]])
            : this.gl.uniform4fv(uniform.location, uniform.value);
    }


    setUniformMatrix2fv(uniform) {
        this.gl.uniformMatrix2fv(uniform.location, false, uniform.value);
    }

    setUniformMatrix3fv(uniform) {
        this.gl.uniformMatrix3fv(uniform.location, false, uniform.value);
    }

    setUniformMatrix4fv(uniform) {
        uniform._internalFormat === "Mat4" ?
            this.gl.uniformMatrix4fv(uniform.location, false, uniform.value.elements)
            : this.gl.uniformMatrix4fv(uniform.location, false, uniform.value);
    }
}