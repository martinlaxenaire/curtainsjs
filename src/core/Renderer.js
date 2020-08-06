import {Scene} from "./Scene.js";
import {CacheManager} from "../utils/CacheManager.js";
import {RenderTarget} from "../framebuffers/RenderTarget.js";
import {ShaderPass} from "../framebuffers/ShaderPass.js";
import {Plane} from "./Plane.js";
import {CallbackQueueManager} from "../utils/CallbackQueueManager.js";
import {throwWarning} from '../utils/utils.js';


/***
 Here we create our Renderer object
 It will create our WebGL context and handle everything that relates to it
 Will create a container, append a canvas, handle WebGL extensions, context lost/restoration events
 Will create a Scene class object that will keep tracks of all added objects
 Will also handle all global WebGL commands, like clearing scene, binding frame buffers, setting depth, blend func, etc.
 Will use a state object to handle all those commands and keep a track of what is being drawned to avoid redundant WebGL calls.

 params:
 @Curtainsparams see Curtains class object

 @onError (function): called when there has been an error while initiating the WebGL context
 @onContextLost (function): called when the WebGL context is lost
 @onContextRestored (function): called when the WebGL context is restored
 @onSceneChange (function): called every time an object has been added/removed from the scene

 returns :
 @this: our Renderer
***/

// TODO deprecate all add* objects method and get rid of imports. BIG breaking change!

export class Renderer {
    constructor({
        // inherited from Curtains class object
        alpha,
        antialias,
        premultipliedAlpha,
        depth,
        failIfMajorPerformanceCaveat,
        preserveDrawingBuffer,
        stencil,
        container,
        pixelRatio,
        renderingScale,
        production,

        // callbacks passed by the Curtains class object on instantiation
        onError,
        onContextLost,
        onContextRestored,
        onDisposed,
        onSceneChange,
    }) {
        this.type = "Renderer";
        // context attributes
        this.alpha = alpha;
        this.antialias = antialias;
        this.premultipliedAlpha = premultipliedAlpha;
        this.depth = depth;
        this.failIfMajorPerformanceCaveat = failIfMajorPerformanceCaveat;
        this.preserveDrawingBuffer = preserveDrawingBuffer;
        this.stencil = stencil;

        this.container = container;

        this.pixelRatio = pixelRatio;
        this._renderingScale = renderingScale;

        this.production = production;

        // callbacks
        this.onError = onError;
        this.onContextLost = onContextLost;
        this.onContextRestored = onContextRestored;
        this.onDisposed = onDisposed;

        // keep sync between Curtains objects arrays and renderer objects arrays
        this.onSceneChange = onSceneChange;

        // managing our webgl draw states
        this.initState();

        // create the canvas
        this.canvas = document.createElement("canvas");

        // set our webgl context
        const glAttributes = {
            alpha: this.alpha,
            premultipliedAlpha: this.premultipliedAlpha,
            antialias: this.antialias,
            depth: this.depth,
            failIfMajorPerformanceCaveat: this.failIfMajorPerformanceCaveat,
            preserveDrawingBuffer: this.preserveDrawingBuffer,
            stencil: this.stencil,
        };

        // try webgl2 context first
        this.gl = this.canvas.getContext("webgl2", glAttributes);
        this._isWebGL2 = !!this.gl;
        // fallback to webgl1
        if(!this.gl) {
            this.gl = this.canvas.getContext("webgl", glAttributes) || this.canvas.getContext("experimental-webgl", glAttributes);
        }

        // WebGL context could not be created
        if(!this.gl) {
            if(!this.production) throwWarning(this.type + ": WebGL context could not be created");

            this.state.isActive = false;

            if(this.onError) {
                this.onError();
            }

            return;
        }

        this.initRenderer();
    }

    /***
     Set/reset our context state object
     ***/
    initState() {
        this.state = {
            // if we are currently rendering
            isActive: true,
            isContextLost: true,
            drawingEnabled: true,
            forceRender: false,

            // current program ID
            currentProgramID: null,

            // if we're using depth test or not
            setDepth: null,
            // face culling
            cullFace: null,

            // current frame buffer ID
            frameBufferID: null,
            // current scene pass ID
            scenePassIndex: null,

            // textures
            activeTexture: null,
            unpackAlignment: null,
            flipY: null,
            premultiplyAlpha: null,
        };
    }

