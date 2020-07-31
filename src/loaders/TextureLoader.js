import {Texture} from '../core/Texture.js';
import {throwError} from "../utils/utils.js";

/*** TEXTURE LOADER CLASS ***/

/***
 An asset loader that handles images, videos and canvas loading
 Load the assets and create a Texture class object that will use those assets as sources

 params:
 @renderer (Curtains or Renderer class object): our curtains object OR our curtains renderer object
 @type (string): Loader type (used internally)
 @crossOrigin (string, optional): crossorigin policy to use

 returns :
 @this: our TextureLoader element
 ***/

// TODO create a new Image or Video element for each of this sources (allows to set crossorigin before src to avois CORS issues)?
// TODO allow to load medias using their src?
// TODO load assets with a web worker?

export class TextureLoader {
    constructor(
        renderer,
        type = "TextureLoader",
        crossOrigin = "anonymous",
    ) {
        this.type = type;

        // we could pass our curtains object OR our curtains renderer object
        renderer = renderer.renderer || renderer;

        // throw warning if no renderer or webgl context
        if(!renderer || renderer.type !== "Renderer") {
            throwError(this.type + ": Renderer not passed as first argument", renderer);
        }
        else if(!renderer.gl) {
            throwError(this.type + ": Renderer WebGL context is undefined", renderer);
        }

        // renderer and webgl context
        this.renderer = renderer;
        this.gl = this.renderer.gl;

        // crossorigin policy to apply
        this.crossOrigin = crossOrigin;

        // keep a track of all sources loaded via this loader
        this.els = [];
    }


    /***
     Keep a track of all sources loaded via this loader with an els array
     This allows to get clean refs to the event listeners to be able to remove them later

     params:
     @source (html element): html image, video or canvas element that has been loaded
     @texture (Texture class object): our newly created texture that will use that source
     @successCallback (function): reference to our success callback
     @errorCallback (function): reference to our error callback
     ***/
    addElement(source, texture, successCallback, errorCallback) {
        const el = {
            source,
            texture,
            load: this._sourceLoaded.bind(this, source, texture, successCallback),
            error: this._sourceLoadError.bind(this, source, errorCallback),
        };

        this.els.push(el);

        return el;
    }


    /***
     Handles media loading errors

     params:
     @source (html element): html image or video element that has failed to load
     @callback (function): function to execute
     @error (object): loading error
     ***/
    _sourceLoadError(source, callback, error) {
        // execute callback
        if(callback) {
            callback(source, error);
        }
    }


    /***
     Handles media loading success

     params:
     @source (html element): html image, video or canvas element that has been loaded
     @texture (Texture class object): our newly created texture that will use that source
     @callback (function): function to execute
     ***/
    _sourceLoaded(source, texture, callback) {
        // execute only once
        if (!texture._sourceLoaded) {
            texture._onSourceLoaded(source);

            // if this loader has a parent (means its a PlaneTextureLoader)
            if(this._parent) {
                // increment plane texture loader
                this._increment && this._increment();

                this.renderer.nextRender.add(() => this._parent._onLoadingCallback && this._parent._onLoadingCallback(texture));
            }
        }

        // execute callback
        if(callback) {
            callback(texture);
        }
    }


    /***
     This method loads one source
     It checks what type of source it is then use the right loader

     params:
     @source (html element): html image, video or canvas element
     ***/
    loadSource(source, params, sucessCallback, errorCallback) {
        if(source.tagName.toUpperCase() === "IMG") {
            return this.loadImage(source, params, sucessCallback, errorCallback);
        }
        else if(source.tagName.toUpperCase() === "VIDEO") {
            return this.loadVideo(source, params, sucessCallback, errorCallback);
        }
        else if(source.tagName.toUpperCase() === "CANVAS") {
            return this.loadCanvas(source, params, sucessCallback);
        }
        else {
            // this type of source is not handled
            return this._sourceLoadError(source, errorCallback, "this HTML tag could not be converted into a texture: " + source.tagName)
        }
    }


