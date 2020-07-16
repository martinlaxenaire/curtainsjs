import {Uniforms} from './Uniforms.js';
import {throwError, throwWarning} from '../utils/utils.js';


/***
 Program class that creates, compiles and links the shaders
 Use a cache system to get already compiled shaders and save some CPU
 Also responsible for the creation, setting and updating of the uniforms (see Uniforms class object)

 params:
 @renderer (Renderer class object): our renderer class object

 @parent (Plane/ShaderPass class object): the mesh that will use that program
 @vertexShader (string): vertex shader as a string
 @fragmentShader (string): fragment shader as a string

 returns:
 @this: our newly created Program
 ***/
export class Program {
    constructor(renderer, {
        parent,
        vertexShader,
        fragmentShader,
    } = {}) {
        this.type = "Program";
        if(!renderer || renderer.type !== "Renderer") {
            throwError(this.type + ": Renderer not passed as first argument", renderer);
        }
        else if(!renderer.gl) {
            throwError(this.type + ": Renderer WebGL context is undefined", renderer);
        }
        this.renderer = renderer;
        this.gl = this.renderer.gl;

        this.parent = parent;
        this.vsCode = vertexShader;
        this.fsCode = fragmentShader;

        this.compiled = true;

        this.setupProgram();
    }

    /***
     Compile our WebGL shaders based on our written shaders

     params:
     @shaderCode (string): shader code
     @shaderType (shaderType): WebGL shader type (vertex or fragment)

     returns:
     @shader (compiled shader): our compiled shader
     ***/
    createShader(shaderCode, shaderType) {
        const shader = this.gl.createShader(shaderType);

        this.gl.shaderSource(shader, shaderCode);
        this.gl.compileShader(shader);

        // check shader compilation status only when not in production mode
        if(!this.renderer.production) {
            if(!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
                // shader debugging log as seen in THREE.js WebGLProgram source code
                const shaderTypeString = shaderType === this.gl.VERTEX_SHADER ? "vertex shader" : "fragment shader";
                const shaderSource = this.gl.getShaderSource(shader);
                let shaderLines = shaderSource.split('\n');

                for(let i = 0; i < shaderLines.length; i ++) {
                    shaderLines[i] = (i + 1) + ': ' + shaderLines[i];
                }
                shaderLines = shaderLines.join("\n");

                throwWarning(this.type + ": Errors occurred while compiling the", shaderTypeString, ":\n", this.gl.getShaderInfoLog(shader));
                throwError(shaderLines);

                this.compiled = false;

                return null;
            }
        }

        return shader;
    }


    /***
     Compiles and creates new shaders
     ***/
    useNewShaders() {
        this.vertexShader = this.createShader(this.vsCode, this.gl.VERTEX_SHADER);
        this.fragmentShader = this.createShader(this.fsCode, this.gl.FRAGMENT_SHADER);

        if(!this.vertexShader || !this.fragmentShader) {
            if(!this.renderer.production) throwWarning(this.type + ": Unable to find or compile the vertex or fragment shader");
        }
    };


    /***
     Checks whether the program has already been registered before creating it
     If yes, use the compiled program if the program should be shared, or just use the compiled shaders to create a new one else with createProgram()
     If not, compile the shaders and call createProgram()
     ***/
    setupProgram() {
        let existingProgram = this.renderer.cache.getProgramFromShaders(this.vsCode, this.fsCode);

        // we found an existing program
        if(existingProgram) {
            // if we've decided to share existing programs, just return the existing one
            if(this.parent.shareProgram) {
                //return existingProgram;
                this.shared = true;
                this.vertexShader = existingProgram.vertexShader;
                this.fragmentShader = existingProgram.fragmentShader;
                this.program = existingProgram.program;
                this.id = existingProgram.id;
                this.activeTextures = existingProgram.activeTextures;
            }
            else {
                // we need to create a new program but we don't have to re compile the shaders
                this.vertexShader = existingProgram.vertexShader;
                this.fragmentShader = existingProgram.fragmentShader;
                // copy active textures as well
                this.activeTextures = existingProgram.activeTextures;
                this.createProgram();
            }
        }
        else {
            // compile the new shaders and create a new program
            this.useNewShaders();
            if(this.compiled) {
                this.createProgram();
            }
        }
    }


    /***
     Used internally to set up program based on the created shaders and attach them to the program
     Sets a list of active textures that are actually used by the shaders to avoid binding unused textures during draw calls
     Add the program to the cache
     ***/
    createProgram() {
        // set program id and type
        this.id = this.renderer.cache.programs.length;
        this.shared = this.parent.shareProgram;

        // we need to create a new shader program
        this.program = this.gl.createProgram();

        // if shaders are valid, go on
        this.gl.attachShader(this.program, this.vertexShader);
        this.gl.attachShader(this.program, this.fragmentShader);
        this.gl.linkProgram(this.program);

        // free the shaders handles
        this.gl.deleteShader(this.vertexShader);
        this.gl.deleteShader(this.fragmentShader);

        // TODO getProgramParameter even in production to avoid errors?
        // check the shader program creation status only when not in production mode
        if(!this.renderer.production) {
            if(!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
                throwWarning(this.type + ": Unable to initialize the shader program.");

                this.compiled = false;

                return;
            }
        }

        // store active textures (those that are used in the shaders) to avoid binding unused textures
        if(!this.activeTextures) {
            this.activeTextures = [];
            // check for program active textures
            let numUniforms = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
            for(let i = 0; i < numUniforms; i++) {
                const activeUniform = this.gl.getActiveUniform(this.program, i);
                // if it's a texture add it to our activeTextures array
                if(activeUniform.type === this.gl.SAMPLER_2D) {
                    this.activeTextures.push(activeUniform.name);
                }
            }
        }

        // add it to our program manager programs list
        this.renderer.cache.addProgram(this);
    }


    /*** UNIFORMS ***/

    /***
     Creates and attach the uniform handlers to our program

     params:
     @uniforms (object): an object describing our uniforms (see Uniforms class object)
     ***/
    createUniforms(uniforms) {
        this.uniformsManager = new Uniforms(this.renderer, this.program, this.shared, uniforms);

        // set them right away
        this.setUniforms();
    }

    /***
     Sets our uniforms (used on init and on context restoration)
     ***/
    setUniforms() {
        // use this program
        this.renderer.useProgram(this);
        this.uniformsManager.setUniforms();
    }

    /***
     Updates our uniforms at each draw calls
     ***/
    updateUniforms() {
        // use this program
        this.renderer.useProgram(this);
        this.uniformsManager.updateUniforms();
    }
}