    /***
     Add a callback queueing manager (execute functions on the next render call, see CallbackQueueManager class object)
     ***/
    initCallbackQueueManager() {
        this.nextRender = new CallbackQueueManager();
    }

    /***
     Init our renderer
     ***/
    initRenderer() {
        this.planes = [];
        this.renderTargets = [];
        this.shaderPasses = [];

        // context is not lost
        this.state.isContextLost = false;

        // callback queue
        this.initCallbackQueueManager();

        // set blend func
        this.setBlendFunc();

        // enable depth by default
        this.setDepth(true);

        // texture cache
        this.cache = new CacheManager();

        // init our scene
        this.scene = new Scene(this);

        // get webgl extensions
        this.getExtensions();

        // handling context
        this._contextLostHandler = this.contextLost.bind(this);
        this.canvas.addEventListener("webglcontextlost", this._contextLostHandler, false);

        this._contextRestoredHandler = this.contextRestored.bind(this);
        this.canvas.addEventListener("webglcontextrestored", this._contextRestoredHandler, false);
    }

    /***
     Get all available WebGL extensions based on WebGL used version
     Called on init and on context restoration
     ***/
    getExtensions() {
        this.extensions = [];
        if(this._isWebGL2) {
            this.extensions['EXT_color_buffer_float'] = this.gl.getExtension('EXT_color_buffer_float');
            this.extensions['OES_texture_float_linear'] = this.gl.getExtension('OES_texture_float_linear');
            this.extensions['EXT_texture_filter_anisotropic'] = this.gl.getExtension('EXT_texture_filter_anisotropic');
            this.extensions['WEBGL_lose_context'] = this.gl.getExtension('WEBGL_lose_context');
        } else {
            this.extensions['OES_vertex_array_object'] = this.gl.getExtension('OES_vertex_array_object');
            this.extensions['OES_texture_float'] = this.gl.getExtension('OES_texture_float');
            this.extensions['OES_texture_float_linear'] = this.gl.getExtension('OES_texture_float_linear');
            this.extensions['OES_texture_half_float'] = this.gl.getExtension('OES_texture_half_float');
            this.extensions['OES_texture_half_float_linear'] = this.gl.getExtension('OES_texture_half_float_linear');
            this.extensions['EXT_texture_filter_anisotropic'] = this.gl.getExtension('EXT_texture_filter_anisotropic');
            this.extensions['OES_element_index_uint'] = this.gl.getExtension('OES_element_index_uint');
            this.extensions['OES_standard_derivatives'] = this.gl.getExtension('OES_standard_derivatives');
            this.extensions['EXT_sRGB'] = this.gl.getExtension('EXT_sRGB');
            this.extensions['WEBGL_depth_texture'] = this.gl.getExtension('WEBGL_depth_texture');
            this.extensions['WEBGL_draw_buffers'] = this.gl.getExtension('WEBGL_draw_buffers');
            this.extensions['WEBGL_lose_context'] = this.gl.getExtension('WEBGL_lose_context');
        }
    }


    /*** HANDLING CONTEXT LOST/RESTORE ***/

    /***
     Called when the WebGL context is lost
     ***/
    contextLost(event) {
        this.state.isContextLost = true;

        // do not try to restore the context if we're disposing everything!
        if(!this.state.isActive) return;

        event.preventDefault();

        this.nextRender.add(() => this.onContextLost && this.onContextLost());
    }


    /***
     Call this method to restore your context
     ***/
    restoreContext() {
        // do not try to restore the context if we're disposing everything!
        if(!this.state.isActive) return;

        this.initState();

        if(this.gl && this.extensions['WEBGL_lose_context']) {
            this.extensions['WEBGL_lose_context'].restoreContext();
        }
        else {
            if(!this.gl && !this.production) {
                throwWarning(this.type + ": Could not restore the context because the context is not defined");
            }
            else if(!this.extensions['WEBGL_lose_context'] && !this.production) {
                throwWarning(this.type + ": Could not restore the context because the restore context extension is not defined");
            }

            if(this.onError) {
                this.onError();
            }
        }
    }

