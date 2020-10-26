import {Mat4} from '../math/Mat4.js';
import {Vec2} from '../math/Vec2.js';
import {Vec3} from '../math/Vec3.js';
import {generateUUID, throwError, throwWarning, isPowerOf2} from '../utils/utils.js';

/***
 Texture class objects used by render targets, shader passes and planes.

 params:
 @renderer (Curtains renderer or Renderer class object): our curtains object OR our curtains renderer object

 @isFBOTexture (bool): Whether this texture is used by a render target/frame buffer object. Default to false
 @fromTexture (bool): Whether this texture should copy another texture right from init (and avoid creating a new webgl texture). Default to false
 @loader (TextureLoader class object): loader used to create that texture and load its source. Default to null

 @sampler (string): the texture sampler's name that will be used in the shaders

 @floatingPoint (string): texture floating point to apply. Could be "float", "half-float" or "none". Default to "none"

 @premultiplyAlpha (bool): Whether this texture should handle premultiplied alpha. Default to false
 @anisotropy (int): Texture anisotropy (see https://developer.mozilla.org/en-US/docs/Web/API/EXT_texture_filter_anisotropic). Default to 1
 @generateMipmap (bool): Whether to generate texture mipmaps (see https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/generateMipmap). Default to true except for frame buffer objects textures.

 see https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/samplerParameter
 @wrapS (GLenum): WebGL constant specifying the texture wrapping function for the texture coordinate S
 @wrapT (GLenum): WebGL constant specifying the texture wrapping function for the texture coordinate T
 @minFilter (GLenum): WebGL constant specifying the texture minification filter
 @magFilter (GLenum): WebGL constant specifying the texture magnification filter

 returns:
 @this: our newly created Texture class object
 ***/
export class Texture {
    constructor(renderer, {
        isFBOTexture = false,
        fromTexture = false,
        loader,

        // texture sampler name
        sampler,

        // floating point textures
        floatingPoint = "none",

        // texture parameters
        premultiplyAlpha = false,
        anisotropy = 1,
        generateMipmap = null,

        wrapS,
        wrapT,
        minFilter,
        magFilter,
    } = {}) {
        this.type = "Texture";

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

        this.uuid = generateUUID();

        // texture parameters
        this._globalParameters = {
            // global gl context parameters
            unpackAlignment: 4,
            flipY: !isFBOTexture,
            premultiplyAlpha,

            // texImage2D properties
            floatingPoint: floatingPoint,
            type: this.gl.UNSIGNED_BYTE,
            internalFormat: this.gl.RGBA,
            format: this.gl.RGBA,
        };

        this.parameters = {
            // per texture parameters
            anisotropy,
            generateMipmap: generateMipmap,

            wrapS: wrapS || this.gl.CLAMP_TO_EDGE,
            wrapT: wrapT || this.gl.CLAMP_TO_EDGE,
            minFilter: minFilter || this.gl.LINEAR,
            magFilter: magFilter || this.gl.LINEAR,

            _shouldUpdate: true,
        };

        // per texture state
        this._initState();

        // is it a frame buffer object texture?
        // if it's not, type will change when the source will be loaded
        this.sourceType = isFBOTexture ? "fbo" : "empty";

        this._samplerName = sampler;

        // prepare texture sampler
        this._sampler = {
            isActive: false
        };

        // we will always declare a texture matrix
        this._textureMatrix = {
            matrix: new Mat4()
        };

        // actual size will be set later on
        this._size = {
            width: 0,
            height: 0,
        };

        this.scale = new Vec2(1, 1);

        // source loading and GPU uploading flags
        this._loader = loader;
        this._sourceLoaded = false;
        this._uploaded = false;

        // _willUpdate and shouldUpdate property are set to false by default
        // we will handle that in the setSource() method for videos and canvases
        this._willUpdate = false;
        this.shouldUpdate = false;

        // if we need to force a texture update
        this._forceUpdate = false;

        // custom user properties
        this.userData = {};

        // useful flag to avoid binding texture that does not belong to current context
        this._canDraw = false;

        // is it set from an existing texture?
        if(fromTexture) {
            this._copyOnInit = true;
            this._copiedFrom = fromTexture;

            // everything else will be done when adding a parent to that texture
            return;
        }

        this._copyOnInit = false;

        // init our texture
        this._initTexture();
    }


