import {Program} from './Program.js';
import {Geometry} from './Geometry.js';
import {Texture} from './Texture.js';
import {PlaneTextureLoader} from '../loaders/PlaneTextureLoader.js';
import {generateUUID, throwError, throwWarning} from '../utils/utils.js';

/***
 Here we create our Mesh object
 We will create an object containing the program that handles shaders and uniforms, a geometry that handles attributes
 Also handles anything that relates to textures creation and basic drawing operations

 params:
 @renderer (Curtains renderer or Renderer class object): our curtains object OR our curtains renderer object
 @type (string): Object type (should be either "Plane" or "ShaderPass")

 @vertexShaderID (string, optional): the vertex shader script ID. If not specified, will look for a data attribute data-vs-id on the plane HTML element.
 @fragmentShaderID (string, optional): the fragment shader script ID. If not specified, will look for a data attribute data-fs-id on the plane HTML element.
 @vertexShader (string, optional): the vertex shader as a string. Will look for a vertexShaderID if not specified.
 @fragmentShader (string, optional): the fragment shader as a string. Will look for a fragmentShaderID if not specified.
 @uniforms (object, optional): the uniforms that will be passed to the shaders.
 @widthSegments (int, optional): mesh definition along the X axis (1 by default)
 @heightSegments (int, optional): mesh definition along the Y axis (1 by default)
 @renderOrder (int, optional): mesh render order in the scene draw stacks (0 by default)
 @depthTest (bool, optional): if the mesh should enable or disable the depth test. Default to true.
 @cullFace (string, optional): which face of the mesh should be culled. Could either be "back", "front" or "none". Default to "back".
 @texturesOptions (object, optional): options and parameters to apply to the textures loaded by the mesh's loader. See the Texture class object.
 @crossorigin (string, optional): defines the crossOrigin process to load images if any (default to "anonymous").

 returns:
 @this: our Mesh element
 ***/
export class Mesh {
    constructor(renderer, type = "Mesh", {
        // program
        vertexShaderID,
        fragmentShaderID,
        vertexShader,
        fragmentShader,
        uniforms = {},

        // geometry
        widthSegments = 1,
        heightSegments = 1,

        // render order
        renderOrder,

        // drawing
        depthTest = true,
        cullFace = "back",

        // textures
        texturesOptions = {},
        crossOrigin = "anonymous"
    } = {}) {
        this.type = type;

        // we could pass our curtains object OR our curtains renderer object
        renderer = renderer && renderer.renderer || renderer;

        if(!renderer || renderer.type !== "Renderer") {
            throwError(this.type + ": Curtains not passed as first argument or Curtains Renderer is missing", renderer);
            // no renderer, we can't use the renderer nextRender method
            setTimeout(() => {
                if(this._onErrorCallback) {
                    this._onErrorCallback();
                }
            }, 0);
        }
        this.renderer = renderer;
        this.gl = this.renderer.gl;

        if(!this.gl) {
            if(!this.renderer.production) throwError(this.type + ": Unable to create a " + this.type + " because the Renderer WebGl context is not defined");

            // we should assume there's still no renderer here, so no nextRender method
            setTimeout(() => {
                if(this._onErrorCallback) {
                    this._onErrorCallback();
                }
            }, 0);
        }

        this._canDraw = false;
        this.renderOrder = renderOrder;

        // depth test
        this._depthTest = depthTest;
        // face culling
        this.cullFace = cullFace;
        if(
            this.cullFace !== "back"
            && this.cullFace !== "front"
            && this.cullFace !== "none"
        ) {
            this.cullFace = "back";
        }

        // textures
        this.textures = [];
        // default textures options depends on the type of Mesh and WebGL context
        texturesOptions = Object.assign({
            premultiplyAlpha: false,
            anisotropy: 1,

            floatingPoint: "none", // accepts "none", "half-float" or "float"

            wrapS: this.gl.CLAMP_TO_EDGE,
            wrapT: this.gl.CLAMP_TO_EDGE,

            minFilter: this.gl.LINEAR,
            magFilter: this.gl.LINEAR,
        }, texturesOptions);

        this._texturesOptions = texturesOptions;
        this.crossOrigin = crossOrigin;

        // handling shaders
        if(!vertexShader && vertexShaderID && document.getElementById(vertexShaderID)) {
            vertexShader = document.getElementById(vertexShaderID).innerHTML;
        }

        if(!fragmentShader && fragmentShaderID && document.getElementById(fragmentShaderID)) {
            fragmentShader = document.getElementById(fragmentShaderID).innerHTML;
        }

        // init sizes and loader
        this._initMesh();

        // geometry
        // set plane attributes
        widthSegments = parseInt(widthSegments);
        heightSegments = parseInt(heightSegments);
        this._geometry = new Geometry(this.renderer, {
            width: widthSegments,
            height: heightSegments,
            // using a special ID for shader passes to avoid weird buffer binding bugs on mac devices
            //id: this.type === "ShaderPass" ? 1 : widthSegments * heightSegments + widthSegments
        });

        this._program = new Program(this.renderer, {
            parent: this,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
        });

        if(this._program.compiled) {
            // create and set program uniforms
            this._program.createUniforms(uniforms);

            // make uniforms accessible directly
            this.uniforms = this._program.uniformsManager.uniforms;

            // geometry
            // set plane attributes
            this._geometry.setProgram(this._program);

            // we've added a new object, keep Curtains class in sync with our renderer
            this.renderer.onSceneChange();
        }
        else {
            this.renderer.nextRender.add(() => this._onErrorCallback && this._onErrorCallback());
        }
    }

