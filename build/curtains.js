/***
 Little WebGL helper to apply images, videos or canvases as textures of planes
 Author: Martin Laxenaire https://www.martin-laxenaire.fr/
 Version: 5.0.1
 https://www.curtainsjs.com/
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
    this.renderTargets = [];
    this.shaderPasses = [];

    this._drawStacks = {
        "opaque": {
            length: 0,
            programs: [],
        },
        "transparent": {
            length: 0,
            programs: [],
        },
    };

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

    this.pixelRatio = params.pixelRatio || window.devicePixelRatio || 1;

    this.premultipliedAlpha = params.premultipliedAlpha || false;

    this.alpha = params.alpha;
    if(this.alpha === null || this.alpha === undefined) {
        this.alpha = true;
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
    var glAttributes = {
        alpha: this.alpha,
        premultipliedAlpha: this.premultipliedAlpha
    };

    this.gl = this.glCanvas.getContext("webgl2", glAttributes);
    this._isWebGL2 = !!this.gl;
    if(!this.gl) {
        this.gl = this.glCanvas.getContext("webgl", glAttributes) || this.glCanvas.getContext("experimental-webgl", glAttributes);
    }

    // WebGL context could not be created
    if(!this.gl) {
        if(!this.productionMode) console.warn("WebGL context could not be created");

        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return;
    }

    this._getExtensions();

    // managing our webgl draw states
    this._glState = {
        // programs
        currentProgramID: null,
        programs: [],

        // last buffer sizes drawn (avoid redundant buffer bindings)
        currentBuffersID: 0,
        setDepth: null,
        frameBufferID: null,
    };

    // handling context
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
    this.setPixelRatio(this.pixelRatio, false);

    // handling window resize event
    this._resizeHandler = null;
    if(this._autoResize) {
        this._resizeHandler = this.resize.bind(this, true);
        window.addEventListener("resize", this._resizeHandler, false);
    }

    // we can start rendering now
    this._readyToDraw();
};


Curtains.prototype._getExtensions = function() {
    this._extensions = [];
    if (this._isWebGL2) {
        this._extensions['EXT_color_buffer_float'] = this.gl.getExtension('EXT_color_buffer_float');
        this._extensions['OES_texture_float_linear'] = this.gl.getExtension('OES_texture_float_linear');
        this._extensions['WEBGL_lose_context'] = this.gl.getExtension('WEBGL_lose_context');
    } else {
        this._extensions['OES_texture_float'] = this.gl.getExtension('OES_texture_float');
        this._extensions['OES_texture_float_linear'] = this.gl.getExtension('OES_texture_float_linear');
        this._extensions['OES_texture_half_float'] = this.gl.getExtension('OES_texture_half_float');
        this._extensions['OES_texture_half_float_linear'] = this.gl.getExtension('OES_texture_half_float_linear');
        this._extensions['OES_element_index_uint'] = this.gl.getExtension('OES_element_index_uint');
        this._extensions['OES_standard_derivatives'] = this.gl.getExtension('OES_standard_derivatives');
        this._extensions['EXT_sRGB'] = this.gl.getExtension('EXT_sRGB');
        this._extensions['WEBGL_depth_texture'] = this.gl.getExtension('WEBGL_depth_texture');
        this._extensions['WEBGL_draw_buffers'] = this.gl.getExtension('WEBGL_draw_buffers');
        this._extensions['WEBGL_lose_context'] = this.gl.getExtension('WEBGL_lose_context');
    }
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

    this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);

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

    // resize the render targets
    for(var i = 0; i < this.renderTargets.length; i++) {
        this.renderTargets[i].resize();
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

    this._glState = {
        currentProgramID: null,
        programs: [],
    };

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
    if(this.gl && this._extensions['WEBGL_lose_context']) {
        this._extensions['WEBGL_lose_context'].restoreContext();
    }
    else if(!this.productionMode) {
        if(!this.gl) {
            console.warn("Could not restore context because the context is not defined");
        }
        else if(!this._extensions['WEBGL_lose_context']) {
            console.warn("Could not restore context because the restore context extension is not defined");
        }
    }
};


/***
 Called when the WebGL context is restored
 ***/
Curtains.prototype._contextRestored = function() {
    this._getExtensions();

    // set blend func
    this._setBlendFunc();

    // enable depth by default
    this._setDepth(true);

    // reset draw stacks
    this._drawStacks = {
        "opaque": {
            length: 0,
            programs: [],
        },
        "transparent": {
            length: 0,
            programs: [],
        },
    };

    // we need to reset everything : planes programs, shaders, buffers and textures !
    for(var i = 0; i < this.renderTargets.length; i++) {
        this.renderTargets[i]._restoreContext();
    }

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
    if(this._autoRender) {
        this._animate();
    }
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

    // delete the shaders
    if(this._shaders) {

        this._shaders = null;
    }

    // delete all programs from manager
    for(var i = 0; i < this._glState.programs.length; i++) {
        var program = this._glState.programs[i];
        this.gl.deleteShader(program.fragmentShader);
        this.gl.deleteShader(program.vertexShader);
        this.gl.deleteProgram(program.program);
    }

    this._glState = {
        currentProgramID: null,
        programs: [],
    };

    // wait for all planes to be deleted before stopping everything
    var self = this;
    var deleteInterval = setInterval(function() {
        if(self.planes.length === 0 && self.shaderPasses.length === 0) {
            // clear interval
            clearInterval(deleteInterval);

            // clear the buffer to clean scene
            self._clear();

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

            self.glCanvas.removeEventListener("webgllost", self._contextLostHandler, false);
            self.glCanvas.removeEventListener("webglrestored", self._contextRestoredHandler, false);

            // lose context
            if(self.gl && self._extensions['WEBGL_lose_context']) {
                self._extensions['WEBGL_lose_context'].loseContext();
            }

            // clear canvas state
            self.glCanvas.width = self.glCanvas.width;

            self.gl = null;

            // remove canvas from DOM
            self.container.removeChild(self.glCanvas);

            self.container = null;
            self.glCanvas = null;
        }
    }, 100);
};


/*** WEBGL PROGRAMS ***/


/***
 Compile our WebGL shaders based on our written shaders

 params:
 @shaderCode (string): shader code
 @shaderType (shaderType): WebGL shader type (vertex or fragment)

 returns:
 @shader (compiled shader): our compiled shader
 ***/
Curtains.prototype._createShader = function(shaderCode, shaderType) {
    var shader = this.gl.createShader(shaderType);

    this.gl.shaderSource(shader, shaderCode);
    this.gl.compileShader(shader);

    // check shader compilation status only when not in production mode
    if(!this.productionMode) {
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.warn("Errors occurred while compiling the shader:\n" + this.gl.getShaderInfoLog(shader));

            return null;
        }
    }

    return shader;
};

/***
 Compare two shaders strings to detect whether they are equal or not

 params:
 @firstShader (string): shader code
 @secondShader (string): shader code

 returns:
 @shader (bool): whether both shaders are equal or not
 ***/
Curtains.prototype._isEqualShader = function(firstShader, secondShader) {
    var isEqualShader = false;
    if(firstShader.localeCompare(secondShader) === 0) {
        isEqualShader = true;
    }

    return isEqualShader;
};


/***
 Checks whether the program has already been registered before creating it

 params:
 @vs (string): vertex shader code
 @fs (string): fragment shader code
 @plane (Plane or ShaderPass object): our plane to set up

 returns:
 @program (object): our program object, false if ceation failed
 ***/
Curtains.prototype._setupProgram = function(vs, fs, plane) {
    var existingProgram = {};
    // check if the program exists
    // a program already exists if both vertex and fragment shaders are the same
    for(var i = 0; i < this._glState.programs.length; i++) {
        if(this._isEqualShader(this._glState.programs[i].vsCode, vs) && this._isEqualShader(this._glState.programs[i].fsCode, fs)) {
            existingProgram = this._glState.programs[i];
            // no need to go further
            break;
        }
    }

    // we found an existing program
    if(existingProgram.program) {
        // if we've decided to share existing programs, just return the existing one
        if(plane.shareProgram) {
            return existingProgram;
        }
        else {
            // we need to create a new program but we don't have to re compile the shaders
            var shaders = this._useExistingShaders(existingProgram);
            return this._createProgram(shaders, plane._type);
        }
    }
    else {
        // compile the new shaders and create a new program
        var shaders = this._useNewShaders(vs, fs);
        if(!shaders) {
            return false;
        }
        else {
            return this._createProgram(shaders, plane._type);
        }
    }
};


/***
 Use already compiled shaders

 params:
 @program (object): an object containing amongst others our compiled shaders and their codes

 returns:
 @shadersObject (object): an object containing the shaders and their codes
 ***/
Curtains.prototype._useExistingShaders = function(program) {
    return {
        vs: {
            vertexShader: program.vertexShader,
            vsCode: program.vsCode,
        },
        fs: {
            fragmentShader: program.fragmentShader,
            fsCode: program.fsCode,
        }
    };
};


/***
 Compiles and creates new shaders

 params:
 @vs (string): vertex shader code
 @fs (string): fragment shader code

 returns:
 @shadersObject (object): an object containing the shaders and their codes
 ***/
Curtains.prototype._useNewShaders = function(vs, fs) {
    var isProgramValid = true;

    var vertexShader = this._createShader(vs, this.gl.VERTEX_SHADER);
    var fragmentShader = this._createShader(fs, this.gl.FRAGMENT_SHADER);

    if(!vertexShader || !fragmentShader) {
        if(!this.productionMode) console.warn("Unable to find or compile the vertex or fragment shader");

        isProgramValid = false;
    }

    if(isProgramValid) {
        return {
            vs: {
                vertexShader: vertexShader,
                vsCode: vs,
            },
            fs: {
                fragmentShader: fragmentShader,
                fsCode: fs,
            }
        };
    }
    else {
        return isProgramValid;
    }
};


