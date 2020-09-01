import {Texture} from '../core/Texture.js';
import {generateUUID, throwError, throwWarning} from '../utils/utils.js';

/***
 Here we create a RenderTarget class object

 params :
 @renderer (Curtains renderer or Renderer class object): our curtains object OR our curtains renderer object

 @shaderPass (ShaderPass class object): shader pass that will use that render target. Default to null
 @depth (bool, optional): whether to create a depth buffer (handle depth inside your render target). Default to false.
 @clear (bool, optional): whether the content of the render target should be cleared before being drawn. Should be set to false to handle ping-pong shading. Default to true.

 @minWidth (float, optional): minimum width of the render target
 @minHeight (float, optional): minimum height of the render target

 @texturesOptions (object, optional): options and parameters to apply to the render target texture. See the Texture class object.

 returns :
 @this: our RenderTarget class object
 ***/

export class RenderTarget {
    constructor(renderer, {
        shaderPass,
        depth = false,
        clear = true,

        minWidth = 1024,
        minHeight = 1024,

        texturesOptions = {}
    } = {}) {
        this.type = "RenderTarget";

        // we could pass our curtains object OR our curtains renderer object
        renderer = renderer && renderer.renderer || renderer;

        if(!renderer || renderer.type !== "Renderer") {
            throwError(this.type + ": Renderer not passed as first argument", renderer);
        }
        else if(!renderer.gl) {
            throwError(this.type + ": Renderer WebGL context is undefined", renderer);
        }
        this.renderer = renderer;
        this.gl = this.renderer.gl;

        this.index = this.renderer.renderTargets.length;

        this._shaderPass = shaderPass;

        // whether to create a render buffer
        this._depth = depth;

        this._shouldClear = clear;

        this._minSize = {
            width: minWidth * this.renderer.pixelRatio,
            height: minHeight * this.renderer.pixelRatio,
        };

        // default textures options depends on the type of Mesh and WebGL context
        texturesOptions = Object.assign({
            // set default sampler to "uRenderTexture" and isFBOTexture to true
            sampler: "uRenderTexture",
            isFBOTexture: true,

            premultiplyAlpha: false,
            anisotropy: 1,
            generateMipmap: false,

            floatingPoint: "none",

            wrapS: this.gl.CLAMP_TO_EDGE,
            wrapT: this.gl.CLAMP_TO_EDGE,

            minFilter: this.gl.LINEAR,
            magFilter: this.gl.LINEAR,
        }, texturesOptions);
        this._texturesOptions = texturesOptions;

        this.userData = {};

        this.uuid = generateUUID();

        this.renderer.renderTargets.push(this);
        // we've added a new object, keep Curtains class in sync with our renderer
        this.renderer.onSceneChange();

        this._initRenderTarget();
    }


    /***
     Init our RenderTarget by setting its size, creating a textures array and then calling _createFrameBuffer()
     ***/
    _initRenderTarget() {
        this._setSize();

        // create our render texture
        this.textures = [];

        // create our frame buffer
        this._createFrameBuffer();
    }


    /*** RESTORING CONTEXT ***/

    /***
     Restore a render target
     Basically just re init it
     ***/
    _restoreContext() {
        // reset size
        this._setSize();

        // re create our frame buffer and restore its texture
        this._createFrameBuffer();
    }


    /***
     Sets our RenderTarget size based on its parent plane size
     ***/
    _setSize() {
        if(this._shaderPass && this._shaderPass._isScenePass) {
            this._size = {
                width: this.renderer._boundingRect.width,
                height: this.renderer._boundingRect.height,
            };
        }
        else {
            this._size = {
                width: Math.max(this._minSize.width, this.renderer._boundingRect.width),
                height: Math.max(this._minSize.height, this.renderer._boundingRect.height),
            };
        }
    }


    /***
     Resizes our RenderTarget (only resize it if it's a ShaderPass scene pass FBO)
     ***/
    resize() {
        // resize render target only if its a child of a shader pass
        if(this._shaderPass) {
            this._setSize();

            this.textures[0].resize();

            // cancel clear on resize
            this.renderer.bindFrameBuffer(this, true);

            if(this._depth) {
                this._bindDepthBuffer();
            }

            this.renderer.bindFrameBuffer(null);
        }
    }


    /***
     Binds our depth buffer
     ***/
    _bindDepthBuffer() {
        // render to our target texture by binding the framebuffer
        if(this._depthBuffer) {
            this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this._depthBuffer);

            // allocate renderbuffer
            this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, this._size.width, this._size.height);

            // attach renderbuffer
            this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.RENDERBUFFER, this._depthBuffer);
        }
    }


    /***
     Here we create our frame buffer object
     We're also adding a render buffer object to handle depth if needed
     ***/
    _createFrameBuffer() {
        this._frameBuffer = this.gl.createFramebuffer();

        // cancel clear on init
        this.renderer.bindFrameBuffer(this, true);

        // if textures array is not empty it means we're restoring the context
        if(this.textures.length) {
            this.textures[0]._parent = this;
            this.textures[0]._restoreContext();
        }
        else {
            // create a texture
            const texture = new Texture(this.renderer, this._texturesOptions);

            // adds the render target as parent and adds the texture to our textures array as well
            texture.addParent(this);
        }

        // attach the texture as the first color attachment
        // this.textures[0]._sampler.texture contains our WebGLTexture object
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.textures[0]._sampler.texture, 0);

        // create a depth renderbuffer
        if(this._depth) {
            this._depthBuffer = this.gl.createRenderbuffer();
            this._bindDepthBuffer();
        }

        this.renderer.bindFrameBuffer(null);
    }


    /*** GET THE RENDER TARGET TEXTURE ***/

    /***
     Returns the render target's texture

     returns :
     @texture (Texture class object): our RenderTarget's texture
     ***/
    getTexture() {
        return this.textures[0];
    }


    /*** DESTROYING ***/

    /***
     Remove an element by calling the appropriate renderer method
     ***/
    remove() {
        // check if it is attached to a shader pass
        if(this._shaderPass) {
            if(!this.renderer.production) {
                throwWarning(this.type + ": You're trying to remove a RenderTarget attached to a ShaderPass. You should remove that ShaderPass instead:", this._shaderPass);
            }

            return;
        }

        this._dispose();

        this.renderer.removeRenderTarget(this);
    }

    /***
     Delete a RenderTarget buffers and its associated texture
     ***/
    _dispose() {
        if(this._frameBuffer) {
            this.gl.deleteFramebuffer(this._frameBuffer);
            this._frameBuffer = null;
        }
        if(this._depthBuffer) {
            this.gl.deleteRenderbuffer(this._depthBuffer);
            this._depthBuffer = null;
        }

        this.textures[0]._dispose();
        this.textures = [];
    }
}