    /***
     Init per-texture parameters state
     Called on init and on context restoration to force parameters settings
     ***/
    _initState() {
        this._state = {
            anisotropy: 1,
            generateMipmap: false,

            wrapS: null,
            wrapT: null,
            minFilter: null,
            magFilter: this.gl.LINEAR, // default to gl.LINEAR
        };
    }

    /***
     Init our texture object
     ***/
    _initTexture() {
        // create our WebGL texture
        this._sampler.texture = this.gl.createTexture();

        // bind the texture the target (TEXTURE_2D) of the active texture unit.
        this.gl.bindTexture(this.gl.TEXTURE_2D, this._sampler.texture);

        if(this.sourceType === "empty") {
            // draw a black plane before the real texture's content has been loaded
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this._globalParameters.internalFormat, 1, 1, 0, this._globalParameters.format, this._globalParameters.type, new Uint8Array([0, 0, 0, 255]));

            this._canDraw = true;
        }
    }


    /*** RESTORING CONTEXT ***/

    /***
     Restore a WebGL texture that is a copy
     Depending on whether it's a copy from start or not, just reset its uniforms or run the full init
     And finally copy our original texture back again
     ***/
    _restoreFromTexture() {
        // init again if needed
        if(!this._copyOnInit) {
            this._initTexture();
        }

        // a texture shouldn't be restored if it does not have a parent
        // since it's always the parent that calls the _restoreContext() method
        if(this._parent) {
            // set uniforms again
            this._setTextureUniforms();

            // update the texture matrix uniform as well
            this._setSize();
        }

        // copy our texture again
        this.copy(this._copiedFrom);

        this._canDraw = true;
    }


    /***
     Restore our WebGL texture
     If it is an original texture, just re run the init function and eventually reset its source
     If it is a texture set from another texture, wait for the original texture to be ready first
     ***/
    _restoreContext() {
        // avoid binding that texture before reseting it
        this._canDraw = false;
        this._sampler.isActive = false;

        this._initState();

        // force mip map regeneration if needed
        this._state.generateMipmap = false;
        this.parameters._shouldUpdate = true;

        // this is an original texture, reset it right away
        if(!this._copiedFrom) {
            this._initTexture();

            if(this._parent) {
                this._setParent();
            }

            if(this.source) {
                this.setSource(this.source);

                // cache again if it is an image
                // also since it's an image it has been uploaded in setSource()
                if(this.sourceType === "image") {
                    this.renderer.cache.addTexture(this);
                }
                else {
                    // force update
                    this.needUpdate();
                }
            }

            this._canDraw = true;
        }
        else {
            // wait for the original texure to be ready before attempting to restore the copy
            const queue = this.renderer.nextRender.add(() => {
                if(this._copiedFrom._canDraw) {
                    this._restoreFromTexture();
                    // remove from callback queue
                    queue.keep = false;
                }
            }, true);
        }
    }


    /*** ADD PARENT ***/

    /***
     Adds a parent to a texture
     Sets its index, its parent and add it to the parent textures array as well
     Then runs _setParent() to set the size and uniforms if needed
     ***/
    addParent(parent) {
        if(!parent || (parent.type !== "Plane" && parent.type !== "ShaderPass" && parent.type !== "RenderTarget")) {
            if(!this.renderer.production) {
                throwWarning(this.type + ": cannot add texture as a child of ", parent, " because it is not a valid parent");
            }

            return;
        }

        // add parent property
        this._parent = parent;
        // update parent textures array
        this.index = this._parent.textures.length;
        this._parent.textures.push(this);

        // now set its parent for real
        this._setParent();
    }


    /***
     Sets the parent
     Basically sets the uniforms names and locations and sizes
     ***/
    _setParent() {
        // prepare texture sampler
        this._sampler.name = this._samplerName || "uSampler" + this.index;

        // we will always declare a texture matrix
        this._textureMatrix.name = this._samplerName ? this._samplerName + "Matrix" : "uTextureMatrix" + this.index;

        // if the parent has a program it means its not a render target texture
        if(this._parent._program) {
            if(!this._parent._program.compiled) {
                if(!this.renderer.production) {
                    throwWarning(this.type + ": Unable to create the texture because the program is not valid");
                }

                return;
            }

            // set uniform
            this._setTextureUniforms();

            if(this._copyOnInit) {
                // copy the original texture on next render
                this.renderer.nextRender.add(() => this.copy(this._copiedFrom));

                // we're done!
                return;
            }

            if(!this.source) {
                // set its size based on parent element size for now
                this._size = {
                    width: this._parent._boundingRect.document.width,
                    height: this._parent._boundingRect.document.height,
                };
            }
            else if(this._parent.loader) {
                // we're adding a parent to a texture that already has a source
                // it means the source should have been loaded before the parent was set
                // add it to the right asset array if needed
                this._parent.loader._addSourceToParent(this.source, this.sourceType);
            }

            this._setSize();
        }
        else if(this._parent.type === "RenderTarget") {
            // its a render target texture, it has no uniform location and no texture matrix
            this._size = {
                width: this._parent._size && this._parent._size.width || this.renderer._boundingRect.width,
                height: this._parent._size && this._parent._size.height || this.renderer._boundingRect.height,
            };

            // updload to gpu
            this._upload();

            // update render texture parameters because it will never be drawn (hence not called)
            this._updateTexParameters();

            this._canDraw = true;
        }
    }


    /***
     Checks if this texture has a parent

     return:
     @hasParent (bool): whether this texture has a parent or not
     ***/
    hasParent() {
        return !!this._parent;
    }


    /*** SEND DATA TO THE GPU ***/

    /***
     Check if our textures is effectively used in our shaders
     If so, set it to active, get its uniform locations and bind it to our texture unit
     ***/
    _setTextureUniforms() {
        // check if our texture is used in our program shaders
        // if so, get its uniform locations and bind it to our program
        for(let i = 0; i < this._parent._program.activeTextures.length; i++) {
            if(this._parent._program.activeTextures[i] === this._sampler.name) {
                // this texture is active
                this._sampler.isActive = true;

                // use the program and get our sampler and texture matrices uniforms
                this.renderer.useProgram(this._parent._program);

                // set our texture sampler uniform
                this._sampler.location = this.gl.getUniformLocation(this._parent._program.program, this._sampler.name);
                // texture matrix uniform
                this._textureMatrix.location = this.gl.getUniformLocation(this._parent._program.program, this._textureMatrix.name);

                // tell the shader we bound the texture to our indexed texture unit
                this.gl.uniform1i(this._sampler.location, this.index);
            }
        }
    }


    /***
     This copies an already existing Texture object to our texture
     DEPRECATED

     params:
     @texture (Texture): texture to set from
     ***/
    setFromTexture(texture) {
        if(!this.renderer.production) {
            throwWarning(this.type + ": setFromTexture() is deprecated, use copy() instead");
        }

        this.copy(texture);
    }

    /***
     This copies an already existing Texture object to our texture

     params:
     @texture (Texture): texture to set from
     ***/
    copy(texture) {
        if(!texture || texture.type !== "Texture") {
            if(!this.renderer.production) {
                throwWarning(this.type + ": Unable to set the texture from texture:", texture);
            }
            return;
        }

        // copy states
        //this._globalParameters = texture._globalParameters;
        this.parameters = texture.parameters;
        this._state = texture._state;

        // copy source
        this._size = texture._size;
        this._sourceLoaded = texture._sourceLoaded;
        this._uploaded = texture._uploaded;
        this.sourceType = texture.sourceType;
        this.source = texture.source;
        this._videoFrameCallbackID = texture._videoFrameCallbackID;

        // copy texture
        this._sampler.texture = texture._sampler.texture;

        // keep a track from the original one
        this._copiedFrom = texture;


        // update its texture matrix if needed and we're good to go!
        if(this._parent && this._parent._program && (!this._canDraw || !this._textureMatrix.matrix)) {
            this._setSize();

            this._canDraw = true;
        }

        // force rendering
        this.renderer.needRender();
    }


    /*** LOADING SOURCES ***/

    /***
     This uses our source as texture

     params:
     @source (images/video/canvas): either an image, a video or a canvas
     ***/
    setSource(source) {
        // fire callback during load (useful for a loader)
        if(!this._sourceLoaded) {
            // texture source loaded callback
            this.renderer.nextRender.add(() => this._onSourceLoadedCallback && this._onSourceLoadedCallback());
        }

        // check for cache
        const cachedTexture = this.renderer.cache.getTextureFromSource(source);

        // if we have a cached texture, just copy it
        if(cachedTexture) {
            // force texture uploaded callback
            if(!this._uploaded) {
                // GPU uploading callback
                this.renderer.nextRender.add(() => this._onSourceUploadedCallback && this._onSourceUploadedCallback());

                this._uploaded = true;
            }

            this.copy(cachedTexture);

            this.resize();

            return;
        }

        // no cached texture, proceed normally
        this.source = source;

        if(this.sourceType === "empty") {
            if(source.tagName.toUpperCase() === "IMG") {
                this.sourceType = "image";
            }
            else if(source.tagName.toUpperCase() === "VIDEO") {
                this.sourceType = "video";
                // a video should be updated by default
                // _willUpdate property will be set to true if the video has data to draw
                this.shouldUpdate = true;
            }
            else if(source.tagName.toUpperCase() === "CANVAS") {
                this.sourceType = "canvas";
                // a canvas could change each frame so we need to update it by default
                this._willUpdate = true;
                this.shouldUpdate = true;
            }
            else if(!this.renderer.production) {
                throwWarning(this.type + ": this HTML tag could not be converted into a texture:", source.tagName);
            }
        }

        this._size = {
            width: this.source.naturalWidth || this.source.width || this.source.videoWidth,
            height: this.source.naturalHeight || this.source.height || this.source.videoHeight,
        };

        // our source is loaded now
        this._sourceLoaded = true;

        // no need to set WebGL active texture unit here, we'll do it at run time for each texture
        // binding the texture is enough
        this.gl.bindTexture(this.gl.TEXTURE_2D, this._sampler.texture);

        this.resize();

        // upload our webgl texture only if it is an image
        // canvas and video textures will be updated anyway in the rendering loop
        // thanks to the shouldUpdate and _willUpdate flags
        if(this.sourceType === "image") {
            // generate mip maps if they have not been explicitly disabled
            this.parameters.generateMipmap = this.parameters.generateMipmap || this.parameters.generateMipmap === null;
            this.parameters._shouldUpdate = this.parameters.generateMipmap;
            this._state.generateMipmap = false;

            this._upload();
        }

        // update scene
        this.renderer.needRender();
    }


    /*** TEXTURE PARAMETERS ***/

    /***
     Updates textures parameters that depends on global WebGL context state
     Typically unpacking, flipY and premultiplied alpha
     Usually called before uploading a texture to the GPU
     ***/
    _updateGlobalTexParameters() {
        // unpack alignment
        if(this.renderer.state.unpackAlignment !== this._globalParameters.unpackAlignment) {
            this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, this._globalParameters.unpackAlignment);
            this.renderer.state.unpackAlignment = this._globalParameters.unpackAlignment;
        }

        // flip Y
        if(this.renderer.state.flipY !== this._globalParameters.flipY) {
            this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, this._globalParameters.flipY);
            this.renderer.state.flipY = this._globalParameters.flipY;
        }

        // premultiplied alpha
        if(this.renderer.state.premultiplyAlpha !== this._globalParameters.premultiplyAlpha) {
            this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this._globalParameters.premultiplyAlpha);
            this.renderer.state.premultiplyAlpha = this._globalParameters.premultiplyAlpha;
        }

        // floating point textures
        if(this._globalParameters.floatingPoint === "half-float") {
            if(this.renderer._isWebGL2 && this.renderer.extensions['EXT_color_buffer_float']) {
                this._globalParameters.internalFormat = this.gl.RGBA16F;
                this._globalParameters.type = this.gl.HALF_FLOAT;
            }
            else if(this.renderer.extensions['OES_texture_half_float']) {
                this._globalParameters.type = this.renderer.extensions['OES_texture_half_float'].HALF_FLOAT_OES;
            }
            else if(!this.renderer.production) {
                throwWarning(this.type + ": could not use half-float textures because the extension is not available");
            }
        }
        else if(this._globalParameters.floatingPoint === "float") {
            if(this.renderer._isWebGL2 && this.renderer.extensions['EXT_color_buffer_float']) {
                this._globalParameters.internalFormat = this.gl.RGBA16F;
                this._globalParameters.type = this.gl.FLOAT;
            }
            else if(this.renderer.extensions['OES_texture_float']) {
                this._globalParameters.type = this.renderer.extensions['OES_texture_half_float'].FLOAT;
            }
            else if(!this.renderer.production) {
                throwWarning(this.type + ": could not use float textures because the extension is not available");
            }
        }
    }

    /***
     Updates per-textures parameters
     Wrapping, filters, anisotropy and mipmaps generation
     Usually called after uploading a texture to the GPU
     ***/
    _updateTexParameters() {
        // be sure we're updating the right texture
        if(this.index && this.renderer.state.activeTexture !== this.index) {
            this._bindTexture(this);
        }

        // wrapS
        if(this.parameters.wrapS !== this._state.wrapS) {
            if(!this.renderer._isWebGL2 && (!isPowerOf2(this._size.width) || !isPowerOf2(this._size.height))) {
                this.parameters.wrapS = this.gl.CLAMP_TO_EDGE;
            }

            // handle wrong wrapS values
            if(
                this.parameters.wrapS !== this.gl.REPEAT
                && this.parameters.wrapS !== this.gl.CLAMP_TO_EDGE
                && this.parameters.wrapS !== this.gl.MIRRORED_REPEAT
            ) {
                if(!this.renderer.production) {
                    throwWarning(this.type + ": Wrong wrapS value", this.parameters.wrapS, "for this texture:", this, "\ngl.CLAMP_TO_EDGE wrapping will be used instead");
                }
                this.parameters.wrapS = this.gl.CLAMP_TO_EDGE;
            }

            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.parameters.wrapS);
            this._state.wrapS = this.parameters.wrapS;
        }

        // wrapT
        if(this.parameters.wrapT !== this._state.wrapT) {
            if(!this.renderer._isWebGL2 && (!isPowerOf2(this._size.width) || !isPowerOf2(this._size.height))) {
                this.parameters.wrapT = this.gl.CLAMP_TO_EDGE;
            }

            // handle wrong wrapT values
            if(
                this.parameters.wrapT !== this.gl.REPEAT
                && this.parameters.wrapT !== this.gl.CLAMP_TO_EDGE
                && this.parameters.wrapT !== this.gl.MIRRORED_REPEAT
            ) {
                if(!this.renderer.production) {
                    throwWarning(this.type + ": Wrong wrapT value", this.parameters.wrapT, "for this texture:", this, "\ngl.CLAMP_TO_EDGE wrapping will be used instead");
                }
                this.parameters.wrapT = this.gl.CLAMP_TO_EDGE;
            }

            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.parameters.wrapT);
            this._state.wrapT = this.parameters.wrapT;
        }

        // generate mip map only if it has a source
        if(this.parameters.generateMipmap && !this._state.generateMipmap && this.source) {
            if(!this.renderer._isWebGL2 && (!isPowerOf2(this._size.width) || !isPowerOf2(this._size.height))) {
                this.parameters.generateMipmap = false;
            }
            else {
                this.gl.generateMipmap(this.gl.TEXTURE_2D);
            }

            this._state.generateMipmap = this.parameters.generateMipmap;
        }

        // min filter
        if(this.parameters.minFilter !== this._state.minFilter) {
            // WebGL1 and non PO2
            if(!this.renderer._isWebGL2 && (!isPowerOf2(this._size.width) || !isPowerOf2(this._size.height))) {
                this.parameters.minFilter = this.gl.LINEAR;
            }

            // at this point if generateMipmap is null it means we will generate them later on
            if(!this.parameters.generateMipmap && this.parameters.generateMipmap !== null) {
                this.parameters.minFilter = this.gl.LINEAR;
            }

            // handle wrong minFilter values
            if(
                this.parameters.minFilter !== this.gl.LINEAR
                && this.parameters.minFilter !== this.gl.NEAREST
                && this.parameters.minFilter !== this.gl.NEAREST_MIPMAP_NEAREST
                && this.parameters.minFilter !== this.gl.LINEAR_MIPMAP_NEAREST
                && this.parameters.minFilter !== this.gl.NEAREST_MIPMAP_LINEAR
                && this.parameters.minFilter !== this.gl.LINEAR_MIPMAP_LINEAR
            ) {
                if(!this.renderer.production) {
                    throwWarning(this.type + ": Wrong minFilter value", this.parameters.minFilter, "for this texture:", this, "\ngl.LINEAR filtering will be used instead");
                }
                this.parameters.minFilter = this.gl.LINEAR;
            }

            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.parameters.minFilter);
            this._state.minFilter = this.parameters.minFilter;
        }

        // mag filter
        if(this.parameters.magFilter !== this._state.magFilter) {
            if(!this.renderer._isWebGL2 && (!isPowerOf2(this._size.width) || !isPowerOf2(this._size.height))) {
                this.parameters.magFilter = this.gl.LINEAR;
            }

            // handle wrong magFilter values
            if(
                this.parameters.magFilter !== this.gl.LINEAR
                && this.parameters.magFilter !== this.gl.NEAREST
            ) {
                if(!this.renderer.production) {
                    throwWarning(this.type + ": Wrong magFilter value", this.parameters.magFilter, "for this texture:", this, "\ngl.LINEAR filtering will be used instead");
                }
                this.parameters.magFilter = this.gl.LINEAR;
            }

            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.parameters.magFilter);
            this._state.magFilter = this.parameters.magFilter;
        }

        // anisotropy
        const anisotropyExt = this.renderer.extensions['EXT_texture_filter_anisotropic'];
        if(anisotropyExt && this.parameters.anisotropy !== this._state.anisotropy) {
            const max = this.gl.getParameter(anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
            this.parameters.anisotropy = Math.max(1, Math.min(this.parameters.anisotropy, max));

            this.gl.texParameterf(this.gl.TEXTURE_2D, anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT, this.parameters.anisotropy);
            this._state.anisotropy = this.parameters.anisotropy;
        }
    }


    /***
     Sets the texture wrapping for the texture coordinate S

     params:
     @wrapS (GLenum): WebGL constant specifying the texture wrapping function for the texture coordinate S
     ***/
    setWrapS(wrapS) {
        if(this.parameters.wrapS !== wrapS) {
            this.parameters.wrapS = wrapS;
            this.parameters._shouldUpdate = true;
        }
    }


    /***
     Sets the texture wrapping for the texture coordinate T

     params:
     @wrapT (GLenum): WebGL constant specifying the texture wrapping function for the texture coordinate T
     ***/
    setWrapT(wrapT) {
        if(this.parameters.wrapT !== wrapT) {
            this.parameters.wrapT = wrapT;
            this.parameters._shouldUpdate = true;
        }
    }

    /***
     Sets the texture minifaction filter value

     params:
     @minFilter (GLenum): WebGL constant specifying the texture minification filter
     ***/
    setMinFilter(minFilter) {
        if(this.parameters.minFilter !== minFilter) {
            this.parameters.minFilter = minFilter;
            this.parameters._shouldUpdate = true;
        }
    }

    /***
     Sets the texture magnifaction filter value

     params:
     @magFilter (GLenum): WebGL constant specifying the texture magnifaction filter
     ***/
    setMagFilter(magFilter) {
        if(this.parameters.magFilter !== magFilter) {
            this.parameters.magFilter = magFilter;
            this.parameters._shouldUpdate = true;
        }
    }

    /***
     Sets the texture anisotropy

     params:
     @anisotropy (int): Texture anisotropy value
     ***/
    setAnisotropy(anisotropy) {
        anisotropy = isNaN(anisotropy) ? this.parameters.anisotropy : anisotropy;

        if(this.parameters.anisotropy !== anisotropy) {
            this.parameters.anisotropy = anisotropy;
            this.parameters._shouldUpdate = true;
        }
    }


    /***
     This forces a texture to be updated on the next draw call
     ***/
    needUpdate() {
        this._forceUpdate = true;
    }


    /***
     This uses the requestVideoFrameCallback API to update the texture each time a new frame is displayed
     ***/
    _videoFrameCallback() {
        this._willUpdate = true;
        this.source.requestVideoFrameCallback(() => this._videoFrameCallback());
    }


    /***
     This updloads our texture to the GPU
     Called on init or inside our drawing loop if shouldUpdate property is set to true
     Typically used by videos or canvas
     ***/
    _upload() {
        // set parameters that need to be set before texture uploading
        this._updateGlobalTexParameters();

        if(this.source) {
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this._globalParameters.internalFormat, this._globalParameters.format, this._globalParameters.type, this.source);
        }
        else if(this.sourceType === "fbo") {
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this._globalParameters.internalFormat, this._size.width, this._size.height, 0, this._globalParameters.format, this._globalParameters.type, this.source);
        }

        // texture has been uploaded
        if(!this._uploaded) {
            // GPU uploading callback
            this.renderer.nextRender.add(() => this._onSourceUploadedCallback && this._onSourceUploadedCallback());

            this._uploaded = true;
        }
    }


    /*** TEXTURE SIZINGS ***/


    /***
     This is used to calculate how to crop/center an texture

     returns:
     @sizes (obj): an object containing plane sizes, source sizes and x and y offset to center the source in the plane
     ***/
    _getSizes() {
        // if this is a fbo texture, its size is the same as its parent
        if(this.sourceType === "fbo") {
            return {
                parentWidth: this._parent._boundingRect.document.width,
                parentHeight: this._parent._boundingRect.document.height,
                sourceWidth: this._parent._boundingRect.document.width,
                sourceHeight: this._parent._boundingRect.document.height,
                xOffset: 0,
                yOffset: 0,
            };
        }

        // remember our ShaderPass objects don't have a scale property
        const scale = this._parent.scale ? new Vec2(this._parent.scale.x, this._parent.scale.y) : new Vec2(1, 1);

        const parentWidth  = this._parent._boundingRect.document.width * scale.x;
        const parentHeight = this._parent._boundingRect.document.height * scale.y;

        const sourceWidth = this._size.width;
        const sourceHeight = this._size.height;

        const sourceRatio = sourceWidth / sourceHeight;
        const parentRatio = parentWidth / parentHeight;

        // center image in its container
        let xOffset = 0;
        let yOffset = 0;

        if(parentRatio > sourceRatio) { // means parent is larger
            yOffset = Math.min(0, parentHeight - (parentWidth * (1 / sourceRatio)));
        }
        else if(parentRatio < sourceRatio) { // means parent is taller
            xOffset = Math.min(0, parentWidth - (parentHeight * sourceRatio));
        }

        return {
            parentWidth: parentWidth,
            parentHeight: parentHeight,
            sourceWidth: sourceWidth,
            sourceHeight: sourceHeight,
            xOffset: xOffset,
            yOffset: yOffset,
        };
    }


    /***
     Set the texture scale and then update its matrix

     params:
     @scale (Vec2 object): scale to apply on X and Y axes
     ***/
    setScale(scale) {
        if(!scale.type || scale.type !== "Vec2") {
            if(!this.renderer.production) {
                throwWarning(this.type + ": Cannot set scale because the parameter passed is not of Vec2 type:", scale);
            }

            return;
        }

        scale.sanitizeNaNValuesWith(this.scale).max(new Vec2(0.001, 0.001));

        if(!scale.equals(this.scale)) {
            this.scale.copy(scale);

            this.resize();
        }
    }


    /***
     Gets our texture and parent sizes and tells our texture matrix to update based on those values
     ***/
    _setSize() {
        // if we need to update the texture matrix uniform
        if(this._parent && this._parent._program) {
            const sizes = this._getSizes();

            // always update texture matrix anyway
            this._updateTextureMatrix(sizes);
        }
    }


    /***
     This is used to crop/center a texture
     If the texture is using texture matrix then we just have to update its matrix
     If it is a render pass texture we also upload the texture with its new size on the GPU
     ***/
    resize() {
        if(this.sourceType === "fbo") {
            // update size based on parent sizes (RenderTarget or ShaderPass)
            this._size = {
                width: this._parent._size && this._parent._size.width || this._parent._boundingRect.document.width,
                height: this._parent._size && this._parent._size.height || this._parent._boundingRect.document.height,
            };

            // reupload only if its not a texture set from another texture (means its a RenderTarget texture)
            if(!this._copiedFrom) {
                this.gl.bindTexture(this.gl.TEXTURE_2D, this._sampler.texture);
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this._globalParameters.internalFormat, this._size.width, this._size.height, 0, this._globalParameters.format, this._globalParameters.type, null);
            }
        }
        else if(this.source) {
            // reset texture sizes (useful for canvas because their dimensions might change on resize)
            this._size = {
                width: this.source.naturalWidth || this.source.width || this.source.videoWidth,
                height: this.source.naturalHeight || this.source.height || this.source.videoHeight,
            };
        }

        this._setSize();
    }

    /***
     This updates our textures matrix uniform based on plane and sources sizes

     params:
     @sizes (object): object containing plane sizes, source sizes and x and y offset to center the source in the plane
     ***/
    _updateTextureMatrix(sizes) {
        // calculate scale to apply to the matrix
        let textureScale = new Vec3(
            sizes.parentWidth / (sizes.parentWidth - sizes.xOffset),
            sizes.parentHeight / (sizes.parentHeight - sizes.yOffset),
            1
        );

        // apply texture scale
        textureScale.x /= this.scale.x;
        textureScale.y /= this.scale.y;

        // translate texture to center it
        const textureTranslation = new Mat4([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            (1 - textureScale.x) / 2, (1 - textureScale.y) / 2, 0, 1
        ]);

        // scale texture
        this._textureMatrix.matrix = textureTranslation.scale(textureScale);

        // update the texture matrix uniform
        this.renderer.useProgram(this._parent._program);
        this.gl.uniformMatrix4fv(this._textureMatrix.location, false, this._textureMatrix.matrix.elements);
    }


    /***
     This calls our loading callback and set our media as texture source
     ***/
    _onSourceLoaded(source) {
        // set the media as our texture source
        this.setSource(source);

        // add to the cache if needed
        if(this.sourceType === "image") {
            this.renderer.cache.addTexture(this);
        }
    }


    /*** DRAWING ***/

    /***
     This is used to set the WebGL context active texture and bind it

     params:
     @texture (texture object): Our texture object containing our WebGL texture and its index
     ***/
    _bindTexture() {
        if(this._canDraw) {
            if(this.renderer.state.activeTexture !== this.index) {
                // tell WebGL we want to affect the texture at the plane's index unit
                this.gl.activeTexture(this.gl.TEXTURE0 + this.index);
                this.renderer.state.activeTexture = this.index;
            }

            // bind the texture to the plane's index unit
            this.gl.bindTexture(this.gl.TEXTURE_2D, this._sampler.texture);
        }
    }


    /***
     This is called to draw the texture
     ***/
    _draw() {
        // only draw if the texture is active (used in the shader)
        if(this._sampler.isActive) {
            // bind the texture
            this._bindTexture(this);

            // if no videoFrameCallback check if the video is actually really playing
            if(this.sourceType === "video" && this.source && !this._videoFrameCallbackID && this.source.readyState >= this.source.HAVE_CURRENT_DATA && !this.source.paused) {
                this._willUpdate = true;
            }

            if(this._forceUpdate || (this._willUpdate && this.shouldUpdate)) {
                // force mipmaps regeneration if needed
                this._state.generateMipmap = false;
                this._upload();
            }

            // reset the video willUpdate flag
            if(this.sourceType === "video") {
                this._willUpdate = false;
            }

            this._forceUpdate = false;
        }

        // set parameters that need to be set after texture uploading
        if(this.parameters._shouldUpdate) {
            this._updateTexParameters();
            this.parameters._shouldUpdate = false;
        }
    }


    /*** EVENTS ***/

    /***
     This is called each time a source has been loaded for the first time
     TODO useless?

     params :
     @callback (function) : a function to execute

     returns :
     @this: our texture to handle chaining
     ***/
    onSourceLoaded(callback) {
        if(callback) {
            this._onSourceLoadedCallback = callback;
        }

        return this;
    }

    /***
     This is called each time a texture has been uploaded to the GPU for the first time

     params :
     @callback (function) : a function to execute

     returns :
     @this: our texture to handle chaining
     ***/
    onSourceUploaded(callback) {
        if(callback) {
            this._onSourceUploadedCallback = callback;
        }

        return this;
    }


    /*** DESTROYING ***/

    /***
     This is used to destroy a texture and free the memory space
     Usually used on a plane/shader pass/render target removal

     params:
     @force (bool, optional): force the texture to be deleted even if cached
     ***/
    _dispose(force = false) {
        if(this.sourceType === "video" || this.sourceType === "image" && !this.renderer.state.isActive) {
            // remove event listeners
            if(this._loader) {
                this._loader._removeSource(this);
            }

            // clear source
            this.source = null;
        }
        else if(this.sourceType === "canvas") {
            // clear all canvas states
            this.source.width = this.source.width;

            // clear source
            this.source = null;
        }

        // remove its parent
        this._parent = null;

        // do not delete original texture if this texture is a copy, or image texture if we're not destroying the context
        const shouldDelete = this.gl && !this._copiedFrom && (force || this.sourceType !== "image" || !this.renderer.state.isActive);

        if(shouldDelete) {
            // if the texture is in our textures cache array, remove it
            this.renderer.cache.removeTexture(this);

            this.gl.activeTexture(this.gl.TEXTURE0 + this.index);
            this.gl.bindTexture(this.gl.TEXTURE_2D, null);
            this.gl.deleteTexture(this._sampler.texture);
        }
    }
}