/***
 Used internally to set up program based on the created shaders and attach them to the program
 Checks whether the program has already been registered before creating it

 params:
 @shadersObject (object): an object containing the shaders and their codes

 returns:
 @program (object): our program object, false if ceation failed
 ***/
Curtains.prototype._createProgram = function(shadersObject, type) {
    var gl = this.gl;
    var isProgramValid = true;

    // we need to create a new shader program
    var webglProgram = gl.createProgram();

    // if shaders are valid, go on
    if(isProgramValid) {
        gl.attachShader(webglProgram, shadersObject.vs.vertexShader);
        gl.attachShader(webglProgram, shadersObject.fs.fragmentShader);
        gl.linkProgram(webglProgram);

        // check the shader program creation status only when not in production mode
        if(!this.productionMode) {
            if (!gl.getProgramParameter(webglProgram, gl.LINK_STATUS)) {
                console.warn("Unable to initialize the shader program.");

                isProgramValid = false;
            }
        }
    }

    // everything is ok we can go on
    if(isProgramValid) {
        // our program object
        var program = {
            id: this._glState.programs.length,
            vsCode: shadersObject.vs.vsCode,
            vertexShader: shadersObject.vs.vertexShader,
            fsCode: shadersObject.fs.fsCode,
            fragmentShader: shadersObject.fs.fragmentShader,
            program: webglProgram,
            type: type,
        };

        // create a new entry in our draw stack array if it's a regular plane
        if(type === "Plane") {
            this._drawStacks["opaque"]["programs"]["program-" + program.id] = [];
            this._drawStacks["transparent"]["programs"]["program-" + program.id] = [];
        }

        // add it to our program manager programs list
        this._glState.programs.push(program);

        return program;
    }
    else {
        return isProgramValid;
    }
};


/***
 Tell WebGL to use the specified program if it's not already in use

 params:
 @program (object): a program object
 ***/
