import {throwError} from '../utils/utils.js';

/***
 Here we create our Scene object
 The Scene will stack all the objects that will be drawn (planes and shader passes) in different arrays, and call them in the right order to be drawn.

 Based on the concept exposed here https://webglfundamentals.org/webgl/lessons/webgl-drawing-multiple-things.html
 The idea is to optimize the order of the rendered object so that the WebGL calls are kept to a strict minimum

 Planes will be placed in two groups: opaque (drawn first) and transparent (drawn last) objects
 We will also group them by their program IDs (planes that shares their programs are stacked together)

 params:
 @renderer (Renderer class object): our renderer class object

 returns :
 @this: our Scene
 ***/

export class Scene {
    constructor(renderer) {
        this.type = "Scene";
        if(!renderer || renderer.type !== "Renderer") {
            throwError(this.type + ": Renderer not passed as first argument", renderer);
        }
        else if(!renderer.gl) {
            throwError(this.type + ": Renderer WebGL context is undefined", renderer);
        }

        this.renderer = renderer;
        this.gl = renderer.gl;

        this.initStacks();
    }

    /***
     Init our Scene stacks object
     ***/
    initStacks() {
        this.stacks = {
            "opaque": {
                length: 0,
                programs: [],
                order: [],
            },
            "transparent": {
                length: 0,
                programs: [],
                order: [],
            },
            "renderPasses": [],
            "scenePasses": [],
        };
    }

    /*** RESET STACKS ***/

    /***
     Reset the plane stacks (used when disposing a plane)
     ***/
    resetPlaneStacks() {
        // clear the plane stacks
        this.stacks.opaque = {
            length: 0,
            programs: [],
            order: [],
        };

        this.stacks.transparent = {
            length: 0,
            programs: [],
            order: [],
        };

        // rebuild them with the new plane indexes
        for(let i = 0; i < this.renderer.planes.length; i++) {
            this.addPlane(this.renderer.planes[i]);
        }
    }

    /***
     Reset the shader pass stacks (used when disposing a shader pass)
     ***/
    resetShaderPassStacks() {
        // now rebuild the drawStacks
        // start by clearing all drawstacks
        this.stacks.scenePasses = [];
        this.stacks.renderPasses = [];

        // restack our planes with new indexes
        for(let i = 0; i < this.renderer.shaderPasses.length; i++) {
            this.renderer.shaderPasses[i].index = i;
            if(this.renderer.shaderPasses[i]._isScenePass) {
                this.stacks.scenePasses.push(this.renderer.shaderPasses[i].index);
            }
            else {
                this.stacks.renderPasses.push(this.renderer.shaderPasses[i].index);
            }
        }

        // reset the scenePassIndex if needed
        if(this.stacks.scenePasses.length === 0) {
            this.renderer.state.scenePassIndex = null;
        }
    }

    /*** ADDING PLANES ***/

    /***
     Add a new entry to our opaque and transparent programs arrays
     ***/
    initProgramStack(programID) {
        this.stacks["opaque"]["programs"]["program-" + programID] = [];
        this.stacks["transparent"]["programs"]["program-" + programID] = [];
    }

    /***
     This function will stack planes by opaqueness/transparency, program ID and then indexes
     Stack order drawing process:
     - draw opaque then transparent planes
     - for each of those two stacks, iterate through the existing programs (following the "order" array) and draw their respective planes
     This is done to improve speed, notably when using shared programs, and reduce GL calls

     params:
     @plane (Plane object): plane to add to our scene
     ***/
    addPlane(plane) {
        if(!this.stacks["opaque"]["programs"]["program-" + plane._program.id]) {
            this.initProgramStack(plane._program.id);
        }

        const stackType = plane._transparent ? "transparent" : "opaque";
        let stack = this.stacks[stackType];
        if(stackType === "transparent") {
            stack["programs"]["program-" + plane._program.id].unshift(plane.index);
            // push to the order array only if it's not already in there
            if(!stack["order"].includes(plane._program.id)) {
                stack["order"].unshift(plane._program.id);
            }
        }
        else {
            stack["programs"]["program-" + plane._program.id].push(plane.index);
            // push to the order array only if it's not already in there
            if(!stack["order"].includes(plane._program.id)) {
                stack["order"].push(plane._program.id);
            }
        }
        stack.length++;
    }