    _initMesh() {
        this.uuid = generateUUID();

        // our Loader Class that will handle all medias loading process
        this.loader = new PlaneTextureLoader(this.renderer, this, {
            sourcesLoaded: 0,
            initSourcesToLoad: 0, // will change if there's any texture to load on init
            complete: false,
            onComplete: () => {
                this._onReadyCallback && this._onReadyCallback();

                this.renderer.needRender();
            }
        });

        this.images = [];
        this.videos = [];
        this.canvases = [];


        // allow the user to add custom data to the plane
        this.userData = {};

        this._canDraw = true;
    }


    /*** RESTORING CONTEXT ***/

    /***
     Used internally to handle context restoration
     ***/
    _restoreContext() {
        this._canDraw = false;

        if(this._matrices) {
            this._matrices = null;
        }

        // reset the used program based on our previous shaders code strings
        this._program = new Program(this.renderer, {
            parent: this,
            vertexShader: this._program.vsCode,
            fragmentShader: this._program.fsCode
        });

        if(this._program.compiled) {
            // reset geometry
            this._geometry.restoreContext(this._program);

            // create and set program uniforms
            this._program.createUniforms(this.uniforms);

            // make uniforms accessible directly
            this.uniforms = this._program.uniformsManager.uniforms;

            // program restored callback of Planes and ShaderPasses
            this._programRestored();
        }
    }

    /***
     This function adds a render target to a mesh

     params :
     @renderTarger (RenderTarget): the render target to add to that mesh
     ***/
    setRenderTarget(renderTarget) {
        if(!renderTarget || renderTarget.type !== "RenderTarget") {
            if(!this.renderer.production) {
                throwWarning(this.type + ": Could not set the render target because the argument passed is not a RenderTarget class object", renderTarget);
            }

            return;
        }

        if(this.type === "Plane") {
            // remove from scene stacks
            this.renderer.scene.removePlane(this);
        }

        this.target = renderTarget;

        if(this.type === "Plane") {
            // add to scene stacks again
            this.renderer.scene.addPlane(this);
        }
    }


    /***
     Set the mesh render order to draw it above or behind other meshes

     params :
     @renderOrder (int): new render order to apply: higher number means a mesh is drawn on top of others
     ***/
    setRenderOrder(renderOrder = 0) {
        renderOrder = isNaN(renderOrder) ? this.renderOrder : parseInt(renderOrder);

        if(renderOrder !== this.renderOrder) {
            this.renderOrder = renderOrder;
            this.renderer.scene.setPlaneRenderOrder(this);
        }
    }


    /*** IMAGES, VIDEOS AND CANVASES LOADING ***/

    /***
     This method creates a new Texture and adds it to the mesh

     params :
     @textureOptions (object, optional) : Parameters to apply to that texture (see Texture class). Will be merged with the mesh default textures options

     returns :
     @texture: our newly created texture
     ***/
    createTexture(textureOptions = {}) {
        // create a new texture with the specified options
        const texture = new Texture(this.renderer, Object.assign(this._texturesOptions, textureOptions));
        // add the texture to the mesh
        texture.addParent(this);

        return texture;
    }


    /***
     Shortcut for addParent() Texture class method
     ***/
    addTexture(texture) {
        if(!texture || texture.type !== "Texture") {
            if(!this.renderer.production) {
                throwWarning(this.type + ": cannot add ", texture, " to this " + this.type + " because it is not a valid texture");
            }

            return;
        }

        texture.addParent(this);
    }


    /***
     This method handles the sources loading process

     params :
     @sourcesArray (array): array of html images, videos or canvases elements
     @texturesOptions (object, optional) : Parameters to apply to those textures (see Texture class). Will be merged with the mesh default textures options
     @successCallback (function): callback to execute on source loading success
     @errorCallback (function): callback to execute on source loading error
     ***/
    loadSources(sourcesArray, texturesOptions = {}, successCallback, errorCallback) {
        for(let i = 0; i < sourcesArray.length; i++) {
            this.loadSource(sourcesArray[i], texturesOptions, successCallback, errorCallback);
        }
    }


