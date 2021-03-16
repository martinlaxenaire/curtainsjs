import {Texture} from '../core/Texture.js';
import {throwError} from "../utils/utils.js";

/*** TEXTURE LOADER CLASS ***/

/***
 An asset loader that handles images, videos and canvas loading
 Load the assets and create a Texture class object that will use those assets as sources

 params:
 @renderer (Curtains or Renderer class object): our curtains object OR our curtains renderer object
 @crossOrigin (string, optional): crossorigin policy to use

 returns :
 @this: our TextureLoader element
 ***/

// TODO load assets with a web worker?

export class TextureLoader {
    constructor(
        renderer,
        crossOrigin = "anonymous",
    ) {
        this.type = "TextureLoader";

        // we could pass our curtains object OR our curtains renderer object
        renderer = renderer && renderer.renderer || renderer;

        // throw warning if no renderer or webgl context
        if(!renderer || renderer.type !== "Renderer") {
            throwError(this.type + ": Renderer not passed as first argument", renderer);
        }
        else if(!renderer.gl) {
            throwError(this.type + ": Renderer WebGL context is undefined", renderer);

            // return if no gl context
            return;
        }

        // renderer and webgl context
        this.renderer = renderer;
        this.gl = this.renderer.gl;

        // crossorigin policy to apply
        this.crossOrigin = crossOrigin;

        // keep a track of all sources loaded via this loader
        this.elements = [];
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
    _addElement(source, texture, successCallback, errorCallback) {
        const el = {
            source,
            texture,
            load: this._sourceLoaded.bind(this, source, texture, successCallback),
            error: this._sourceLoadError.bind(this, source, errorCallback),
        };

        this.elements.push(el);

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

            // execute callback
            if(callback) {
                callback(texture);
            }
        }
    }


    /***
     Get the source type based on its file extension if it's a string or it's tag name if its a HTML element

     params:
     @source (html element or string): html image, video, canvas element or source url

     returns :
     @sourceType (string): either "image", "video", "canvas" or null if source type cannot be determined
     ***/
    _getSourceType(source) {
        let sourceType;

        if(typeof source === "string") {
            // from https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#Supported_image_formats
            if(source.match(/\.(jpeg|jpg|jfif|pjpeg|pjp|gif|bmp|png|webp|svg|avif|apng)$/) !== null) {
                sourceType = "image";
            }
            else if(source.match(/\.(webm|mp4|mpg|mpeg|avi|ogg|ogm|ogv|mov|av1)$/) !== null) {
                sourceType = "video";
            }
        }
        else {
            if(source.tagName.toUpperCase() === "IMG") {
                sourceType = "image";
            }
            else if(source.tagName.toUpperCase() === "VIDEO") {
                sourceType = "video";
            }
            else if(source.tagName.toUpperCase() === "CANVAS") {
                sourceType = "canvas";
            }
        }

        return sourceType;
    }


    /***
     Create an image HTML element based on an image source url

     params:
     @source (string): source url

     returns :
     @image (HTML image element): an HTML image element
     ***/
    _createImage(source) {
        // create a new image element if the source specified is a string
        // or if the crossorigin attribute is not specified (avoid potential CORS errors)
        if(typeof source === "string" || !source.hasAttribute("crossOrigin")) {
            const image = new Image();
            image.crossOrigin = this.crossOrigin;
            if(typeof source === "string") {
                image.src = source;
            }
            else {
                image.src = source.src;
                source.hasAttribute("data-sampler") && image.setAttribute("data-sampler", source.getAttribute("data-sampler"));
            }
            return image;
        }
        else {
            // else return source directly to avoid reloading the image
            return source;
        }
    }


    /***
     Create a video HTML element based on a video source url

     params:
     @source (string): source url

     returns :
     @video (HTML video element): an HTML video element
     ***/
    _createVideo(source) {
        // create a new video element if the source specified is a string
        // or if the crossorigin attribute is not specified (avoid potential CORS errors)
        if(typeof source === "string" || source.getAttribute("crossOrigin") === null) {
            const video = document.createElement("video");
            video.crossOrigin = this.crossOrigin;
            if(typeof source === "string") {
                video.src = source;
            }
            else {
                video.src = source.src;
                source.hasAttribute("data-sampler") && video.setAttribute("data-sampler", source.getAttribute("data-sampler"));
            }
            return video;
        }
        else {
            // else return source directly to avoid reloading the video
            return source;
        }
    }