    /***
     This function will remove a plane from our scene. This just reset the plane stacks for now.
     Useful if we'd want to change the way our draw stacks work and keep the logic separated from our renderer

     params:
     @plane (Plane object): plane to remove from our scene
     ***/
    removePlane(plane) {
        this.resetPlaneStacks();
    }

    /***
     Changing the position of a plane inside the correct plane stack to render it on top of the others
     ***/
    movePlaneToFront(plane) {
        const drawType = plane._transparent ? "transparent" : "opaque";
        let stack = this.stacks[drawType]["programs"]["program-" + plane._program.id];

        stack = stack.filter(index => index !== plane.index);
        if(drawType === "transparent") {
            stack.unshift(plane.index);
        }
        else {
            stack.push(plane.index);
        }

        this.stacks[drawType]["programs"]["program-" + plane._program.id] = stack;

        // update order array
        this.stacks[drawType]["order"] = this.stacks[drawType]["order"].filter(programID => programID !== plane._program.id);
        this.stacks[drawType]["order"].push(plane._program.id);
    }

    /*** ADDING POST PROCESSING ***/

    /***
     Add a shader pass to the stack

     params:
     @shaderPass (ShaderPass object): shaderPass to add to our scene
     ***/
    addShaderPass(shaderPass) {
        if(!shaderPass._isScenePass) {
            this.stacks.renderPasses.push(shaderPass.index);
        }
        else {
            this.stacks.scenePasses.push(shaderPass.index);
        }
    }

    /***
     This function will remove a shader pass from our scene. This just reset the shaderPass stacks for now.
     Useful if we'd want to change the way our draw stacks work and keep the logic separated from our renderer

     params:
     @shaderPass (ShaderPass object): shader pass to remove from our scene
     ***/
    removeShaderPass(shaderPass) {
        this.resetShaderPassStacks();
    }

    /*** DRAWING SCENE ***/

    /***
     Loop through one of our stack (opaque or transparent objects) and draw its planes
     ***/
    drawStack(stackType) {
        for(let i = 0; i < this.stacks[stackType]["order"].length; i++) {
            const programID = this.stacks[stackType]["order"][i];
            const program = this.stacks[stackType]["programs"]["program-" + programID];
            for(let j = 0; j < program.length; j++) {
                const plane = this.renderer.planes[program[j]];
                // be sure the plane exists
                if(plane) {
                    // draw the plane
                    plane._startDrawing();
                }
            }
        }
    }

    /***
     Enable the first Shader pass scene pass
     ***/
    enableShaderPass() {
        if(this.stacks.scenePasses.length > 0 && this.stacks.renderPasses.length === 0) {
            this.renderer.state.scenePassIndex = 0;
            this.renderer.bindFrameBuffer(this.renderer.shaderPasses[this.stacks.scenePasses[0]].target);
        }
    }

    /***
     Draw the shader passes
     ***/
    drawShaderPasses() {
        // if we got one or multiple scene passes after the render passes, bind the first scene pass here
        if(this.stacks.scenePasses.length > 0 && this.stacks.renderPasses.length > 0) {
            this.renderer.state.scenePassIndex = 0;
            this.renderer.bindFrameBuffer(this.renderer.shaderPasses[this.stacks.scenePasses[0]].target);
        }

        // first the render passes
        for(let i = 0; i < this.stacks.renderPasses.length; i++) {
            this.renderer.shaderPasses[this.stacks.renderPasses[i]]._startDrawing();
        }

        // then the scene passes
        if(this.stacks.scenePasses.length > 0) {
            for(let i = 0; i < this.stacks.scenePasses.length; i++) {
                this.renderer.shaderPasses[this.stacks.scenePasses[i]]._startDrawing();
            }
        }
    }

    /***
     Draw our scene content
     ***/
    draw() {
        // enable first frame buffer for shader passes if needed
        this.enableShaderPass();

        // loop on our stacked planes
        this.drawStack("opaque");

        // draw transparent planes if needed
        if(this.stacks["transparent"].length) {
            // clear our depth buffer to display transparent objects
            this.gl.clearDepth(1.0);
            this.gl.clear(this.gl.DEPTH_BUFFER_BIT);

            this.drawStack("transparent");
        }

        // now render the shader passes
        this.drawShaderPasses();
    }
}