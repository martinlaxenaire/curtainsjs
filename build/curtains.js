/***
 Little WebGL helper to apply images, videos or canvases as textures of planes
 Author: Martin Laxenaire https://www.martin-laxenaire.fr/
 Version: 4.0.2
 ***/

'use strict';

/*** CURTAINS CLASS ***/

/***
 This is our main class to call to init our curtains
 Basically sets up all necessary intern variables based on params and runs the init method

 params:
 @containerID (string): the container ID that will hold our canvas

 returns:
 @this: our Curtains element
 ***/
function Curtains(params) {
    this.planes = [];
    this.shaderPasses = [];
    this._drawStack = [];

    this._drawingEnabled = true;
    this._forceRender = false;

    // handle old version init param
    if(typeof params === "string") {
        console.warn("Since v4.0 you should use an object to pass your container and other parameters. Please refer to the docs: https://www.curtainsjs.com/documentation.html");
        var container = params;
        params = {
            container: container
        };
    }

    // set container
    if(!params.container) {
        var container = document.createElement("div");
        container.setAttribute("id", "curtains-canvas");
        document.body.appendChild(container);
        this.container = container;
    }
    else {
        if(typeof params.container === "string") {
            this.container = document.getElementById(params.container);
        }
        else if(params.container instanceof Element) {
            this.container = params.container;
        }
    }

    // if we should use auto resize (default to true)
    this._autoResize = params.autoResize;
    if(this._autoResize === null || this._autoResize === undefined) {
        this._autoResize = true;
    }

    // if we should use auto render (default to true)
    this._autoRender = params.autoRender;
    if(this._autoRender === null || this._autoRender === undefined) {
        this._autoRender = true;
    }

    // if we should watch the scroll (default to true)
    this._watchScroll = params.watchScroll;
    if(this._watchScroll === null || this._watchScroll === undefined) {
        this._watchScroll = true;
    }

    this.productionMode = params.production || false;

    if(!this.container) {
        if(!this.productionMode) console.warn("You must specify a valid container ID");

        // call the error callback if provided
        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return;
    }

    this._init();
}

/***
 Init by creating a canvas and webgl context, set the size and handle events
 Then prepare immediately for drawing as all planes will be created asynchronously
 ***/
Curtains.prototype._init = function() {
    this.glCanvas = document.createElement("canvas");

    // set our webgl context
    this.glContext = this.glCanvas.getContext("webgl", { alpha: true }) || this.glCanvas.getContext("experimental-webgl");

    // WebGL context could not be created
    if(!this.glContext) {
        if(!this.productionMode) console.warn("WebGL context could not be created");

        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return;
    }

    // handling context
    this._loseContextExtension = this.glContext.getExtension('WEBGL_lose_context');

    this._contextLostHandler = this._contextLost.bind(this);
    this.glCanvas.addEventListener("webglcontextlost", this._contextLostHandler, false);

    this._contextRestoredHandler = this._contextRestored.bind(this);
    this.glCanvas.addEventListener("webglcontextrestored", this._contextRestoredHandler, false);

    // handling scroll event
    this._scrollManager = {
        handler: this._scroll.bind(this, true),
        shouldWatch: this._watchScroll,

        // init values even if we won't necessarily use them
        xOffset: window.pageXOffset,
        yOffset: window.pageYOffset,
        lastXDelta: 0,
        lastYDelta: 0,
    };
    if(this._watchScroll) {
        window.addEventListener("scroll", this._scrollManager.handler, {passive: true});
    }

    // this will set the size as well
    var pixelRatio = window.devicePixelRatio || 1;
    this.setPixelRatio(pixelRatio, false);

    // handling window resize event
    this._resizeHandler = null;
    if(this._autoResize) {
        this._resizeHandler = this.resize.bind(this, true);
        window.addEventListener("resize", this._resizeHandler, false);
    }

    // we can start rendering now
    this._readyToDraw();
};


/*** SIZING ***/

/***
 Set the pixel ratio property and update everything by calling resize method
 ***/
Curtains.prototype.setPixelRatio = function(pixelRatio, triggerCallback) {
    this.pixelRatio = parseFloat(Math.max(pixelRatio, 1)) || 1;
    // apply new pixel ratio to all our elements but don't trigger onAfterResize callback
    this.resize(triggerCallback);
};


/***
 Set our container and canvas sizes
 ***/
Curtains.prototype._setSize = function() {
    // get our container bounding client rectangle
    var containerBoundingRect = this.container.getBoundingClientRect();

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
    var isSafari = !!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/);
    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if(isSafari && iOS) {
        // if we are on iOS Safari we'll need a custom function to retrieve our container absolute top position
        function getTopOffset(el) {
            var topOffset = 0;
            while(el && !isNaN(el.offsetTop)) {
                topOffset += el.offsetTop - el.scrollTop;
                el = el.offsetParent;
            }
            return topOffset;
        }

        // use it to update our top value
        this._boundingRect.top = getTopOffset(this.container) * this.pixelRatio;
    }

    this.glCanvas.style.width  = Math.floor(this._boundingRect.width / this.pixelRatio) + "px";
    this.glCanvas.style.height = Math.floor(this._boundingRect.height / this.pixelRatio) + "px";

    this.glCanvas.width  = Math.floor(this._boundingRect.width);
    this.glCanvas.height = Math.floor(this._boundingRect.height);

    this.glContext.viewport(0, 0, this.glContext.drawingBufferWidth, this.glContext.drawingBufferHeight);

    // update scroll values ass well
    if(this._scrollManager.shouldWatch) {
        this._scrollManager.xOffset = window.pageXOffset;
        this._scrollManager.yOffset = window.pageYOffset;
    }
};


/***
 Useful to get our container bounding rectangle without triggering a reflow/layout

 returns :
 @boundingRectangle (obj): an object containing our container bounding rectangle (width, height, top and left properties)
 ***/
Curtains.prototype.getBoundingRect = function() {
    return this._boundingRect;
};


/***
 Resize our container and all the planes

 params:
 @triggerCallback (boolean): Whether we should trigger onAfterResize callback
 ***/
Curtains.prototype.resize = function(triggerCallback) {
    this._setSize();

    // resize the planes only if they are fully initiated
    for(var i = 0; i < this.planes.length; i++) {
        if(this.planes[i]._canDraw) {
            this.planes[i].planeResize();
        }
    }

    // resize the shader passes only if they are fully initiated
    for(var i = 0; i < this.shaderPasses.length; i++) {
        if(this.shaderPasses[i]._canDraw) {
            this.shaderPasses[i].planeResize();
        }
    }

    // be sure we'll update the scene even if drawing is disabled
    this.needRender();

    var self = this;
    setTimeout(function() {
        if(self._onAfterResizeCallback && triggerCallback) {
            self._onAfterResizeCallback();
        }
    }, 0);
};


/*** SCROLLING ***/

/***
 Handles the different values associated with a scroll event (scroll and delta values)
 If no plane watch the scroll then those values won't be retrieved to avoid unnecessary reflow calls
 If at least a plane is watching, update all watching planes positions based on the scroll values
 And force render for at least one frame to actually update the scene
 ***/
Curtains.prototype._scroll = function() {
    // get our scroll values
    var scrollValues = {
        x: window.pageXOffset,
        y: window.pageYOffset,
    };

    // update scroll manager values
    this.updateScrollValues(scrollValues.x, scrollValues.y);

    // shouldWatch should be true if at least one plane watches the scroll
    if(this._scrollManager.shouldWatch) {

        for(var i = 0; i < this.planes.length; i++) {
            // if our plane is watching the scroll, update its position
            if(this.planes[i].watchScroll) {
                this.planes[i].updateScrollPosition();
            }
        }

        // be sure we'll update the scene even if drawing is disabled
        this.needRender();
    }

    // TODO trigger our scroll callback even if we are not actively watching scroll?
    var self = this;
    setTimeout(function() {
        if(self._onScrollCallback) {
            self._onScrollCallback();
        }
    }, 0);
};


/***
 Updates the scroll manager X and Y scroll values as well as last X and Y deltas
 Internally called by the scroll handler if at least one plane is watching the scroll
 Could be called externally as well if the user wants to handle the scroll by himself

 params:
 @x (float): scroll value along X axis
 @y (float): scroll value along Y axis
 ***/
Curtains.prototype.updateScrollValues = function(x, y) {
    // get our scroll delta values
    var lastScrollXValue = this._scrollManager.xOffset;
    this._scrollManager.xOffset = x;
    this._scrollManager.lastXDelta = lastScrollXValue - this._scrollManager.xOffset;

    var lastScrollYValue = this._scrollManager.yOffset;
    this._scrollManager.yOffset = y;
    this._scrollManager.lastYDelta = lastScrollYValue - this._scrollManager.yOffset;
};


/***
 Returns last delta scroll values

 returns:
 @delta (obj): an object containing X and Y last delta values
 ***/
Curtains.prototype.getScrollDeltas = function() {
    return {
        x: this._scrollManager.lastXDelta,
        y: this._scrollManager.lastYDelta,
    };
};


/***
 Returns last window scroll values

 returns:
 @scrollValue (obj): an object containing X and Y last scroll values
 ***/
Curtains.prototype.getScrollValues = function() {
    return {
        x: this._scrollManager.xOffset,
        y: this._scrollManager.yOffset,
    };
};



/*** ENABLING / DISABLING DRAWING ***/

/***
 Enables the render loop
 ***/
Curtains.prototype.enableDrawing = function() {
    this._drawingEnabled = true;
};

/***
 Disables the render loop
 ***/
Curtains.prototype.disableDrawing = function() {
    this._drawingEnabled = false;
};

/***
 Forces the rendering of the next frame, even if disabled
 ***/
Curtains.prototype.needRender = function() {
    this._forceRender = true;
};


/*** HANDLING CONTEXT ***/

/***
 Called when the WebGL context is lost
 ***/
Curtains.prototype._contextLost = function(event) {
    event.preventDefault();

    // cancel requestAnimationFrame
    if(this._animationFrameID) {
        window.cancelAnimationFrame(this._animationFrameID);
    }

    var self = this;
    setTimeout(function() {
        if(self._onContextLostCallback) {
            self._onContextLostCallback();
        }
    }, 0);
};


/***
 Call this method to restore your context
 ***/
Curtains.prototype.restoreContext = function() {
    if(this.glContext && this._loseContextExtension) {
        this._loseContextExtension.restoreContext();
    }
    else if(!this.productionMode) {
        if(!this.glContext) {
            console.warn("Could not restore context because the context is not defined");
        }
        else if(!this._loseContextExtension) {
            console.warn("Could not restore context because the restore context extension is not defined");
        }
    }
};


/***
 Called when the WebGL context is restored
 ***/
Curtains.prototype._contextRestored = function() {
    // we need to reset everything : planes programs, shaders, buffers and textures !
    for(var i = 0; i < this.planes.length; i++) {
        this.planes[i]._restoreContext();
    }

    // same goes for shader passes
    for(var i = 0; i < this.shaderPasses.length; i++) {
        this.shaderPasses[i]._restoreContext();
    }

    var self = this;

    setTimeout(function() {
        if(self._onContextRestoredCallback) {
            self._onContextRestoredCallback();
        }
    }, 0);

    // redraw scene even if drawing is disabled
    this.needRender();

    // requestAnimationFrame again
    this._animate();
};


/***
 Dispose everything
 ***/
Curtains.prototype.dispose = function() {
    // be sure to delete all planes
    while(this.planes.length > 0) {
        this.removePlane(this.planes[0]);
    }
    // we need to delete the shader passes also
    while(this.shaderPasses.length > 0) {
        this.removeShaderPass(this.shaderPasses[0]);
    }

    // wait for all planes to be deleted before stopping everything
    var self = this;
    var deleteInterval = setInterval(function() {
        if(self.planes.length === 0 && self.shaderPasses.length === 0) {
            // clear interval
            clearInterval(deleteInterval);

            // clear the buffer to clean scene
            self.glContext.clear(self.glContext.DEPTH_BUFFER_BIT | self.glContext.COLOR_BUFFER_BIT);

            // cancel animation frame
            if(self._animationFrameID) {
                window.cancelAnimationFrame(self._animationFrameID);
            }

            // remove event listeners
            if(this._resizeHandler) {
                window.removeEventListener("resize", self._resizeHandler, false);
            }
            if(this._watchScroll) {
                window.removeEventListener("scroll", this._scrollManager.handler, {passive: true});
            }

            self.glCanvas.removeEventListener("webglcontextlost", self._contextLostHandler, false);
            self.glCanvas.removeEventListener("webglcontextrestored", self._contextRestoredHandler, false);

            // lose context
            if(self.glContext && self._loseContextExtension) {
                self._loseContextExtension.loseContext();
            }

            // clear canvas state
            self.glCanvas.width = self.glCanvas.width;

            self.glContext = null;

            // remove canvas from DOM
            self.container.removeChild(self.glCanvas);

            self.container = null;
            self.glCanvas = null;
        }
    }, 100);
};