    /***
     This method loads one source
     It checks what type of source it is then use the right loader

     params:
     @source (html element): html image, video or canvas element
     @textureOptions (object): parameters to apply to the textures, such as sampler name, repeat wrapping, filters, anisotropy...
     @successCallback (function): function to execute when the source has been loaded
     @errorCallback (function): function to execute if the source fails to load
     ***/
    loadSource(
        source,
        textureOptions,
        successCallback,
        errorCallback
    ) {
        // get source type to use the right loader
        const sourceType = this._getSourceType(source);

        switch(sourceType) {
            case "image":
                this.loadImage(source, textureOptions, successCallback, errorCallback);
                break;
            case "video":
                this.loadVideo(source, textureOptions, successCallback, errorCallback);
                break;
            case "canvas":
                this.loadCanvas(source, textureOptions, successCallback);
                break;
            default:
                this._sourceLoadError(source, errorCallback, "this source could not be converted into a texture: " + source);
                break;
        }
    }


    /***
     This method loads an array of sources by calling loadSource() for each one of them

     params:
     @sources (array of html elements / sources url): array of html images, videos, canvases element or sources url
     @texturesOptions (object): parameters to apply to the textures, such as sampler name, repeat wrapping, filters, anisotropy...
     @successCallback (function): function to execute when each source has been loaded
     @errorCallback (function): function to execute if a source fails to load
     ***/
    loadSources(
        sources,
        texturesOptions,
        successCallback,
        errorCallback
    ) {
        for(let i = 0; i < sources.length; i++) {
            this.loadSource(sources[i], texturesOptions, successCallback, errorCallback);
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
        successCallback,
        errorCallback
    ) {
        // check for cache
        const cachedTexture = this.renderer.cache.getTextureFromSource(source);

        let options = Object.assign({}, textureOptions);
        // merge texture options with its parent textures options if needed
        if(this._parent) {
            options = Object.assign(options, this._parent._texturesOptions);
        }

        options.loader = this;

        if(cachedTexture) {
            options.sampler = typeof source !== "string" && source.hasAttribute("data-sampler") ? source.getAttribute("data-sampler") : options.sampler;

            options.fromTexture = cachedTexture;
            const texture = new Texture(this.renderer, options);

            // execute source loaded callback directly
            this._sourceLoaded(cachedTexture.source, texture, successCallback);

            // if there's a parent (PlaneTextureLoader) add texture and source to it
            this._parent && this._addToParent(texture, cachedTexture.source, "image");

            // that's all!
            return;
        }

        const image = this._createImage(source);

        options.sampler = image.hasAttribute("data-sampler") ? image.getAttribute("data-sampler") : options.sampler;

        // create a new texture that will use our image later
        const texture = new Texture(this.renderer, options);

        // add a new entry in our elements array
        const el = this._addElement(image, texture, successCallback, errorCallback);

        // If the image is in the cache of the browser,
        // the 'load' event might have been triggered
        // before we registered the event handler.
        if(image.complete) {
            this._sourceLoaded(image, texture, successCallback);
        }
        else if(image.decode) {
            image.decode().then(this._sourceLoaded.bind(this, image, texture, successCallback)).catch(() => {
                // fallback to classic load & error events
                image.addEventListener('load', el.load, false);
                image.addEventListener('error', el.error, false);
            });
        }
        else {
            image.addEventListener('load', el.load, false);
            image.addEventListener('error', el.error, false);
        }

        // if there's a parent (PlaneTextureLoader) add texture and source to it
        this._parent && this._addToParent(texture, image,  "image");
    }


    /***
     This method loads an array of images by calling loadImage() for each one of them

     params:
     @sources (array of images / images url): array of html images elements or images url
     @texturesOptions (object): parameters to apply to the textures, such as sampler name, repeat wrapping, filters, anisotropy...
     @successCallback (function): function to execute when each source has been loaded
     @errorCallback (function): function to execute if a source fails to load
     ***/
    loadImages(
        sources,
        texturesOptions,
        successCallback,
        errorCallback
    ) {
        for(let i = 0; i < sources.length; i++) {
            this.loadImage(sources[i], texturesOptions, successCallback, errorCallback);
        }
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
        successCallback,
        errorCallback
    ) {
        const video = this._createVideo(source);

        video.preload = true;
        video.muted = true;
        video.loop = true;
        video.setAttribute("playsinline", "");

        video.crossOrigin = this.crossOrigin;

        let options = Object.assign({}, textureOptions);
        // merge texture options with its parent textures options if needed
        if(this._parent) {
            options = Object.assign(textureOptions, this._parent._texturesOptions);
        }

        options.loader = this;
        options.sampler = video.hasAttribute("data-sampler") ? video.getAttribute("data-sampler") : options.sampler;

        // create a new texture that will use our video later
        const texture = new Texture(this.renderer, options);

        // add a new entry in our elements array
        const el = this._addElement(video, texture, successCallback, errorCallback);

        // handle our loaded data event inside the texture and tell our plane when the video is ready to play
        video.addEventListener('canplaythrough', el.load, false);
        video.addEventListener('error', el.error, false);

        // If the video is in the cache of the browser,
        // the 'canplaythrough' event might have been triggered
        // before we registered the event handler.
        if(video.readyState >= video.HAVE_FUTURE_DATA && successCallback) {
            this._sourceLoaded(video, texture, successCallback);
        }

        // start loading our video
        video.load();

        // if there's a parent (PlaneTextureLoader) add texture and source to it
        this._addToParent && this._addToParent(texture, video, "video");

        // if requestVideoFrameCallback exist, use it to update our video texture
        if('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
            el.videoFrameCallback = texture._videoFrameCallback.bind(texture);
            texture._videoFrameCallbackID = video.requestVideoFrameCallback(el.videoFrameCallback);
        }
    }


    /***
     This method loads an array of images by calling loadVideo() for each one of them

     params:
     @sources (array of videos / videos url): array of html videos elements or videos url
     @texturesOptions (object): parameters to apply to the textures, such as sampler name, repeat wrapping, filters, anisotropy...
     @successCallback (function): function to execute when each source has been loaded
     @errorCallback (function): function to execute if a source fails to load
     ***/
    loadVideos(
        sources,
        texturesOptions,
        successCallback,
        errorCallback
    ) {
        for(let i = 0; i < sources.length; i++) {
            this.loadVideo(sources[i], texturesOptions, successCallback, errorCallback);
        }
    }


    /***
     This method loads a canvas
     Creates a new texture object right away and uses the canvas as our WebGL texture

     params:
     @source (canvas): html canvas element
     @textureOptions (object): parameters to apply to the textures, such as sampler name, repeat wrapping, filters, anisotropy...
     @successCallback (function): function to execute when the source has been loaded
     ***/
    loadCanvas(
        source,
        textureOptions = {},
        successCallback
    ) {
        let options = Object.assign({}, textureOptions);
        // merge texture options with its parent textures options if needed
        if(this._parent) {
            options = Object.assign(textureOptions, this._parent._texturesOptions);
        }

        options.loader = this;
        options.sampler = source.hasAttribute("data-sampler") ? source.getAttribute("data-sampler") : options.sampler;

        // create a new texture that will use our source later
        const texture = new Texture(this.renderer, options);

        // add a new entry in our elements array
        this._addElement(source, texture, successCallback, null);

        // canvas are directly loaded
        this._sourceLoaded(source, texture, successCallback);

        // if there's a parent (PlaneTextureLoader) add texture and source to it
        this._parent && this._addToParent(texture, source, "canvas");
    }


    /***
     This method loads an array of images by calling loadCanvas() for each one of them

     params:
     @sources (array of canvas): array of html canvases elements
     @texturesOptions (object): parameters to apply to the textures, such as sampler name, repeat wrapping, filters, anisotropy...
     @successCallback (function): function to execute when each source has been loaded
     ***/
    loadCanvases(
        sources,
        texturesOptions,
        successCallback,
    ) {
        for(let i = 0; i < sources.length; i++) {
            this.loadCanvas(sources[i], texturesOptions, successCallback);
        }
    }


    /*** REMOVING EVENT LISTENERS ***/

    /***
     Cleanly removes a texture source by removing its associated event listeners

     params:
     @texture (Texture class object): The texture that contains our source
     ***/
    _removeSource(texture) {
        // find our reference el in our els array
        const el = this.elements.find((element) => element.texture.uuid === texture.uuid);

        // if we have an element, remove its associated event listeners
        if(el) {
            if(texture.sourceType === "image") {
                el.source.removeEventListener("load", el.load, false);
            }
            else if(texture.sourceType === "video") {
                // cancel video frame callback
                if(el.videoFrameCallback && texture._videoFrameCallbackID) {
                    el.source.cancelVideoFrameCallback(texture._videoFrameCallbackID);
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