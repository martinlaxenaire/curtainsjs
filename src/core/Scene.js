import {throwError} from '../utils/utils.js';

/***
 Here we create our Scene object
 The Scene will stack all the objects that will be drawn (planes and shader passes) in different arrays, and call them in the right order to be drawn.

 Based on the concept exposed here https://webgl2fundamentals.org/webgl/lessons/webgl-drawing-multiple-things.html
 The idea is to optimize the order of the rendered object so that the WebGL calls are kept to a strict minimum

 Here's the whole draw process order:
 - first we draw the ping pong planes
 - if needed, we bind the first scene pass frame buffer
 - draw all the planes that are rendered onto a render target (render pass)
 - draw the planes from the first render target created, ordered by their renderOrder then indexes (first added first drawn) order
 - draw the planes from the second render target created, etc.
 - draw the render passes content (depth buffer is cleared after each pass)
 - draw the transparent planes ordered by renderOrder, Z positions, geometry IDs and then indexes (first added first drawn)
 - draw the opaque planes ordered by renderOrder, geometry IDs and then indexes (first added first drawn)
 - draw the scene passes content

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
            // planes
            "pingPong": [],
            "renderTargets": [],
            "opaque": [],
            "transparent": [],

            // post processing
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
        this.stacks.pingPong = [];
        this.stacks.renderTargets = [];
        this.stacks.opaque = [];
        this.stacks.transparent = [];

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
                this.stacks.scenePasses.push(this.renderer.shaderPasses[i]);
            }
            else {
                this.stacks.renderPasses.push(this.renderer.shaderPasses[i]);
            }
        }

        // reset the scenePassIndex if needed
        if(this.stacks.scenePasses.length === 0) {
            this.renderer.state.scenePassIndex = null;
        }
    }

    /*** ADDING PLANES ***/


    /***
     Add a plane to our renderTargets stack

     params:
     @plane (Plane object): plane to add to our stack
     ***/
    addToRenderTargetsStack(plane) {
        // find all planes that are rendered onto a render target
        const renderTargetsPlanes = this.renderer.planes.filter(el => el.type !== "PingPongPlane" && el.target && el.uuid !== plane.uuid);

        // is there any plane that is already rendered onto that plane's render target?
        let siblingPlaneIndex = -1;
        if(plane.target._depth) {
            // findLastIndex
            for (let i = renderTargetsPlanes.length - 1; i >= 0; i--) {
                if (renderTargetsPlanes[i].target.uuid === plane.target.uuid) {
                    siblingPlaneIndex = i + 1;
                    break;
                }
            }
        }
        else {
            // findIndex
            siblingPlaneIndex = renderTargetsPlanes.findIndex(el => el.target.uuid === plane.target.uuid);
        }

        // if findIndex returned -1, just push the plane
        siblingPlaneIndex = Math.max(0, siblingPlaneIndex);
        renderTargetsPlanes.splice(siblingPlaneIndex, 0, plane);

        // sort by index (order of addition) then render order, depending on whether the render target handle depth or not
        if(plane.target._depth) {
            renderTargetsPlanes.sort((a, b) => a.index - b.index);
            renderTargetsPlanes.sort((a, b) => b.renderOrder - a.renderOrder);
        }
        else {
            renderTargetsPlanes.sort((a, b) => b.index - a.index);
            renderTargetsPlanes.sort((a, b) => a.renderOrder - b.renderOrder);
        }

        // sort by render targets order
        renderTargetsPlanes.sort((a, b) => a.target.index - b.target.index);

        this.stacks.renderTargets = renderTargetsPlanes;
    }


    /***
     Rebuilds our regular stack (transparent or opaque) with our plane added, geometry IDs and then indexes (first added first drawn)

     params:
     @plane (Plane object): plane to add to our stack

     returns:
     @planeStack (array): our transparent or opaque stack ready to be applied custom sorting filter
     ***/
    addToRegularPlaneStack(plane) {
        // get all planes that have same transparency
        const planeStack = this.renderer.planes.filter(el => el.type !== "PingPongPlane" && !el.target && el._transparent === plane._transparent && el.uuid !== plane.uuid);

        // find if there's already a plane with the same geometry with a findLastIndex function
        let siblingPlaneIndex = -1;

        for(let i = planeStack.length - 1; i >= 0; i--) {
            if(planeStack[i]._geometry.definition.id === plane._geometry.definition.id) {
                siblingPlaneIndex = i + 1;
                break;
            }
        }

        // if findIndex returned -1 (no matching geometry or program)
        siblingPlaneIndex = Math.max(0, siblingPlaneIndex);

        // add it to our stack plane array
        planeStack.splice(siblingPlaneIndex, 0, plane);

        // sort by indexes
        planeStack.sort((a, b) => a.index - b.index);

        return planeStack;
    }

    /***
     This function will add a plane into one of our 4 stacks : pingPong, renderTargets, transparent and opaque
     - pingPong is just a simple array (ordered by order of creation)
     - renderTargets array is ordered by render target creation order, planes renderOrder value and then planes indexes (order of creation)
     - transparent array is ordered by renderOrder, Z positions, geometry IDs and then indexes (first added first drawn)
     - opaque array is ordered by renderOrder, geometry IDs and then indexes (first added first drawn)

     This is done to improve speed and reduce GL calls

     params:
     @plane (Plane object): plane to add to our scene
     ***/
    addPlane(plane) {
        if(plane.type === "PingPongPlane") {
            this.stacks.pingPong.push(plane);
        }
        else if(plane.target) {
            this.addToRenderTargetsStack(plane);
        }
        else {
            if(plane._transparent) {
                // rebuild a stack of all transparent planes
                const planeStack = this.addToRegularPlaneStack(plane);

                // sort by their depth position
                planeStack.sort((a, b) => b.relativeTranslation.z - a.relativeTranslation.z);

                // then sort by their render order
                planeStack.sort((a, b) => b.renderOrder - a.renderOrder);

                this.stacks.transparent = planeStack;
            }
            else {
                // rebuild a stack of all opaque planes
                const planeStack = this.addToRegularPlaneStack(plane);

                // then sort by their render order
                planeStack.sort((a, b) => b.renderOrder - a.renderOrder);

                this.stacks.opaque = planeStack;
            }
        }
    }

    /***
     This function will remove a plane from our scene. This just reset the plane stacks for now.
     Useful if we'd want to change the way our draw stacks work and keep the logic separated from our renderer

     params:
     @plane (Plane object): plane to remove from our scene
     ***/
    removePlane(plane) {
        if(plane.type === "PingPongPlane") {
            this.stacks.pingPong = this.stacks.pingPong.filter(el => el.uuid !== plane.uuid);
        }
        else if(plane.target) {
            this.stacks.renderTargets = this.stacks.renderTargets.filter(el => el.uuid !== plane.uuid);
        }
        else {
            if(plane._transparent) {
                this.stacks.transparent = this.stacks.transparent.filter(el => el.uuid !== plane.uuid);
            }
            else {
                this.stacks.opaque = this.stacks.opaque.filter(el => el.uuid !== plane.uuid);
            }
        }
    }

    /***
     Changing the position of a plane inside the correct plane stack to render it on above or behind the other planes

     params:
     @plane (Plane object): the plane that had its renderOrder property updated
     ***/
    setPlaneRenderOrder(plane) {
        if(plane.type === "ShaderPass") {
            this.sortShaderPassStack(plane._isScenePass ? this.stacks.scenePasses : this.stacks.renderPasses);
        }
        else if(plane.type === "PingPongPlane") {
            // this does not makes any sense for ping pong planes
            return;
        }

        if(plane.target) {
            // sort by index (order of addition) then render order, depending on whether the render target handle depth or not
            if(plane.target._depth) {
                this.stacks.renderTargets.sort((a, b) => a.index - b.index);
                this.stacks.renderTargets.sort((a, b) => b.renderOrder - a.renderOrder);
            }
            else {
                this.stacks.renderTargets.sort((a, b) => b.index - a.index);
                this.stacks.renderTargets.sort((a, b) => a.renderOrder - b.renderOrder);
            }

            // then sort by render targets order
            this.stacks.renderTargets.sort((a, b) => a.target.index - b.target.index);
        }
        else {
            const planeStack = plane._transparent ?
                this.stacks.transparent
                : this.stacks.opaque;

            // if the first drawn scene pass does not handle depth, we'll have to sort them in the inverse order
            const scenePassWithoutDepth = this.stacks.scenePasses.find((pass, index) => pass._isScenePass && !pass._depth && index === 0);

            if(!this.renderer.depth || scenePassWithoutDepth) {
                // inverted sorting

                // sort by indexes
                planeStack.sort((a, b) => b.index - a.index);

                if(plane._transparent) {
                    // if plane is transparent, sort by their depth position
                    planeStack.sort((a, b) => a.relativeTranslation.z - b.relativeTranslation.z);
                }

                // then sort by render order
                planeStack.sort((a, b) => a.renderOrder - b.renderOrder);
            }
            else {
                // regular sorting

                // sort by indexes
                planeStack.sort((a, b) => a.index - b.index);

                if(plane._transparent) {
                    // if plane is transparent, sort by their depth position
                    planeStack.sort((a, b) => b.relativeTranslation.z - a.relativeTranslation.z);
                }

                // then sort by render order
                planeStack.sort((a, b) => b.renderOrder - a.renderOrder);
            }
        }
    }

    /*** ADDING POST PROCESSING ***/

    /***
     Add a shader pass to the stack

     params:
     @shaderPass (ShaderPass object): shaderPass to add to our scene
     ***/
    addShaderPass(shaderPass) {
        if(!shaderPass._isScenePass) {
            this.stacks.renderPasses.push(shaderPass);
            this.sortShaderPassStack(this.stacks.renderPasses);
        }
        else {
            this.stacks.scenePasses.push(shaderPass);
            this.sortShaderPassStack(this.stacks.scenePasses);
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


    /***
     Sorts the shader pass stack by index then by renderOrder property

     params:
     @passStack (array): which shader pass stack (scenePasses or renderPasses) to sort
     ***/
    sortShaderPassStack(passStack) {
        passStack.sort((a, b) => a.index - b.index);
        passStack.sort((a, b) => a.renderOrder - b.renderOrder);
    }

    /*** DRAWING SCENE ***/

    /***
     Enable the first Shader pass scene pass
     ***/
    enableShaderPass() {
        if(this.stacks.scenePasses.length && this.stacks.renderPasses.length === 0 && this.renderer.planes.length) {
            this.renderer.state.scenePassIndex = 0;
            this.renderer.bindFrameBuffer(this.stacks.scenePasses[0].target);
        }
    }

    /***
     Draw the render passes
     ***/
    drawRenderPasses() {
        // if we got one or multiple scene passes after the render passes, bind the first scene pass here
        if(this.stacks.scenePasses.length && this.stacks.renderPasses.length && this.renderer.planes.length) {
            this.renderer.state.scenePassIndex = 0;
            this.renderer.bindFrameBuffer(this.stacks.scenePasses[0].target);
        }

        for(let i = 0; i < this.stacks.renderPasses.length; i++) {
            this.stacks.renderPasses[i]._startDrawing();

            // we need to clear our depth buffer to display previously drawn render passes
            this.renderer.clearDepth();
        }
    }

    /***
     Draw the scene passes
     ***/
    drawScenePasses() {
        // then the scene passes
        for(let i = 0; i < this.stacks.scenePasses.length; i++) {
            this.stacks.scenePasses[i]._startDrawing();
        }
    }

    /***
     Loop through the special ping pong planes stack and draw its planes
     ***/
    drawPingPongStack() {
        for(let i = 0; i < this.stacks.pingPong.length; i++) {
            const plane = this.stacks.pingPong[i];
            // be sure the plane exists
            if(plane) {
                // draw the plane
                plane._startDrawing();
            }
        }
    }

    /***
     Loop through one of our stack (renderTargets, opaque or transparent objects) and draw its planes
     ***/
    drawStack(stackType) {
        for(let i = 0; i < this.stacks[stackType].length; i++) {
            const plane = this.stacks[stackType][i];
            // be sure the plane exists
            if(plane) {
                // draw the plane
                plane._startDrawing();
            }
        }
    }


    /***
     Draw our scene content
     ***/
    draw() {
        // always draw our ping pong planes first!
        this.drawPingPongStack();

        // enable first frame buffer for shader passes if needed
        this.enableShaderPass();

        // our planes that are drawn onto a render target
        this.drawStack("renderTargets");

        // then draw the content of our render targets render passes
        this.drawRenderPasses();

        // disable blending for the opaque planes
        this.renderer.setBlending(false);

        // loop on our stacked planes
        this.drawStack("opaque");

        // set blending and draw transparents planes only if we have some
        if(this.stacks.transparent.length) {
            this.renderer.setBlending(true);

            // draw the transparent planes
            this.drawStack("transparent");
        }

        // now draw the render targets scene passes
        this.drawScenePasses();
    }
}