/***
 Create a new Plane element and ensure its program is valid to return the right value

 params:
 @planeHtmlElement (html element): the html element that we will use for our plane
 @params (obj): see addPlane method

 returns:
 @plane: our newly created Plane object
 ***/
Curtains.prototype._createPlane = function(planeHtmlElement, params) {
    var returnedPlane = new Curtains.Plane(this, planeHtmlElement, params);

    if(!returnedPlane._isProgramValid) {
        returnedPlane = false;
    }
    else {
        this.planes.push(returnedPlane);
    }

    return returnedPlane;
};



/***
 Create a Plane element and load its images

 params:
 @planesHtmlElement (html element): the html element that we will use for our plane
 @params (obj): plane params:
 - vertexShaderID (string, optionnal): the vertex shader ID. If not specified, will look for a data attribute data-vs-id on the plane HTML element. Will throw an error if nothing specified
 - fragmentShaderID (string, optionnal): the fragment shader ID. If not specified, will look for a data attribute data-fs-id on the plane HTML element. Will throw an error if nothing specified
 - widthSegments (optionnal): plane definition along the X axis (1 by default)
 - heightSegments (optionnal): plane definition along the Y axis (1 by default)
 - mimicCSS (boolean, optionnal): define if the plane should mimic it's html element position (true by default) DEPRECATED
 - alwaysDraw (boolean, optionnal): define if the plane should always be drawn or it should be drawn only if its within the canvas (false by default)
 - autoloadSources (boolean, optionnal): define if the sources should be load on init automatically (true by default)
 - crossOrigin (string, optionnal): define the crossOrigin process to load images if any
 - fov (int, optionnal): define the perspective field of view (default to 75)
 - uniforms (obj, otpionnal): the uniforms that will be passed to the shaders (if no uniforms specified there wont be any interaction with the plane)

 returns :
 @plane: our newly created plane object
 ***/
Curtains.prototype.addPlane = function(planeHtmlElement, params) {
    // if the WebGL context couldn't be created, return null
    if(!this.glContext) {
        if(!this.productionMode) console.warn("Unable to create a plane. The WebGl context couldn't be created");

        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return null;
    }
    else {
        if(!planeHtmlElement || planeHtmlElement.length === 0) {
            if(!this.productionMode) console.warn("The html element you specified does not currently exists in the DOM");

            if(this._onErrorCallback) {
                this._onErrorCallback()
            }

            return false;
        }

        // init the plane
        var plane = this._createPlane(planeHtmlElement, params);

        return plane;
    }
};



/***
 Completly remove a Plane element (delete from draw stack, delete buffers and textures, empties object, remove)

 params:
 @plane (plane element): the plane element to remove
 ***/
Curtains.prototype.removePlane = function(plane) {
    // first we want to stop drawing it
    plane._canDraw = false;

    // now free the webgl part
    plane && plane._dispose();

    // remove from draw stack
    var drawStack = this._drawStack;
    for(var i = 0; i < drawStack.length; i++) {
        if(plane.index === drawStack[i]) {
            this._drawStack.splice(i, 1);
        }
    }

    // remove from our array
    var planeIndex;
    for(var i = 0; i < this.planes.length; i++) {
        if(plane.index === this.planes[i].index) {
            planeIndex = i;
        }
    }

    // finally erase the plane
    plane = null;
    this.planes[planeIndex] = null;
    this.planes.splice(planeIndex, 1);

    // clear the buffer to clean scene
    if(this.glContext) this.glContext.clear(this.glContext.DEPTH_BUFFER_BIT | this.glContext.COLOR_BUFFER_BIT);
};


/***
 This function will stack planes by their indexes
 We are not necessarily going to draw them in their creation order
 ***/
Curtains.prototype._stackPlane = function(index) {
    this._drawStack.push(index);
};


/*** POST PROCESSING ***/

/***
 Create a new Plane element and ensure its program is valid to return the right value

 params:
 @planeHtmlElement (html element): the html element that we will use for our plane
 @params (obj): see addPlane method

 returns:
 @plane: our newly created Plane object
 ***/
Curtains.prototype._createShaderPass = function(params) {
    var returnedPlane = new Curtains.ShaderPass(this, params);

    if(!returnedPlane._isProgramValid) {
        returnedPlane = false;
    }
    else {
        this.shaderPasses.push(returnedPlane);
    }

    return returnedPlane;
};

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
Curtains.prototype.addShaderPass = function(params) {
    // if the WebGL context couldn't be created, return null
    if(!this.glContext) {
        if(!this.productionMode) console.warn("Unable to create a plane. The WebGl context couldn't be created");

        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return null;
    }
    else {

        // init the plane
        var shaderPass = this._createShaderPass(params);

        return shaderPass;
    }
};


/***
 Completly remove a ShaderPass element
 does almost the same thing as the removePlane method but handles only shaderPasses array, not drawStack

 params:
 @plane (plane element): the plane element to remove
 ***/
Curtains.prototype.removeShaderPass = function(plane) {
    // first we want to stop drawing it
    plane._canDraw = false;

    // now free the webgl part
    plane && plane._dispose();

    // remove from our array
    var planeIndex;
    for(var i = 0; i < this.shaderPasses.length; i++) {
        if(plane.index === this.shaderPasses[i].index) {
            planeIndex = i;
        }
    }

    // finally erase the plane
    plane = null;
    this.shaderPasses[planeIndex] = null;
    this.shaderPasses.splice(planeIndex, 1);

    // clear the buffer to clean scene
    if(this.glContext) this.glContext.clear(this.glContext.DEPTH_BUFFER_BIT | this.glContext.COLOR_BUFFER_BIT);
};


/*** DEPTH ***/

/***
 Called to set whether the renderer will handle depth test or not
 Depth test is enabled by default

 params:
 @shouldHandleDepth (boolean): if we should enable or disable the depth test
 ***/
Curtains.prototype._handleDepth = function(shouldHandleDepth) {
    this._shouldHandleDepth = shouldHandleDepth;

    if(shouldHandleDepth) {
        // enable depth test
        this.glContext.enable(this.glContext.DEPTH_TEST);
    }
    else {
        // disable depth test
        this.glContext.disable(this.glContext.DEPTH_TEST);
    }
};


/*** MATRICES MATHS ***/

/***
 Simple matrix multiplication helper

 params:
 @a (array): first matrix
 @b (array): second matrix

 returns:
 @out: matrix after multiplication
 ***/
Curtains.prototype._multiplyMatrix = function(a, b) {
    var out = [];

    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    // Cache only the current line of the second matrix
    var b0  = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    return out;
};


/***
 Simple matrix scaling helper

 params :
 @matrix (array): initial matrix
 @scaleX (float): scale along X axis
 @scaleY (float): scale along Y axis
 @scaleZ (float): scale along Z axis

 returns :
 @scaledMatrix: matrix after scaling
 ***/
Curtains.prototype._scaleMatrix = function(matrix, scaleX, scaleY, scaleZ) {
    var scaledMatrix = new Float32Array(16);

    scaledMatrix[0] = scaleX * matrix[0 * 4 + 0];
    scaledMatrix[1] = scaleX * matrix[0 * 4 + 1];
    scaledMatrix[2] = scaleX * matrix[0 * 4 + 2];
    scaledMatrix[3] = scaleX * matrix[0 * 4 + 3];
    scaledMatrix[4] = scaleY * matrix[1 * 4 + 0];
    scaledMatrix[5] = scaleY * matrix[1 * 4 + 1];
    scaledMatrix[6] = scaleY * matrix[1 * 4 + 2];
    scaledMatrix[7] = scaleY * matrix[1 * 4 + 3];
    scaledMatrix[8] = scaleZ * matrix[2 * 4 + 0];
    scaledMatrix[9] = scaleZ * matrix[2 * 4 + 1];
    scaledMatrix[10] = scaleZ * matrix[2 * 4 + 2];
    scaledMatrix[11] = scaleZ * matrix[2 * 4 + 3];

    if (matrix !== scaledMatrix) {
        scaledMatrix[12] = matrix[12];
        scaledMatrix[13] = matrix[13];
        scaledMatrix[14] = matrix[14];
        scaledMatrix[15] = matrix[15];
    }

    return scaledMatrix;
};



/***
 Creates a matrix from a quaternion rotation, vector translation and vector scale
 Equivalent for applying translation, rotation and scale matrices but much faster
 Source code from: http://glmatrix.net/docs/mat4.js.html

 params :
 @translation (array): translation vector: [X, Y, Z]
 @rotation (array): rotation vector: [X, Y, Z]
 @scale (array): scale vector: [X, Y, Z]

 returns :
 @transformationMatrix: matrix after transformations
 ***/
Curtains.prototype._applyTransformationsMatrix = function(translation, rotation, scale) {
    var transformationMatrix = new Float32Array(16);

    // handling our rotation quaternion
    var quaternion = new Float32Array(4);

    var ax = rotation[0] * 0.5;
    var ay = rotation[1] * 0.5;
    var az = rotation[2] * 0.5;

    var sinx = Math.sin(ax);
    var cosx = Math.cos(ax);
    var siny = Math.sin(ay);
    var cosy = Math.cos(ay);
    var sinz = Math.sin(az);
    var cosz = Math.cos(az);

    // our quaternion assuming we are doing a XYZ euler rotation
    quaternion[0] = sinx * cosy * cosz - cosx * siny * sinz;
    quaternion[1] = cosx * siny * cosz + sinx * cosy * sinz;
    quaternion[2] = cosx * cosy * sinz - sinx * siny * cosz;
    quaternion[3] = cosx * cosy * cosz + sinx * siny * sinz;

    // applying our transformations all at once!
    // quaternion math
    var x = quaternion[0], y = quaternion[1], z = quaternion[2], w = quaternion[3];
    var x2 = x + x;
    var y2 = y + y;
    var z2 = z + z;

    var xx = x * x2;
    var xy = x * y2;
    var xz = x * z2;
    var yy = y * y2;
    var yz = y * z2;
    var zz = z * z2;
    var wx = w * x2;
    var wy = w * y2;
    var wz = w * z2;
    var sx = scale[0];
    var sy = scale[1];
    var sz = scale[2];

    transformationMatrix[0] = (1 - (yy + zz)) * sx;
    transformationMatrix[1] = (xy + wz) * sx;
    transformationMatrix[2] = (xz - wy) * sx;
    transformationMatrix[3] = 0;
    transformationMatrix[4] = (xy - wz) * sy;
    transformationMatrix[5] = (1 - (xx + zz)) * sy;
    transformationMatrix[6] = (yz + wx) * sy;
    transformationMatrix[7] = 0;
    transformationMatrix[8] = (xz + wy) * sz;
    transformationMatrix[9] = (yz - wx) * sz;
    transformationMatrix[10] = (1 - (xx + yy)) * sz;
    transformationMatrix[11] = 0;
    transformationMatrix[12] = translation[0];
    transformationMatrix[13] = translation[1];
    transformationMatrix[14] = translation[2];
    transformationMatrix[15] = 1;

    return transformationMatrix;
};


/***
 Apply a matrix to a point
 Useful to convert a point position from plane local world to webgl space using projection view matrix for example
 Taken from THREE.js: https://github.com/mrdoob/three.js/blob/master/src/math/Vector3.js

 params :
 @point (array): point to which we apply the matrix
 @matrix (array): 4x4 matrix used

 returns :
 @point: point after matrix application
 ***/
Curtains.prototype._applyMatrixToPoint = function(point, matrix) {
    var x = point[0], y = point[1], z = point[2];

    // implicit 1 in the 4rth dimension
    var w = 1 / (matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15]);

    point[0] = (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) * w;
    point[1] = (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) * w;
    point[2] = (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) * w;

    return point;
};


/*** DRAW EVERYTHING ***/

/***
 This is called when everything is set up and ready to draw
 It will launch our requestAnimationFrame loop
 ***/
Curtains.prototype._readyToDraw = function() {
    // we are ready to go
    this.container.appendChild(this.glCanvas);

    // allows transparency
    // based on https://limnu.com/webgl-blending-youre-probably-wrong/
    this.glContext.enable(this.glContext.BLEND);
    this.glContext.blendFunc(this.glContext.ONE, this.glContext.ONE_MINUS_SRC_ALPHA);

    // enable depth by default
    this._handleDepth(true);

    console.log("curtains.js - v4.0");

    this._animationFrameID = null;
    if(this._autoRender) {
        this._animate();
    }
};


/***
 This just handles our drawing animation frame
 ***/
Curtains.prototype._animate = function() {
    this.render();
    this._animationFrameID = window.requestAnimationFrame(this._animate.bind(this));
};


/***
 This is our draw call, ie what has to be called at each frame our our requestAnimationFrame loop
 draw our planes and shader passes
 ***/