    /***
     This method loads an image
     Creates a new texture object right away and once the image is loaded it uses it as our WebGL texture

     params:
     @source (image): html image element
     @textureOptions (object): parameters to apply to the textures, such as sampler name, repeat wrapping, filters, anisotropy...
     @successCallback (function): function to execute when the source has been loaded
     @errorCallback (function): function to execute if the source fails to load
     ***/
    loadImage(
        source,
        textureOptions = {},
        sucessCallback,
        errorCallback
    ) {
        source.crossOrigin = this.crossOrigin;

        // merge texture options with its parent textures options if needed
        if(this._parent) {
            textureOptions = Object.assign(textureOptions, this._parent._texturesOptions);
        }

        // check for cache
        const cachedTexture = this.renderer.cache.getTextureFromSource(source);

        if(cachedTexture) {
            const texture = new Texture(this.renderer, {
                loader: this,
                fromTexture: cachedTexture,

                sampler: textureOptions.sampler || source.getAttribute("data-sampler"),
                premultiplyAlpha: textureOptions.premultiplyAlpha,
                anisotropy: textureOptions.anisotropy,
                generateMipmap: textureOptions.generateMipmap,
                wrapS: textureOptions.wrapS,
                wrapT: textureOptions.wrapT,
                minFilter: textureOptions.minFilter,
                magFilter: textureOptions.magFilter,
            });

            // execute sucess callback directly
            if(sucessCallback) {
                sucessCallback(texture);
            }

            // if there's a parent (PlaneTextureLoader) add texture and source to it
            this._parent && this._addToParent(texture, source, "image");

            // return our texture
            // that's all!
            return texture;
        }

        // create a new texture that will use our image later
        const texture = new Texture(this.renderer, {
            loader: this,

            sampler: textureOptions.sampler || source.getAttribute("data-sampler"),
            premultiplyAlpha: textureOptions.premultiplyAlpha,
            anisotropy: textureOptions.anisotropy,
            generateMipmap: textureOptions.generateMipmap,
            wrapS: textureOptions.wrapS,
            wrapT: textureOptions.wrapT,
            minFilter: textureOptions.minFilter,
            magFilter: textureOptions.magFilter,
        });

        // add a new entry in our elements array
        const el = this.addElement(source, texture, sucessCallback, errorCallback);

        // If the image is in the cache of the browser,
        // the 'load' event might have been triggered
        // before we registered the event handler.
        if(source.complete) {
            this._sourceLoaded(source, texture, sucessCallback);
        }
        else if(source.decode) {
            source.decode().then(this._sourceLoaded.bind(this, source, texture, sucessCallback)).catch(() => {
                // fallback to classic load & error events
                source.addEventListener('load', el.load, false);
                source.addEventListener('error', el.error, false);
            });
        }
        else {
            source.addEventListener('load', el.load, false);
            source.addEventListener('error', el.error, false);
        }

        // if there's a parent (PlaneTextureLoader) add texture and source to it
        this._parent && this._addToParent(texture, source,  "image");
    }


