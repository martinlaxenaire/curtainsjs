import {Mesh} from './Mesh.js';
import {Vec2} from '../math/Vec2.js';
import {throwWarning} from '../utils/utils.js';

/***
 Here we create our DOMGLObject object
 We will extend our Mesh class object by adding HTML sizes helpers (bounding boxes getter/setter and mouse to mesh positioning)

 params:
 @renderer (Curtains renderer or Renderer class object): our curtains object OR our curtains renderer object
 @plane (html element): the html element that we will use for our DOMMesh object
 @type (string): Object type (should be either "Plane" or "ShaderPass")
 @Meshparams (object): see Mesh class object
 
 returns:
 @this: our BasePlane element
 ***/

// TODO raycasting inside mouseToPlaneCoords for Plane objects when transformed

export class DOMMesh extends Mesh {
    constructor(renderer, htmlElement, type = "DOMMesh", {
        // Mesh params
        shareProgram,
        widthSegments,
        heightSegments,
        depthTest,
        cullFace,
        uniforms,
        vertexShaderID,
        fragmentShaderID,
        vertexShader,
        fragmentShader,
        texturesOptions,
        crossOrigin,
    } = {}) {
        // handling HTML shaders scripts
        vertexShaderID = vertexShaderID || htmlElement && htmlElement.getAttribute("data-vs-id");
        fragmentShaderID = fragmentShaderID || htmlElement && htmlElement.getAttribute("data-fs-id");

        super(renderer, type, {
            shareProgram,
            widthSegments,
            heightSegments,
            depthTest,
            cullFace,
            uniforms,
            vertexShaderID,
            fragmentShaderID,
            vertexShader,
            fragmentShader,
            texturesOptions,
            crossOrigin,
        });

        // our HTML element
        this.htmlElement = htmlElement;

        if(!this.htmlElement || this.htmlElement.length === 0) {
            if(!this.renderer.production) throwWarning(this.type + ": The HTML element you specified does not currently exists in the DOM");
        }

        // set plane sizes
        this._setDocumentSizes();
    }


    /*** PLANE SIZES ***/

    /***
     Set our plane dimensions and positions relative to document
     Triggers reflow!
     ***/
    _setDocumentSizes() {
        // set our basic initial infos
        let planeBoundingRect = this.htmlElement.getBoundingClientRect();

        if(!this._boundingRect) this._boundingRect = {};

        // set plane dimensions in document space
        this._boundingRect.document = {
            width: planeBoundingRect.width * this.renderer.pixelRatio,
            height: planeBoundingRect.height * this.renderer.pixelRatio,
            top: planeBoundingRect.top * this.renderer.pixelRatio,
            left: planeBoundingRect.left * this.renderer.pixelRatio,
        };
    };


    /*** BOUNDING BOXES GETTERS ***/

    /***
     Useful to get our plane HTML element bounding rectangle without triggering a reflow/layout

     returns :
     @boundingRectangle (obj): an object containing our plane HTML element bounding rectangle (width, height, top, bottom, right and left properties)
     ***/
    getBoundingRect() {
        return {
            width: this._boundingRect.document.width,
            height: this._boundingRect.document.height,
            top: this._boundingRect.document.top,
            left: this._boundingRect.document.left,

            // right = left + width, bottom = top + height
            right: this._boundingRect.document.left + this._boundingRect.document.width,
            bottom: this._boundingRect.document.top + this._boundingRect.document.height,
        };
    }


    /***
     Handles each plane resizing
     used internally when our container is resized
     TODO will soon be DEPRECATED!
     ***/
    planeResize() {
        if(!this.renderer.production) {
            throwWarning(this.type + ": planeResize() is deprecated, use resize() instead.");
        }

        this.resize();
    }

    /***
     Handles each plane resizing
     used internally when our container is resized
     ***/
    resize() {
        // reset plane dimensions
        this._setDocumentSizes();

        // if this is a Plane object we need to update its perspective and positions
        if(this.type === "Plane") {
            // reset perspective
            this.setPerspective(this.camera.fov, this.camera.near, this.camera.far);

            // apply new position
            this._applyWorldPositions();
        }

        // resize all textures
        for(let i = 0; i < this.textures.length; i++) {
            this.textures[i].resize();
        }

        // handle our after resize event
        this.renderer.nextRender.add(() => this._onAfterResizeCallback && this._onAfterResizeCallback());
    }



    /*** INTERACTION ***/

    /***
     This function takes the mouse position relative to the document and returns it relative to our plane
     It ranges from -1 to 1 on both axis

     params :
     @mouseCoordinates (Vec2 object): coordinates of the mouse

     returns :
     @mousePosition (Vec2 object): the mouse position relative to our plane in WebGL space coordinates
     ***/
    mouseToPlaneCoords(mouseCoordinates) {
        // remember our ShaderPass objects don't have a scale property
        const scale = this.scale ? this.scale : new Vec2(1, 1);

        // we need to adjust our plane document bounding rect to it's webgl scale
        const scaleAdjustment = new Vec2(
            (this._boundingRect.document.width - this._boundingRect.document.width * scale.x) / 2,
            (this._boundingRect.document.height - this._boundingRect.document.height * scale.y) / 2,
        );

        // also we need to divide by pixel ratio
        const planeBoundingRect = {
            width: (this._boundingRect.document.width * scale.x) / this.renderer.pixelRatio,
            height: (this._boundingRect.document.height * scale.y) / this.renderer.pixelRatio,
            top: (this._boundingRect.document.top + scaleAdjustment.y) / this.renderer.pixelRatio,
            left: (this._boundingRect.document.left + scaleAdjustment.x) / this.renderer.pixelRatio,
        };

        // mouse position conversion from document to plane space
        return new Vec2(
            (((mouseCoordinates.x - planeBoundingRect.left) / planeBoundingRect.width) * 2) - 1,
            1 - (((mouseCoordinates.y - planeBoundingRect.top) / planeBoundingRect.height) * 2)
        );
    }


    /*** EVENTS ***/


    /***
     This is called each time a plane has been resized

     params :
     @callback (function) : a function to execute

     returns :
     @this: our plane to handle chaining
     ***/
    onAfterResize(callback) {
        if(callback) {
            this._onAfterResizeCallback = callback;
        }

        return this;
    }
}