Curtains.prototype.render = function() {
    // If _forceRender is true, force rendering this frame even if drawing is not enabled.
    // If not, only render if enabled.
    if(!this._drawingEnabled && !this._forceRender) return;

    // reset _forceRender
    if(this._forceRender) {
        this._forceRender = false;
    }

    // Curtains onRender callback
    if(this.__onRenderCallback) {
        this.__onRenderCallback();
    }


    // enable first frame buffer for shader passes
    if(this.shaderPasses.length > 0) {
        this.shaderPasses[0]._enableFrameBuffer();
    }
    else {
        // clear the color and depth buffer,
        this.glContext.clearColor(0.0, 0.0, 0.0, 0.0);
        this.glContext.clearDepth(1.0);
        this.glContext.clear(this.glContext.COLOR_BUFFER_BIT | this.glContext.DEPTH_BUFFER_BIT);
    }


    // loop on our stacked planes
    for(var i = 0; i < this._drawStack.length; i++) {
        var plane = this.planes[this._drawStack[i]];
        // be sure the plane exists
        if(plane) {
            // set/unset the depth test if needed
            if(plane._shouldUseDepthTest && !this._shouldHandleDepth) {
                this._handleDepth(true);
            }
            else if(!plane._shouldUseDepthTest && this._shouldHandleDepth) {
                this._handleDepth(false);
            }

            // draw the plane
            plane._drawPlane();
        }
    }

    // if we have shader passes, draw them
    if(this.shaderPasses.length > 0) {
        for (var i = 0; i < this.shaderPasses.length; i++) {
            var shaderPass = this.shaderPasses[i];

            shaderPass._drawPlane();
        }
    }
};


/*** EVENTS ***/


/***
 This is called each time our container has been resized

 params :
 @callback (function) : a function to execute

 returns :
 @this: our Curtains element to handle chaining
 ***/
Curtains.prototype.onAfterResize = function(callback) {
    if(callback) {
        this._onAfterResizeCallback = callback;
    }

    return this;
};

/***
 This is called when an error has been detected during init

 params:
 @callback (function): a function to execute

 returns:
 @this: our Curtains element to handle chaining
 ***/
Curtains.prototype.onError = function(callback) {
    if(callback) {
        this._onErrorCallback = callback;
    }

    return this;
};


/***
 This is called once our context has been lost

 params:
 @callback (function): a function to execute

 returns:
 @this: our Curtains element to handle chaining
 ***/
Curtains.prototype.onContextLost = function(callback) {
    if(callback) {
        this._onContextLostCallback = callback;
    }

    return this;
};


/***
 This is called once our context has been restored

 params:
 @callback (function): a function to execute

 returns:
 @this: our Curtains element to handle chaining
 ***/
Curtains.prototype.onContextRestored = function(callback) {
    if(callback) {
        this._onContextRestoredCallback = callback;
    }

    return this;
};


/***
 This is called once at each request animation frame call

 params:
 @callback (function): a function to execute

 returns:
 @this: our Curtains element to handle chaining
 ***/
Curtains.prototype.onRender = function(callback) {
    if(callback) {
        this.__onRenderCallback = callback;
    }

    return this;
};


/***
 This is called each time window is scrolled and if our scrollManager is active

 params :
 @callback (function) : a function to execute

 returns :
 @this: our Curtains element to handle chaining
 ***/
Curtains.prototype.onScroll = function(callback) {
    if(callback) {
        this._onScrollCallback = callback;
    }

    return this;
};




/*** BASEPLANE CLASS ***/

/***
 Here we create our BasePlane object (note that we are using the Curtains namespace to avoid polluting the global scope)
 We will create a plane object containing the program, shaders, as well as other useful data
 Once our shaders are linked to a program, we create their matrices and set up their default attributes

 params:
 @curtainWrapper: our curtain object that wraps all the planes
 @plane (html element): html div that contains 0 or more media elements.
 @params (obj): see addPlanes method of the wrapper

 returns:
 @this: our BasePlane element
 ***/
Curtains.BasePlane = function(curtainWrapper, plane, params) {
    this._type = "BasicPlane";

    this._wrapper = curtainWrapper;
    this.htmlElement = plane;

    this._initBasePlane(plane, params);
};


/***
 Init our plane object and its properties
 ***/
Curtains.BasePlane.prototype._initBasePlane = function(plane, params) {
    // if params are not defined
    if(!params) params = {};

    this._canDraw = false;

    this._definition = {
        width: parseInt(params.widthSegments) || 1,
        height: parseInt(params.heightSegments) || 1
    };

    // our object that will handle all images loading process
    this._loadingManager = {
        sourcesLoaded: 0,
    };

    // first we prepare the shaders to be set up
    this._setupShaders(params);

    // then we set up the program as compiling can be quite slow
    var isProgramValid = this._setupPlaneProgram();

    this.images = [];
    this.videos = [];
    this.canvases = [];
    this.textures = [];

    this.crossOrigin = params.crossOrigin || "anonymous";

    //set up init uniforms
    // handle uniforms
    if(!params.uniforms) {
        if(!this._wrapper.productionMode) console.warn("You are setting a plane without uniforms, you won't be able to interact with it. Please check your addPlane method for : ", this.htmlElement);

        params.uniforms = {};
    }

    this.uniforms = {};

    // first we create our uniforms objects
    var self = this;
    if(params.uniforms) {
        Object.keys(params.uniforms).map(function(objectKey, index) {
            var uniform = params.uniforms[objectKey];

            // fill our uniform object
            self.uniforms[objectKey] = {
                name: uniform.name,
                type: uniform.type,
                value: uniform.value,
            }
        });
    }

    // if program and shaders are valid, go on
    if(isProgramValid) {
        // should draw is set to true by default, we'll check it later
        this._shouldDraw = true;

        // set plane attributes
        this._setAttributes();

        // set plane sizes
        this._setDocumentSizes();

        // set our uniforms
        this._setUniforms(this.uniforms);

        // set plane definitions, vertices, uvs and stuff
        this._initializeBuffers();

        this._canDraw = true;

        return this;
    }
    else {
        return isProgramValid;
    }
};


/***
 Set a default vertex shader that does nothing but show the plane
 ***/
Curtains.BasePlane.prototype._setDefaultVS = function(params) {
    if(!this._wrapper.productionMode) console.warn("No vertex shader provided, will use a default one");

    return "#ifdef GL_ES\nprecision mediump float;\n#endif\nattribute vec3 aVertexPosition;attribute vec2 aTextureCoord;uniform mat4 uMVMatrix;uniform mat4 uPMatrix;varying vec3 vVertexPosition;varying vec2 vTextureCoord;void main() {vTextureCoord = aTextureCoord;vVertexPosition = aVertexPosition;gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);}";
};


/***
 Set a default fragment shader that does nothing but draw black pixels
 ***/
Curtains.BasePlane.prototype._setDefaultFS = function(params) {
    return "#ifdef GL_ES\nprecision mediump float;\n#endif\nvarying vec3 vVertexPosition;varying vec2 vTextureCoord;void main( void ) {gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);}";
};



/*** SHADERS CREATIONS ***/


/***
 Used internally to set up shaders
 ***/
Curtains.BasePlane.prototype._setupShaders = function(params) {
    var wrapper = this._wrapper;

    // handling shaders
    var vsId = params.vertexShaderID || this.htmlElement.getAttribute("data-vs-id");
    var fsId = params.fragmentShaderID || this.htmlElement.getAttribute("data-fs-id");

    var vsIdHTML, fsIdHTML;

    if(!params.vertexShader) {
        if(!vsId || !document.getElementById(vsId)) {
            vsIdHTML = this._setDefaultVS();
        }
        else {
            vsIdHTML = document.getElementById(vsId).innerHTML;
        }
    }

    if(!params.fragmentShader) {
        if(!fsId || !document.getElementById(fsId)) {
            if(!wrapper.productionMode) console.warn("No fragment shader provided, will use a default one");

            fsIdHTML = this._setDefaultFS();
        }
        else {
            fsIdHTML = document.getElementById(fsId).innerHTML;
        }
    }

    this._shaders = {
        vertexShaderCode: params.vertexShader || vsIdHTML,
        fragmentShaderCode: params.fragmentShader || fsIdHTML,
    };
};


/***
 Create our WebGL shaders based on our written shaders

 params:
 @shaderCode (string): shader code
 @shaderType (shaderType): WebGL shader type (vertex of fragment)

 returns:
 @shader (compiled shader): our compiled shader
 ***/
Curtains.BasePlane.prototype._createShader = function(shaderCode, shaderType) {
    var glContext = this._wrapper.glContext;

    var shader = glContext.createShader(shaderType);

    glContext.shaderSource(shader, shaderCode);
    glContext.compileShader(shader);

    // check shader compilation status only when not in production mode
    if(!this._wrapper.productionMode) {
        if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
            console.warn("Errors occurred while compiling the shader:\n" + glContext.getShaderInfoLog(shader));

            return null;
        }
    }

    return shader;
};


/***
 Used internally to set up program, create the shaders and attach them to the program

 returns:
 @isProgramValid (boolean): indicates if our program has succesfully been created
 ***/
Curtains.BasePlane.prototype._setupPlaneProgram = function() {
    var isProgramValid = true;

    var wrapper = this._wrapper;
    var glContext = wrapper.glContext;

    // create shader program
    this._program = glContext.createProgram();

    // Create shaders,
    this._shaders.vertexShader = this._createShader(this._shaders.vertexShaderCode, glContext.VERTEX_SHADER);
    this._shaders.fragmentShader = this._createShader(this._shaders.fragmentShaderCode, glContext.FRAGMENT_SHADER);

    if(!this._shaders.vertexShader || !this._shaders.fragmentShader) {
        if(!wrapper.productionMode) console.warn("Unable to find or compile the vertex or fragment shader");

        isProgramValid = false;
    }

    // if shaders are valid, go on
    if(isProgramValid) {
        glContext.attachShader(this._program, this._shaders.vertexShader);
        glContext.attachShader(this._program, this._shaders.fragmentShader);
        glContext.linkProgram(this._program);

        // check the shader program creation status only when not in production mode
        if(!wrapper.productionMode) {
            if (!glContext.getProgramParameter(this._program, glContext.LINK_STATUS)) {
                console.warn("Unable to initialize the shader program.");

                isProgramValid = false;
            }
        }
    }

    this._isProgramValid = isProgramValid;

    return isProgramValid;
};


/*** PLANE ATTRIBUTES & UNIFORMS ***/

/*** UNIFORMS ***/

/***
 This is a little helper to set uniforms based on their types

 params :
 @uniformType (string): the uniform type
 @uniformLocation (WebGLUniformLocation obj): location of the current program uniform
 @uniformValue (float/integer or array of float/integer): value to set
 ***/
Curtains.BasePlane.prototype._handleUniformSetting = function(uniformType, uniformLocation, uniformValue) {
    var glContext = this._wrapper.glContext;

    switch(uniformType) {
        case "1i":
            glContext.uniform1i(uniformLocation, uniformValue);
            break;
        case "1iv":
            glContext.uniform1iv(uniformLocation, uniformValue);
            break;
        case "1f":
            glContext.uniform1f(uniformLocation, uniformValue);
            break;
        case "1fv":
            glContext.uniform1fv(uniformLocation, uniformValue);
            break;

        case "2i":
            glContext.uniform2i(uniformLocation, uniformValue[0], uniformValue[1]);
            break;
        case "2iv":
            glContext.uniform2iv(uniformLocation, uniformValue);
            break;
        case "2f":
            glContext.uniform2f(uniformLocation, uniformValue[0], uniformValue[1]);
            break;
        case "2fv":
            glContext.uniform2fv(uniformLocation, uniformValue);
            break;

        case "3i":
            glContext.uniform3i(uniformLocation, uniformValue[0], uniformValue[1], uniformValue[2]);
            break;
        case "3iv":
            glContext.uniform3iv(uniformLocation, uniformValue);
            break;
        case "3f":
            glContext.uniform3f(uniformLocation, uniformValue[0], uniformValue[1], uniformValue[2]);
            break;
        case "3fv":
            glContext.uniform3fv(uniformLocation, uniformValue);
            break;

        case "4i":
            glContext.uniform4i(uniformLocation, uniformValue[0], uniformValue[1], uniformValue[2], uniformValue[3]);
            break;
        case "4iv":
            glContext.uniform4iv(uniformLocation, uniformValue);
            break;
        case "4f":
            glContext.uniform4f(uniformLocation, uniformValue[0], uniformValue[1], uniformValue[2], uniformValue[3]);
            break;
        case "4fv":
            glContext.uniform4fv(uniformLocation, uniformValue);
            break;

        case "mat2":
            glContext.uniformMatrix2fv(uniformLocation, false, uniformValue);
            break;
        case "mat3":
            glContext.uniformMatrix3fv(uniformLocation, false, uniformValue);
            break;
        case "mat4":
            glContext.uniformMatrix4fv(uniformLocation, false, uniformValue);
            break;

        default:
            if(!this._wrapper.productionMode) console.warn("This uniform type is not handled : ", uniformType);
    }
};


