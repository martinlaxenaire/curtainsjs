import {DOMMesh} from "./DOMMesh.js";
import {Camera} from "../camera/Camera.js";
import {Mat4} from '../math/Mat4.js';
import {Vec2} from '../math/Vec2.js';
import {Vec3} from '../math/Vec3.js';
import {Quat} from '../math/Quat.js';
import {throwWarning} from '../utils/utils.js';

/***
 Here we create our Plane object
 We will extend our DOMMesh class that handles all the WebGL part and basic HTML sizings

 Plane class will add:
 - sizing and positioning and everything that relates to the DOM like draw checks (frustum culling) and reenter/leave events
 - projection (using Camera class object) and view matrices and everything that is related like perspective, scale, rotation...

 params :
 @renderer (Curtains renderer or Renderer class object): our curtains object OR our curtains renderer object
 @plane (html element): the html element that we will use for our Plane object

 @Meshparams (object): see Mesh class object

 @alwaysDraw (boolean, optionnal): if the plane should always be drawn or if it should use frustum culling. Default to false.
 @visible (boolean, optional): if the plane should be drawn or not. Default to true.
 @transparent (boolean, optional): if the plane should handle transparency. Default to false.
 @drawCheckMargins (object, optional): defines the margins in pixels to add to the frustum culling check to determine if the plane should be drawn. Default to 0.
 @autoloadSources (boolean, optional): if the sources should be loaded on init automatically. Default to true
 @watchScroll (boolean, optional): if the plane should auto update its position based on the scroll value. Default to true.
 @fov (float, optional): defines the perspective field of view used by the camera. Default to 50.

 returns :
 @this: our Plane
 ***/