    /***
     This method loads one source using our mesh loader (see PlaneTextureLoader class)

     params :
     @source (html element) : html image, video or canvas element
     @textureOptions (object, optional) : Parameters to apply to that texture (see Texture class). Will be merged with the mesh default textures options
     @successCallback (function): callback to execute on source loading success
     @errorCallback (function): callback to execute on source loading error
     ***/
    loadSource(source, textureOptions = {}, successCallback, errorCallback) {
        this.loader.loadSource(source, Object.assign(this._texturesOptions, textureOptions), (texture) => {
            successCallback && successCallback(texture);
        }, (source, error) => {
            if(!this.renderer.production) {
                throwWarning(this.type + ": this HTML tag could not be converted into a texture:", source.tagName);
            }

            errorCallback && errorCallback(source, error);
        });
    }


    /***
     This method loads an image using our mesh loader (see PlaneTextureLoader class)

     params :
     @source (image) : html image element
     @textureOptions (object, optional) : Parameters to apply to that texture (see Texture class). Will be merged with the mesh default textures options
     @successCallback (function): callback to execute on source loading success
     @errorCallback (function): callback to execute on source loading error
     ***/
    loadImage(source, textureOptions = {}, successCallback, errorCallback) {
        this.loader.loadImage(source, Object.assign(this._texturesOptions, textureOptions), (texture) => {
            successCallback && successCallback(texture);
        }, (source, error) => {
            if(!this.renderer.production) {
                throwWarning(this.type + ": There has been an error:\n", error, "\nwhile loading this image:\n", source);
            }

            errorCallback && errorCallback(source, error);
        });
    }


    /***
     This method loads a video using the mesh loader (see PlaneTextureLoader class)

     params :
     @source (video) : html video element
     @textureOptions (object, optional) : Parameters to apply to that texture (see Texture class). Will be merged with the mesh default textures options
     @successCallback (function): callback to execute on source loading success
     @errorCallback (function): callback to execute on source loading error
     ***/
    loadVideo(source, textureOptions = {}, successCallback, errorCallback) {
        this.loader.loadVideo(source, Object.assign(this._texturesOptions, textureOptions), (texture) => {
            successCallback && successCallback(texture);
        }, (source, error) => {
            if(!this.renderer.production) {
                throwWarning(this.type + ": There has been an error:\n", error, "\nwhile loading this video:\n", source);
            }

            errorCallback && errorCallback(source, error);
        });
    }


    /***
     This method loads a canvas using the mesh loader (see PlaneTextureLoader class)

     params :
     @source (canvas) : html canvas element
     @textureOptions (object, optional) : Parameters to apply to that texture (see Texture class). Will be merged with the mesh default textures options
     @successCallback (function): callback to execute on source loading success
     ***/
    loadCanvas(source, textureOptions = {}, successCallback) {
        this.loader.loadCanvas(source, Object.assign(this._texturesOptions, textureOptions), (texture) => {
            successCallback && successCallback(texture);
        });
    }


    /*** LOAD ARRAYS ***/

    /***
     Loads an array of images

     params :
     @imagesArray (array) : array of html image elements
     @texturesOptions (object, optional) : Parameters to apply to those textures (see Texture class). Will be merged with the mesh default textures options
     @successCallback (function): callback to execute on source loading success
     @errorCallback (function): callback to execute on source loading error
     ***/
    loadImages(imagesArray, texturesOptions = {}, successCallback, errorCallback) {
        for(let i = 0; i < imagesArray.length; i++) {
            this.loadImage(imagesArray[i], texturesOptions, successCallback, errorCallback);
        }
    }

    /***
     Loads an array of videos

     params :
     @videosArray (array) : array of html video elements
     @texturesOptions (object, optional) : Parameters to apply to those textures (see Texture class). Will be merged with the mesh default textures options
     @successCallback (function): callback to execute on source loading success
     @errorCallback (function): callback to execute on source loading error
     ***/
    loadVideos(videosArray, texturesOptions = {}, successCallback, errorCallback) {
        for(let i = 0; i < videosArray.length; i++) {
            this.loadVideo(videosArray[i], texturesOptions, successCallback, errorCallback);
        }
    }

    /***
     Loads an array of canvases

     params :
     @canvasesArray (array) : array of html canvas elements
     @texturesOptions (object, optional) : Parameters to apply to those textures (see Texture class). Will be merged with the mesh default textures options
     @successCallback (function): callback to execute on source loading success
     @errorCallback (function): callback to execute on source loading error
     ***/
    loadCanvases(canvasesArray, texturesOptions = {}, successCallback) {
        for(let i = 0; i < canvasesArray.length; i++) {
            this.loadCanvas(canvasesArray[i], texturesOptions, successCallback);
        }
    }