/***
 This sets our shaders uniforms

 params :
 @uniforms (obj): uniforms to apply
 ***/
Curtains.BasePlane.prototype._setUniforms = function(uniforms) {
    var wrapper = this._wrapper;
    var glContext = wrapper.glContext;
    // ensure we are using the right program
    glContext.useProgram(this._program);

    var self = this;
    // set our uniforms if we got some
    if(uniforms) {
        Object.keys(uniforms).map(function(objectKey, index) {
            var uniform = uniforms[objectKey];

            // set our uniform location
            uniform.location = glContext.getUniformLocation(self._program, uniform.name);

            if(!uniform.type) {
                if(Array.isArray(uniform.value)) {
                    if(uniform.value.length === 4) {
                        uniform.type = "4f";

                        if(!wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a 4f (array of 4 floats) uniform type");
                    }
                    else if(uniform.value.length === 3) {
                        uniform.type = "3f";

                        if(!wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a 3f (array of 3 floats) uniform type");
                    }
                    else if(uniform.value.length === 2) {
                        uniform.type = "2f";

                        if(!wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a 2f (array of 2 floats) uniform type");
                    }
                }
                else if(uniform.value.constructor === Float32Array) {
                    if(uniform.value.length === 16) {
                        uniform.type = "mat4";

                        if(!wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a mat4 (4x4 matrix array) uniform type");
                    }
                    else if(uniform.value.length === 9) {
                        uniform.type = "mat3";

                        if(!wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a mat3 (3x3 matrix array) uniform type");
                    }
                    else  if(uniform.value.length === 4) {
                        uniform.type = "mat2";

                        if(!wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a mat2 (2x2 matrix array) uniform type");
                    }
                }
                else {
                    uniform.type = "1f";

                    if(!wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a 1f (float) uniform type");
                }
            }

            // set the uniforms
            self._handleUniformSetting(uniform.type, uniform.location, uniform.value);
        });
    }
};


/***
 This updates all uniforms of a plane that were set by the user
 It is called at each draw call
 ***/
Curtains.BasePlane.prototype._updateUniforms = function(uniforms) {
    if(uniforms) {
        var self = this;
        Object.keys(uniforms).map(function(objectKey) {

            var uniform = uniforms[objectKey];

            var location = uniform.location;
            var value = uniform.value;
            var type = uniform.type;

            // update our uniforms
            self._handleUniformSetting(type, location, value);
        });
    }
};

/*** ATTRIBUTES ***/

/***
 This set our plane vertex shader attributes

 BE CAREFUL : if an attribute is set here, it MUST be DECLARED and USED inside our plane vertex shader
 ***/
Curtains.BasePlane.prototype._setAttributes = function() {
    // set default attributes
    if(!this._attributes) this._attributes = {};

    this._attributes.vertexPosition = {
        name: "aVertexPosition",
        location: this._wrapper.glContext.getAttribLocation(this._program, "aVertexPosition"),
    };

    this._attributes.textureCoord = {
        name: "aTextureCoord",
        location: this._wrapper.glContext.getAttribLocation(this._program, "aTextureCoord"),
    };
};


/*** PLANE VERTICES AND BUFFERS ***/

/***
 This method is used internally to create our vertices coordinates and texture UVs
 we first create our UVs on a grid from [0, 0, 0] to [1, 1, 0]
 then we use the UVs to create our vertices coords
 ***/
Curtains.BasePlane.prototype._setPlaneVertices = function() {
    // geometry vertices
    this._geometry = {
        vertices: [],
    };

    // now the texture UVs coordinates
    this._material = {
        uvs: [],
    };

    for (var y = 0; y < this._definition.height; ++y) {
        var v = y / this._definition.height;

        for (var x = 0; x < this._definition.width; ++x) {
            var u = x / this._definition.width;

            // uvs and vertices
            // our uvs are ranging from 0 to 1, our vertices range from -1 to 1

            // first triangle
            this._material.uvs.push(u);
            this._material.uvs.push(v);
            this._material.uvs.push(0);

            this._geometry.vertices.push((u - 0.5) * 2);
            this._geometry.vertices.push((v - 0.5) * 2);
            this._geometry.vertices.push(0);

            this._material.uvs.push(u + (1 / this._definition.width));
            this._material.uvs.push(v);
            this._material.uvs.push(0);

            this._geometry.vertices.push(((u + (1 / this._definition.width)) - 0.5) * 2);
            this._geometry.vertices.push((v - 0.5) * 2);
            this._geometry.vertices.push(0);

            this._material.uvs.push(u);
            this._material.uvs.push(v + (1 / this._definition.height));
            this._material.uvs.push(0);

            this._geometry.vertices.push((u - 0.5) * 2);
            this._geometry.vertices.push(((v + (1 / this._definition.height)) - 0.5) * 2);
            this._geometry.vertices.push(0);

            // second triangle
            this._material.uvs.push(u);
            this._material.uvs.push(v + (1 / this._definition.height));
            this._material.uvs.push(0);

            this._geometry.vertices.push((u - 0.5) * 2);
            this._geometry.vertices.push(((v + (1 / this._definition.height)) - 0.5) * 2);
            this._geometry.vertices.push(0);

            this._material.uvs.push(u + (1 / this._definition.width));
            this._material.uvs.push(v + (1 / this._definition.height));
            this._material.uvs.push(0);

            this._geometry.vertices.push(((u + (1 / this._definition.width)) - 0.5) * 2);
            this._geometry.vertices.push(((v + (1 / this._definition.height)) - 0.5) * 2);
            this._geometry.vertices.push(0);

            this._material.uvs.push(u + (1 / this._definition.width));
            this._material.uvs.push(v);
            this._material.uvs.push(0);

            this._geometry.vertices.push(((u + (1 / this._definition.width)) - 0.5) * 2);
            this._geometry.vertices.push((v - 0.5) * 2);
            this._geometry.vertices.push(0);
        }
    }
};


/***
 This method creates our vertex and texture coord buffers
 ***/
Curtains.BasePlane.prototype._initializeBuffers = function() {
    var wrapper = this._wrapper;
    var glContext = wrapper.glContext;

    // we could not use plane._size property here because it might have changed since its creation
    // if the plane does not have any texture yet, a window resize does not trigger the resize function

    // if this our first time we need to create our geometry and material objects
    if(!this._geometry && !this._material) {
        this._setPlaneVertices();
    }

    if(!this._attributes) return;

    // now we'll create vertices and uvs attributes
    this._geometry.bufferInfos = {
        id: glContext.createBuffer(),
        itemSize: 3,
        numberOfItems: this._geometry.vertices.length / 3, // divided by item size
    };

    glContext.enableVertexAttribArray(this._attributes.vertexPosition.location);

    glContext.bindBuffer(glContext.ARRAY_BUFFER, this._geometry.bufferInfos.id);
    glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(this._geometry.vertices), glContext.STATIC_DRAW);

    // Set where the vertexPosition attribute gets its data,
    glContext.vertexAttribPointer(this._attributes.vertexPosition.location, this._geometry.bufferInfos.itemSize, glContext.FLOAT, false, 0, 0);


    this._material.bufferInfos = {
        id: glContext.createBuffer(),
        itemSize: 3,
        numberOfItems: this._material.uvs.length / 3, // divided by item size
    };

    glContext.enableVertexAttribArray(this._attributes.textureCoord.location);

    glContext.bindBuffer(glContext.ARRAY_BUFFER, this._material.bufferInfos.id);
    glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(this._material.uvs), glContext.STATIC_DRAW);

    glContext.vertexAttribPointer(this._attributes.textureCoord.location, this._material.bufferInfos.itemSize, glContext.FLOAT, false, 0, 0);
};


/***
 Used internally handle context restoration
 ***/
Curtains.BasePlane.prototype._restoreContext = function() {
    this._canDraw = false;

    // remove and reset everything that depends on the context
    this._shaders.vertexShader = null;
    this._shaders.fragmentShader = null;

    this._program = null;

    if(this._matrices) {
        this._matrices = null;
    }

    this._attributes = null;

    this._geometry.bufferInfos = null;
    this._material.bufferInfos = null;

    // reset also frame and depth buffer if needed
    if(this._type === "ShaderPass") {
        this._frameBuffer = null;
        this._depthBuffer = null;
    }

    // reset plane shaders, programs and matrices
    var isProgramValid = this._setupPlaneProgram();

    if(isProgramValid) {
        // reset attributes
        this._setAttributes();

        // reset plane uniforms
        this._setUniforms(this.uniforms);

        // reinitialize buffers
        this._initializeBuffers();


        // reset textures
        for(var i = 0; i < this.textures.length; i++) {
            var source = this.textures[i].source;

            // if our texture is a render texture use special init
            if(this.textures[i].type === "texturePass") {
                this.textures[i]._initShaderPassTexture();
            }
            else {
                // else use standard init and reset source
                this.textures[i]._init();
                this.textures[i].setSource(source);
            }
        }

        // if this is a Plane object we need to reset its matrices, perspective and position
        if(this._type === "Plane") {
            this._initMatrices();

            // set our initial perspective matrix
            this.setPerspective(this._fov, 0.1, this._fov * 2);

            this._applyCSSPositions();
        }
        else {
            // if this is a ShaderPlane object, recreate its frame buffer
            this._createFrameBuffer();
        }

        this._canDraw = true;
    }
};


/*** PLANE SIZES AND TEXTURES HANDLING ***/

/***
 Set our plane dimensions and positions relative to document
 ***/
Curtains.BasePlane.prototype._setDocumentSizes = function() {
    var wrapper = this._wrapper;

    // set our basic initial infos
    var planeBoundingRect = this.htmlElement.getBoundingClientRect();

    // just in case the html element is missing from the DOM, set its container values instead
    if(planeBoundingRect.width === 0 && planeBoundingRect.height === 0) {
        planeBoundingRect = wrapper._boundingRect;
    }

    if(!this._boundingRect) this._boundingRect = {};

    // set plane dimensions in document space
    this._boundingRect.document = {
        width: planeBoundingRect.width * wrapper.pixelRatio,
        height: planeBoundingRect.height * wrapper.pixelRatio,
        top: planeBoundingRect.top * wrapper.pixelRatio,
        left: planeBoundingRect.left * wrapper.pixelRatio,
    };
};


/***
 Useful to get our plane bounding rectangle without triggering a reflow/layout

 returns :
 @boundingRectangle (obj): an object containing our plane HTML element bounding rectangle (width, height, top, bottom, right and left properties)
 ***/
Curtains.BasePlane.prototype.getBoundingRect = function() {
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
 Useful to get our WebGL plane bounding rectangle
 Takes all transformations into account
 Used internally for frustum culling

 returns :
 @boundingRectangle (obj): an object containing our plane WebGL element bounding rectangle (width, height, top, bottom, right and left properties)
 ***/
Curtains.BasePlane.prototype.getWebGLBoundingRect = function() {
    var wrapper = this._wrapper;

    var vPMatrix = this._matrices.viewProjectionMatrix;

    // check that our view projection matrix is defined
    if(vPMatrix) {
        // we are going to get our plane's four corners relative to our view projection matrix
        var corners = [
            wrapper._applyMatrixToPoint([-1, 1, 0], vPMatrix), // plane's top left corner
            wrapper._applyMatrixToPoint([1, 1, 0], vPMatrix), // plane's top right corner
            wrapper._applyMatrixToPoint([1, -1, 0], vPMatrix), // plane's bottom right corner
            wrapper._applyMatrixToPoint([-1, -1, 0], vPMatrix) // plane's bottom left corner
        ];

        // we need to check for the X and Y min and max values
        // use arbitrary integers that will be overrided anyway
        var minX = 1000000;
        var maxX = -1000000;

        var minY = 1000000;
        var maxY = -1000000;

        for(var i = 0; i < corners.length; i++) {
            var corner = corners[i];
            // convert from coordinates range of [-1, 1] to coordinates range of [0, 1]
            corner[0] = (corner[0] + 1) / 2;
            corner[1] = 1 - (corner[1] + 1) / 2;

            if(corner[0] < minX) {
                minX = corner[0];
            }
            else if(corner[0] > maxX) {
                maxX = corner[0];
            }

            if(corner[1] < minY) {
                minY = corner[1];
            }
            else if(corner[1] > maxY) {
                maxY = corner[1];
            }
        }

        // return our values ranging from 0 to 1 multiplied by our canvas sizes + canvas top and left offsets
        return {
            width: (maxX - minX) * wrapper._boundingRect.width,
            height: (maxY - minY) * wrapper._boundingRect.height,
            top: minY * wrapper._boundingRect.height + wrapper._boundingRect.top,
            left: minX * wrapper._boundingRect.width + wrapper._boundingRect.left,

            // add left and width to get right property
            right: minX * wrapper._boundingRect.width + wrapper._boundingRect.left + (maxX - minX) * wrapper._boundingRect.width,
            // add top and height to get bottom property
            bottom: minY * wrapper._boundingRect.height + wrapper._boundingRect.top + (maxY - minY) * wrapper._boundingRect.height,
        };
    }
    else {
        return this._boundingRect.document;
    }
};


/***
 Handles each plane resizing
 used internally when our container is resized
 ***/
Curtains.BasePlane.prototype.planeResize = function() {
    // reset plane dimensions
    this._setDocumentSizes();

    // if this is a Plane object we need to update its perspective and positions
    if(this._type === "Plane") {
        // set its new computed sizes
        this._setComputedSizes();

        // reset perspective
        this.setPerspective(this._fov, 0.1, this._fov * 2);

        // apply new position
        this._applyCSSPositions();
    }

    // resize all textures
    for(var i = 0; i < this.textures.length; i++) {
        this.textures[i]._adjustTextureSize();
    }

    // resize our frame and depth buffers by binding them again
    if(this._type === "ShaderPass") {
        this._wrapper.glContext.bindFramebuffer(this._wrapper.glContext.FRAMEBUFFER, this._frameBuffer);
        this._bindDepthBuffer();
    }

    // handle our after resize event
    var self = this;
    setTimeout(function() {
        if(self._onAfterResizeCallback) {
            self._onAfterResizeCallback();
        }
    });
};



/*** IMAGES, VIDEOS AND CANVASES LOADING ***/

/***
 This method creates a new Texture associated to the plane

 params :
 @type (string) : texture type, either image, video or canvas

 returns :
 @t: our newly created texture
 ***/
Curtains.BasePlane.prototype.createTexture = function(sampler, isTexturePass) {
    var t = new Curtains.Texture(this, {
        index: this.textures.length,
        sampler: sampler,
        isTexturePass: isTexturePass,
    });

    // add our texture to the textures array
    this.textures.push(t);

    return t;
};


/***
 This method handles the sources loading process

 params :
 @sourcesArray (array) : array of html images, videos or canvases elements
 ***/
Curtains.BasePlane.prototype.loadSources = function(sourcesArray) {
    for(var i = 0; i < sourcesArray.length; i++) {
        this.loadSource(sourcesArray[i]);
    }
};


/***
 This method loads one source
 It checks what type of source it is then use the right loader

 params :
 @source (html element) : html image, video or canvas element
 ***/
Curtains.BasePlane.prototype.loadSource = function(source) {
    if(source.tagName.toUpperCase() === "IMG") {
        this.loadImage(source);
    }
    else if(source.tagName.toUpperCase() === "VIDEO") {
        this.loadVideo(source);
    }
    else if(source.tagName.toUpperCase() === "CANVAS") {
        this.loadCanvas(source);
    }
    else if(!this._wrapper.productionMode) {
        console.warn("this HTML tag could not be converted into a texture:", source.tagName);
    }
};


/***
 This method loads an image
 Creates a new texture object right away and once the image is loaded it uses it as our WebGL texture

 params :
 @source (image) : html image element
 ***/
Curtains.BasePlane.prototype.loadImage = function(source) {
    var image = source;

    image.crossOrigin = this.crossOrigin || "anonymous";
    image.sampler = source.getAttribute("data-sampler") || null;

    // create a new texture that will use our image later
    var texture = this.createTexture(image.sampler);

    // handle our loaded data event inside the texture and tell our plane when the video is ready to play
    texture._onSourceLoadedHandler = texture._onSourceLoaded.bind(texture, image);
    image.addEventListener('load', texture._onSourceLoadedHandler, false);

    // If the image is in the cache of the browser,
    // the 'load' event might have been triggered
    // before we registered the event handler.
    if(image.complete) {
        texture._onSourceLoaded(image);
    }

    // add the image to our array
    this.images.push(image);
};


/***
 This method loads a video
 Creates a new texture object right away and once the video has enough data it uses it as our WebGL texture

 params :
 @source (video) : html video element
 ***/
Curtains.BasePlane.prototype.loadVideo = function(source) {
    var video = source;

    video.preload = true;
    video.muted = true;
    video.loop = true;

    video.sampler = source.getAttribute("data-sampler") || null;

    video.crossOrigin = this.crossOrigin || "anonymous";

    // create a new texture that will use our video later
    var texture = this.createTexture(video.sampler);

    // handle our loaded data event inside the texture and tell our plane when the video is ready to play
    texture._onSourceLoadedHandler = texture._onVideoLoadedData.bind(texture, video);
    video.addEventListener('canplaythrough', texture._onSourceLoadedHandler, false);

    // If the video is in the cache of the browser,
    // the 'canplaythrough' event might have been triggered
    // before we registered the event handler.
    if(video.readyState >= video.HAVE_FUTURE_DATA) {
        texture._onSourceLoaded(video);
    }

    // start loading our video
    video.load();

    this.videos.push(video);
};


/***
 This method loads a canvas
 Creates a new texture object right away and uses the canvas as our WebGL texture

 params :
 @source (canvas) : html canvas element
 ***/
Curtains.BasePlane.prototype.loadCanvas = function(source) {
    var canvas = source;
    canvas.sampler = source.getAttribute("data-sampler") || null;

    var texture = this.createTexture(canvas.sampler);

    this.canvases.push(canvas);

    texture._onSourceLoaded(canvas);
};


/*** DEPRECATED LOADERS ***/

/***
 Loads an array of images

 params :
 @imagesArray (array) : array of html image elements

 returns :
 @this: our plane to handle chaining
 ***/
Curtains.BasePlane.prototype.loadImages = function(imagesArray) {
    for(var i = 0; i < imagesArray.length; i++) {
        this.loadImage(imagesArray[i]);
    }
};

/***
 Loads an array of videos

 params :
 @videosArray (array) : array of html video elements

 returns :
 @this: our plane to handle chaining
 ***/
Curtains.BasePlane.prototype.loadVideos = function(videosArray) {
    for(var i = 0; i < videosArray.length; i++) {
        this.loadVideo(videosArray[i]);
    }
};

/***
 Loads an array of canvases

 params :
 @canvasesArray (array) : array of html canvas elements

 returns :
 @this: our plane to handle chaining
 ***/
Curtains.BasePlane.prototype.loadCanvases = function(canvasesArray) {
    for(var i = 0; i < canvasesArray.length; i++) {
        this.loadCanvas(canvasesArray[i]);
    }
};



/***
 This has to be called in order to play the planes videos
 We need this because on mobile devices we can't start playing a video without a user action
 Once the video has started playing we set an interval and update a new frame to our our texture at a 30FPS rate
 ***/
Curtains.BasePlane.prototype.playVideos = function() {
    for(var i = 0; i < this.textures.length; i++) {
        var texture = this.textures[i];

        if(texture.type === "video") {
            var playPromise = texture.source.play();

            // In browsers that don’t yet support this functionality,
            // playPromise won’t be defined.
            var self = this;
            if (playPromise !== undefined) {
                playPromise.catch(function(error) {
                    if(!self._wrapper.productionMode) console.warn("Could not play the video : ", error);
                });
            }
        }
    }
};


/*** INTERACTION ***/

/***
 This function takes the mouse position relative to the document and returns it relative to our plane
 It ranges from -1 to 1 on both axis

 params :
 @xPosition (float): position to convert on X axis
 @yPosition (float): position to convert on Y axis

 returns :
 @mousePosition: the mouse position relative to our plane in WebGL space coordinates
 ***/
Curtains.BasePlane.prototype.mouseToPlaneCoords = function(xMousePosition, yMousePosition) {
    // remember our ShaderPass objects don't have a scale property
    var scale = this.scale ? this.scale : {x: 1, y: 1};

    // we need to adjust our plane document bounding rect to it's webgl scale
    var scaleAdjustment = {
        x: (this._boundingRect.document.width - this._boundingRect.document.width * scale.x) / 2,
        y: (this._boundingRect.document.height - this._boundingRect.document.height * scale.y) / 2,
    };

    // also we need to divide by pixel ratio
    var planeBoundingRect = {
        width: (this._boundingRect.document.width * scale.x) / this._wrapper.pixelRatio,
        height: (this._boundingRect.document.height * scale.y) / this._wrapper.pixelRatio,
        top: (this._boundingRect.document.top + scaleAdjustment.y) / this._wrapper.pixelRatio,
        left: (this._boundingRect.document.left + scaleAdjustment.x) / this._wrapper.pixelRatio,
    };

    // mouse position conversion from document to plane space
    var mousePosition = {
        x: (((xMousePosition - planeBoundingRect.left) / planeBoundingRect.width) * 2) - 1,
        y: 1 - (((yMousePosition - planeBoundingRect.top) / planeBoundingRect.height) * 2)
    };

    return mousePosition;
};


/***
 Used inside our draw call to set the correct plane buffers before drawing it
 ***/
Curtains.BasePlane.prototype._bindPlaneBuffers = function() {
    var glContext = this._wrapper.glContext;

    // Set the vertices buffer
    glContext.enableVertexAttribArray(this._attributes.vertexPosition.location);
    glContext.bindBuffer(glContext.ARRAY_BUFFER, this._geometry.bufferInfos.id);

    glContext.vertexAttribPointer(this._attributes.vertexPosition.location, this._geometry.bufferInfos.itemSize, glContext.FLOAT, false, 0, 0);


    // Set where the texture coord attribute gets its data,
    glContext.enableVertexAttribArray(this._attributes.textureCoord.location);
    glContext.bindBuffer(glContext.ARRAY_BUFFER, this._material.bufferInfos.id);

    glContext.vertexAttribPointer(this._attributes.textureCoord.location, this._material.bufferInfos.itemSize, glContext.FLOAT, false, 0, 0);
};


/***
 This is used to set the WebGL context active texture and bind it

 params :
 @texture (texture object) : Our texture object containing our WebGL texture and its index
 ***/
Curtains.BasePlane.prototype._bindPlaneTexture = function(texture) {
    var glContext = this._wrapper.glContext;

    // tell WebGL we want to affect the texture at the plane's index unit
    glContext.activeTexture(glContext.TEXTURE0 + texture.index);
    // bind the texture to the plane's index unit
    glContext.bindTexture(glContext.TEXTURE_2D, texture._sampler.texture);
};


/*** DRAW THE PLANE ***/

/***
 We draw the plane, ie bind the buffers, set the active textures and draw it
 If the plane type is a ShaderPass we also need to bind the right frame buffers
 ***/
Curtains.BasePlane.prototype._drawPlane = function() {
    var glContext = this._wrapper.glContext;

    // check if our plane is ready to draw
    if(this._canDraw) {
        // ensure we're using the right program
        glContext.useProgram(this._program);

        // even if our plane should not be drawn we still execute its onRender callback and update its uniforms
        if(this._onRenderCallback) {
            this._onRenderCallback();
        }

        // if this is a frame buffer, check if theres one more coming next and eventually bind it
        if(this._type === "ShaderPass" && this.index + 1 <= this._wrapper.shaderPasses.length - 1) {
            this._wrapper.shaderPasses[this.index + 1]._enableFrameBuffer();
        }

        // update all uniforms set up by the user
        this._updateUniforms(this.uniforms);

        // bind plane attributes buffers
        this._bindPlaneBuffers();

        // now check if we really need to draw it and its textures
        if(this._shouldDraw) {

            // draw all our plane textures
            for(var i = 0; i < this.textures.length; i++) {
                // draw (bind and maybe update) our texture
                this.textures[i]._drawTexture();
            }

            // we have finished to apply our frame buffers, now render to canvas
            if(this._type === "ShaderPass" && this.index === this._wrapper.shaderPasses.length - 1) {
                glContext.bindFramebuffer(glContext.FRAMEBUFFER, null);
            }

            // the draw call!
            glContext.drawArrays(glContext.TRIANGLES, 0, this._geometry.bufferInfos.numberOfItems);
        }
    }
};


/***
 This deletes all our plane webgl bindings and its textures
 ***/
Curtains.BasePlane.prototype._dispose = function() {
    var glContext = this._wrapper.glContext;

    // unbind and delete the textures
    for(var i = 0; i < this.textures.length; i++) {
        this.textures[i]._dispose();
    }
    this.textures = null;

    if(glContext) {
        // delete buffers
        // each time we check for existing properties to avoid errors
        if(this._geometry) {
            glContext.bindBuffer(glContext.ARRAY_BUFFER, this._geometry.bufferInfos.id);
            glContext.bufferData(glContext.ARRAY_BUFFER, 1, glContext.STATIC_DRAW);
            glContext.deleteBuffer(this._geometry.bufferInfos.id);
            this._geometry = null;
        }

        if(this._material) {
            glContext.bindBuffer(glContext.ARRAY_BUFFER, this._material.bufferInfos.id);
            glContext.bufferData(glContext.ARRAY_BUFFER, 1, glContext.STATIC_DRAW);
            glContext.deleteBuffer(this._material.bufferInfos.id);
            this._material = null;
        }

        // delete frame buffers
        if(this._frameBuffer) {
            this._wrapper.glContext.deleteFramebuffer(this.framebuffer);
            this.framebuffer = null;
        }
        if(this._depthBuffer) {
            this._wrapper.glContext.deleteRenderbuffer(this._depthBuffer);
            this._depthBuffer = null;
        }

        // delete the shaders
        if(this._shaders) {
            glContext.deleteShader(this._shaders.fragmentShader);
            glContext.deleteShader(this._shaders.vertexShader);
            this._shaders = null;
        }

        // and delete the program at last
        if(this._program) {
            glContext.deleteProgram(this._program);
            this._program = null;
        }
    }
};



/*** BASE PLANE EVENTS ***/


/***
 This is called each time a plane has been resized

 params :
 @callback (function) : a function to execute

 returns :
 @this: our plane to handle chaining
 ***/
Curtains.BasePlane.prototype.onAfterResize = function(callback) {
    if(callback) {
        this._onAfterResizeCallback = callback;
    }

    return this;
};

/***
 This is called each time a plane's image has been loaded. Useful to handle a loader

 params :
 @callback (function) : a function to execute

 returns :
 @this: our plane to handle chaining
 ***/
Curtains.BasePlane.prototype.onLoading = function(callback) {
    if(callback) {
        this._onPlaneLoadingCallback = callback;
    }

    return this;
};


/***
 This is called when a plane is ready to be drawn

 params :
 @callback (function) : a function to execute

 returns :
 @this: our plane to handle chaining
 ***/
Curtains.BasePlane.prototype.onReady = function(callback) {
    if(callback) {
        this._onReadyCallback = callback;
    }

    return this;
};


/***
 This is called at each requestAnimationFrame call

 params :
 @callback (function) : a function to execute

 returns :
 @this: our plane to handle chaining
 ***/
Curtains.BasePlane.prototype.onRender = function(callback) {
    if(callback) {
        this._onRenderCallback = callback;
    }

    return this;
};




/*** PLANE CLASS ***/

/***
 Here we create our Plane object (note that we are using the Curtains namespace to avoid polluting the global scope)
 It will inherits from ou BasePlane class that handles all the WebGL part
 Plane class will add:
 - sizing and positioning and everything that relates to the DOM like draw checks and reenter/leave events
 - projection and view matrices and everything that is related like perspective, scale, rotation...
 - sources auto loading and onReady callback
 - depth related things

 params :
 @curtainWrapper : our curtain object that wraps all the planes
 @plane (html element) : html div that contains 0 or more media elements.
 @params (obj) : see addPlanes method of the wrapper

 returns :
 @this: our Plane element
 ***/
Curtains.Plane = function(curtainWrapper, plane, params) {
    // inherit
    Curtains.BasePlane.call(this, curtainWrapper, plane, params);

    this.index = this._wrapper.planes.length;
    this._type = "Plane";
    this._canDraw = false;

    // if params is not defined
    if(!params) params = {};

    this._setInitParams(params);

    // if program is valid, go on
    if(this._isProgramValid) {

        // init our plane
        this._initPositions();
        this._initSources();
    }
    else {
        if(this._wrapper._onErrorCallback) {
            // if it's not valid call the wrapper error callback
            this._wrapper._onErrorCallback();
        }
    }
};
Curtains.Plane.prototype = Object.create(Curtains.BasePlane.prototype);
Curtains.Plane.prototype.constructor = Curtains.Plane;


/***
 Set plane's initial params like rotation, scale, translation, fov

 params :
 @params (obj) : see addPlanes method of the wrapper
 ***/
Curtains.Plane.prototype._setInitParams = function(params) {
    var wrapper = this._wrapper;

    // if our plane should always be drawn or if it should be drawn only when inside the viewport (frustum culling)
    this.alwaysDraw = params.alwaysDraw || false;

    // draw check margins in pixels
    // positive numbers means it can be displayed even when outside the viewport
    // negative numbers means it can be hidden even when inside the viewport
    var drawCheckMargins = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    };
    if(params.drawCheckMargins) {
        drawCheckMargins = params.drawCheckMargins;
    }
    this.drawCheckMargins = drawCheckMargins;

    this.rotation = {
        x: 0,
        y: 0,
        z: 0,
    };

    this.relativeTranslation = {
        x: 0,
        y: 0,
    };

    // will be our translation in webgl coordinates
    this._translation = {
        x: 0,
        y: 0,
        z: 0
    };

    this.scale = {
        x: 1,
        y: 1,
    };

    // we need to sort planes by their definitions : widthSegments * heightSegments
    // but we have to keep in mind that 10*15 and 15*10 are not the same vertices definion, so we add widthSegments to differenciate them
    wrapper._stackPlane(this.index);

    // if we decide to load all sources on init or let the user do it manually
    this.autoloadSources = params.autoloadSources;
    if(this.autoloadSources === null || this.autoloadSources === undefined) {
        this.autoloadSources = true;
    }

    // set default fov
    this._fov = params.fov || 75;

    // if we should watch scroll
    if(params.watchScroll === null || params.watchScroll === undefined) {
        this.watchScroll = this._wrapper._watchScroll;
    }
    else {
        this.watchScroll = params.watchScroll || false;
    }
    // start listening for scroll
    if(this.watchScroll) {
        this._wrapper._scrollManager.shouldWatch = true;
    }

    // enable depth test by default
    this._shouldUseDepthTest = true;
};


/***
 Init our plane position: set its matrices, its position and perspective
 ***/
Curtains.Plane.prototype._initPositions = function() {
    // set its matrices
    this._initMatrices();

    // set our initial perspective matrix
    this.setPerspective(this._fov, 0.1, this._fov * 2);

    // apply our css positions
    this._applyCSSPositions();
};



/***
 Load our initial sources if needed and calls onReady callback
 ***/
Curtains.Plane.prototype._initSources = function() {
    // finally load every sources already in our plane html element
    // load plane sources
    if (this.autoloadSources) {
        // load images
        var imagesArray = [];
        for (var i = 0; i < this.htmlElement.getElementsByTagName("img").length; i++) {
            imagesArray.push(this.htmlElement.getElementsByTagName("img")[i]);
        }
        if (imagesArray.length > 0) {
            this.loadSources(imagesArray);
        }

        // load videos
        var videosArray = [];
        for (var i = 0; i < this.htmlElement.getElementsByTagName("video").length; i++) {
            videosArray.push(this.htmlElement.getElementsByTagName("video")[i]);
        }
        if (videosArray.length > 0) {
            this.loadSources(videosArray);
        }

        // load canvases
        var canvasesArray = [];
        for (var i = 0; i < this.htmlElement.getElementsByTagName("canvas").length; i++) {
            canvasesArray.push(this.htmlElement.getElementsByTagName("canvas")[i]);
        }
        if (canvasesArray.length > 0) {
            this.loadSources(canvasesArray);
        }

        this._loadingManager.initSourcesToLoad = imagesArray.length + videosArray.length + canvasesArray.length;
    }

    if (this._loadingManager.initSourcesToLoad === 0 && !this._wrapper.productionMode) {
        // if there's no images, no videos, no canvas, send a warning
        console.warn("This plane does not contain any image, video or canvas element. You may want to add some later with the loadSource() or loadSources() method.");
    }

    // handling our plane onReady callback with an interval
    // maybe i could improve this by using the raf loop and a flag
    var loadedInterval;
    var self = this;

    // check if everything is ready depending on the number of sources we need to load on init
    loadedInterval = setInterval(function () {
        // everything is loaded
        if (self._loadingManager.sourcesLoaded >= self._loadingManager.initSourcesToLoad) {
            clearInterval(loadedInterval);

            if (self._onReadyCallback) {
                self._onReadyCallback();
            }
        }
    }, 16);

    this._canDraw = true;

    // be sure we'll update the scene even if drawing is disabled
    this._wrapper.needRender();

    // everything is ready, check if we should draw the plane
    if(!this.alwaysDraw) {
        this._shouldDrawCheck();
    }
};


/***
 Init our plane model view and projection matrices and set their uniform locations
 ***/
Curtains.Plane.prototype._initMatrices = function() {
    var glContext = this._wrapper.glContext;

    // projection and model view matrix
    // create our modelview and projection matrix
    this._matrices = {
        mvMatrix: {
            name: "uMVMatrix",
            matrix: new Float32Array([
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0
            ]),
            location: glContext.getUniformLocation(this._program, "uMVMatrix"),
        },
        pMatrix: {
            name: "uPMatrix",
            matrix: new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                0.0, 0.0, 0.0, 0.0,
                0.0, 0.0, 0.0, 0.0,
                0.0, 0.0, 0.0, 0.0
            ]), // will be set after
            location: glContext.getUniformLocation(this._program, "uPMatrix"),
        }
    };
};


/***
 Set our plane dimensions and positions relative to clip spaces
 ***/
Curtains.Plane.prototype._setComputedSizes = function() {
    var wrapper = this._wrapper;

    // dimensions and positions of our plane in the document and clip spaces
    // don't forget translations in webgl space are referring to the center of our plane and canvas
    var planeCenter = {
        x: (this._boundingRect.document.width / 2) + this._boundingRect.document.left,
        y: (this._boundingRect.document.height / 2) + this._boundingRect.document.top,
    };

    var wrapperCenter = {
        x: (wrapper._boundingRect.width / 2) + wrapper._boundingRect.left,
        y: (wrapper._boundingRect.height / 2) + wrapper._boundingRect.top,
    };

    // our plane clip space informations
    this._boundingRect.computed = {
        width: this._boundingRect.document.width / wrapper._boundingRect.width,
        height: this._boundingRect.document.height / wrapper._boundingRect.height,
        top: (wrapperCenter.y - planeCenter.y) / wrapper._boundingRect.height,
        left: (planeCenter.x - wrapperCenter.x) / wrapper._boundingRect.height,
    };
};



/*** PLANES SCALES AND ROTATIONS ***/

/***
 This will set our perspective matrix

 params :
 @fov (float): the field of view
 @near (float): the nearest point where object are displayed
 @far (float): the farthest point where object are displayed

 returns :
 @perspectiveMatrix: our perspective matrix
 ***/
Curtains.Plane.prototype._setPerspectiveMatrix = function(fov, near, far) {
    var aspect = this._wrapper._boundingRect.width / this._wrapper._boundingRect.height;

    if(fov !== this._fov) {
        this._fov = fov;
    }

    var perspectiveMatrix = [
        fov / aspect, 0, 0, 0,
        0, fov, 0, 0,
        0, 0, (near + far) * (1 / (near - far)), -1,
        0, 0, near * far * (1 / (near - far)) * 2, 0
    ];

    return perspectiveMatrix;
};


/***
 This will set our perspective matrix
 used internally but can be used externally as well to change fov for example

 params :
 @fov (float): the field of view
 @near (float): the nearest point where object are displayed
 @far (float): the farthest point where object are displayed
 ***/
Curtains.Plane.prototype.setPerspective = function(fov, near, far) {
    var fieldOfView;
    if(fov === null || typeof fov !== "number") {
        fieldOfView = 75;
    }
    else {
        fieldOfView = parseInt(fov)
    }

    if(fieldOfView < 1) {
        fieldOfView = 1;
    }
    else if(fieldOfView > 180) {
        fieldOfView = 180;
    }

    var nearPlane = parseFloat(near) || 0.1;
    var farPlane = parseFloat(far) || 100;

    if(this._matrices) {
        this._matrices.pMatrix.matrix = this._setPerspectiveMatrix(fieldOfView, nearPlane, farPlane);

        this._wrapper.glContext.useProgram(this._program);
        this._wrapper.glContext.uniformMatrix4fv(this._matrices.pMatrix.location, false, this._matrices.pMatrix.matrix);

        // set mvMatrix as well cause we need to update z translation based on new fov
        if(this._canDraw) {
            this._setMVMatrix();
        }
    }
};


/***
 This will set our model view matrix
 used internally at each draw call
 It will calculate our matrix based on its plane translation, rotation and scale

 returns :
 @nextMVMatrix: our new model view matrix
 ***/
Curtains.Plane.prototype._setMVMatrix = function() {
    var wrapper = this._wrapper;

    // here we will silently set our scale based on the canvas size and the plane inner size
    var relativeScale = {
        x: this.scale.x * ((wrapper._boundingRect.width / wrapper._boundingRect.height) * this._boundingRect.computed.width / 2),
        y: this.scale.y * this._boundingRect.computed.height / 2,
    };

    // translation (we're translating the planes under the hood from fov / 2 along Z axis)
    var translation = [this._translation.x, this._translation.y, this._translation.z - (this._fov / 2)];
    var rotation = [this.rotation.x, this.rotation.y, this.rotation.z];
    var scale = [relativeScale.x, relativeScale.y, 1];

    if(this._matrices) {
        // set model view matrix with our transformations
        this._matrices.mvMatrix.matrix = wrapper._applyTransformationsMatrix(translation, rotation, scale);

        wrapper.glContext.useProgram(this._program);
        wrapper.glContext.uniformMatrix4fv(this._matrices.mvMatrix.location, false, this._matrices.mvMatrix.matrix);

        // this is the result of our projection matrix * our mv matrix, useful for bounding box calculations and frustum culling
        this._matrices.viewProjectionMatrix = wrapper._multiplyMatrix(this._matrices.pMatrix.matrix, this._matrices.mvMatrix.matrix);
    }

    // check if we should draw the plane but only if everything has been initialized
    if(!this.alwaysDraw && this._canDraw) {
        this._shouldDrawCheck();
    }
};


/***
 This will set our plane scale
 used internally but can be used externally as well

 params :
 @scaleX (float): scale to apply on X axis
 @scaleY (float): scale to apply on Y axis
 ***/
Curtains.Plane.prototype.setScale = function(scaleX, scaleY) {
    if(scaleX === null || typeof scaleX !== "number") {
        scaleX = 1;
    }
    else {
        scaleX = Math.max(parseFloat(scaleX), 0.001); // ensure we won't have a 0 scale
    }

    if(scaleY === null || typeof scaleY !== "number") {
        scaleY = 1;
    }
    else {
        scaleY = Math.max(parseFloat(scaleY), 0.001); // ensure we won't have a 0 scale
    }

    // only apply if values changed
    if(scaleX !== this.scale.x || scaleY !== this.scale.y) {
        this.scale = {
            x: scaleX,
            y: scaleY
        };

        // set mvMatrix
        this._setMVMatrix();

        // adjust textures size
        for (var i = 0; i < this.textures.length; i++) {
            this.textures[i]._adjustTextureSize();
        }
    }
};


/***
 This will set our plane rotation
 used internally but can be used externally as well

 params :
 @angleX (float): rotation to apply on X axis (in radians)
 @angleY (float): rotation to apply on Y axis (in radians)
 @angleZ (float): rotation to apply on Z axis (in radians)
 ***/
Curtains.Plane.prototype.setRotation = function(angleX, angleY, angleZ) {
    angleX = parseFloat(angleX) || 0;
    angleY = parseFloat(angleY) || 0;
    angleZ = parseFloat(angleZ) || 0;

    // only apply if values changed
    if(angleX !== this.rotation.x || angleY !== this.rotation.y || angleZ !== this.rotation.z) {
        this.rotation = {
            x: angleX,
            y: angleY,
            z: angleZ
        };

        // set mvMatrix
        this._setMVMatrix();
    }
};


/***
 This will set our plane translation by adding plane computed bounding box values and computed relative position values
 ***/
Curtains.Plane.prototype._setTranslation = function() {
    // avoid unnecessary calculations if we don't have a users set relative position
    var relativePosition = {
        x: 0,
        y: 0,
    };
    if(this.relativeTranslation.x !== 0 || this.relativeTranslation.y !== 0) {
        relativePosition = this._documentToPlaneSpace(this.relativeTranslation.x, this.relativeTranslation.y);
    }

    this._translation.x = this._boundingRect.computed.left + relativePosition.x;
    this._translation.y = this._boundingRect.computed.top + relativePosition.y;

    // set mvMatrix
    this._setMVMatrix();
};


/***
 This function takes pixel values along X and Y axis and convert them to clip space coordinates, and then apply the corresponding translation

 params :
 @translationX (float): translation to apply on X axis
 @translationY (float): translation to apply on Y axis
 ***/
Curtains.Plane.prototype.setRelativePosition = function(translationX, translationY) {
    this.relativeTranslation = {
        x: translationX,
        y: translationY
    };

    this._setTranslation();
};


/***
 This function takes pixel values along X and Y axis and convert them to clip space coordinates

 params :
 @xPosition (float): position to convert on X axis
 @yPosition (float): position to convert on Y axis

 returns :
 @relativePosition: plane's position in WebGL space
 ***/
Curtains.Plane.prototype._documentToPlaneSpace = function(xPosition, yPosition) {
    var wrapper = this._wrapper;

    var relativePosition = {
        x: xPosition / (wrapper._boundingRect.width / wrapper.pixelRatio) * (wrapper._boundingRect.width / wrapper._boundingRect.height),
        y: -yPosition / (wrapper._boundingRect.height / wrapper.pixelRatio),
    };

    return relativePosition;
};


/***
 This function checks if the plane is currently visible in the canvas and sets _shouldDraw property according to this test
 This checks DOM positions for now but we might want to improve it to use real frustum calculations
 ***/
Curtains.Plane.prototype._shouldDrawCheck = function() {
    var wrapper = this._wrapper;

    // get plane bounding rect
    var actualPlaneBounds = this.getWebGLBoundingRect();

    var self = this;

    // if we decide to draw the plane only when visible inside the canvas
    // we got to check if its actually inside the canvas
    if(
        actualPlaneBounds.right < wrapper._boundingRect.left - this.drawCheckMargins.right
        || actualPlaneBounds.left > wrapper._boundingRect.left + wrapper._boundingRect.width + this.drawCheckMargins.left
        || actualPlaneBounds.bottom < wrapper._boundingRect.top - this.drawCheckMargins.bottom
        || actualPlaneBounds.top > wrapper._boundingRect.top + wrapper._boundingRect.height + this.drawCheckMargins.top
    ) {
        if(this._shouldDraw) {
            this._shouldDraw = false;
            // callback for leaving view
            setTimeout(function() {
                if(self._onLeaveViewCallback) {
                    self._onLeaveViewCallback();
                }
            }, 0);
        }
    }
    else {
        if(!this._shouldDraw) {
            // callback for entering view
            setTimeout(function() {
                if(self._onReEnterViewCallback) {
                    self._onReEnterViewCallback();
                }
            }, 0);
        }
        this._shouldDraw = true;
    }
};


/***
 This function takes the plane CSS positions and convert them to clip space coordinates, and then apply the corresponding translation
 ***/
Curtains.Plane.prototype._applyCSSPositions = function() {
    // set our plane sizes and positions relative to the clipspace
    this._setComputedSizes();

    // set the translation values
    this._setTranslation();
};


/***
 This function updates the plane position based on its CSS positions and transformations values.
 Useful if the HTML element has been moved while the container size has not changed.
 ***/
Curtains.Plane.prototype.updatePosition = function() {
    // set the new plane sizes and positions relative to document by triggering getBoundingClientRect()
    this._setDocumentSizes();

    // apply them
    this._applyCSSPositions();
};


/***
 This function updates the plane position based on the Curtains wrapper scroll manager values
 ***/
Curtains.Plane.prototype.updateScrollPosition = function() {
    // actually update the plane position only if last X delta or last Y delta is not equal to 0
    if(this._wrapper._scrollManager.lastXDelta || this._wrapper._scrollManager.lastYDelta) {
        // set new positions based on our delta without triggering reflow
        this._boundingRect.document.top += this._wrapper._scrollManager.lastYDelta * this._wrapper.pixelRatio;
        this._boundingRect.document.left += this._wrapper._scrollManager.lastXDelta * this._wrapper.pixelRatio;

        // apply them
        this._applyCSSPositions();
    }
};


/***
 This function set/unset the depth test for that plane

 params :
 @shouldEnableDepthTest (bool): enable/disable depth test for that plane
 ***/
Curtains.Plane.prototype.enableDepthTest = function(shouldEnableDepthTest) {
    this._shouldUseDepthTest = shouldEnableDepthTest;
};


/***
 This function puts the plane at the end of the draw stack, allowing it to overlap any other plane
 ***/
Curtains.Plane.prototype.moveToFront = function() {
    // enable the depth test
    this.enableDepthTest(false);

    var drawStack = this._wrapper._drawStack;
    for(var i = 0; i < drawStack.length; i++) {
        if(this.index === drawStack[i]) {
            drawStack.splice(i, 1);
        }
    }
    drawStack.push(this.index);
};


/*** PLANE EVENTS ***/


/***
 This is called each time a plane is entering again the view bounding box

 params :
 @callback (function) : a function to execute

 returns :
 @this: our plane to handle chaining
 ***/
Curtains.Plane.prototype.onReEnterView = function(callback) {
    if(callback) {
        this._onReEnterViewCallback = callback;
    }

    return this;
};


/***
 This is called each time a plane is leaving the view bounding box

 params :
 @callback (function) : a function to execute

 returns :
 @this: our plane to handle chaining
 ***/
Curtains.Plane.prototype.onLeaveView = function(callback) {
    if(callback) {
        this._onLeaveViewCallback = callback;
    }

    return this;
};




/*** SHADERPASS CLASS ***/

/***
 Here we create our ShaderPass object (note that we are using the Curtains namespace to avoid polluting the global scope)
 It will inherits from ou BasePlane class that handles all the WebGL part
 ShaderPass class will handle the frame buffer

 params :
 @curtainWrapper : our curtain object that (we will use its container property and its size)
 @params (obj) : see addShaderPass method of the wrapper

 returns :
 @this: our ShaderPass element
 ***/
Curtains.ShaderPass = function(curtainWrapper, params) {
    if(!params) params = {};

    // force plane defintion to 1x1
    params.widthSegments = 1;
    params.heightSegments = 1;

    // inherit
    Curtains.BasePlane.call(this, curtainWrapper, curtainWrapper.container, params);

    this.index = this._wrapper.shaderPasses.length;
    this._type = "ShaderPass";

    // if the program is valid, go on
    if(this._isProgramValid) {
        this._initShaderPassPlane();
    }
};
Curtains.ShaderPass.prototype = Object.create(Curtains.BasePlane.prototype);
Curtains.ShaderPass.prototype.constructor = Curtains.ShaderPass;


/***
 Here we init additionnal shader pass planes properties
 This mainly consists in creating our render texture and add a frame buffer object

 params:
 @plane (html element): html div that contains one or more image.
 @params (obj): see createTexture method of the Plane

 returns:
 @this: our newly created texture object
 ***/
Curtains.ShaderPass.prototype._initShaderPassPlane = function() {
    // create our render texture
    this.createTexture("uRenderTexture", true);

    // create our frame buffer
    this._createFrameBuffer();

    // on ready callback
    var self = this;
    setTimeout(function() {
        if(self._onReadyCallback) {
            self._onReadyCallback();
        }
    }, 0);

    this._canDraw = true;

    // be sure we'll update the scene even if drawing is disabled
    this._wrapper.needRender();
};


/***
 Here we override the parent _setDefaultVS method
 because shader passes vs don't have projection and model view matrices
 ***/
Curtains.ShaderPass.prototype._setDefaultVS = function(params) {
    return "#ifdef GL_ES\nprecision mediump float;\n#endif\nattribute vec3 aVertexPosition;attribute vec2 aTextureCoord;varying vec3 vVertexPosition;varying vec2 vTextureCoord;void main() {vTextureCoord = aTextureCoord;vVertexPosition = aVertexPosition;gl_Position = vec4(aVertexPosition, 1.0);}";
};


/***
 Here we override the parent _setDefaultFS method
 taht way we can still draw our render texture
 ***/
Curtains.ShaderPass.prototype._setDefaultFS = function(params) {
    return "#ifdef GL_ES\nprecision mediump float;\n#endif\nvarying vec3 vVertexPosition;varying vec2 vTextureCoord;uniform sampler2D uRenderTexture;void main( void ) {gl_FragColor = texture2D(uRenderTexture, vTextureCoord);}";
};


/***
 Enables our frame buffer
 Called at each tick to add a shader pass
 Note that we need to clear the scene after is has been enabled
 ***/
Curtains.ShaderPass.prototype._enableFrameBuffer = function() {
    var glContext = this._wrapper.glContext;

    // render to our target texture by binding the framebuffer
    if(this._frameBuffer) {
        glContext.bindFramebuffer(glContext.FRAMEBUFFER, this._frameBuffer);

        // clear the color and depth buffer,
        glContext.clearColor(0.0, 0.0, 0.0, 0.0);
        glContext.clearDepth(1.0);
        glContext.clear(glContext.COLOR_BUFFER_BIT | glContext.DEPTH_BUFFER_BIT);
    }

    glContext.viewport(0, 0, glContext.drawingBufferWidth, glContext.drawingBufferHeight);
};


/***
 Enables our frame buffer
 Called at each tick to add a shader pass
 Note that we need to clear the scene after is has been enabled
 ***/
Curtains.ShaderPass.prototype._bindDepthBuffer = function() {
    var glContext = this._wrapper.glContext;

    // render to our target texture by binding the framebuffer
    if(this._depthBuffer) {
        glContext.bindRenderbuffer(glContext.RENDERBUFFER, this._depthBuffer);

        // allocate renderbuffer
        glContext.renderbufferStorage(glContext.RENDERBUFFER, glContext.DEPTH_COMPONENT16, this._boundingRect.document.width, this._boundingRect.document.height);

        // attach renderbuffer
        glContext.framebufferRenderbuffer(glContext.FRAMEBUFFER, glContext.DEPTH_ATTACHMENT, glContext.RENDERBUFFER, this._depthBuffer);
    }
};


/***
 Here we create our frame buffer object
 We're also adding a render buffer object to handle depth inside our shader pass
 ***/
Curtains.ShaderPass.prototype._createFrameBuffer = function() {
    var glContext = this._wrapper.glContext;

    this._frameBuffer = glContext.createFramebuffer();
    glContext.bindFramebuffer(glContext.FRAMEBUFFER, this._frameBuffer);

    // attach the texture as the first color attachment
    glContext.framebufferTexture2D(glContext.FRAMEBUFFER, glContext.COLOR_ATTACHMENT0, glContext.TEXTURE_2D, this.textures[0]._sampler.texture, 0);

    // create a depth renderbuffer
    this._depthBuffer = glContext.createRenderbuffer();
    this._bindDepthBuffer();
};



/*** TEXTURE CLASS ***/

/***
 Here we create our Texture object (note that we are using the Curtains namespace to avoid polluting the global scope)

 params:
 @plane (html element): html div that contains one or more image.
 @params (obj): see createTexture method of the Plane

 returns:
 @this: our newly created texture object
 ***/
Curtains.Texture = function(plane, params) {
    // set up base properties
    this._plane = plane;
    this._wrapper = plane._wrapper;

    if(!plane._isProgramValid && !params.isTexturePass) {
        if(!this._wrapper.productionMode) {
            console.warn("Unable to create the texture because the program is not valid");
        }

        return;
    }

    this.index = plane.textures.length;

    // prepare texture sampler
    this._sampler = {
        name: params.sampler || null
    };

    // _willUpdate and shouldUpdate property are set to false by default
    // we will handle that in the setSource() method for videos and canvases
    this._willUpdate = false;
    this.shouldUpdate = false;

    this.scale = {
        x: 1,
        y: 1,
    };

    // init texture
    if(params.isTexturePass) {
        this._initShaderPassTexture();
    }
    else {
        this._init();
    }

    return this;
};


/***
 Init our texture object
 ***/
Curtains.Texture.prototype._init = function() {
    var glContext = this._wrapper.glContext;
    var plane = this._plane;

    // create our WebGL texture
    this._sampler.texture = glContext.createTexture();

    // bind the texture the target (TEXTURE_2D) of the active texture unit.
    glContext.bindTexture(glContext.TEXTURE_2D, this._sampler.texture);

    // we don't use Y flip yet
    glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, false);

    // draw a black plane before the real texture's content has been loaded
    glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, 1, 1, 0, glContext.RGBA, glContext.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

    // our texture source hasn't been loaded yet
    this._sourceLoaded = false;

    glContext.useProgram(plane._program);

    // set our texture sampler uniform
    var samplerUniformLocation = this._sampler.name || "uSampler" + this.index;

    this._sampler.location = glContext.getUniformLocation(plane._program, samplerUniformLocation);

    // tell the shader we bound the texture to our indexed texture unit
    glContext.uniform1i(this._sampler.location, this.index);

    // we will always declare a texture matrix uniform
    var textureMatrix = this._sampler.name ? this._sampler.name + "Matrix" : "uTextureMatrix" + this.index;
    this._textureMatrix = {
        name: textureMatrix,
        matrix: null,
        location: glContext.getUniformLocation(this._plane._program, textureMatrix)
    };

    this._sampler.name = samplerUniformLocation;
};


/***
 Init our render texture object (it is a texture representing our scene before our shader pass)
 ***/
Curtains.Texture.prototype._initShaderPassTexture = function() {
    var glContext = this._wrapper.glContext;

    // set a special type
    this.type = "texturePass";

    // set its size to our parent plane, in this case our canvas
    this._size = {
        width: this._plane._boundingRect.document.width,
        height: this._plane._boundingRect.document.height,
    };

    // create a textue
    this._sampler.texture = glContext.createTexture();

    // bind the texture
    glContext.bindTexture(glContext.TEXTURE_2D, this._sampler.texture);

    // set its location based on our sampler name
    glContext.useProgram(this._plane._program);
    this._sampler.location = glContext.getUniformLocation(this._plane._program, this._sampler.name);

    // tell the shader we bound the texture to our last texture unit
    glContext.uniform1i(this._sampler.location, this.index);

    // define its size
    glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, this._size.width, this._size.height, 0, glContext.RGBA, glContext.UNSIGNED_BYTE, null);

    // set the filtering so we don't need mips
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.LINEAR);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
};