Curtains.prototype._useProgram = function(program) {
    if(this._glState.currentProgramID === null || this._glState.currentProgramID !== program.id) {
        this.gl.useProgram(program.program);
        this._glState.currentProgramID = program.id;
    }
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

    if(!returnedPlane._usedProgram) {
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
    if(!this.gl) {
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

    // remove from our planes array
    var planeIndex;
    for(var i = 0; i < this.planes.length; i++) {
        if(plane.index === this.planes[i].index) {
            planeIndex = i;
        }
    }

    // erase the plane
    plane = null;
    this.planes[planeIndex] = null;
    this.planes.splice(planeIndex, 1);

    // now rebuild the drawStacks
    // start by clearing all drawstacks
    for(var i = 0; i < this._glState.programs.length; i++) {
        this._drawStacks["opaque"]["programs"]["program-" + this._glState.programs[i].id] = [];
        this._drawStacks["transparent"]["programs"]["program-" +  + this._glState.programs[i].id] = [];
    }
    this._drawStacks["opaque"].length = 0;
    this._drawStacks["transparent"].length = 0;

    // restack our planes with new indexes
    for(var i = 0; i < this.planes.length; i++) {
        this.planes[i].index = i;
        this._stackPlane(this.planes[i]);
    }

    // clear the buffer to clean scene
    if(this.gl) this._clear();
};


/***
 This function will stack planes by opaque/transparency, program ID and then indexes
 We are not necessarily going to draw them in their creation order
 ***/
Curtains.prototype._stackPlane = function(plane) {
    var stackType = plane._transparent ? "transparent" : "opaque";
    if(stackType === "transparent") {
        this._drawStacks[stackType]["programs"]["program-" + plane._usedProgram.id].unshift(plane.index);
    }
    else {
        this._drawStacks[stackType]["programs"]["program-" + plane._usedProgram.id].push(plane.index);
    }
    this._drawStacks[stackType].length++;
};


/*** POST PROCESSING ***/


/*** RENDER TARGETS ***/

/***
 Create a new RenderTarget element and return it

 params:
 @params (obj): see addRenderTarget method

 returns:
 @renderTarget: our newly created RenderTarget object
 ***/
Curtains.prototype._createRenderTarget = function(params) {
    var renderTarget = new Curtains.RenderTarget(this, params);

    return renderTarget;
};

/***
 Create a new RenderTarget element

 params:
 @params (obj): plane params:
 - depth (bool, optionnal): if the render target should use a depth buffer in order to preserve depth (default to false)

 returns :
 @renderTarget: our newly created RenderTarget object
 ***/
Curtains.prototype.addRenderTarget = function(params) {
    // if the WebGL context couldn't be created, return null
    if(!this.gl) {
        if(!this.productionMode) console.warn("Unable to create a plane. The WebGl context couldn't be created");

        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return null;
    }
    else {

        // init the plane
        var renderTarget = this._createRenderTarget(params);

        return renderTarget;
    }
};


/***
 Completely remove a RenderTarget element

 params:
 @renderTarget (RenderTarget element): the render target element to remove
 ***/
Curtains.prototype.removeRenderTarget = function(renderTarget) {
    // now free the webgl part
    renderTarget && renderTarget._dispose();

    // remove plane attachment
    if(renderTarget._plane) {
        renderTarget._plane.target = null;
    }

    // remove from our array
    var fboIndex;
    for(var i = 0; i < this.renderTargets.length; i++) {
        if(renderTarget.index === this.renderTargets[i].index) {
            fboIndex = i;
        }
    }

    // finally erase the plane
    renderTarget = null;
    this.renderTargets[fboIndex] = null;
    this.renderTargets.splice(fboIndex, 1);

    // clear the buffer to clean scene
    if(this.gl) this._clear();
};


/*** SHADER PASSES ***/


/***
 Create a new ShaderPass element and ensure its program is valid to return the right value

 params:
 @planeHtmlElement (html element): the html element that we will use for our plane
 @params (obj): see addShaderPass method

 returns:
 @plane: our newly created ShaderPass object
 ***/
Curtains.prototype._createShaderPass = function(params) {
    var returnedPlane = new Curtains.ShaderPass(this, params);

    if(!returnedPlane._usedProgram) {
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
    if(!this.gl) {
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
    if(this.gl) this._clear();
};


/*** CLEAR SCENE ***/

Curtains.prototype._clear = function() {
    //this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    //this.gl.clearDepth(1.0);

    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
};


/*** FBO ***/

/***
 Called to bind or unbind a FBO

 params:
 @frameBuffer (frameBuffer): if frameBuffer is not null, bind it, unbind it otherwise
 ***/
Curtains.prototype._bindFrameBuffer = function(frameBuffer) {
    var bufferId = null;
    if(frameBuffer) {
        bufferId = frameBuffer.index;

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frameBuffer._frameBuffer);
        this.gl.viewport(0, 0, frameBuffer._size.width, frameBuffer._size.height);
    }
    else {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    }

    this._glState.frameBufferID = bufferId;
};


/*** DEPTH ***/

/***
 Called to set whether the renderer will handle depth test or not
 Depth test is enabled by default

 params:
 @setDepth (boolean): if we should enable or disable the depth test
 ***/
Curtains.prototype._setDepth = function(setDepth) {
    if(setDepth && !this._glState.depthTest) {
        this._glState.depthTest = setDepth;
        // enable depth test
        this.gl.enable(this.gl.DEPTH_TEST);
    }
    else if(!setDepth && this._glState.depthTest) {
        this._glState.depthTest = setDepth;
        // disable depth test
        this.gl.disable(this.gl.DEPTH_TEST);
    }
};


/*** BLEND FUNC ***/

/***
 Called to set whether the renderer will handle depth test or not
 Depth test is enabled by default

 params:
 @setDepth (boolean): if we should enable or disable the depth test
 ***/
Curtains.prototype._setBlendFunc = function() {
    // allows transparency
    // based on https://limnu.com/webgl-blending-youre-probably-wrong/
    this.gl.enable(this.gl.BLEND);
    if(this.premultipliedAlpha) {
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }
    else {
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
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
    var out = new Float32Array(16);

    out[0] = b[0]*a[0] + b[1]*a[4] + b[2]*a[8] + b[3]*a[12];
    out[1] = b[0]*a[1] + b[1]*a[5] + b[2]*a[9] + b[3]*a[13];
    out[2] = b[0]*a[2] + b[1]*a[6] + b[2]*a[10] + b[3]*a[14];
    out[3] = b[0]*a[3] + b[1]*a[7] + b[2]*a[11] + b[3]*a[15];

    out[4] = b[4]*a[0] + b[5]*a[4] + b[6]*a[8] + b[7]*a[12];
    out[5] = b[4]*a[1] + b[5]*a[5] + b[6]*a[9] + b[7]*a[13];
    out[6] = b[4]*a[2] + b[5]*a[6] + b[6]*a[10] + b[7]*a[14];
    out[7] = b[4]*a[3] + b[5]*a[7] + b[6]*a[11] + b[7]*a[15];

    out[8] = b[8]*a[0] + b[9]*a[4] + b[10]*a[8] + b[11]*a[12];
    out[9] = b[8]*a[1] + b[9]*a[5] + b[10]*a[9] + b[11]*a[13];
    out[10] = b[8]*a[2] + b[9]*a[6] + b[10]*a[10] + b[11]*a[14];
    out[11] = b[8]*a[3] + b[9]*a[7] + b[10]*a[11] + b[11]*a[15];

    out[12] = b[12]*a[0] + b[13]*a[4] + b[14]*a[8] + b[15]*a[12];
    out[13] = b[12]*a[1] + b[13]*a[5] + b[14]*a[9] + b[15]*a[13];
    out[14] = b[12]*a[2] + b[13]*a[6] + b[14]*a[10] + b[15]*a[14];
    out[15] = b[12]*a[3] + b[13]*a[7] + b[14]*a[11] + b[15]*a[15];

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
 Creates a matrix from a quaternion rotation, vector translation and vector scale, rotating and scaling around the given origin
 Equivalent for applying translation, rotation and scale matrices but much faster
 Source code from: http://glmatrix.net/docs/mat4.js.html

 params :
 @translation (array): translation vector: [X, Y, Z]
 @rotation (array): rotation vector: [X, Y, Z]
 @scale (array): scale vector: [X, Y, Z]
 @origin (array): origin vector around which to scale and rotate: [X, Y, Z]

 returns :
 @transformationMatrix: matrix after transformations
 ***/
Curtains.prototype._applyTransformationsMatrixFromOrigin = function(translation, rotation, scale, origin) {
    var transformationMatrix = new Float32Array(16);

    // creating a rotation quaternion
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

    quaternion[0] = sinx * cosy * cosz - cosx * siny * sinz;
    quaternion[1] = cosx * siny * cosz + sinx * cosy * sinz;
    quaternion[2] = cosx * cosy * sinz - sinx * siny * cosz;
    quaternion[3] = cosx * cosy * cosz + sinx * siny * sinz;

    // Quaternion math
    var x = quaternion[0], y = quaternion[1], z = quaternion[2], w = quaternion[3];

    var x2 = x + x; // .
    var y2 = y + y; // .
    var z2 = z + z; // . 0 if no rotation

    var xx = x * x2; // .
    var xy = x * y2; // .
    var xz = x * z2; // .
    var yy = y * y2; // .
    var yz = y * z2; // .
    var zz = z * z2; // . 0 if no rotation

    var wx = w * x2; // .
    var wy = w * y2; // .
    var wz = w * z2; // . 0 if no rotation

    var sx = scale[0];
    var sy = scale[1];
    var sz = scale[2];

    var ox = origin[0];
    var oy = origin[1];
    var oz = origin[2];

    var out0 = (1 - (yy + zz)) * sx; // sx if no rotation
    var out1 = (xy + wz) * sx; // 0 if no rotation
    var out2 = (xz - wy) * sx; // 0 if no rotation
    var out4 = (xy - wz) * sy; // 0 if no rotation
    var out5 = (1 - (xx + zz)) * sy; // sy if no rotation
    var out6 = (yz + wx) * sy; // 0 if no rotation
    var out8 = (xz + wy) * sz; // 0 if no rotation
    var out9 = (yz - wx) * sz; // 0 if no rotation
    var out10 = (1 - (xx + yy)) * sz; // sz if no rotation

    transformationMatrix[0] = out0;
    transformationMatrix[1] = out1;
    transformationMatrix[2] = out2;
    transformationMatrix[3] = 0;
    transformationMatrix[4] = out4;
    transformationMatrix[5] = out5;
    transformationMatrix[6] = out6;
    transformationMatrix[7] = 0;
    transformationMatrix[8] = out8;
    transformationMatrix[9] = out9;
    transformationMatrix[10] = out10;
    transformationMatrix[11] = 0;
    transformationMatrix[12] = translation[0] + ox - (out0 * ox + out4 * oy + out8 * oz);
    transformationMatrix[13] = translation[1] + oy - (out1 * ox + out5 * oy + out9 * oz);
    transformationMatrix[14] = translation[2] + oz - (out2 * ox + out6 * oy + out10 * oz);
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

    // set blend func
    this._setBlendFunc();

    // enable depth by default
    this._setDepth(true);

    console.log("curtains.js - v5.0");

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
 Loop through one of our stack (opaque or transparent objects) and draw its planes
 ***/
Curtains.prototype._drawPlaneStack = function(stackType) {
    for(var key in this._drawStacks[stackType]["programs"]) {
        var program = this._drawStacks[stackType]["programs"][key];
        for(var i = 0; i < program.length; i++) {
            var plane = this.planes[program[i]];
            // be sure the plane exists
            if(plane) {
                // draw the plane
                plane._drawPlane();
            }
        }
    }
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
    if(this._onRenderCallback) {
        this._onRenderCallback();
    }

    // enable first frame buffer for shader passes
    if(this.shaderPasses.length > 0) {
        this._bindFrameBuffer(this.shaderPasses[0].target);
    }

    this._clear();

    // loop on our stacked planes
    this._drawPlaneStack("opaque");

    // draw transparent planes if needed
    if(this._drawStacks["transparent"].length) {
        // clear our depth buffer to display transparent objects
        this.gl.clearDepth(1.0);
        this.gl.clear(this.gl.DEPTH_BUFFER_BIT);

        this._drawPlaneStack("transparent");
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
        this._onRenderCallback = callback;
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
    this._type = this._type || "BasicPlane";

    this._curtains = curtainWrapper;
    this.htmlElement = plane;

    this._initBasePlane(params);
};


/***
 Init our plane object and its properties

 params:
 @params (obj): see addPlanes method of the wrapper

 returns:
 @this: our BasePlane element or false if it could not have been created
 ***/
Curtains.BasePlane.prototype._initBasePlane = function(params) {
    // if params are not defined
    if(!params) params = {};

    this._canDraw = false;

    // whether to share programs or not (could enhance performance if a lot of planes use the same shaders)
    this.shareProgram = params.shareProgram || false;

    // define if we should update the plane's matrices when called in the draw loop
    this._updatePerspectiveMatrix = false;
    this._updateMVMatrix = false;

    this._definition = {
        width: parseInt(params.widthSegments) || 1,
        height: parseInt(params.heightSegments) || 1,
    };

    // unique plane buffers dimensions based on width and height
    // used to avoid unnecessary buffer bindings during draw loop
    this._definition.buffersID = this._definition.width * this._definition.height + this._definition.width;

    // depth test
    this._depthTest = params.depthTest;
    if(this._depthTest === null || this._depthTest === undefined) {
        this._depthTest = true;
    }

    // our object that will handle all images loading process
    this._loadingManager = {
        sourcesLoaded: 0,
        initSourcesToLoad: 0 // will change if there's any texture to load on init
    };

    // first we prepare the shaders to be set up
    var shaders = this._setupShaders(params);

    // then we set up the program as compiling can be quite slow
    this._usedProgram = this._curtains._setupProgram(shaders.vertexShaderCode, shaders.fragmentShaderCode, this);

    this.images = [];
    this.videos = [];
    this.canvases = [];
    this.textures = [];

    this.crossOrigin = params.crossOrigin || "anonymous";

    // set up init uniforms
    // handle uniforms
    if(!params.uniforms) {
        params.uniforms = {};
    }

    this.uniforms = {};

    // first we create our uniforms objects
    if(params.uniforms) {
        for(var key in params.uniforms) {
            var uniform = params.uniforms[key];

            // fill our uniform object
            this.uniforms[key] = {
                name: uniform.name,
                type: uniform.type,
                value: uniform.value,

                // TODO
                lastValue: uniform.value,
            };
        }
    }

    // allow the user to add custom data to the plane
    this.userData = {};

    // if program and shaders are valid, go on
    if(this._usedProgram) {
        // should draw is set to true by default, we'll check it later
        this._shouldDraw = true;
        // let the user decide whether the plane should be drawn
        this.visible = true;

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
        return false;
    }
};


/***
 Get a default vertex shader that does nothing but show the plane
 ***/
Curtains.BasePlane.prototype._getDefaultVS = function() {
    if(!this._curtains.productionMode) console.warn("No vertex shader provided, will use a default one");

    return "#ifdef GL_ES\nprecision mediump float;\n#endif\nattribute vec3 aVertexPosition;attribute vec2 aTextureCoord;uniform mat4 uMVMatrix;uniform mat4 uPMatrix;varying vec3 vVertexPosition;varying vec2 vTextureCoord;void main() {vTextureCoord = aTextureCoord;vVertexPosition = aVertexPosition;gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);}";
};


/***
 Get a default fragment shader that does nothing but draw black pixels
 ***/
Curtains.BasePlane.prototype._getDefaultFS = function() {
    return "#ifdef GL_ES\nprecision mediump float;\n#endif\nvarying vec3 vVertexPosition;varying vec2 vTextureCoord;void main( void ) {gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);}";
};



/*** SHADERS CREATIONS ***/


/***
 Used internally to set up shaders

 params:
 @params (obj): see addPlanes method of the wrapper
 ***/
Curtains.BasePlane.prototype._setupShaders = function(params) {
    // handling shaders
    var vsId = params.vertexShaderID || this.htmlElement.getAttribute("data-vs-id");
    var fsId = params.fragmentShaderID || this.htmlElement.getAttribute("data-fs-id");

    var vsIdHTML, fsIdHTML;

    if(!params.vertexShader) {
        if(!vsId || !document.getElementById(vsId)) {
            vsIdHTML = this._getDefaultVS();
        }
        else {
            vsIdHTML = document.getElementById(vsId).innerHTML;
        }
    }

    if(!params.fragmentShader) {
        if(!fsId || !document.getElementById(fsId)) {
            if(!this._curtains.productionMode) console.warn("No fragment shader provided, will use a default one");

            fsIdHTML = this._getDefaultFS();
        }
        else {
            fsIdHTML = document.getElementById(fsId).innerHTML;
        }
    }

    return {
        vertexShaderCode: params.vertexShader || vsIdHTML,
        fragmentShaderCode: params.fragmentShader || fsIdHTML,
    }
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
    var gl = this._curtains.gl;

    switch(uniformType) {
        case "1i":
            gl.uniform1i(uniformLocation, uniformValue);
            break;
        case "1iv":
            gl.uniform1iv(uniformLocation, uniformValue);
            break;
        case "1f":
            gl.uniform1f(uniformLocation, uniformValue);
            break;
        case "1fv":
            gl.uniform1fv(uniformLocation, uniformValue);
            break;

        case "2i":
            gl.uniform2i(uniformLocation, uniformValue[0], uniformValue[1]);
            break;
        case "2iv":
            gl.uniform2iv(uniformLocation, uniformValue);
            break;
        case "2f":
            gl.uniform2f(uniformLocation, uniformValue[0], uniformValue[1]);
            break;
        case "2fv":
            gl.uniform2fv(uniformLocation, uniformValue);
            break;

        case "3i":
            gl.uniform3i(uniformLocation, uniformValue[0], uniformValue[1], uniformValue[2]);
            break;
        case "3iv":
            gl.uniform3iv(uniformLocation, uniformValue);
            break;
        case "3f":
            gl.uniform3f(uniformLocation, uniformValue[0], uniformValue[1], uniformValue[2]);
            break;
        case "3fv":
            gl.uniform3fv(uniformLocation, uniformValue);
            break;

        case "4i":
            gl.uniform4i(uniformLocation, uniformValue[0], uniformValue[1], uniformValue[2], uniformValue[3]);
            break;
        case "4iv":
            gl.uniform4iv(uniformLocation, uniformValue);
            break;
        case "4f":
            gl.uniform4f(uniformLocation, uniformValue[0], uniformValue[1], uniformValue[2], uniformValue[3]);
            break;
        case "4fv":
            gl.uniform4fv(uniformLocation, uniformValue);
            break;

        case "mat2":
            gl.uniformMatrix2fv(uniformLocation, false, uniformValue);
            break;
        case "mat3":
            gl.uniformMatrix3fv(uniformLocation, false, uniformValue);
            break;
        case "mat4":
            gl.uniformMatrix4fv(uniformLocation, false, uniformValue);
            break;

        default:
            if(!this._curtains.productionMode) console.warn("This uniform type is not handled : ", uniformType);
    }
};


/***
 This sets our shaders uniforms

 params :
 @uniforms (obj): uniforms to apply
 ***/
Curtains.BasePlane.prototype._setUniforms = function(uniforms) {
    var curtains = this._curtains;
    var gl = curtains.gl;

    // ensure we are using the right program
    curtains._useProgram(this._usedProgram);

    // set our uniforms if we got some
    if(uniforms) {
        for(var key in uniforms) {
            var uniform = uniforms[key];

            // set our uniform location
            uniform.location = gl.getUniformLocation(this._usedProgram.program, uniform.name);

            if(!uniform.type) {
                if(Array.isArray(uniform.value)) {
                    if(uniform.value.length === 4) {
                        uniform.type = "4f";

                        if(!curtains.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a 4f (array of 4 floats) uniform type");
                    }
                    else if(uniform.value.length === 3) {
                        uniform.type = "3f";

                        if(!curtains.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a 3f (array of 3 floats) uniform type");
                    }
                    else if(uniform.value.length === 2) {
                        uniform.type = "2f";

                        if(!curtains.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a 2f (array of 2 floats) uniform type");
                    }
                }
                else if(uniform.value.constructor === Float32Array) {
                    if(uniform.value.length === 16) {
                        uniform.type = "mat4";

                        if(!curtains.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a mat4 (4x4 matrix array) uniform type");
                    }
                    else if(uniform.value.length === 9) {
                        uniform.type = "mat3";

                        if(!curtains.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a mat3 (3x3 matrix array) uniform type");
                    }
                    else  if(uniform.value.length === 4) {
                        uniform.type = "mat2";

                        if(!curtains.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a mat2 (2x2 matrix array) uniform type");
                    }
                }
                else {
                    uniform.type = "1f";

                    if(!curtains.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a 1f (float) uniform type");
                }
            }

            // set the uniforms
            this._handleUniformSetting(uniform.type, uniform.location, uniform.value);
        }
    }
};


/***
 This updates all uniforms of a plane that were set by the user
 It is called at each draw call
 ***/
Curtains.BasePlane.prototype._updateUniforms = function() {
    if(this.uniforms) {
        for(var key in this.uniforms) {
            var uniform = this.uniforms[key];

            if(!this.shareProgram) {
                if(!uniform.value.length && uniform.value !== uniform.lastValue) {
                    // update our uniforms
                    this._handleUniformSetting(uniform.type, uniform.location, uniform.value);
                }
                else if(JSON.stringify(uniform.value) !== JSON.stringify(uniform.lastValue)) { // compare two arrays
                    // update our uniforms
                    this._handleUniformSetting(uniform.type, uniform.location, uniform.value);
                }

                uniform.lastValue = uniform.value;
            }
            else {
                // update our uniforms
                this._handleUniformSetting(uniform.type, uniform.location, uniform.value);
            }
        }
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
        location: this._curtains.gl.getAttribLocation(this._usedProgram.program, "aVertexPosition"),
    };

    this._attributes.textureCoord = {
        name: "aTextureCoord",
        location: this._curtains.gl.getAttribLocation(this._usedProgram.program, "aTextureCoord"),
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
            this._material.uvs.push(v);
            this._material.uvs.push(0);

            this._geometry.vertices.push(((u + (1 / this._definition.width)) - 0.5) * 2);
            this._geometry.vertices.push((v - 0.5) * 2);
            this._geometry.vertices.push(0);

            this._material.uvs.push(u + (1 / this._definition.width));
            this._material.uvs.push(v + (1 / this._definition.height));
            this._material.uvs.push(0);

            this._geometry.vertices.push(((u + (1 / this._definition.width)) - 0.5) * 2);
            this._geometry.vertices.push(((v + (1 / this._definition.height)) - 0.5) * 2);
            this._geometry.vertices.push(0);
        }
    }
};


/***
 This method creates our vertex and texture coord buffers
 ***/
Curtains.BasePlane.prototype._initializeBuffers = function() {
    var gl = this._curtains.gl;

    // if this our first time we need to create our geometry and material objects
    if(!this._geometry && !this._material) {
        this._setPlaneVertices();
    }

    if(!this._attributes) return;

    // now we'll create vertices and uvs attributes
    this._geometry.bufferInfos = {
        id: gl.createBuffer(),
        itemSize: 3,
        numberOfItems: this._geometry.vertices.length / 3, // divided by item size
    };

    gl.enableVertexAttribArray(this._attributes.vertexPosition.location);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._geometry.bufferInfos.id);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._geometry.vertices), gl.STATIC_DRAW);

    // Set where the vertexPosition attribute gets its data,
    gl.vertexAttribPointer(this._attributes.vertexPosition.location, this._geometry.bufferInfos.itemSize, gl.FLOAT, false, 0, 0);


    this._material.bufferInfos = {
        id: gl.createBuffer(),
        itemSize: 3,
        numberOfItems: this._material.uvs.length / 3, // divided by item size
    };

    gl.enableVertexAttribArray(this._attributes.textureCoord.location);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._material.bufferInfos.id);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._material.uvs), gl.STATIC_DRAW);

    gl.vertexAttribPointer(this._attributes.textureCoord.location, this._material.bufferInfos.itemSize, gl.FLOAT, false, 0, 0);
};


/***
 Used internally handle context restoration
 ***/
Curtains.BasePlane.prototype._restoreContext = function() {
    this._canDraw = false;

    if(this._matrices) {
        this._matrices = null;
    }

    this._attributes = null;

    this._geometry.bufferInfos = null;
    this._material.bufferInfos = null;

    // reset the used program based on our previous shaders code strings
    this._usedProgram = this._curtains._setupProgram(this._usedProgram.vsCode, this._usedProgram.fsCode, this);

    if(this._usedProgram) {
        // reset attributes
        this._setAttributes();

        // reset plane uniforms
        this._setUniforms(this.uniforms);

        // reinitialize buffers
        this._initializeBuffers();

        // handle attached render targets
        if(this._type === "ShaderPass") {
            this.target._frameBuffer = null;
            this.target._depthBuffer = null;

            // remove its render target
            this._curtains.renderTargets.splice(this.target.index, 1);
            // remove its render target texture as well
            this.textures.splice(0, 1);

            // recreate the render target and its texture
            this._createFrameBuffer();
        }
        else if(this.target) {
            // reset its render target if needed
            this.setRenderTarget(this._curtains.renderTargets[this.target.index]);
        }

        // reset textures
        var copyTextures = [];
        for(var i = 0; i < this.textures.length; i++) {
            var texture = this.textures[i];

            // we have reinited our ShaderPass render target texture above, so skip it
            if(!(this._type === "ShaderPass" && texture.type === "fboTexture")) {
                if(!texture._originalInfos) {
                    texture._init();
                }
                else {
                    if(!this._curtains.productionMode) {
                        console.warn("This texture is a copy. You'll need to reassign it again using setFromTexture in the onContextRestored callback:", texture._sampler.name);
                    }

                    // reset to default values
                    // those will be set again in the setFromTexture method
                    texture.type = null;
                    texture._internalFormat = this._curtains.gl.RGBA;
                    texture._format = this._curtains.gl.RGBA;
                    texture._textureType = this._curtains.gl.UNSIGNED_BYTE;

                    texture._init();
                }

                if(texture.source) {
                    texture.setSource(texture.source);
                }
            }
        }

        // if this is a Plane object we need to reset its matrices, perspective and position
        if(this._type === "Plane") {
            this._initMatrices();

            // set our initial perspective matrix
            this.setPerspective(this._fov, 0.1, this._fov * 2);

            this._applyCSSPositions();

            // add the plane to our draw stack again as they have been emptied
            this._curtains._stackPlane(this);
        }

        this._canDraw = true;
    }
};


/*** PLANE SIZES AND TEXTURES HANDLING ***/

/***
 Set our plane dimensions and positions relative to document
 ***/
Curtains.BasePlane.prototype._setDocumentSizes = function() {
    // set our basic initial infos
    var planeBoundingRect = this.htmlElement.getBoundingClientRect();

    // just in case the html element is missing from the DOM, set its container values instead
    if(planeBoundingRect.width === 0 && planeBoundingRect.height === 0) {
        planeBoundingRect = this._curtains._boundingRect;
    }

    if(!this._boundingRect) this._boundingRect = {};

    // set plane dimensions in document space
    this._boundingRect.document = {
        width: planeBoundingRect.width * this._curtains.pixelRatio,
        height: planeBoundingRect.height * this._curtains.pixelRatio,
        top: planeBoundingRect.top * this._curtains.pixelRatio,
        left: planeBoundingRect.left * this._curtains.pixelRatio,
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
    var vPMatrix = this._matrices.mVPMatrix;

    // check that our view projection matrix is defined
    if(vPMatrix) {
        // we are going to get our plane's four corners relative to our view projection matrix
        var corners = [
            this._curtains._applyMatrixToPoint([-1, 1, 0], vPMatrix), // plane's top left corner
            this._curtains._applyMatrixToPoint([1, 1, 0], vPMatrix), // plane's top right corner
            this._curtains._applyMatrixToPoint([1, -1, 0], vPMatrix), // plane's bottom right corner
            this._curtains._applyMatrixToPoint([-1, -1, 0], vPMatrix) // plane's bottom left corner
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
            if(corner[0] > maxX) {
                maxX = corner[0];
            }

            if(corner[1] < minY) {
                minY = corner[1];
            }
            if(corner[1] > maxY) {
                maxY = corner[1];
            }
        }


        // return our values ranging from 0 to 1 multiplied by our canvas sizes + canvas top and left offsets
        return {
            width: (maxX - minX) * this._curtains._boundingRect.width,
            height: (maxY - minY) * this._curtains._boundingRect.height,
            top: minY * this._curtains._boundingRect.height + this._curtains._boundingRect.top,
            left: minX * this._curtains._boundingRect.width + this._curtains._boundingRect.left,

            // add left and width to get right property
            right: minX * this._curtains._boundingRect.width + this._curtains._boundingRect.left + (maxX - minX) * this._curtains._boundingRect.width,
            // add top and height to get bottom property
            bottom: minY * this._curtains._boundingRect.height + this._curtains._boundingRect.top + (maxY - minY) * this._curtains._boundingRect.height,
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
        // reset perspective
        this.setPerspective(this._fov, 0.1, this._fov * 2);

        // apply new position
        this._applyCSSPositions();
    }

    // resize all textures
    for(var i = 0; i < this.textures.length; i++) {
        this.textures[i].resize();
    }


    // handle our after resize event
    var self = this;
    setTimeout(function() {
        if(self._onAfterResizeCallback) {
            self._onAfterResizeCallback();
        }
    }, 0);
};



/*** IMAGES, VIDEOS AND CANVASES LOADING ***/

/***
 This method creates a new Texture associated to the plane

 params :
 @type (string) : texture type, either image, video or canvas

 returns :
 @t: our newly created texture
 ***/
Curtains.BasePlane.prototype.createTexture = function(sampler, isFBOTexture) {
    var texture = new Curtains.Texture(this, {
        index: this.textures.length,
        sampler: sampler,
        isFBOTexture: isFBOTexture,
    });

    // add our texture to the textures array
    this.textures.push(texture);

    return texture;
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
    else if(!this._curtains.productionMode) {
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


/*** LOAD ARRAYS ***/

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
                    if(!self._curtains.productionMode) console.warn("Could not play the video : ", error);
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
        width: (this._boundingRect.document.width * scale.x) / this._curtains.pixelRatio,
        height: (this._boundingRect.document.height * scale.y) / this._curtains.pixelRatio,
        top: (this._boundingRect.document.top + scaleAdjustment.y) / this._curtains.pixelRatio,
        left: (this._boundingRect.document.left + scaleAdjustment.x) / this._curtains.pixelRatio,
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
    var gl = this._curtains.gl;

    // Set the vertices buffer
    gl.enableVertexAttribArray(this._attributes.vertexPosition.location);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._geometry.bufferInfos.id);

    gl.vertexAttribPointer(this._attributes.vertexPosition.location, this._geometry.bufferInfos.itemSize, gl.FLOAT, false, 0, 0);


    // Set where the texture coord attribute gets its data,
    gl.enableVertexAttribArray(this._attributes.textureCoord.location);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._material.bufferInfos.id);

    gl.vertexAttribPointer(this._attributes.textureCoord.location, this._material.bufferInfos.itemSize, gl.FLOAT, false, 0, 0);
};


/***
 This function adds a render target to a plane

 params :
 @renderTarger (RenderTarget): the render target to add to that plane
 ***/
Curtains.BasePlane.prototype.setRenderTarget = function(renderTarget) {
    this.target = renderTarget;
    renderTarget._plane = this;

    // force render
    this._curtains.needRender();
};


/***
 This is used to set the WebGL context active texture and bind it

 params :
 @texture (texture object) : Our texture object containing our WebGL texture and its index
 ***/
Curtains.BasePlane.prototype._bindPlaneTexture = function(texture) {
    var gl = this._curtains.gl;

    // tell WebGL we want to affect the texture at the plane's index unit
    gl.activeTexture(gl.TEXTURE0 + texture.index);
    // bind the texture to the plane's index unit
    gl.bindTexture(gl.TEXTURE_2D, texture._sampler.texture);
};


/*** DRAW THE PLANE ***/

/***
 We draw the plane, ie bind the buffers, set the active textures and draw it
 If the plane type is a ShaderPass we also need to bind the right frame buffers
 ***/
Curtains.BasePlane.prototype._drawPlane = function() {
    var gl = this._curtains.gl;

    // check if our plane is ready to draw
    if(this._canDraw) {
        // enable/disable depth test
        this._curtains._setDepth(this._depthTest);

        // ensure we're using the right program
        this._curtains._useProgram(this._usedProgram);

        // even if our plane should not be drawn we still execute its onRender callback and update its uniforms
        if(this._onRenderCallback) {
            this._onRenderCallback();
        }

        // if this is a frame buffer, check if theres one more coming next and eventually bind it
        if(this._type === "ShaderPass") {
            if(this.index + 1 <= this._curtains.shaderPasses.length - 1) {
                this._curtains._bindFrameBuffer(this._curtains.shaderPasses[this.index + 1].target);
                this._curtains._clear();
            }
            else {
                this._curtains._bindFrameBuffer(null);
            }
        }
        else {
            // if we should render to a render target
            if(this.target) {
                this._curtains._bindFrameBuffer(this.target);
            }
            else if(this._curtains._glState.frameBufferID !== null && this._curtains.shaderPasses.length === 0) {
                this._curtains._bindFrameBuffer(null);
            }

            // update our perspective matrix
            this._setPerspectiveMatrix();

            // update our mv matrix
            this._setMVMatrix();
        }

        // now check if we really need to draw it and its textures
        if(this._shouldDraw && this.visible) {
            // update all uniforms set up by the user
            this._updateUniforms();

            // bind plane attributes buffers
            if(this._curtains._glState.currentBuffersID !== this._definition.buffersID) {
                this._bindPlaneBuffers();
                this._curtains._glState.currentBuffersID = this._definition.buffersID;
            }

            // draw all our plane textures
            for(var i = 0; i < this.textures.length; i++) {
                // draw (bind and maybe update) our texture
                this.textures[i]._drawTexture();
            }

            // the draw call!
            gl.drawArrays(gl.TRIANGLES, 0, this._geometry.bufferInfos.numberOfItems);

            // callback after draw
            if(this._onAfterRenderCallback) {
                this._onAfterRenderCallback();
            }
        }
    }
};


/***
 This deletes all our plane webgl bindings and its textures
 ***/
Curtains.BasePlane.prototype._dispose = function() {
    var gl = this._curtains.gl;

    if(gl) {
        // delete buffers
        // each time we check for existing properties to avoid errors
        if(this._geometry) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this._geometry.bufferInfos.id);
            gl.bufferData(gl.ARRAY_BUFFER, 1, gl.STATIC_DRAW);
            gl.deleteBuffer(this._geometry.bufferInfos.id);
            this._geometry = null;
        }

        if(this._material) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this._material.bufferInfos.id);
            gl.bufferData(gl.ARRAY_BUFFER, 1, gl.STATIC_DRAW);
            gl.deleteBuffer(this._material.bufferInfos.id);
            this._material = null;
        }

        if(this.target) {
            this._curtains.removeRenderTarget(this.target);
            // remove the first texture since it has been deleted with the render target
            this.textures.shift();
        }

        // unbind and delete the textures
        for(var i = 0; i < this.textures.length; i++) {
            this.textures[i]._dispose();
        }
        this.textures = null;
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


/***
 This is called at each requestAnimationFrame call for each plane after the draw call

 params :
 @callback (function) : a function to execute

 returns :
 @this: our plane to handle chaining
 ***/
Curtains.BasePlane.prototype.onAfterRender = function(callback) {
    if(callback) {
        this._onAfterRenderCallback = callback;
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
    this._type = "Plane";

    // inherit
    Curtains.BasePlane.call(this, curtainWrapper, plane, params);

    this.index = this._curtains.planes.length;
    this._canDraw = false;

    // used for FBOs
    this.target = null;

    // if params is not defined
    if(!params) params = {};

    this._setInitParams(params);

    // if program is valid, go on
    if(this._usedProgram) {
        // add our plane to the draw stack
        this._curtains._stackPlane(this);

        // init our plane
        this._initPositions();
        this._initSources();
    }
    else {
        if(this._curtains._onErrorCallback) {
            // if it's not valid call the curtains error callback
            this._curtains._onErrorCallback();
        }
    }
};
Curtains.Plane.prototype = Object.create(Curtains.BasePlane.prototype);
Curtains.Plane.prototype.constructor = Curtains.Plane;


/***
 Set plane's initial params like rotation, scale, translation, fov

 params :
 @params (obj) : see addPlanes method of the Curtains class
 ***/
Curtains.Plane.prototype._setInitParams = function(params) {
    // if our plane should always be drawn or if it should be drawn only when inside the viewport (frustum culling)
    this.alwaysDraw = params.alwaysDraw || false;

    // if the plane has transparency
    this._transparent = params.transparent || false;

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

    // set plane transform origin to center
    this.transformOrigin = {
        x: 0.5,
        y: 0.5,
    };

    // if we decide to load all sources on init or let the user do it manually
    this.autoloadSources = params.autoloadSources;
    if(this.autoloadSources === null || this.autoloadSources === undefined) {
        this.autoloadSources = true;
    }

    // set default fov
    this._fov = params.fov || 75;
    this._nearPlane = 0.1;
    this._farPlane = this._fov * 2;

    // if we should watch scroll
    if(params.watchScroll === null || params.watchScroll === undefined) {
        this.watchScroll = this._curtains._watchScroll;
    }
    else {
        this.watchScroll = params.watchScroll || false;
    }
    // start listening for scroll
    if(this.watchScroll) {
        this._curtains._scrollManager.shouldWatch = true;
    }
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

    if (this._loadingManager.initSourcesToLoad === 0 && !this._curtains.productionMode) {
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
    this._curtains.needRender();

    // everything is ready, check if we should draw the plane
    if(!this.alwaysDraw) {
        this._shouldDrawCheck();
    }
};


/***
 Init our plane model view and projection matrices and set their uniform locations
 ***/
Curtains.Plane.prototype._initMatrices = function() {
    var gl = this._curtains.gl;

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
            location: gl.getUniformLocation(this._usedProgram.program, "uMVMatrix"),
        },
        pMatrix: {
            name: "uPMatrix",
            matrix: new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                0.0, 0.0, 0.0, 0.0,
                0.0, 0.0, 0.0, 0.0,
                0.0, 0.0, 0.0, 0.0
            ]), // will be set after
            location: gl.getUniformLocation(this._usedProgram.program, "uPMatrix"),
        }
    };
};


/***
 Set our plane dimensions and positions relative to clip spaces
 ***/
Curtains.Plane.prototype._setComputedSizes = function() {
    var curtains = this._curtains;

    // dimensions and positions of our plane in the document and clip spaces
    // don't forget translations in webgl space are referring to the center of our plane and canvas
    var planeCenter = {
        x: (this._boundingRect.document.width / 2) + this._boundingRect.document.left,
        y: (this._boundingRect.document.height / 2) + this._boundingRect.document.top,
    };

    var curtainsCenter = {
        x: (curtains._boundingRect.width / 2) + curtains._boundingRect.left,
        y: (curtains._boundingRect.height / 2) + curtains._boundingRect.top,
    };

    // our plane clip space informations
    this._boundingRect.computed = {
        width: this._boundingRect.document.width / curtains._boundingRect.width,
        height: this._boundingRect.document.height / curtains._boundingRect.height,
        top: (curtainsCenter.y - planeCenter.y) / curtains._boundingRect.height,
        left: (planeCenter.x - curtainsCenter.x) / curtains._boundingRect.height,
    };
};



/*** PLANES PERSPECTIVES, SCALES AND ROTATIONS ***/

/***
 This will set our perspective matrix and update our perspective matrix uniform
 used internally at each draw call if needed
 ***/
Curtains.Plane.prototype._setPerspectiveMatrix = function() {
    if(this._updatePerspectiveMatrix) {
        var aspect = this._curtains._boundingRect.width / this._curtains._boundingRect.height;

        this._matrices.pMatrix.matrix = [
            this._fov / aspect, 0, 0, 0,
            0, this._fov, 0, 0,
            0, 0, (this._nearPlane + this._farPlane) * (1 / (this._nearPlane - this._farPlane)), -1,
            0, 0, this._nearPlane * this._farPlane * (1 / (this._nearPlane - this._farPlane)) * 2, 0
        ];
    }

    // update our matrix uniform only if we share programs or if we actually have updated its values
    if(this.shareProgram || !this.shareProgram && this._updatePerspectiveMatrix) {
        this._curtains.gl.uniformMatrix4fv(this._matrices.pMatrix.location, false, this._matrices.pMatrix.matrix);
    }

    this._updatePerspectiveMatrix = false;
};


/***
 This will set our perspective matrix new parameters (fov, near plane and far plane)
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

    if(fieldOfView !== this._fov) {
        this._fov = fieldOfView;
    }

    var nearPlane = parseFloat(near) || 0.1;
    if(nearPlane !== this._nearPlane) {
        this._nearPlane = nearPlane;
    }

    var farPlane = parseFloat(far) || fieldOfView * 2;
    if(farPlane !== this._farPlane) {
        this._farPlane = farPlane;
    }

    // update the plane perspective matrix
    this._updatePerspectiveMatrix = true;
    // update the mvMatrix as well cause we need to update z translation based on new fov
    this._updateMVMatrix = true;
};


/***
 This will set our model view matrix
 used internally at each draw call if needed
 It will calculate our matrix based on its plane translation, rotation and scale
 ***/
Curtains.Plane.prototype._setMVMatrix = function() {
    if(this._updateMVMatrix) {
        var applyWorldScale = {
            x: ((this._curtains._boundingRect.width / this._curtains._boundingRect.height) * this._boundingRect.computed.width / 2),
            y: this._boundingRect.computed.height / 2,
        };

        // translation (we're translating the planes under the hood from fov / 2 along Z axis)
        var translation = [this._translation.x, this._translation.y, this._translation.z - (this._fov / 2)];
        var rotation = [this.rotation.x, this.rotation.y, this.rotation.z];
        var scale = [this.scale.x, this.scale.y, 1];

        var adjustedOrigin = {
            x: this.transformOrigin.x * 2 - 1, // between -1 and 1
            y: -(this.transformOrigin.y * 2 - 1), // between -1 and 1
        };

        var origin = [adjustedOrigin.x * applyWorldScale.x, adjustedOrigin.y * applyWorldScale.y, 0];

        var matrixFromOrigin = this._curtains._applyTransformationsMatrixFromOrigin(translation, rotation, scale, origin);
        var scaleMatrix = new Float32Array([
            applyWorldScale.x, 0.0, 0.0, 0.0,
            0.0, applyWorldScale.y, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0
        ]);

        this._matrices.mvMatrix.matrix = this._curtains._multiplyMatrix(matrixFromOrigin, scaleMatrix);

        // this is the result of our projection matrix * our mv matrix, useful for bounding box calculations and frustum culling
        this._matrices.mVPMatrix = this._curtains._multiplyMatrix(this._matrices.pMatrix.matrix, this._matrices.mvMatrix.matrix);

        // check if we should draw the plane but only if everything has been initialized
        if(!this.alwaysDraw) {
            this._shouldDrawCheck();
        }
    }

    // update our matrix uniform only if we share programs or if we actually have updated its values
    if(this.shareProgram || !this.shareProgram && this._updateMVMatrix) {
        this._curtains.gl.uniformMatrix4fv(this._matrices.mvMatrix.location, false, this._matrices.mvMatrix.matrix);
    }

    // reset our flag
    this._updateMVMatrix = false;
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

        // adjust textures size
        for (var i = 0; i < this.textures.length; i++) {
            this.textures[i].resize();
        }

        // we should update the plane mvMatrix
        this._updateMVMatrix = true;
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

        // we should update the plane mvMatrix
        this._updateMVMatrix = true;
    }
};


/***
 This will set our plane transform origin
 (0, 0) means plane's top left corner
 (1, 1) means plane's bottom right corner

 params :
 @xOrigin (float): coordinate of transformation origin along width
 @yOrigin (float): coordinate of transformation origin along height
 ***/
Curtains.Plane.prototype.setTransformOrigin = function(xOrigin, yOrigin) {
    if(xOrigin === null || typeof xOrigin !== "number") {
        xOrigin = 0.5;
    }
    else {
        xOrigin = parseFloat(xOrigin);
    }

    if(yOrigin === null || typeof yOrigin !== "number") {
        yOrigin = 0.5;
    }
    else {
        yOrigin = parseFloat(yOrigin);
    }

    if(xOrigin !== this.transformOrigin.x || yOrigin !== this.transformOrigin.y) {
        this._updateMVMatrix = true;
    }

    this.transformOrigin = {
        x: xOrigin,
        y: yOrigin,
    };
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

    // we should update the plane mvMatrix
    this._updateMVMatrix = true;
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
    var relativePosition = {
        x: xPosition / (this._curtains._boundingRect.width / this._curtains.pixelRatio) * (this._curtains._boundingRect.width / this._curtains._boundingRect.height),
        y: -yPosition / (this._curtains._boundingRect.height / this._curtains.pixelRatio),
    };

    return relativePosition;
};


/***
 This function checks if the plane is currently visible in the canvas and sets _shouldDraw property according to this test
 This checks DOM positions for now but we might want to improve it to use real frustum calculations
 ***/
Curtains.Plane.prototype._shouldDrawCheck = function() {
    // get plane bounding rect
    var actualPlaneBounds = this.getWebGLBoundingRect();

    var self = this;

    // if we decide to draw the plane only when visible inside the canvas
    // we got to check if its actually inside the canvas
    if(
        Math.round(actualPlaneBounds.right) <= this._curtains._boundingRect.left - this.drawCheckMargins.right
        || Math.round(actualPlaneBounds.left) >= this._curtains._boundingRect.left + this._curtains._boundingRect.width + this.drawCheckMargins.left
        || Math.round(actualPlaneBounds.bottom) <= this._curtains._boundingRect.top - this.drawCheckMargins.bottom
        || Math.round(actualPlaneBounds.top) >= this._curtains._boundingRect.top + this._curtains._boundingRect.height + this.drawCheckMargins.top
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
 This function updates the plane position based on the Curtains class scroll manager values
 ***/
Curtains.Plane.prototype.updateScrollPosition = function() {
    // actually update the plane position only if last X delta or last Y delta is not equal to 0
    if(this._curtains._scrollManager.lastXDelta || this._curtains._scrollManager.lastYDelta) {
        // set new positions based on our delta without triggering reflow
        this._boundingRect.document.top += this._curtains._scrollManager.lastYDelta * this._curtains.pixelRatio;
        this._boundingRect.document.left += this._curtains._scrollManager.lastXDelta * this._curtains.pixelRatio;

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
    this._depthTest = shouldEnableDepthTest;
};


/***
 This function puts the plane at the end of the draw stack, allowing it to overlap any other plane
 ***/
Curtains.Plane.prototype.moveToFront = function() {
    // disable the depth test
    this.enableDepthTest(false);

    var drawType = this._transparent ? "transparent" : "opaque";
    var drawStack = this._curtains._drawStacks[drawType]["programs"]["program-" + this._usedProgram.id];
    for(var i = 0; i < drawStack.length; i++) {
        if(this.index === drawStack[i]) {
            drawStack.splice(i, 1);
        }
    }
    if(drawType === "transparent") {
        drawStack.unshift(this.index);
    }
    else {
        drawStack.push(this.index);
    }

    // now move its program stack array on top as well
    for(var key in this._curtains._drawStacks[drawType]) {
        if(key === "program-" + this._usedProgram.id) {
            delete this._curtains._drawStacks[drawType][key];
        }
    }
    this._curtains._drawStacks[drawType]["programs"]["program-" + this._usedProgram.id] = drawStack;
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



/*** RENDERTARGET CLASS ***/

/***
 Here we create a render target

 params :
 @curtainWrapper : our curtain object that wraps all the planes
 @params (object, optionnal): additionnal params
 - plane (plane object, optionnal): the plane to attach this render target to. Set under the hood by shader passes
 - depth (bool, optionnal): whether the render target should use a depth buffer and handle depth

 returns :
 @this: our render target element
 ***/
Curtains.RenderTarget = function(curtainWrapper, params) {
    if(!params) params = {};
    this._curtains = curtainWrapper;

    this.index = this._curtains.renderTargets.length;
    this._type = "RenderTarget";
    this._plane = params.plane || null;

    this._depth = params.depth;
    if(this._depth === null || this._depth === undefined) {
        this._depth = true;
    }

    this.userData = {};

    this._curtains.renderTargets.push(this);

    this._initRenderTarget();
};



/***
 Init our RenderTarget by setting its size and creating a textures array
 ***/
Curtains.RenderTarget.prototype._initRenderTarget = function() {
    this._setSize();

    // create our render texture
    this.textures = [];

    // create our frame buffer
    this._createFrameBuffer();
};


/***
 Sets our RenderTarget size based on its parent plane size
 ***/
Curtains.RenderTarget.prototype._setSize = function() {
    this._size = {
        width: this._plane ? this._plane._boundingRect.document.width : this._curtains._boundingRect.width,
        height: this._plane ? this._plane._boundingRect.document.height : this._curtains._boundingRect.height,
    };
};

/***
 Resizes our RenderTarget (basically only resize it if it's a ShaderPass FBO)
 ***/
Curtains.RenderTarget.prototype.resize = function() {
    // resize render target only if its a child of a shader pass
    if(this._plane && this._plane._type === "ShaderPass") {
        this._setSize();
    }

    this._curtains._bindFrameBuffer(this);
    if(this._depth) {
        this._bindDepthBuffer();
    }

    this._curtains._bindFrameBuffer(null);
};


/***
 Binds our depth buffer
 ***/
Curtains.RenderTarget.prototype._bindDepthBuffer = function() {
    var gl = this._curtains.gl;

    // render to our target texture by binding the framebuffer
    if(this._depthBuffer) {
        gl.bindRenderbuffer(gl.RENDERBUFFER, this._depthBuffer);

        // allocate renderbuffer
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this._size.width, this._size.height);

        // attach renderbuffer
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._depthBuffer);
    }
};


/***
 Here we create our FBO texture and assign it as our FBO attachment
 ***/
Curtains.RenderTarget.prototype._createFBOTexture = function() {
    var gl = this._curtains.gl;

    // attach the texture to the parent ShaderPass if it exists, to the render target otherwise
    var texture = new Curtains.Texture(this._plane ? this._plane : this, {
        index: this.textures.length,
        sampler: "uRenderTexture",
        isFBOTexture: true,
    });

    this.textures.push(texture);

    // attach the texture as the first color attachment
    // this.textures[0]._sampler.texture contains our WebGLTexture object
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[0]._sampler.texture, 0);
};


/***
 Here we create our frame buffer object
 We're also adding a render buffer object to handle depth if needed
 ***/
Curtains.RenderTarget.prototype._createFrameBuffer = function() {
    var gl = this._curtains.gl;

    this._frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._frameBuffer);

    this._createFBOTexture();

    // create a depth renderbuffer
    if(this._depth) {
        this._depthBuffer = gl.createRenderbuffer();
        this._bindDepthBuffer();
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};


/***
 Restore a render target
 Used only for render targets that are not attached to shader passes
 Those attached to shader passes are restored inside the _restoreContext method of the ShaderPass class
 ***/
Curtains.RenderTarget.prototype._restoreContext = function() {
    if(this._plane._type !== "ShaderPass") {
        // reset textures array
        this.textures = [];

        // reset plane for texture creation
        // if there's a plane attached it will be re-attached in the plane's restoreContext method anyway
        this._plane = null;

        // recreate frame buffer
        this._createFrameBuffer();
    }
};


/***
 Remove a RenderTarget buffers
 ***/
Curtains.RenderTarget.prototype._dispose = function() {
    if(this._frameBuffer) {
        this._curtains.gl.deleteFramebuffer(this.framebuffer);
        this._frameBuffer = null;
    }
    if(this._depthBuffer) {
        this._curtains.gl.deleteRenderbuffer(this._depthBuffer);
        this._depthBuffer = null;
    }

    this.textures[0]._dispose();
    this.textures = [];
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

    this._type = "ShaderPass";

    // inherit
    Curtains.BasePlane.call(this, curtainWrapper, curtainWrapper.container, params);

    this.index = this._curtains.shaderPasses.length;

    // if the program is valid, go on
    if(this._usedProgram) {
        this._initShaderPassPlane();
    }
};
Curtains.ShaderPass.prototype = Object.create(Curtains.BasePlane.prototype);
Curtains.ShaderPass.prototype.constructor = Curtains.ShaderPass;


/***
 Here we init additionnal shader pass planes properties
 This mainly consists in creating our render texture and add a frame buffer object
 ***/
Curtains.ShaderPass.prototype._initShaderPassPlane = function() {
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
    this._curtains.needRender();
};


/***
 Here we override the parent _getDefaultVS method
 because shader passes vs don't have projection and model view matrices
 ***/
Curtains.ShaderPass.prototype._getDefaultVS = function(params) {
    return "#ifdef GL_ES\nprecision mediump float;\n#endif\nattribute vec3 aVertexPosition;attribute vec2 aTextureCoord;varying vec3 vVertexPosition;varying vec2 vTextureCoord;void main() {vTextureCoord = aTextureCoord;vVertexPosition = aVertexPosition;gl_Position = vec4(aVertexPosition, 1.0);}";
};


/***
 Here we override the parent _getDefaultFS method
 taht way we can still draw our render texture
 ***/
Curtains.ShaderPass.prototype._getDefaultFS = function(params) {
    return "#ifdef GL_ES\nprecision mediump float;\n#endif\nvarying vec3 vVertexPosition;varying vec2 vTextureCoord;uniform sampler2D uRenderTexture;void main( void ) {gl_FragColor = texture2D(uRenderTexture, vTextureCoord);}";
};


/***
 Here we create our frame buffer object
 We're also adding a render buffer object to handle depth inside our shader pass
 ***/
Curtains.ShaderPass.prototype._createFrameBuffer = function() {
    var target = new Curtains.RenderTarget(this._curtains, {
        plane: this,
    });
    this.setRenderTarget(target);

    // add the frame buffer texture to the shader pass texture array
    this.textures.push(this.target.textures[0]);
};



/*** TEXTURE CLASS ***/

/***
 Here we create our Texture object (note that we are using the Curtains namespace to avoid polluting the global scope)

 params:
 @parent (Plane, ShaderPass or RenderTarget object): the parent object using that texture
 @params (obj): see createTexture method of the Plane

 returns:
 @this: our newly created texture object
 ***/
Curtains.Texture = function(parent, params) {
    // set up base properties
    this._parent = parent;
    this._curtains = parent._curtains;

    if(!parent._usedProgram && !params.isFBOTexture) {
        if(!this._curtains.productionMode) {
            console.warn("Unable to create the texture because the program is not valid");
        }

        return;
    }

    this.index = parent.textures.length;

    var gl = this._curtains.gl;
    // texImage2D properties
    this._internalFormat = gl.RGBA;
    this._format = gl.RGBA;
    this._textureType = gl.UNSIGNED_BYTE;

    // prepare texture sampler
    this._sampler = {
        name: params.sampler || null
    };

    // _willUpdate and shouldUpdate property are set to false by default
    // we will handle that in the setSource() method for videos and canvases
    this._willUpdate = false;
    this.shouldUpdate = false;

    // if we need to force a texture update
    this._forceUpdate = false;

    this.scale = {
        x: 1,
        y: 1,
    };

    // custom user properties
    this.userData = {};

    // init texture
    if(params.isFBOTexture) {
        // set a special type
        this.type = "fboTexture";
    }

    // init our texture
    this._init();

    return this;
};


/***
 Init our texture object
 ***/
Curtains.Texture.prototype._init = function() {
    var gl = this._curtains.gl;

    // create our WebGL texture
    this._sampler.texture = gl.createTexture();

    // bind the texture the target (TEXTURE_2D) of the active texture unit.
    gl.bindTexture(gl.TEXTURE_2D, this._sampler.texture);

    // we don't use Y flip yet
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);

    // if the parent has a program it means its not a render target texture
    if(this._parent._usedProgram) {
        // use the program and get our sampler and texture matrices uniforms
        this._curtains._useProgram(this._parent._usedProgram);

        // set our texture sampler uniform
        var samplerUniformLocation = this._sampler.name || "uSampler" + this.index;

        this._sampler.location = gl.getUniformLocation(this._parent._usedProgram.program, samplerUniformLocation);

        // tell the shader we bound the texture to our indexed texture unit
        gl.uniform1i(this._sampler.location, this.index);

        // we will always declare a texture matrix uniform
        var textureMatrix = this._sampler.name ? this._sampler.name + "Matrix" : "uTextureMatrix" + this.index;
        this._textureMatrix = {
            name: textureMatrix,
            matrix: null,
            location: gl.getUniformLocation(this._parent._usedProgram.program, textureMatrix)
        };

        this._sampler.name = samplerUniformLocation;

        // its a shader pass texture
        // set its size to our parent plane, in this case our canvas
        this._size = {
            width: this._parent._boundingRect.document.width,
            height: this._parent._boundingRect.document.height,
        };

        // its a plane texture
        if(this.type !== "fboTexture") {
            // draw a black plane before the real texture's content has been loaded
            gl.texImage2D(gl.TEXTURE_2D, 0, this._internalFormat, 1, 1, 0, this._format, this._textureType, new Uint8Array([0, 0, 0, 255]));

            // our texture source hasn't been loaded yet
            this._sourceLoaded = false;
        }
        else {
            // get a texture matrix even if it fits the viewport
            var sizes = this._getSizes();

            // always update texture matrix anyway
            this._updateTextureMatrix(sizes);
        }
    }
    else {
        // its a render target texture, it has no uniform location and no texture matrix
        this._size = {
            width: this._parent._size.width || this._curtains._boundingRect.width,
            height: this._parent._size.height || this._curtains._boundingRect.height,
        };
    }

    // if its a render target texture use nearest filters and half float whenever possible
    if(this.type === "fboTexture") {
        // set the filtering so we don't need mips
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);


        // update texImage2D properties
        if(this._curtains._isWebGL2 && this._curtains._extensions['EXT_color_buffer_float']) {
            this._internalFormat = gl.RGBA16F;
            this._textureType = gl.HALF_FLOAT;
        }
        else if(this._curtains._extensions['OES_texture_half_float']) {
            this._textureType = this._curtains._extensions['OES_texture_half_float'].HALF_FLOAT_OES;
        }

        // define its size
        gl.texImage2D(gl.TEXTURE_2D, 0, this._internalFormat, this._size.width, this._size.height, 0, this._format, this._textureType, null);
    }
};


/*** LOADING SOURCESS ***/

/***
 This applies an already existing Texture object to our texture

 params:
 @texture (Texture): texture to set from
 ***/
Curtains.Texture.prototype.setFromTexture = function(texture) {
    if(texture) {
        this.type = texture.type;
        this._sampler.texture = texture._sampler.texture;
        this.source = texture.source;
        this._size = texture._size;

        this._internalFormat = texture._internalFormat;
        this._format = texture._format;
        this._textureType = texture._textureType;

        this._originalInfos = {
            type: texture._parent._type,
            parentIndex: texture._parent.index,
            textureIndex: texture.index,
        };

        if(this._parent._usedProgram && !this._textureMatrix.matrix) {
            // we will always declare a texture matrix uniform
            var textureMatrix = this._sampler.name ? this._sampler.name + "Matrix" : "uTextureMatrix" + this.index;
            this._textureMatrix = {
                name: textureMatrix,
                matrix: null,
                location: this._curtains.gl.getUniformLocation(this._parent._usedProgram.program, textureMatrix)
            };

            // no point in resizing texture if it does not have a source yet
            var sizes = this._getSizes();

            // always update texture matrix anyway
            this._updateTextureMatrix(sizes);
        }
    }
    else if(!this._curtains.productionMode) {
        console.warn("Unable to set the texture from texture:", texture);
    }
};

/***
 This uses our source as texture

 params:
 @source (images/video/canvas): either an image, a video or a canvas
 ***/
Curtains.Texture.prototype.setSource = function(source) {
    // if our program hasn't been validated we can't set a texture source
    if(!this._parent._usedProgram) {
        if(!this._curtains.productionMode) {
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
        // _willUpdate property will be set to true if the video has data to draw
        this.shouldUpdate = true;
    }
    else if(source.tagName.toUpperCase() === "CANVAS") {
        this.type = "canvas";
        // a canvas could change each frame so we need to update it by default
        this._willUpdate = true;
        this.shouldUpdate = true;
    }
    else if(!this._curtains.productionMode) {
        console.warn("this HTML tag could not be converted into a texture:", source.tagName);
    }

    this._size = {
        width: this.source.naturalWidth || this.source.width || this.source.videoWidth,
        height: this.source.naturalHeight || this.source.height || this.source.videoHeight,
    };

    var gl = this._curtains.gl;

    // Bind the texture the target (TEXTURE_2D) of the active texture unit.
    gl.bindTexture(gl.TEXTURE_2D, this._sampler.texture);

    if(this._curtains.premultipliedAlpha) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this._curtains.premultipliedAlpha);
    }

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.resize();

    // set our webgl texture only if it is not a video
    // if it is a video it won't be ready yet and throw a warning in chrome
    // besides it will be updated anyway as soon as it will start playing
    if(this.type !== "video") {
        gl.texImage2D(gl.TEXTURE_2D, 0, this._internalFormat, this._format, this._textureType, source);
    }

    // update our scene
    this._curtains.needRender();
};


/***
 This forces a texture to be updated on the next draw call
 ***/
Curtains.Texture.prototype.needUpdate = function() {
    this._forceUpdate = true;
};


/***
 This update our texture
 Called inside our drawing loop if shouldUpdate property is set to true
 Typically used by videos or canvas
 ***/
Curtains.Texture.prototype._update = function() {
    var gl = this._curtains.gl;

    if(this.source) {
        // fix weird bug where sometimes canvas texture Y flip is not applied
        if(this.type === "canvas" && !this._yFlipped) {
            this._yFlipped = true;
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        }

        gl.texImage2D(gl.TEXTURE_2D, 0, this._internalFormat, this._format, this._textureType, this.source);
    }
    else {
        gl.texImage2D(gl.TEXTURE_2D, 0, this._internalFormat, this._size.width, this._size.height, 0, this._format, this._textureType, this.source);
    }
};


/*** TEXTURE SIZINGS ***/


/***
 This is used to calculate how to crop/center an texture

 returns:
 @sizes (obj): an object containing plane sizes, source sizes and x and y offset to center the source in the plane
 ***/
Curtains.Texture.prototype._getSizes = function() {
    // remember our ShaderPass objects don't have a scale property
    var scale = this._parent.scale ? this._parent.scale : {x: 1, y: 1};

    var parentWidth  = this._parent._boundingRect.document.width * scale.x;
    var parentHeight = this._parent._boundingRect.document.height * scale.y;

    var sourceWidth = this._size.width;
    var sourceHeight = this._size.height;

    var sourceRatio = sourceWidth / sourceHeight;
    var parentRatio = parentWidth / parentHeight;

    // center image in its container
    var xOffset = 0;
    var yOffset = 0;

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

    this.resize();
};

/***
 This is used to crop/center a texture
 If the texture is using texture matrix then we just have to update its matrix
 If it is a render pass texture we also upload the texture with its new size on the GPU
 ***/
Curtains.Texture.prototype.resize = function() {
    if(this.type === "fboTexture") {
        var gl = this._curtains.gl;

        this._size = {
            width: this._parent._boundingRect.document.width,
            height: this._parent._boundingRect.document.height,
        };

        // if its not a texture set from another texture
        if(!this._originalInfos) {
            gl.bindTexture(gl.TEXTURE_2D, this._parent.textures[0]._sampler.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, this._internalFormat, this._size.width, this._size.height, 0, this._format, this._textureType, this.source);
        }
    }
    else if(this.source) {
        // reset texture sizes (useful for canvas because their dimensions might change on resize)
        this._size = {
            width: this.source.naturalWidth || this.source.width || this.source.videoWidth,
            height: this.source.naturalHeight || this.source.height || this.source.videoHeight,
        };
    }

    // if we need to update the texture matrix uniform
    if(this._parent._usedProgram) {
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
        x: sizes.parentWidth / (sizes.parentWidth - sizes.xOffset),
        y: sizes.parentHeight / (sizes.parentHeight - sizes.yOffset),
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
    this._textureMatrix.matrix = this._curtains._scaleMatrix(
        textureTranslation,
        texScale.x,
        texScale.y,
        1
    );

    // update the texture matrix uniform
    this._curtains._useProgram(this._parent._usedProgram);
    this._curtains.gl.uniformMatrix4fv(this._textureMatrix.location, false, this._textureMatrix.matrix);

    // force render
    this._curtains.needRender();
};


/***
 This calls our loading callback and set our media as texture source
 ***/
Curtains.Texture.prototype._onSourceLoaded = function(source) {
    // increment our loading manager
    this._parent._loadingManager.sourcesLoaded++;

    // set the media as our texture source
    this.setSource(source);

    // fire callback during load (useful for a loader)
    var self = this;
    if(!this._sourceLoaded) {
        setTimeout(function() {
            if(self._parent._onPlaneLoadingCallback) {
                self._parent._onPlaneLoadingCallback(self);
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
    this._parent._bindPlaneTexture(this);

    // check if the video is actually really playing
    if(this.type === "video" && this.source && this.source.readyState >= this.source.HAVE_CURRENT_DATA) {
        this._willUpdate = true;
    }

    if(this._forceUpdate || (this._willUpdate && this.shouldUpdate)) {
        this._update();
    }

    // reset the video willUpdate flag
    if(this.type === "video") {
        this._willUpdate = false;
    }

    this._forceUpdate = false;
};


/***
 This is used to destroy a texture and free the memory space
 Usually used on a plane/shader pass/render target removal
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

    var gl = this._curtains.gl;

    if(gl) {
        gl.activeTexture(gl.TEXTURE0 + this.index);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.deleteTexture(this._sampler.texture);
    }

    // decrease textures loaded
    this._parent._loadingManager && this._parent._loadingManager.sourcesLoaded--;
};