    /***
     This method loads a video
     Creates a new texture object right away and once the video has enough data it uses it as our WebGL texture

     params:
     @source (video): html video element
     @textureOptions (object): parameters to apply to the textures, such as sampler name, repeat wrapping, filters, anisotropy...
     @successCallback (function): function to execute when the source has been loaded
     @errorCallback (function): function to execute if the source fails to load
     ***/
    loadVideo(
        source,
        textureOptions = {},
        sucessCallback,
        errorCallback
    ) {
        source.preload = true;
        source.muted = true;
        source.loop = true;
        source.playsinline = true;

        source.crossOrigin = this.crossOrigin;

        // merge texture options with its parent textures options if needed
        if(this._parent) {
            textureOptions = Object.assign(textureOptions, this._parent._texturesOptions);
        }

        // create a new texture that will use our video later
        const texture = new Texture(this.renderer, {
            loader: this,
            sampler: textureOptions.sampler || source.getAttribute("data-sampler"),
            premultiplyAlpha: textureOptions.premultiplyAlpha,
            anisotropy: textureOptions.anisotropy,
            generateMipmap: textureOptions.generateMipmap,
            wrapS: textureOptions.wrapS,
            wrapT: textureOptions.wrapT,
            minFilter: textureOptions.minFilter,
            magFilter: textureOptions.magFilter,
        });

        // add a new entry in our elements array
        const el = this.addElement(source, texture, sucessCallback, errorCallback);

        // handle our loaded data event inside the texture and tell our plane when the video is ready to play
        source.addEventListener('canplaythrough', el.load, false);
        source.addEventListener('error', el.error, false);

        // If the video is in the cache of the browser,
        // the 'canplaythrough' event might have been triggered
        // before we registered the event handler.
        if(source.readyState >= source.HAVE_FUTURE_DATA && sucessCallback) {
            this._sourceLoaded(source, texture, sucessCallback);
        }

        // start loading our video
        source.load();

        // if there's a parent (PlaneTextureLoader) add texture and source to it
        this._addToParent && this._addToParent(texture, source, "video");

        // if requestVideoFrameCallback exist, use it to update our video texture
        if('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
            el.videoFrameCallback = texture._videoFrameCallback.bind(texture);
            source.hasVideoFrameCallback = true;
            source.requestVideoFrameCallback(el.videoFrameCallback);
        }
    }


    /***
     This method loads a canvas
     Creates a new texture object right away and uses the canvas as our WebGL texture

     params:
     @source (canvas): html canvas element
     @textureOptions (object): parameters to apply to the textures, such as sampler name, repeat wrapping, filters, anisotropy...
     @successCallback (function): function to execute when the source has been loaded
     @errorCallback (function): function to execute if the source fails to load
     ***/
    loadCanvas(
        source,
        textureOptions = {},
        sucessCallback
    ) {
        // merge texture options with its parent textures options if needed
        if(this._parent) {
            textureOptions = Object.assign(textureOptions, this._parent._texturesOptions);
        }

        // create a new texture that will use our source later
        const texture = new Texture(this.renderer, {
            loader: this,
            sampler: textureOptions.sampler || source.getAttribute("data-sampler"),
            premultiplyAlpha: textureOptions.premultiplyAlpha,
            anisotropy: textureOptions.anisotropy,
            generateMipmap: textureOptions.generateMipmap,
            wrapS: textureOptions.wrapS,
            wrapT: textureOptions.wrapT,
            minFilter: textureOptions.minFilter,
            magFilter: textureOptions.magFilter,
        });

        // add a new entry in our elements array
        this.addElement(source, texture, sucessCallback, null);

        // canvas are directly loaded
        this._sourceLoaded(source, texture, sucessCallback);

        // if there's a parent (PlaneTextureLoader) add texture and source to it
        this._parent && this._addToParent(texture, source, "canvas");
    }


    /*** REMOVING EVENT LISTENERS ***/

    /***
     Cleanly removes a texture source by removing its associated event listeners

     params:
     @texture (Texture class object): The texture that contains our source
     ***/
    removeSource(texture) {
        // find our reference el in our els array
        const el = this.els.find((element) => element.texture.uuid === texture.uuid);

        // if we have an element, remove its associated event listeners
        if(el) {
            if(texture.sourceType === "image") {
                el.source.removeEventListener("load", el.load, false);
            }
            else if(texture.sourceType === "video") {
                // cancel video frame callback
                if(el.videoFrameCallback) {
                    el.source.cancelVideoFrameCallback(el.videoFrameCallback);
                }

                el.source.removeEventListener("canplaythrough", el.load, false);
                // empty source to properly delete video element and free the memory
                el.source.pause();
                el.source.removeAttribute("src");
                el.source.load();
            }

            el.source.removeEventListener("error", el.error, false);
        }
    }
}