/*** LOADING SOURCESS ***/

/***
 This use our source as texture

 params:
 @source (images/video/canvas): either an image, a video or a canvas
 ***/
Curtains.Texture.prototype.setSource = function(source) {
    // if our program hasn't been validated we can't set a texture source
    if(!this._plane._isProgramValid) {
        if(!this._wrapper.productionMode) {
            console.warn("Unable to set the texture source because the program is not valid");
        }

        return;
    }

    this.source = source;

    if(source.tagName.toUpperCase() === "IMG") {
        this.type = "image";
    }
    else if(source.tagName.toUpperCase() === "VIDEO") {
        this.type = "video";
        // a video should be updated by default
        // _willUpdate property will be alternatively set to true/false elsewhere to display the video at 30fps
        this.shouldUpdate = true;
    }
    else if(source.tagName.toUpperCase() === "CANVAS") {
        this.type = "canvas";
        // a canvas could change each frame so we need to update it by default
        this._willUpdate = true;
        this.shouldUpdate = true;
    }
    else if(!this._wrapper.productionMode) {
        console.warn("this HTML tag could not be converted into a texture:", source.tagName);
    }

    this._size = {
        width: this.source.naturalWidth || this.source.width || this.source.videoWidth,
        height: this.source.naturalHeight || this.source.height || this.source.videoHeight,
    };

    var glContext = this._wrapper.glContext;

    // Bind the texture the target (TEXTURE_2D) of the active texture unit.
    glContext.bindTexture(glContext.TEXTURE_2D, this._sampler.texture);

    glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, true);

    // Set the parameters so we can render any size image.
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.LINEAR);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.LINEAR);

    this._adjustTextureSize();

    // set our webgl texture only if it is not a video
    // if it is a video it won't be ready yet and throw a warning in chrome
    // besides it will be updated anyway as soon as it will start playing
    if(this.type !== "video") {
        glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, source);
    }

    // update our scene
    this._wrapper.needRender();
};


