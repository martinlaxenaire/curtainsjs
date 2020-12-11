import {TextureLoader} from "./TextureLoader.js";
import {throwWarning} from "../utils/utils.js";

/*** PLANE TEXTURE LOADER CLASS ***/

/***
 Extends our TextureLoader class to add sources loaded count, handle onComplete event
 Also adds the sources and textures to its defined parent

 params:
 @renderer (Curtains renderer or Renderer class object): our curtains object OR our curtains renderer object
 @parent (Plane or ShaderPass class object): The plane or shader pass that will use this loader

 @sourcesLoaded (int): Number of sources loaded
 @sourcesToLoad (int): Number of initial sources to load
 @complete (bool): Whether the loader has loaded all the initial sources
 @onComplete (function): Callback to execute when all the initial sources have been loaded

 returns :
 @this: our PlaneTextureLoader element
 ***/
export class PlaneTextureLoader extends TextureLoader {
    constructor(renderer, parent, {
        sourcesLoaded = 0,
        sourcesToLoad = 0,
        complete = false,

        onComplete = () => {},
    } = {}) {

        super(renderer, parent.crossOrigin);
        this.type = "PlaneTextureLoader";

        this._parent = parent;
        if(this._parent.type !== "Plane" && this._parent.type !== "PingPongPlane" && this._parent.type !== "ShaderPass") {
            throwWarning(this.type + ": Wrong parent type assigned to this loader");
            this._parent = null;
        }

        this.sourcesLoaded = sourcesLoaded;
        this.sourcesToLoad = sourcesToLoad;
        this.complete = complete;

        this.onComplete = onComplete;
    }


    /*** TRACK LOADING ***/

    /***
     Sets the total number of assets to load before firing the onComplete event

     params:
     @size (int): our curtains object OR our curtains renderer object
     ***/
    _setLoaderSize(size) {
        this.sourcesToLoad = size;

        if(this.sourcesToLoad === 0) {
            this.complete = true;
            this.renderer.nextRender.add(() => this.onComplete && this.onComplete());
        }
    }


    /***
     Increment the number of sources loaded
     ***/
    _increment() {
        this.sourcesLoaded++;
        if(this.sourcesLoaded >= this.sourcesToLoad && !this.complete) {
            this.complete = true;
            this.renderer.nextRender.add(() => this.onComplete && this.onComplete());
        }
    }


    /*** UPDATE PARENT SOURCES AND TEXTURES ARAYS ***/

    /***
     Adds the source to the correct parent assets array

     params:
     @source (html element): html image, video or canvas element that has been loaded
     @sourceType (string): either "image", "video" or "canvas"
     ***/
    _addSourceToParent(source, sourceType) {
        // add the source if it is not already in the correct parent assets array
        if(sourceType === "image") {
            const parentAssetArray = this._parent["images"];
            const isInParent = parentAssetArray.find((element) => element.src === source.src);
            !isInParent && parentAssetArray.push(source);
        }
        else if(sourceType === "video") {
            const parentAssetArray = this._parent["videos"];
            const isInParent = parentAssetArray.find((element) => element.src === source.src);
            !isInParent && parentAssetArray.push(source);
        }
        else if(sourceType === "canvas") {
            const parentAssetArray = this._parent["canvases"];
            const isInParent = parentAssetArray.find((element) => element.isSameNode(source));
            !isInParent && parentAssetArray.push(source);
        }
    }


    /***
     Adds the loader parent to the newly created texture
     Also adds the source to the correct parent assets array

     params:
     @texture (Texture class object): our newly created texture
     @source (html element): html image, video or canvas element that has been loaded
     @sourceType (string): either "image", "video" or "canvas"
     ***/
    _addToParent(texture, source, sourceType) {
        this._addSourceToParent(source, sourceType);

        // add the texture to the parent
        this._parent && texture.addParent(this._parent);
    }
}