    /***
     This has to be called in order to play the planes videos
     We need this because on mobile devices we can't start playing a video without a user action
     Once the video has started playing we set an interval and update a new frame to our our texture at a 30FPS rate
     ***/
    playVideos() {
        // avoid looping on textures is the plane has been removed
        if(this.textures) {
            for (let i = 0; i < this.textures.length; i++) {
                const texture = this.textures[i];

                if (texture.sourceType === "video") {
                    const playPromise = texture.source.play();

                    // In browsers that don’t yet support this functionality,
                    // playPromise won’t be defined.
                    if (playPromise !== undefined) {
                        playPromise.catch((error) => {
                            if (!this.renderer.production) throwWarning(this.type + ": Could not play the video : ", error);
                        });
                    }
                }
            }
        }
    }


    /*** DRAW THE PLANE ***/

    /***
     We draw the plane, ie bind the buffers, set the active textures and draw it
     ***/
    _draw() {
        // enable/disable depth test
        this.renderer.setDepthTest(this._depthTest);

        // face culling
        this.renderer.setFaceCulling(this.cullFace);

        // update all uniforms set up by the user
        this._program.updateUniforms();

        // bind plane attributes buffers
        // TODO ideally we should only bind the attributes buffers if the geometry changed
        // however it is leading to some bugs on macOS & iOS and should therefore be tested extensively
        // for now we'll disable this feature even tho it is ready to be used
        //if(this.renderer.state.currentGeometryID !== this._geometry.definition.id || this.renderer.state.forceBufferUpdate) {
        this._geometry.bindBuffers();
        this.renderer.state.forceBufferUpdate = false;
        //}

        // draw all our plane textures
        for(let i = 0; i < this.textures.length; i++) {
            // draw (bind and maybe update) our texture
            this.textures[i]._draw();

            if(!this.textures[i]._sampler.isTextureBound) {
                return;
            }
        }

        // the draw call!
        this._geometry.draw();

        // reset active texture
        this.renderer.state.activeTexture = null;

        // callback after draw
        this._onAfterRenderCallback && this._onAfterRenderCallback();
    }


    /*** EVENTS ***/


    /***
     This is called each time a mesh can't be instanciated

     params :
     @callback (function) : a function to execute

     returns :
     @this: our plane to handle chaining
     ***/
    onError(callback) {
        if(callback) {
            this._onErrorCallback = callback;
        }

        return this;
    }

    /***
     This is called each time a mesh's image has been loaded. Useful to handle a loader

     params :
     @callback (function) : a function to execute

     returns :
     @this: our plane to handle chaining
     ***/
    onLoading(callback) {
        if(callback) {
            this._onLoadingCallback = callback;
        }

        return this;
    }


    /***
     This is called when a mesh is ready to be drawn

     params :
     @callback (function) : a function to execute

     returns :
     @this: our plane to handle chaining
     ***/
    onReady(callback) {
        if(callback) {
            this._onReadyCallback = callback;
        }

        return this;
    }


    /***
     This is called at each requestAnimationFrame call

     params :
     @callback (function) : a function to execute

     returns :
     @this: our plane to handle chaining
     ***/
    onRender(callback) {
        if(callback) {
            this._onRenderCallback = callback;
        }

        return this;
    }


    /***
     This is called at each requestAnimationFrame call for each mesh after the draw call

     params :
     @callback (function) : a function to execute

     returns :
     @this: our plane to handle chaining
     ***/
    onAfterRender(callback) {
        if(callback) {
            this._onAfterRenderCallback = callback;
        }

        return this;
    }


    /*** DESTROYING ***/

    /***
     Remove an element by calling the appropriate renderer method
     ***/
    remove() {
        // first we want to stop drawing it
        this._canDraw = false;

        // force unbinding frame buffer
        if(this.target) {
            this.renderer.bindFrameBuffer(null);
        }

        // delete all the webgl bindings
        this._dispose();

        if(this.type === "Plane") {
            this.renderer.removePlane(this);
        }
        else if(this.type === "ShaderPass") {
            // remove its render target first
            if(this.target) {
                this.target._shaderPass = null;
                this.target.remove();
                this.target = null;
            }

            this.renderer.removeShaderPass(this);
        }
    }

    /***
     This deletes all our mesh webgl bindings and its textures
     ***/
    _dispose() {
        if(this.gl) {
            // dispose our geometry
            this._geometry && this._geometry.dispose();

            if(this.target && this.type === "ShaderPass") {
                this.renderer.removeRenderTarget(this.target);
                // remove the first texture since it has been deleted with the render target
                this.textures.shift();
            }

            // unbind and delete the textures
            for(let i = 0; i < this.textures.length; i++) {
                this.textures[i]._dispose();
            }
            this.textures = null;
        }
    }
}