export class Plane extends DOMMesh {
    constructor(renderer, htmlElement, {
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

        // Plane specific params
        alwaysDraw = false,
        visible = true,
        transparent = false,
        drawCheckMargins = {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        },
        autoloadSources = true,
        watchScroll = true,
        fov = 50
    } = {}) {
        super(renderer, htmlElement, "Plane", {
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

        this.index = this.renderer.planes.length;

        // used for FBOs
        this.target = null;

        // use frustum culling or not
        this.alwaysDraw = alwaysDraw;
        // should draw is set to true by default, we'll check it later
        this._shouldDraw = true;

        this.visible = visible;

        // if the plane has transparency
        this._transparent = transparent;

        // draw check margins in pixels
        // positive numbers means it can be displayed even when outside the viewport
        // negative numbers means it can be hidden even when inside the viewport
        this.drawCheckMargins = drawCheckMargins;

        // if we decide to load all sources on init or let the user do it manually
        this.autoloadSources = autoloadSources;

        // if we should watch scroll
        this.watchScroll = watchScroll;

        // define if we should update the plane's matrices when called in the draw loop
        this._updateMVMatrix = false;

        // init camera
        this.camera = new Camera({
            fov: fov,
            width: this.renderer._boundingRect.width,
            height: this.renderer._boundingRect.height,
            pixelRatio: this.renderer.pixelRatio,
        });

        // if program is valid, go on
        if(this._program.compiled) {
            // init our plane
            this._initPlane();

            // add our plane to the scene stack and the renderer array
            this.renderer.scene.addPlane(this);
            this.renderer.planes.push(this);
        }
    }


    /*** RESTORING CONTEXT ***/

    /***
     Used internally to handle context restoration after the program has been successfully compiled again
     ***/
    _programRestored() {
        if(this.target) {
            // reset its render target if needed
            this.setRenderTarget(this.renderer.renderTargets[this.target.index]);
        }

        this._initMatrices();

        // set our initial perspective matrix
        this.setPerspective(this.camera.fov, this.camera.near, this.camera.far);

        this._applyWorldPositions();

        // add the plane to our draw stack again as it have been emptied
        this.renderer.scene.addPlane(this);

        // reset textures
        for(let i = 0; i < this.textures.length; i++) {
            this.textures[i]._parent = this;
            this.textures[i]._restoreContext();
        }

        this._canDraw = true;
    }

    /***
     Init our basic plane values (transformations, positions, camera, sources)
     ***/
    _initPlane() {
        // init transformation values
        this._initTransformValues();

        // init its position values
        this._initPositions();
        // set camera values
        this.setPerspective(this.camera.fov, this.camera.near, this.camera.far);
        // load sources
        this._initSources();
    }


    /*** TRANSFORMATIONS, PROJECTION & MATRICES ***/

    /***
     Set/reset plane's transformation values: rotation, scale, translation, transform origin
     ***/
    _initTransformValues() {
        this.rotation = new Vec3();

        // initial quaternion
        this.quaternion = new Quat();

        // translation in viewport coordinates
        this.relativeTranslation = new Vec3();

        // translation in webgl coordinates
        this._translation = new Vec3();

        // scale is a Vec3 with z always equal to 1
        this.scale = new Vec3(1, 1, 1);

        // set plane transform origin to center
        this.transformOrigin = new Vec3(0.5, 0.5, 0);
    }


    /***
     Reset our plane transformation values and HTML element if specified (and valid)

     params :
     @htmlElement (HTML element, optional) : if provided, new HTML element to use as a reference for sizes and position syncing.
     ***/
    resetPlane(htmlElement) {
        this._initTransformValues();

        if(htmlElement !== null && !!htmlElement) {
            this.htmlElement = htmlElement;

            this.updatePosition();
        }
        else if(!htmlElement && !this.renderer.production) {
            throwWarning(this.type + ": You are trying to reset a plane with a HTML element that does not exist. The old HTML element will be kept instead.");
        }
    }


    /***
     Init our plane position: set its matrices, its position and perspective
     ***/
    _initPositions() {
        // set its matrices
        this._initMatrices();

        // apply our css positions
        this._applyWorldPositions();
    }


    /***
     Init our plane model view and projection matrices and set their uniform locations
     ***/
    _initMatrices() {
        // create our model view and projection matrix
        this._matrices = {
            mvMatrix: {
                name: "uMVMatrix",
                matrix: new Mat4(),
                location: this.gl.getUniformLocation(this._program.program, "uMVMatrix"),
            },
            pMatrix: {
                name: "uPMatrix",
                matrix: new Mat4(), // will be set after
                location: this.gl.getUniformLocation(this._program.program, "uPMatrix"),
            }
        };
    }


    /***
     Set our plane dimensions and positions relative to clip spaces
     ***/
    _setWorldSizes() {
        // dimensions and positions of our plane in the document and clip spaces
        // don't forget translations in webgl space are referring to the center of our plane and canvas
        const planeCenter = {
            x: (this._boundingRect.document.width / 2) + this._boundingRect.document.left,
            y: (this._boundingRect.document.height / 2) + this._boundingRect.document.top,
        };

        const containerCenter = {
            x: (this.renderer._boundingRect.width / 2) + this.renderer._boundingRect.left,
            y: (this.renderer._boundingRect.height / 2) + this.renderer._boundingRect.top,
        };

        // our plane clip space informations
        this._boundingRect.world = {
            width: this._boundingRect.document.width / this.renderer._boundingRect.width,
            height: this._boundingRect.document.height / this.renderer._boundingRect.height,
            top: (containerCenter.y - planeCenter.y) / this.renderer._boundingRect.height,
            left: (planeCenter.x - containerCenter.x) / this.renderer._boundingRect.height,
        };

        // since our vertices values range from -1 to 1
        // we need to scale them under the hood relatively to our canvas
        // to display an accurately sized plane
        this._boundingRect.world.scale = {
            x: (this.renderer._boundingRect.width / this.renderer._boundingRect.height) * this._boundingRect.world.width / 2,
            y: this._boundingRect.world.height / 2,
        };
    }



    /*** PLANES PERSPECTIVES, SCALES AND ROTATIONS ***/

    /***
     This will set our perspective matrix and update our perspective matrix uniform
     used internally at each draw call if needed
     ***/
    _setPerspectiveMatrix() {
        // update our matrix uniform only if we share programs or if we actually have updated its values
        if(this.shareProgram || !this.shareProgram && this.camera._shouldUpdate) {
            this.renderer.useProgram(this._program);
            this.gl.uniformMatrix4fv(this._matrices.pMatrix.location, false, this._matrices.pMatrix.matrix.elements);
        }

        // reset camera shouldUpdate flag
        this.camera.cancelUpdate();
    }


    /***
     This will set our perspective matrix new parameters (fov, near plane and far plane)
     used internally but can be used externally as well to change fov for example

     params :
     @fov (float): the field of view
     @near (float): the nearest point where object are displayed
     @far (float): the farthest point where object are displayed
     ***/
    setPerspective(fov, near, far) {
        this.camera.setPerspective(fov, near, far, this.renderer._boundingRect.width, this.renderer._boundingRect.height, this.renderer.pixelRatio);

        // force camera update on context restoration
        if(this.renderer.state.isContextLost) {
            this.camera.forceUpdate();
        }

        this._matrices.pMatrix.matrix = this.camera.projectionMatrix;

        // if camera settings changed update the mvMatrix as well cause we need to update z translation based on new fov
        this._updateMVMatrix = this.camera._shouldUpdate;
    }


    /***
     This will set our model view matrix
     used internally at each draw call if needed
     It will calculate our matrix based on its plane translation, rotation and scale
     ***/
    _setMVMatrix() {
        if(this._updateMVMatrix) {
            // translation
            // along the Z axis it's based on the relativeTranslation.z, CSSPerspective and camera Z position values
            // we're computing it here because it will change when our fov changes
            this._translation.z = -((1 - (this.relativeTranslation.z / this.camera.CSSPerspective)) / this.camera.position.z);

            // get transformation origin relative to world space
            const origin = new Vec3(
                (this.transformOrigin.x * 2 - 1) // between -1 and 1
                    * this._boundingRect.world.scale.x,
                -(this.transformOrigin.y * 2 - 1) // between -1 and 1
                    * this._boundingRect.world.scale.y,
                this.transformOrigin.z
            );

            // get our transformation matrix
            let transformFromOrigin = new Mat4().composeFromOrigin(this._translation, this.quaternion, this.scale, origin);

            // now scale our plane according to its world bounding rect
            const scaleMatrix = new Mat4([
                this._boundingRect.world.scale.x, 0, 0, 0,
                0, this._boundingRect.world.scale.y, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);

            // we've got our model view matrix
            this._matrices.mvMatrix.matrix = transformFromOrigin.multiply(scaleMatrix);

            // this is the result of our projection matrix * our mv matrix, useful for bounding box calculations and frustum culling
            this._matrices.mVPMatrix = this._matrices.pMatrix.matrix.multiply(this._matrices.mvMatrix.matrix);

            // check if we should draw the plane but only if everything has been initialized
            if(!this.alwaysDraw) {
                this._shouldDrawCheck();
            }
        }

        // update our matrix uniform only if we share programs or if we actually have updated its values
        if(this.shareProgram || !this.shareProgram && this._updateMVMatrix) {
            this.renderer.useProgram(this._program);
            this.gl.uniformMatrix4fv(this._matrices.mvMatrix.location, false, this._matrices.mvMatrix.matrix.elements);
        }

        // reset our flag
        this._updateMVMatrix = false;
    }


    /***
     This will set our plane scale
     used internally but can be used externally as well

     params :
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

        // only apply if values changed
        if(scale.x !== this.scale.x || scale.y !== this.scale.y) {
            this.scale.set(scale.x, scale.y, 1);

            // adjust textures size
            for(let i = 0; i < this.textures.length; i++) {
                this.textures[i].resize();
            }

            // we should update the plane mvMatrix
            this._updateMVMatrix = true;
        }
    }


    /***
     This will set our plane rotation
     used internally but can be used externally as well

     params :
     @rotation (Vec3 object): rotation to apply on X, Y and Z axes (in radians)
     ***/
    setRotation(rotation) {
        if(!rotation.type || rotation.type !== "Vec3") {
            if(!this.renderer.production) {
                throwWarning(this.type + ": Cannot set rotation because the parameter passed is not of Vec3 type:", rotation);
            }

            return;
        }

        rotation.sanitizeNaNValuesWith(this.rotation);

        // only apply if values changed
        if(!rotation.equals(this.rotation)) {
            this.rotation.copy(rotation);

            this.quaternion.setFromVec3(this.rotation);

            // we should update the plane mvMatrix
            this._updateMVMatrix = true;
        }
    }


    /***
     This will set our plane transform origin
     (0, 0, 0) means plane's top left corner
     (1, 1, 0) means plane's bottom right corner
     (0.5, 0.5, -1) means behind plane's center

     params :
     @origin (Vec3 object): coordinate of transformation origin X, Y and Z axes
     ***/
    setTransformOrigin(origin) {
        if(!origin.type || origin.type !== "Vec3") {
            if(!this.renderer.production) {
                throwWarning(this.type + ": Cannot set transform origin because the parameter passed is not of Vec3 type:", origin);
            }

            return;
        }

        origin.sanitizeNaNValuesWith(this.transformOrigin);

        if(!origin.equals(this.transformOrigin)) {
            this.transformOrigin.copy(origin);

            this._updateMVMatrix = true;
        }
    }


    /***
     This will set our plane translation by adding plane computed bounding box values and computed relative position values
     ***/
    _setTranslation() {
        // avoid unnecessary calculations if we don't have a users set relative position
        let worldPosition = new Vec3();
        if(!this.relativeTranslation.equals(worldPosition)) {
            worldPosition = this._documentToWorldSpace(this.relativeTranslation);
        }

        this._translation.set(
            this._boundingRect.world.left + worldPosition.x,
            this._boundingRect.world.top + worldPosition.y,
            this._translation.z,
        );

        // we should update the plane mvMatrix
        this._updateMVMatrix = true;
    }


    /***
     This function takes pixel values along X and Y axis and convert them to clip space coordinates, and then apply the corresponding translation
     TODO deprecated and will be removed soon

     params :
     @translation (Vec3): translation to apply on X, Y and Z axes
     ***/
    setRelativePosition(translation) {
        if(!this.renderer.production) {
            throwWarning(this.type + ": setRelativePosition() is deprecated, use setRelativeTranslation() instead");
        }

        this.setRelativeTranslation(translation);
    }


    /***
     This function takes pixel values along X and Y axis and convert them to clip space coordinates, and then apply the corresponding translation

     params :
     @translation (Vec3): translation to apply on X, Y and Z axes
     ***/
    setRelativeTranslation(translation) {
        if(!translation.type || translation.type !== "Vec3") {
            if(!this.renderer.production) {
                throwWarning(this.type + ": Cannot set translation because the parameter passed is not of Vec3 type:", translation);
            }

            return;
        }

        translation.sanitizeNaNValuesWith(this.relativeTranslation);

        // only apply if values changed
        if(!translation.equals(this.relativeTranslation)) {
            this.relativeTranslation.copy(translation);

            this._setTranslation();
        }
    }


    /***
     This function takes pixel values along X and Y axis and convert them to clip space coordinates

     params :
     @vector (Vec3): position to convert on X, Y and Z axes

     returns :
     @worldPosition: plane's position in WebGL space
     ***/
    _documentToWorldSpace(vector) {
        const worldPosition = new Vec3(
            vector.x / (this.renderer._boundingRect.width / this.renderer.pixelRatio) * (this.renderer._boundingRect.width / this.renderer._boundingRect.height),
            -vector.y / (this.renderer._boundingRect.height / this.renderer.pixelRatio),
            vector.z,
        );

        return worldPosition;
    };


    /*** FRUSTUM CULLING (DRAW CHECK) ***/


    /***
     Find the intersection point by adding a vector starting from a corner till we reach the near plane

     params:
     @refPoint (Vec3 class object): corner of the plane from which we start to iterate from
     @secondPoint (Vec3 class object): second point near the refPoint to get a direction to use for iteration

     returns:
     @intersection (Vec3 class object): intersection between our plane and the camera near plane
     ***/
    _getIntersection(refPoint, secondPoint) {
        // direction vector to add
        let direction = secondPoint.clone().sub(refPoint);

        // copy our corner refpoint
        let intersection = refPoint.clone();
        // iterate till we reach near plane
        while(intersection.z > -1) {
            intersection.add(direction);
        }

        return intersection;
    }

    /***
     Get intersection points between a plane and the camera near plane
     When a plane gets clipped by the camera near plane, the clipped corner projected coords returned by _applyMat4() are erronate
     We need to find the intersection points using another approach
     Here I chose to use non clipped corners projected coords and a really small vector parallel to the plane's side
     We're adding that vector again and again to our corner projected coords until the Z coordinate matches the near plane: we got our intersection

     params:
     @corners (array): our original corners vertices coordinates
     @mvpCorners (array): the projected corners of our plane
     @clippedCorners (array): index of the corners that are clipped

     returns:
     @mvpCorners (array): the corrected projected corners of our plane
     ***/
    _getNearPlaneIntersections(corners, mvpCorners, clippedCorners) {
        // rebuild the clipped corners based on non clipped ones

        if(clippedCorners.length === 1) {
            // we will have 5 corners to check so we'll need to push a new entry in our mvpCorners array
            if(clippedCorners[0] === 0) {
                // top left is culled
                // get intersection iterating from top right
                mvpCorners[0] = this._getIntersection(mvpCorners[1], new Vec3(0.95, 1, 0).applyMat4(this._matrices.mVPMatrix));

                // get intersection iterating from bottom left
                mvpCorners.push(this._getIntersection(mvpCorners[3], new Vec3(-1, -0.95, 0).applyMat4(this._matrices.mVPMatrix)));
            }
            else if(clippedCorners[0] === 1) {
                // top right is culled
                // get intersection iterating from top left
                mvpCorners[1] = this._getIntersection(mvpCorners[0], new Vec3(-0.95, 1, 0).applyMat4(this._matrices.mVPMatrix));

                // get intersection iterating from bottom right
                mvpCorners.push(this._getIntersection(mvpCorners[2], new Vec3(1, -0.95, 0).applyMat4(this._matrices.mVPMatrix)));
            }
            else if(clippedCorners[0] === 2) {
                // bottom right is culled
                // get intersection iterating from bottom left
                mvpCorners[2] = this._getIntersection(mvpCorners[3], new Vec3(-0.95, -1, 0).applyMat4(this._matrices.mVPMatrix));

                // get intersection iterating from top right
                mvpCorners.push(this._getIntersection(mvpCorners[1], new Vec3(1, 0.95, 0).applyMat4(this._matrices.mVPMatrix)));
            }
            else if(clippedCorners[0] === 3) {
                // bottom left is culled
                // get intersection iterating from bottom right
                mvpCorners[3] = this._getIntersection(mvpCorners[2], new Vec3(0.95, -1, 0).applyMat4(this._matrices.mVPMatrix));

                // get intersection iterating from top left
                mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3( -1, 0.95, 0).applyMat4(this._matrices.mVPMatrix)));
            }
        }
        else if(clippedCorners.length === 2) {
            if(clippedCorners[0] === 0 && clippedCorners[1] === 1) {
                // top part of the plane is culled by near plane
                // find intersection using bottom corners
                mvpCorners[0] = this._getIntersection(mvpCorners[3], new Vec3(-1, -0.95, 0).applyMat4(this._matrices.mVPMatrix));
                mvpCorners[1] = this._getIntersection(mvpCorners[2], new Vec3( 1, -0.95, 0).applyMat4(this._matrices.mVPMatrix));
            }
            else if(clippedCorners[0] === 1 && clippedCorners[1] === 2) {
                // right part of the plane is culled by near plane
                // find intersection using left corners
                mvpCorners[1] = this._getIntersection(mvpCorners[0], new Vec3(-0.95, 1, 0).applyMat4(this._matrices.mVPMatrix));
                mvpCorners[2] = this._getIntersection(mvpCorners[3], new Vec3(-0.95, -1, 0).applyMat4(this._matrices.mVPMatrix));
            }
            else if(clippedCorners[0] === 2 && clippedCorners[1] === 3) {
                // bottom part of the plane is culled by near plane
                // find intersection using top corners
                mvpCorners[2] = this._getIntersection(mvpCorners[1], new Vec3(1, 0.95, 0).applyMat4(this._matrices.mVPMatrix));
                mvpCorners[3] = this._getIntersection(mvpCorners[0], new Vec3(-1, 0.95, 0).applyMat4(this._matrices.mVPMatrix));
            }
            else if(clippedCorners[0] === 0 && clippedCorners[1] === 3) {
                // left part of the plane is culled by near plane
                // find intersection using right corners
                mvpCorners[0] = this._getIntersection(mvpCorners[1], new Vec3(0.95, 1, 0).applyMat4(this._matrices.mVPMatrix));
                mvpCorners[3] = this._getIntersection(mvpCorners[2], new Vec3(0.95, -1, 0).applyMat4(this._matrices.mVPMatrix));
            }
        }
        else if(clippedCorners.length === 3) {
            // get the corner that is not clipped
            let nonClippedCorner = 0;
            for(let i = 0; i < corners.length; i++) {
                if(!clippedCorners.includes(i)) {
                    nonClippedCorner = i;
                }
            }

            // we will have just 3 corners so reset our mvpCorners array with just the visible corner
            mvpCorners = [
                mvpCorners[nonClippedCorner]
            ];
            if(nonClippedCorner === 0) {
                // from top left corner to right
                mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(-0.95, 1, 0).applyMat4(this._matrices.mVPMatrix)));
                // from top left corner to bottom
                mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(-1, 0.95, 0).applyMat4(this._matrices.mVPMatrix)));
            }
            else if(nonClippedCorner === 1) {
                // from top right corner to left
                mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(0.95, 1, 0).applyMat4(this._matrices.mVPMatrix)));
                // from top right corner to bottom
                mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(1, 0.95, 0).applyMat4(this._matrices.mVPMatrix)));
            }
            else if(nonClippedCorner === 2) {
                // from bottom right corner to left
                mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(0.95, -1, 0).applyMat4(this._matrices.mVPMatrix)));
                // from bottom right corner to top
                mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(1,-0.95, 0).applyMat4(this._matrices.mVPMatrix)));
            }
            else if(nonClippedCorner === 3) {
                // from bottom left corner to right
                mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(-0.95, -1, 0).applyMat4(this._matrices.mVPMatrix)));
                // from bottom left corner to top
                mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(-1 -0.95, 0).applyMat4(this._matrices.mVPMatrix)));
            }
        }
        else {
            // all 4 corners are culled! artificially apply wrong coords to force plane culling
            for(let i = 0; i < corners.length; i++) {
                mvpCorners[i][0] = 10000;
                mvpCorners[i][1] = 10000;
            }
        }

        return mvpCorners;
    };


    /***
     Useful to get our WebGL plane bounding box in the world space
     Takes all transformations into account
     Used internally for frustum culling

     returns :
     @boundingRectangle (obj): an object containing our plane WebGL element 4 corners coordinates: top left corner is [-1, 1] and bottom right corner is [1, -1]
     ***/
    _getWorldCoords() {
        const corners = [
            new Vec3(-1, 1, 0), // plane's top left corner
            new Vec3(1, 1, 0), // plane's top right corner
            new Vec3(1, -1, 0), // plane's bottom right corner
            new Vec3(-1, -1, 0), // plane's bottom left corner
        ];

        // corners with model view projection matrix applied
        let mvpCorners = [];
        // eventual clipped corners
        let clippedCorners = [];

        // we are going to get our plane's four corners relative to our model view projection matrix
        for(let i = 0; i < corners.length; i++) {
            const mvpCorner = corners[i].applyMat4(this._matrices.mVPMatrix);
            mvpCorners.push(mvpCorner);

            // Z position is > 1 or < -1 means the corner is clipped
            if(Math.abs(mvpCorner.z) > 1) {
                clippedCorners.push(i);
            }
        }

        // near plane is clipping, get intersections between plane and near plane
        if(clippedCorners.length) {
            mvpCorners = this._getNearPlaneIntersections(corners, mvpCorners, clippedCorners);
        }

        // we need to check for the X and Y min and max values
        // use arbitrary integers that will be overriden anyway
        let minX = Infinity;
        let maxX = -Infinity;

        let minY = Infinity;
        let maxY = -Infinity;

        for(let i = 0; i < mvpCorners.length; i++) {
            const corner = mvpCorners[i];

            if(corner.x < minX) {
                minX = corner.x;
            }
            if(corner.x > maxX) {
                maxX = corner.x;
            }

            if(corner.y < minY) {
                minY = corner.y;
            }
            if(corner.y > maxY) {
                maxY = corner.y;
            }
        }

        return {
            top: maxY,
            right: maxX,
            bottom: minY,
            left: minX,
        };
    };


    /***
     Transpose our plane corners coordinates from world space to document space
     Sets an object with the accurate plane WebGL bounding rect relative to document
     ***/
    _computeWebGLBoundingRect() {
        // get our world space bouding rect
        const worldBBox = this._getWorldCoords();

        // normalize worldBBox to (0 -> 1) screen coordinates with [0, 0] being the top left corner and [1, 1] being the bottom right
        let screenBBox = {
            top: 1 - (worldBBox.top + 1) / 2,
            right: (worldBBox.right + 1) / 2,
            bottom: 1 - (worldBBox.bottom + 1) / 2,
            left: (worldBBox.left + 1) / 2,
        };

        screenBBox.width = screenBBox.right - screenBBox.left;
        screenBBox.height = screenBBox.bottom - screenBBox.top;

        // return our values ranging from 0 to 1 multiplied by our canvas sizes + canvas top and left offsets
        this._boundingRect.worldToDocument = {
            width: screenBBox.width * this.renderer._boundingRect.width,
            height: screenBBox.height * this.renderer._boundingRect.height,
            top: screenBBox.top * this.renderer._boundingRect.height + this.renderer._boundingRect.top,
            left: screenBBox.left * this.renderer._boundingRect.width + this.renderer._boundingRect.left,

            // add left and width to get right property
            right: screenBBox.left * this.renderer._boundingRect.width + this.renderer._boundingRect.left + screenBBox.width * this.renderer._boundingRect.width,
            // add top and height to get bottom property
            bottom: screenBBox.top * this.renderer._boundingRect.height + this.renderer._boundingRect.top + screenBBox.height * this.renderer._boundingRect.height,
        };
    }


    /***
     Returns our plane WebGL bounding rect relative to document

     returns :
     @boundingRectangle (obj): an object containing our plane WebGL element bounding rectangle (width, height, top, bottom, right and left properties)
     ***/
    getWebGLBoundingRect() {
        if(!this._matrices.mVPMatrix) {
            return this._boundingRect.document;
        }
        else if(!this._boundingRect.worldToDocument || this.alwaysDraw) {
            this._computeWebGLBoundingRect();
        }

        return this._boundingRect.worldToDocument;
    }


    /***
     Returns our plane WebGL bounding rectangle in document coordinates including additional drawCheckMargins

     returns :
     @boundingRectangle (obj): an object containing our plane WebGL element bounding rectangle including the draw check margins (top, bottom, right and left properties)
     ***/
    _getWebGLDrawRect() {
        this._computeWebGLBoundingRect();

        return {
            top: this._boundingRect.worldToDocument.top - this.drawCheckMargins.top,
            right: this._boundingRect.worldToDocument.right + this.drawCheckMargins.right,
            bottom: this._boundingRect.worldToDocument.bottom + this.drawCheckMargins.bottom,
            left: this._boundingRect.worldToDocument.left - this.drawCheckMargins.left,
        };
    }


    /***
     This function checks if the plane is currently visible in the canvas and sets _shouldDraw property according to this test
     This is our real frustum culling check
     ***/
    _shouldDrawCheck() {
        // get plane bounding rect
        const actualPlaneBounds = this._getWebGLDrawRect();

        // if we decide to draw the plane only when visible inside the canvas
        // we got to check if its actually inside the canvas
        if(
            Math.round(actualPlaneBounds.right) <= this.renderer._boundingRect.left
            || Math.round(actualPlaneBounds.left) >= this.renderer._boundingRect.left + this.renderer._boundingRect.width
            || Math.round(actualPlaneBounds.bottom) <= this.renderer._boundingRect.top
            || Math.round(actualPlaneBounds.top) >= this.renderer._boundingRect.top + this.renderer._boundingRect.height
        ) {
            if(this._shouldDraw) {
                this._shouldDraw = false;
                // callback for leaving view
                this.renderer.nextRender.add(() => this._onLeaveViewCallback && this._onLeaveViewCallback());
            }
        }
        else {
            if(!this._shouldDraw) {
                // callback for entering view
                this.renderer.nextRender.add(() => this._onReEnterViewCallback && this._onReEnterViewCallback());
            }
            this._shouldDraw = true;
        }
    }


    /***
     This function returns if the plane is actually drawn (ie fully initiated, visible property set to true and not culled)
     ***/
    isDrawn() {
        return this._canDraw && this.visible && (this._shouldDraw || this.alwaysDraw);
    }


    /***
     This function uses our plane HTML Element bounding rectangle values and convert them to the world clip space coordinates, and then apply the corresponding translation
     ***/
    _applyWorldPositions() {
        // set our plane sizes and positions relative to the world clipspace
        this._setWorldSizes();

        // set the translation values
        this._setTranslation();
    }


    /***
     This function updates the plane position based on its CSS positions and transformations values.
     Useful if the HTML element has been moved while the container size has not changed.
     ***/
    updatePosition() {
        // set the new plane sizes and positions relative to document by triggering getBoundingClientRect()
        this._setDocumentSizes();

        // apply them
        this._applyWorldPositions();
    }


    /***
     This function updates the plane position based on the Curtains class scroll manager values

     params:
     @lastXDelta (float): last scroll value along X axis
     @lastYDelta (float): last scroll value along Y axis
     ***/
    updateScrollPosition(lastXDelta, lastYDelta) {
        // actually update the plane position only if last X delta or last Y delta is not equal to 0
        if(lastXDelta || lastYDelta) {
            // set new positions based on our delta without triggering reflow
            this._boundingRect.document.top += lastYDelta * this.renderer.pixelRatio;
            this._boundingRect.document.left += lastXDelta * this.renderer.pixelRatio;

            // apply them
            this._applyWorldPositions();
        }
    };


    /*** DEPTH AND RENDER ORDER ***/

    /***
     This function set/unset the depth test for that plane

     params :
     @shouldEnableDepthTest (bool): enable/disable depth test for that plane
     ***/
    enableDepthTest(shouldEnableDepthTest) {
        this._depthTest = shouldEnableDepthTest;
    }


    /***
     This function puts the plane at the end of the draw stack, allowing it to overlap any other plane
     ***/
    moveToFront() {
        this.renderer.scene.movePlaneToFront(this);
    }


    /*** SOURCES ***/

    /***
     Load our initial sources if needed and calls onReady callback
     ***/
    _initSources() {
        // finally load every sources already in our plane html element
        // load plane sources
        let loaderSize = 0;
        if(this.autoloadSources) {
            // load images
            const imagesArray = [];
            for(let i = 0; i < this.htmlElement.getElementsByTagName("img").length; i++) {
                imagesArray.push(this.htmlElement.getElementsByTagName("img")[i]);
            }
            if(imagesArray.length > 0) {
                this.loadImages(imagesArray);
            }

            // load videos
            const videosArray = [];
            for(let i = 0; i < this.htmlElement.getElementsByTagName("video").length; i++) {
                videosArray.push(this.htmlElement.getElementsByTagName("video")[i]);
            }
            if(videosArray.length > 0) {
                this.loadVideos(videosArray);
            }

            // load canvases
            const canvasesArray = [];
            for(let i = 0; i < this.htmlElement.getElementsByTagName("canvas").length; i++) {
                canvasesArray.push(this.htmlElement.getElementsByTagName("canvas")[i]);
            }
            if(canvasesArray.length > 0) {
                this.loadCanvases(canvasesArray);
            }

            loaderSize = imagesArray.length + videosArray.length + canvasesArray.length;
        }

        this.loader._setLoaderSize(loaderSize);

        this._canDraw = true;
    }


    /*** DRAWING ***/

    /***
     Specific instructions for the Plane class to execute before drawing it
     ***/
    _startDrawing() {
        // check if our plane is ready to draw
        if(this._canDraw) {
            // even if our plane should not be drawn we still execute its onRender callback and update its uniforms
            if(this._onRenderCallback) {
                this._onRenderCallback();
            }

            // to improve webgl pipeline performace, we might want to update each texture that needs an update here
            // see https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#texImagetexSubImage_uploads_particularly_with_videos_can_cause_pipeline_flushes


            // if we should render to a render target
            if(this.target) {
                this.renderer.bindFrameBuffer(this.target);
            }
            else if(this.renderer.state.scenePassIndex === null) {
                this.renderer.bindFrameBuffer(null);
            }

            // update our perspective matrix
            this._setPerspectiveMatrix();

            // update our mv matrix
            this._setMVMatrix();

            // now check if we really need to draw it and its textures
            if((this.alwaysDraw || this._shouldDraw) && this.visible) {
                this._draw();
            }
        }
    }


    /*** EVENTS ***/

    /***
     This is called each time a plane is entering again the view bounding box

     params :
     @callback (function) : a function to execute

     returns :
     @this: our plane to handle chaining
     ***/
    onReEnterView(callback) {
        if(callback) {
            this._onReEnterViewCallback = callback;
        }

        return this;
    }


    /***
     This is called each time a plane is leaving the view bounding box

     params :
     @callback (function) : a function to execute

     returns :
     @this: our plane to handle chaining
     ***/
    onLeaveView(callback) {
        if(callback) {
            this._onLeaveViewCallback = callback;
        }

        return this;
    }
}