/***
 This update our texture
 Called inside our drawing loop if shouldUpdate property is set to true
 Typically used by videos or canvas
 ***/
Curtains.Texture.prototype._update = function() {
    var glContext = this._wrapper.glContext;

    glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, this.source);
};


/*** TEXTURE SIZINGS ***/


/***
 This is used to calculate how to crop/center an texture

 returns:
 @sizes (obj): an object containing plane sizes, source sizes and x and y offset to center the source in the plane
 ***/
Curtains.Texture.prototype._getSizes = function() {
    // remember our ShaderPass objects don't have a scale property
    var scale = this._plane.scale ? this._plane.scale : {x: 1, y: 1};

    var planeWidth  = this._plane._boundingRect.document.width * scale.x;
    var planeHeight = this._plane._boundingRect.document.height * scale.y;

    var sourceWidth = this._size.width;
    var sourceHeight = this._size.height;

    var sourceRatio = sourceWidth / sourceHeight;
    var planeRatio = planeWidth / planeHeight;

    // center image in its container
    var xOffset = 0;
    var yOffset = 0;

    if(planeRatio > sourceRatio) { // means plane is larger
        yOffset = Math.min(0, planeHeight - (planeWidth * (1 / sourceRatio)));
    }
    else if(planeRatio < sourceRatio) { // means plane is taller
        xOffset = Math.min(0, planeWidth - (planeHeight * sourceRatio));
    }

    var sizes = {
        planeWidth: planeWidth,
        planeHeight: planeHeight,
        sourceWidth: sourceWidth,
        sourceHeight: sourceHeight,
        xOffset: xOffset,
        yOffset: yOffset,
    };

    return sizes;
};