    /***
     Check that all objects and textures have been restored

     returns:
     @isRestored (bool): whether everything has been restored or not
     ***/
    isContextexFullyRestored() {
        let isRestored = true;
        for(let i = 0; i < this.renderTargets.length; i++) {
            if(!this.renderTargets[i].textures[0]._canDraw) {
                isRestored = false;
            }
            break;
        }

        if(isRestored) {
            for(let i = 0; i < this.planes.length; i++) {
                if(!this.planes[i]._canDraw) {
                    isRestored = false;
                    break;
                }
                else {
                    for(let j = 0; j < this.planes[i].textures.length; j++) {
                        if(!this.planes[i].textures[j]._canDraw) {
                            isRestored = false;
                            break;
                        }
                    }
                }
            }
        }

        if(isRestored) {
            for(let i = 0; i < this.shaderPasses.length; i++) {
                if(!this.shaderPasses[i]._canDraw) {
                    isRestored = false;
                    break;
                }
                else {
                    for(let j = 0; j < this.shaderPasses[i].textures.length; j++) {
                        if(!this.shaderPasses[i].textures[j]._canDraw) {
                            isRestored = false;
                            break;
                        }
                    }
                }
            }
        }

        return isRestored;
    }

    /***
     Called when the WebGL context is restored
     ***/
    contextRestored() {
        this.getExtensions();

        // set blend func
        this.setBlendFunc();

        // enable depth by default
        this.setDepth(true);

        // clear texture and programs cache
        this.cache.clear();

        // reset draw stacks
        this.scene.initStacks();

        // we need to reset everything : planes programs, shaders, buffers and textures !
        for(let i = 0; i < this.renderTargets.length; i++) {
            this.renderTargets[i]._restoreContext();
        }

        for(let i = 0; i < this.planes.length; i++) {
            this.planes[i]._restoreContext();
        }

        // same goes for shader passes
        for(let i = 0; i < this.shaderPasses.length; i++) {
            this.shaderPasses[i]._restoreContext();
        }

        // callback if everything is restored
        const isRestoredQueue = this.nextRender.add(() => {
            const isRestored = this.isContextexFullyRestored();
            if(isRestored) {
                isRestoredQueue.keep = false;

                // start drawing again
                this.state.isContextLost = false;

                if(this.onContextRestored) {
                    this.onContextRestored();
                }

                // we've changed the objects, keep Curtains class in sync with our renderer
                this.onSceneChange();

                // force next frame render whatever our drawing flag value
                this.needRender();
            }
        }, true);
    }


    /*** SIZING ***/

    /***
     Updates pixelRatio property
     ***/
    setPixelRatio(pixelRatio) {
        this.pixelRatio = pixelRatio;
    }

    /***
     Set/reset container sizes and WebGL viewport sizes
     ***/
    setSize() {
        if(!this.gl) return;

        // get our container bounding client rectangle
        const containerBoundingRect = this.container.getBoundingClientRect();

        // use the bounding rect values
        this._boundingRect = {
            width: containerBoundingRect.width * this.pixelRatio,
            height: containerBoundingRect.height * this.pixelRatio,
            top: containerBoundingRect.top * this.pixelRatio,
            left: containerBoundingRect.left * this.pixelRatio,
        };

        // iOS Safari > 8+ has a known bug due to navigation bar appearing/disappearing
        // this causes wrong bounding client rect calculations, especially negative top value when it shouldn't
        // to fix this we'll use a dirty but useful workaround

        // first we check if we're on iOS Safari
        const isSafari = !!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/);
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        if(isSafari && iOS) {
            // if we are on iOS Safari we'll need a custom function to retrieve our container absolute top position
            function getTopOffset(el) {
                let topOffset = 0;
                while(el && !isNaN(el.offsetTop)) {
                    topOffset += el.offsetTop - el.scrollTop;
                    el = el.offsetParent;
                }
                return topOffset;
            }

            // use it to update our top value
            this._boundingRect.top = getTopOffset(this.container) * this.pixelRatio;
        }