/***
 Set the texture scale and then update its matrix

 params:
 @scaleX (float): scale to apply on X axis
 @scaleY (float): scale to apply on Y axis
 ***/
Curtains.Texture.prototype.setScale = function(scaleX, scaleY) {
    scaleX = parseFloat(scaleX) || 1;
    scaleX = Math.max(scaleX, 0.001);

    scaleY = parseFloat(scaleY) || 1;
    scaleY = Math.max(scaleY, 0.001);

    this.scale = {
        x: scaleX,
        y: scaleY,
    };

    this._adjustTextureSize();
};

/***
 This is used to crop/center an texture
 If the texture is using texture matrix then we just have to update its matrix
 else if it is an image we draw it inside a canvas and use that canvas as our texture
 ***/
Curtains.Texture.prototype._adjustTextureSize = function() {
    if(this.type === "texturePass") {
        var glContext = this._wrapper.glContext;

        this._size.width = this._plane._boundingRect.document.width;
        this._size.height = this._plane._boundingRect.document.height;

        glContext.bindTexture(glContext.TEXTURE_2D, this._sampler.texture);

        glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, this._size.width, this._size.height, 0, glContext.RGBA, glContext.UNSIGNED_BYTE, null);
    }
    else if(this.source) {
        // no point in resizing texture if it does not have a source yet
        var sizes = this._getSizes();

        // always update texture matrix anyway
        this._updateTextureMatrix(sizes);
    }
};

/***
 This updates our textures matrix uniform based on plane and sources sizes

 params:
 @sizes (object): object containing plane sizes, source sizes and x and y offset to center the source in the plane
 ***/
Curtains.Texture.prototype._updateTextureMatrix = function(sizes) {
    // calculate scale to apply to the matrix
    var texScale = {
        x: sizes.planeWidth / (sizes.planeWidth - sizes.xOffset),
        y: sizes.planeHeight / (sizes.planeHeight - sizes.yOffset),
    };

    // apply texture scale
    texScale.x /= this.scale.x;
    texScale.y /= this.scale.y;

    // translate texture to center it
    var textureTranslation = new Float32Array([
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        (1 - texScale.x) / 2, (1 - texScale.y) / 2, 0.0, 1.0
    ]);

    // scale texture
    this._textureMatrix.matrix = this._wrapper._scaleMatrix(
        textureTranslation,
        texScale.x,
        texScale.y,
        1
    );

    // update the texture matrix uniform
    this._wrapper.glContext.useProgram(this._plane._program);
    this._wrapper.glContext.uniformMatrix4fv(this._textureMatrix.location, false, this._textureMatrix.matrix);
};


/***
 This calls our loading callback and set our media as texture source
 ***/
Curtains.Texture.prototype._onSourceLoaded = function(source) {
    // increment our loading manager
    this._plane._loadingManager.sourcesLoaded++;

    // set the media as our texture source
    this.setSource(source);

    // fire callback during load (useful for a loader)
    var self = this;
    if(!this._sourceLoaded) {
        setTimeout(function() {
            if(self._plane._onPlaneLoadingCallback) {
                self._plane._onPlaneLoadingCallback();
            }
        }, 0);
    }

    // our source is loaded now
    this._sourceLoaded = true;
};


/***
 This handles our canplaythrough data event, then handles source loaded
 ***/
Curtains.Texture.prototype._onVideoLoadedData = function(video) {
    // check if we have not already loaded the source to avoid calling loading callback twice
    if(!this._sourceLoaded) {
        this._onSourceLoaded(video);
    }
};


/***
 This is called to draw the texture
 ***/
Curtains.Texture.prototype._drawTexture = function() {
    // bind the texture
    this._plane._bindPlaneTexture(this);

    // check if the video is actually really playing
    if(this.type === "video" && this.source && this.source.readyState >= this.source.HAVE_CURRENT_DATA && !this.source.paused && this.source.currentTime > 0 && !this.source.ended) {
        this._willUpdate = !this._willUpdate;
    }

    if(this._willUpdate && this.shouldUpdate) {
        this._update();
    }

};


/***
 This is used to destroy a texture and free the memory space
 Usually used on a plane removal
 ***/
Curtains.Texture.prototype._dispose = function() {
    if(this.type === "video") {
        // remove event listeners
        this.source.removeEventListener("canplaythrough", this._onSourceLoadedHandler, false);

        // empty source to properly delete video element and free the memory
        this.source.pause();
        this.source.removeAttribute('src');
        this.source.load();

        // clear the update interval
        if(this.source.updateInterval) {
            clearInterval(this.source.updateInterval);
        }
    }
    else if(this.type === "canvas") {
        // clear all canvas states
        this.source.width = this.source.width;
    }
    else if(this.type === "image") {
        this.source.removeEventListener('load', this._onSourceLoadedHandler, false);
    }

    // clear source
    this.source = null;

    var glContext = this._wrapper.glContext;

    if(glContext) {
        glContext.activeTexture(glContext.TEXTURE0 + this.index);
        glContext.bindTexture(glContext.TEXTURE_2D, null);
        glContext.deleteTexture(this._sampler.texture);
    }

    // decrease textures loaded
    this._plane._loadingManager.sourcesLoaded--;
};