        this.canvas.style.width  = Math.floor(this._boundingRect.width / this.pixelRatio) + "px";
        this.canvas.style.height = Math.floor(this._boundingRect.height / this.pixelRatio) + "px";

        this.canvas.width = Math.floor(this._boundingRect.width * this._renderingScale);
        this.canvas.height = Math.floor(this._boundingRect.height * this._renderingScale);

        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    }

    /***
     Resize all our elements: planes, shader passes and render targets
     Their textures will be resized as well
     ***/
    resize() {
        // resize the planes only if they are fully initiated
        for(let i = 0; i < this.planes.length; i++) {
            if(this.planes[i]._canDraw) {
                this.planes[i].resize();
            }
        }

        // resize the shader passes only if they are fully initiated
        for(let i = 0; i < this.shaderPasses.length; i++) {
            if(this.shaderPasses[i]._canDraw) {
                this.shaderPasses[i].resize();
            }
        }

        // resize the render targets
        for(let i = 0; i < this.renderTargets.length; i++) {
            this.renderTargets[i].resize();
        }

        // be sure we'll update the scene even if drawing is disabled
        this.needRender();
    }


    /*** CLEAR SCENE ***/

    /***
     Clear our WebGL scene colors and depth
     ***/
    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }


    /*** FRAME BUFFER OBJECTS ***/

    /***
     Called to bind or unbind a FBO

     params:
     @frameBuffer (frameBuffer): if frameBuffer is not null, bind it, unbind it otherwise
     @cancelClear (bool / undefined): if we should cancel clearing the frame buffer (typically on init & resize)
     ***/
    bindFrameBuffer(frameBuffer, cancelClear) {
        let bufferId = null;
        if(frameBuffer) {
            bufferId = frameBuffer.index;

            // new frame buffer, bind it
            if(bufferId !== this.state.frameBufferID) {
                this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frameBuffer._frameBuffer);

                this.gl.viewport(0, 0, frameBuffer._size.width, frameBuffer._size.height);

                // if we should clear the buffer content
                if(frameBuffer._shouldClear && !cancelClear) {
                    this.clear();
                }
            }
        }
        else if(this.state.frameBufferID !== null) {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
            this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
        }

        this.state.frameBufferID = bufferId;
    }


    /*** DEPTH ***/

    /***
     Called to set whether the renderer will handle depth test or not
     Depth test is enabled by default

     params:
     @setDepth (boolean): if we should enable or disable the depth test
     ***/
    setDepth(setDepth) {
        if(setDepth && !this.state.depthTest) {
            this.state.depthTest = setDepth;
            // enable depth test
            this.gl.enable(this.gl.DEPTH_TEST);
        }
        else if(!setDepth && this.state.depthTest) {
            this.state.depthTest = setDepth;
            // disable depth test
            this.gl.disable(this.gl.DEPTH_TEST);
        }
    }


    /*** BLEND FUNC ***/

    /***
     Called to set the blending function (transparency)
     ***/
    setBlendFunc() {
        // allows transparency
        // based on how three.js solves this
        this.gl.enable(this.gl.BLEND);
        if(this.premultipliedAlpha) {
            this.gl.blendFuncSeparate(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
        }
        else {
            this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
        }
    }


    /*** FACE CULLING ***/

    /***
     Called to set whether we should cull an object face or not

     params:
     @cullFace (boolean): what face we should cull
     ***/
    setFaceCulling(cullFace) {
        if(this.state.cullFace !== cullFace) {
            this.state.cullFace = cullFace;

            if(cullFace === "none") {
                this.gl.disable(this.gl.CULL_FACE);
            }
            else {
                // default to back face culling
                const faceCulling = cullFace === "front" ? this.gl.FRONT : this.gl.BACK;

                this.gl.enable(this.gl.CULL_FACE);
                this.gl.cullFace(faceCulling);
            }
        }
    }

    /***
     Tell WebGL to use the specified program if it's not already in use

     params:
     @program (object): a program object
     ***/
    useProgram(program) {
        if(this.state.currentProgramID === null || this.state.currentProgramID !== program.id) {
            this.gl.useProgram(program.program);
            this.state.currentProgramID = program.id;
        }
    }


    /*** PLANES ***/

    /***
     Create a Plane element and load its images

     params:
     @planesHtmlElement (html element): the html element that we will use for our plane
     @params (obj): plane params:
     - vertexShaderID (string, optionnal): the vertex shader ID. If not specified, will look for a data attribute data-vs-id on the plane HTML element. Will throw an error if nothing specified
     - fragmentShaderID (string, optionnal): the fragment shader ID. If not specified, will look for a data attribute data-fs-id on the plane HTML element. Will throw an error if nothing specified
     - widthSegments (optionnal): plane definition along the X axis (1 by default)
     - heightSegments (optionnal): plane definition along the Y axis (1 by default)
     - alwaysDraw (boolean, optionnal): define if the plane should always be drawn or it should be drawn only if its within the canvas (false by default)
     - autoloadSources (boolean, optionnal): define if the sources should be load on init automatically (true by default)
     - crossOrigin (string, optionnal): define the crossOrigin process to load images if any
     - fov (int, optionnal): define the perspective field of view (default to 75)
     - uniforms (obj, otpionnal): the uniforms that will be passed to the shaders (if no uniforms specified there wont be any interaction with the plane)

     returns :
     @plane: our newly created plane object
     ***/
    addPlane(planeHtmlElement, params) {
        // if the WebGL context couldn't be created, return null
        if(!this.gl) {
            if(!this.production) throwWarning(this.type + ": Unable to create a Plane because the WebGl context is not defined");

            return false;
        }
        else {
            if(!planeHtmlElement || planeHtmlElement.length === 0) {
                if(!this.production) throwWarning(this.type + ": The HTML element you specified does not currently exists in the DOM");

                return false;
            }

            // init the plane
            let plane = new Plane(this, planeHtmlElement, params);

            if(!plane._program.compiled) {
                plane = false;
            }

            return plane;
        }
    }


    /***
     Removes a Plane element (that has already been disposed) from the scene and the planes array

     params:
     @plane (Plane object): the plane to remove
     ***/
    removePlane(plane) {
        if(!this.gl) return;

        // remove from our planes array
        this.planes = this.planes.filter(element => element.uuid !== plane.uuid);

        // remove from scene stacks
        this.scene.removePlane(plane);

        plane = null;

        // clear the buffer to clean scene
        if(this.gl) this.clear();

        // we've removed an object, keep Curtains class in sync with our renderer
        this.onSceneChange();
    }


    /*** POST PROCESSING ***/


    /*** RENDER TARGETS ***/


    /***
     Create a new RenderTarget element

     params:
     @params (obj): plane params:
     - depth (bool, optionnal): if the render target should use a depth buffer in order to preserve depth (default to false)

     returns :
     @renderTarget: our newly created RenderTarget object
     ***/
    addRenderTarget(params) {
        // if the WebGL context couldn't be created, return null
        if(!this.gl) {
            if(!this.production) throwWarning(this.type + ": Unable to create a RenderTarget because the WebGl context is not defined");

            return false;
        }
        else {
            // init the render target
            return new RenderTarget(this, params);
        }
    }


    /***
     Completely remove a RenderTarget element

     params:
     @renderTarget (RenderTarget object): the render target to remove
     ***/
    removeRenderTarget(renderTarget) {
        if(!this.gl) return;

        // loop through all planes that might use that render target and reset it
        for(let i = 0; i < this.planes.length; i++) {
            if(this.planes[i].target && this.planes[i].target.uuid === renderTarget.uuid) {
                this.planes[i].target = null;
            }
        }

        this.renderTargets = this.renderTargets.filter(element => element.uuid !== renderTarget.uuid);

        renderTarget = null;

        // clear the buffer to clean scene
        if(this.gl) this.clear();

        // we've removed an object, keep Curtains class in sync with our renderer
        this.onSceneChange();
    }


    /*** SHADER PASSES ***/


    /***
     Create a new ShaderPass element

     params:
     @params (obj): plane params:
     - vertexShaderID (string, optionnal): the vertex shader ID. If not specified, will look for a data attribute data-vs-id on the plane HTML element. Will throw an error if nothing specified
     - fragmentShaderID (string, optionnal): the fragment shader ID. If not specified, will look for a data attribute data-fs-id on the plane HTML element. Will throw an error if nothing specified
     - crossOrigin (string, optionnal): define the crossOrigin process to load images if any
     - uniforms (obj, otpionnal): the uniforms that will be passed to the shaders (if no uniforms specified there wont be any interaction with the plane)

     returns :
     @shaderPass: our newly created ShaderPass object
     ***/
    addShaderPass(params) {
        // if the WebGL context couldn't be created, return null
        if(!this.gl) {
            if(!this.production) throwWarning(this.type + ": Unable to create a ShaderPass because the WebGl context is not defined");

            return false;
        }
        else {
            // init the shader pass
            let shaderPass = new ShaderPass(this, params);

            if(!shaderPass._program.compiled) {
                shaderPass = false;
            }

            return shaderPass;
        }
    }


    /***
     Removes a ShaderPass element (that has already been disposed) from the scene and the shaderPasses array

     params:
     @shaderPass (ShaderPass object): the shader pass to remove
     ***/
    removeShaderPass(shaderPass) {
        if(!this.gl) return;

        // remove from shaderPasses our array
        this.shaderPasses = this.shaderPasses.filter(element => element.uuid !== shaderPass.uuid);

        // remove from scene stacks
        this.scene.removeShaderPass(shaderPass);

        shaderPass = null;

        // clear the buffer to clean scene
        if(this.gl) this.clear();

        // we've removed an object, keep Curtains class in sync with our renderer
        this.onSceneChange();
    }


    /***
     Enables the render loop
     ***/
    enableDrawing() {
        this.state.drawingEnabled = true;
    }

    /***
     Disables the render loop
     ***/
    disableDrawing() {
        this.state.drawingEnabled = false;
    }

    /***
     Forces the rendering of the next frame, even if disabled
     ***/
    needRender() {
        this.state.forceRender = true;
    }

    /***
     Called at each draw call to render our scene and its content
     Also execute our nextRender callback queue
     ***/
    render() {
        if(!this.gl) return;

        // clear scene first
        this.clear();

        // draw our scene content
        this.scene.draw();
    }


    /*** DISPOSING ***/

    /***
     Delete all cached programs
     ***/
    deletePrograms() {
        // delete all programs from manager
        for(let i = 0; i < this.cache.programs.length; i++) {
            const program = this.cache.programs[i];
            this.gl.deleteProgram(program.program);
        }
    }

    /***
     Dispose our WebGL context and all its objects
     ***/
    dispose() {
        if(!this.gl) return;

        this.state.isActive = false;

        // be sure to delete all planes
        while(this.planes.length > 0) {
            this.removePlane(this.planes[0]);
        }

        // we need to delete the shader passes also
        while(this.shaderPasses.length > 0) {
            this.removeShaderPass(this.shaderPasses[0]);
        }

        // finally we need to delete the render targets
        while(this.renderTargets.length > 0) {
            this.removeRenderTarget(this.renderTargets[0]);
        }

        // wait for all planes to be deleted before stopping everything
        let disposeQueue = this.nextRender.add(() => {
            if(this.planes.length === 0 && this.shaderPasses.length === 0 && this.renderTargets.length === 0) {
                // clear from callback queue
                disposeQueue.keep = false;

                this.deletePrograms();

                // clear the buffer to clean scene
                this.clear();

                this.canvas.removeEventListener("webgllost", this._contextLostHandler, false);
                this.canvas.removeEventListener("webglrestored", this._contextRestoredHandler, false);

                // lose context
                if(this.gl && this.extensions['WEBGL_lose_context']) {
                    this.extensions['WEBGL_lose_context'].loseContext();
                }

                // clear canvas state
                this.canvas.width = this.canvas.width;

                this.gl = null;

                // remove canvas from DOM
                this.container.removeChild(this.canvas);

                this.container = null;
                this.canvas = null;

                this.onDisposed && this.onDisposed();
            }
        }, true);
    }
}