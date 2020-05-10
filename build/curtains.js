/***
 Little WebGL helper to apply images, videos or canvases as textures of planes
 Author: Martin Laxenaire https://www.martin-laxenaire.fr/
 Version: 6.1.1
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
    // textures
    this._imageCache = [];

    this._drawStacks = {
        "opaque": {
            length: 0,
            programs: [],
            order: [],
        },
        "transparent": {
            length: 0,
            programs: [],
            order: [],
        },
        "renderPasses": [],
        "scenePasses": [],
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

    // pixel ratio and rendering scale
    this.pixelRatio = params.pixelRatio || window.devicePixelRatio || 1;

    params.renderingScale = isNaN(params.renderingScale) ? 1 : parseFloat(params.renderingScale);
    this._renderingScale = Math.max(0.25, Math.min(1, params.renderingScale));

    // webgl context parameters
    this.premultipliedAlpha = params.premultipliedAlpha || false;

    this.alpha = params.alpha;
    if(this.alpha === null || this.alpha === undefined) {
        this.alpha = true;
    }

    this.antialias = params.antialias;
    if(this.antialias === null || this.antialias === undefined) {
        this.antialias = true;
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
        premultipliedAlpha: this.premultipliedAlpha,
        antialias: this.antialias,
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

    // get webgl extensions
    this._getExtensions();

    // managing our webgl draw states
    this._glState = {
        // programs
        currentProgramID: null,
        programs: [],

        // last buffer sizes drawn (avoid redundant buffer bindings)
        currentBuffersID: 0,
        setDepth: null,
        // current frame buffer ID
        frameBufferID: null,
        // current scene pass ID
        scenePassIndex: null,

        // face culling
        cullFace: null,

        // textures flip Y
        flipY: null,
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


/***
 Get all available WebGL extensions based on WebGL used version
 Called on init and on context restoration
 ***/
Curtains.prototype._getExtensions = function() {
    this._extensions = [];
    if(this._isWebGL2) {
        this._extensions['EXT_color_buffer_float'] = this.gl.getExtension('EXT_color_buffer_float');
        this._extensions['OES_texture_float_linear'] = this.gl.getExtension('OES_texture_float_linear');
        this._extensions['WEBGL_lose_context'] = this.gl.getExtension('WEBGL_lose_context');
    } else {
        this._extensions['OES_vertex_array_object'] = this.gl.getExtension('OES_vertex_array_object');
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

    this.glCanvas.width = Math.floor(this._boundingRect.width * this._renderingScale);
    this.glCanvas.height = Math.floor(this._boundingRect.height * this._renderingScale);

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

    if(this._onScrollCallback) {
        this._onScrollCallback();
    }
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

        // last buffer sizes drawn (avoid redundant buffer bindings)
        currentBuffersID: 0,
        setDepth: null,
        // current frame buffer ID
        frameBufferID: null,
        // current scene pass ID
        scenePassIndex: null,

        // face culling
        cullFace: null,

        // textures flip Y
        flipY: null,
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
    var isDrawingEnabled = this._drawingEnabled;
    this._drawingEnabled = false;

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
            order: [],
        },
        "transparent": {
            length: 0,
            programs: [],
            order: [],
        },
        "renderPasses": [],
        "scenePasses": [],
    };

    this._imageCache = [];

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

    // callback
    if(this._onContextRestoredCallback) {
        this._onContextRestoredCallback();
    }

    // start drawing again
    // reset drawing flag to original value
    this._drawingEnabled = isDrawingEnabled;

    // force next frame render whatever our drawing flag value
    this.needRender();

    // requestAnimationFrame again if needed
    if(this._autoRender) {
        this._animate();
    }
};


/***
 Dispose everything
 ***/
Curtains.prototype.dispose = function() {
    this._isDestroying = true;

    // be sure to delete all planes
    while(this.planes.length > 0) {
        this.removePlane(this.planes[0]);
    }

    // we need to delete the shader passes also
    while(this.shaderPasses.length > 0) {
        this.removeShaderPass(this.shaderPasses[0]);
    }

    // finally we need to delete the render targets
    while(this.renderTargets.length > 0) {
        this.removeRenderTarget(this.renderTargets[0]);
    }

    // delete all programs from manager
    for(var i = 0; i < this._glState.programs.length; i++) {
        var program = this._glState.programs[i];
        this.gl.deleteProgram(program.program);
    }

    this._glState = {
        currentProgramID: null,
        programs: [],
        // last buffer sizes drawn (avoid redundant buffer bindings)
        currentBuffersID: 0,
        setDepth: null,
        // current frame buffer ID
        frameBufferID: null,
        // current scene pass ID
        scenePassIndex: null,
        // face culling
        cullFace: null,
        // textures flip Y
        flipY: null,
    };

    // wait for all planes to be deleted before stopping everything
    var self = this;
    var deleteInterval = setInterval(function() {
        if(self.planes.length === 0 && self.shaderPasses.length === 0 && self.renderTargets.length === 0) {
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
        if(!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            // shader debugging log as seen in THREE.js WebGLProgram source code
            var shaderTypeString = shaderType === this.gl.VERTEX_SHADER ? "vertex shader" : "fragment shader";
            var shaderSource = this.gl.getShaderSource(shader);
            var shaderLines = shaderSource.split('\n');

            for(var i = 0; i < shaderLines.length; i ++) {
                shaderLines[i] = (i + 1) + ': ' + shaderLines[i];
            }
            shaderLines = shaderLines.join("\n");

            console.warn("Errors occurred while compiling the", shaderTypeString, ":\n", this.gl.getShaderInfoLog(shader));
            console.error(shaderLines);

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
 @type (string): type of the plane that will use that program. Could be either "Plane" or "ShaderPass"

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
            if(!gl.getProgramParameter(webglProgram, gl.LINK_STATUS)) {
                console.warn("Unable to initialize the shader program.");

                isProgramValid = false;
            }
        }

        // free the shaders handles
        gl.deleteShader(shadersObject.vs.vertexShader);
        gl.deleteShader(shadersObject.fs.fragmentShader);
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
        var plane = new Curtains.Plane(this, planeHtmlElement, params);

        if(!plane._usedProgram) {
            plane = false;
        }
        else {
            this.planes.push(plane);
        }

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

    var stackType = plane._transparent ? "transparent" : "opaque";

    // now free the webgl part
    plane && plane._dispose();

    // remove from our planes array
    var planeIndex;
    for(var i = 0; i < this.planes.length; i++) {
        if(plane.uuid === this.planes[i].uuid) {
            planeIndex = i;
        }
    }

    // erase the plane
    plane = null;
    this.planes[planeIndex] = null;
    this.planes.splice(planeIndex, 1);

    // now rebuild the drawStacks
    // start by clearing all the program drawstacks
    for(var i = 0; i < this._glState.programs.length; i++) {
        this._drawStacks["opaque"]["programs"]["program-" + this._glState.programs[i].id] = [];
        this._drawStacks["transparent"]["programs"]["program-" + this._glState.programs[i].id] = [];
    }
    this._drawStacks["opaque"].length = 0;
    this._drawStacks["transparent"].length = 0;

    // rebuild them with the new plane indexes
    for(var i = 0; i < this.planes.length; i++) {
        var plane = this.planes[i];
        plane.index = i;

        var planeStackType = plane._transparent ? "transparent" : "opaque";
        if(planeStackType === "transparent") {
            this._drawStacks[planeStackType]["programs"]["program-" + plane._usedProgram.id].unshift(plane.index);
        }
        else {
            this._drawStacks[planeStackType]["programs"]["program-" + plane._usedProgram.id].push(plane.index);
        }
        this._drawStacks[planeStackType].length++;
    }

    // look for an empty program drawstack array and remove it from the program order stack
    for(var i = 0; i < this._drawStacks[stackType]["order"].length; i++) {
        var programID = this._drawStacks[stackType]["order"][i];
        if(this._drawStacks[stackType]["programs"]["program-" + programID].length === 0) {
            this._drawStacks[stackType]["order"].splice(i, 1);
        }
    }

    // clear the buffer to clean scene
    if(this.gl) this._clear();

    // reset buffers to force binding them again
    this._glState.currentBuffersID = 0;
};


/***
 This function will stack planes by opaqueness/transparency, program ID and then indexes
 Stack order drawing process:
 - draw opaque then transparent planes
 - for each of those two stacks, iterate through the existing programs (following the "order" array) and draw their respective planes
 This is done to improve speed, notably when using shared programs, and reduce GL calls
 ***/
Curtains.prototype._stackPlane = function(plane) {
    var stackType = plane._transparent ? "transparent" : "opaque";
    var drawStack = this._drawStacks[stackType];
    if(stackType === "transparent") {
        drawStack["programs"]["program-" + plane._usedProgram.id].unshift(plane.index);
        // push to the order array only if it's not already in there
        if(!drawStack["order"].includes(plane._usedProgram.id)) {
            drawStack["order"].unshift(plane._usedProgram.id);
        }
    }
    else {
        drawStack["programs"]["program-" + plane._usedProgram.id].push(plane.index);
        // push to the order array only if it's not already in there
        if(!drawStack["order"].includes(plane._usedProgram.id)) {
            drawStack["order"].push(plane._usedProgram.id);
        }
    }
    drawStack.length++;
};


/*** POST PROCESSING ***/


/*** RENDER TARGETS ***/


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
        if(!this.productionMode) console.warn("Unable to create a render target. The WebGl context couldn't be created");

        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return null;
    }
    else {
        // init the render target
        var renderTarget = new Curtains.RenderTarget(this, params);

        return renderTarget;
    }
};


/***
 Completely remove a RenderTarget element

 params:
 @renderTarget (RenderTarget element): the render target element to remove
 ***/
Curtains.prototype.removeRenderTarget = function(renderTarget) {
    // check if it is attached to a shader pass
    if(renderTarget._shaderPass) {
        if(!this.productionMode) {
            console.warn("You're trying to remove a render target attached to a shader pass. You should remove that shader pass instead:", renderTarget._shaderPass);
        }

        return;
    }

    // loop through all planes that might use that render target and reset it
    for(var i = 0; i < this.planes.length; i++) {
        if(this.planes[i].target && this.planes[i].target.uuid === renderTarget.uuid) {
            this.planes[i].target = null;
        }
    }

    // remove from our render targets array
    var fboIndex;
    for(var i = 0; i < this.renderTargets.length; i++) {
        if(renderTarget.uuid === this.renderTargets[i].uuid) {
            fboIndex = i;
        }
    }

    // finally erase the plane
    this.renderTargets[fboIndex] = null;
    this.renderTargets.splice(fboIndex, 1);

    // now free the webgl part
    renderTarget && renderTarget._dispose();
    renderTarget = null;

    // clear the buffer to clean scene
    if(this.gl) this._clear();

    // reset buffers to force binding them again
    this._glState.currentBuffersID = 0;
};


/*** SHADER PASSES ***/


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
        if(!this.productionMode) console.warn("Unable to create a shader pass. The WebGl context couldn't be created");

        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return null;
    }
    else {
        // init the shader pass
        var shaderPass = new Curtains.ShaderPass(this, params);

        if(!shaderPass._usedProgram) {
            shaderPass = false;
        }
        else {
            if(params.renderTarget) {
                this._drawStacks.renderPasses.push(shaderPass.index);
            }
            else {
                this._drawStacks.scenePasses.push(shaderPass.index);
            }

            this.shaderPasses.push(shaderPass);
        }

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

    if(plane.target) {
        plane.target._shaderPass = null;
        this.removeRenderTarget(plane.target);
        plane.target = null;
    }

    // remove from shaderPasses our array
    var planeIndex;
    for(var i = 0; i < this.shaderPasses.length; i++) {
        if(plane.uuid === this.shaderPasses[i].uuid) {
            planeIndex = i;
        }
    }

    // finally erase the plane
    this.shaderPasses.splice(planeIndex, 1);

    // now rebuild the drawStacks
    // start by clearing all drawstacks
    this._drawStacks.scenePasses = [];
    this._drawStacks.renderPasses = [];

    // restack our planes with new indexes
    for(var i = 0; i < this.shaderPasses.length; i++) {
        this.shaderPasses[i].index = i;
        if(this.shaderPasses[i]._isScenePass) {
            this._drawStacks.scenePasses.push(this.shaderPasses[i].index);
        }
        else {
            this._drawStacks.renderPasses.push(this.shaderPasses[i].index);
        }
    }

    // reset the scenePassIndex if needed
    if(this._drawStacks.scenePasses.length === 0) {
        this._glState.scenePassIndex = null;
    }

    // now free the webgl part
    plane && plane._dispose();
    plane = null;

    // clear the buffer to clean scene
    if(this.gl) this._clear();

    // reset buffers to force binding them again
    this._glState.currentBuffersID = 0;
};


/*** CLEAR SCENE ***/

Curtains.prototype._clear = function() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
};


/*** FBO ***/

/***
 Called to bind or unbind a FBO

 params:
 @frameBuffer (frameBuffer): if frameBuffer is not null, bind it, unbind it otherwise
 @cancelClear (bool / undefined): if we should cancel clearing the frame buffer (typically on init & resize)
 ***/
Curtains.prototype._bindFrameBuffer = function(frameBuffer, cancelClear) {
    var bufferId = null;
    if(frameBuffer) {
        bufferId = frameBuffer.index;

        // new frame buffer, bind it
        if(bufferId !== this._glState.frameBufferID) {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frameBuffer._frameBuffer);
            this.gl.viewport(0, 0, frameBuffer._size.width, frameBuffer._size.height);

            // if we should clear the buffer content
            if(frameBuffer._shouldClear && !cancelClear) {
                this._clear();
            }
        }
    }
    else if(this._glState.frameBufferID !== null) {
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
 Called to set the blending function (transparency)
 ***/
Curtains.prototype._setBlendFunc = function() {
    // allows transparency
    // based on how three.js solves this
    var gl = this.gl;
    gl.enable(gl.BLEND);
    if(this.premultipliedAlpha) {
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    else {
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
};


/*** FACE CULLING ***/

/***
 Called to set whether we should cull a plane face or not

 params:
 @cullFace (boolean): what face we should cull
 ***/
Curtains.prototype._setFaceCulling = function(cullFace) {
    var gl = this.gl;
    if(this._glState.cullFace !== cullFace) {
        this._glState.cullFace = cullFace;

        if(cullFace === "none") {
            gl.disable(gl.CULL_FACE);
        }
        else {
            // default to back face culling
            var faceCulling = cullFace === "front" ? gl.FRONT : gl.BACK;

            gl.enable(gl.CULL_FACE);
            gl.cullFace(faceCulling);
        }
    }
};


/*** UTILS ***/

/***
 Returns a universally unique identifier
 ***/
Curtains.prototype._generateUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16).toUpperCase();
    });
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

    if(matrix !== scaledMatrix) {
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
 @quaternion (array): rotation quaternion
 @scale (array): scale vector: [X, Y, Z]
 @origin (array): origin vector around which to scale and rotate: [X, Y, Z]

 returns :
 @matrix: matrix after transformations
 ***/
Curtains.prototype._composeMatrixFromOrigin = function(translation, quaternion, scale, origin) {
    var matrix = new Float32Array(16);

    // Quaternion math
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

    var sx = scale.x;
    var sy = scale.y;
    var sz = 1; // scale along Z is always equal to 1

    var ox = origin.x;
    var oy = origin.y;
    var oz = origin.z;

    var out0 = (1 - (yy + zz)) * sx;
    var out1 = (xy + wz) * sx;
    var out2 = (xz - wy) * sx;
    var out4 = (xy - wz) * sy;
    var out5 = (1 - (xx + zz)) * sy;
    var out6 = (yz + wx) * sy;
    var out8 = (xz + wy) * sz;
    var out9 = (yz - wx) * sz;
    var out10 = (1 - (xx + yy)) * sz;

    matrix[0] = out0;
    matrix[1] = out1;
    matrix[2] = out2;
    matrix[3] = 0;
    matrix[4] = out4;
    matrix[5] = out5;
    matrix[6] = out6;
    matrix[7] = 0;
    matrix[8] = out8;
    matrix[9] = out9;
    matrix[10] = out10;
    matrix[11] = 0;
    matrix[12] = translation.x + ox - (out0 * ox + out4 * oy + out8 * oz);
    matrix[13] = translation.y + oy - (out1 * ox + out5 * oy + out9 * oz);
    matrix[14] = translation.z + oz - (out2 * ox + out6 * oy + out10 * oz);
    matrix[15] = 1;

    return matrix;
};


/***
 Apply a matrix 4 to a point (vec3)
 Useful to convert a point position from plane local world to webgl space using projection view matrix for example
 Source code from: http://glmatrix.net/docs/vec3.js.html

 params :
 @point (array): point to which we apply the matrix
 @matrix (array): 4x4 matrix used

 returns :
 @point: point after matrix application
 ***/
Curtains.prototype._applyMatrixToPoint = function(point, matrix) {
    var transformedPoint = [];
    var x = point[0], y = point[1], z = point[2];

    transformedPoint[0] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    transformedPoint[1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    transformedPoint[2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];

    var w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    w = w || 1;

    transformedPoint[0] /= w;
    transformedPoint[1] /= w;
    transformedPoint[2] /= w;

    return transformedPoint;
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

    console.log("curtains.js - v6.1");

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
    for(var i = 0; i < this._drawStacks[stackType]["order"].length; i++) {
        var programID = this._drawStacks[stackType]["order"][i];
        var program = this._drawStacks[stackType]["programs"]["program-" + programID];
        for(var j = 0; j < program.length; j++) {
            var plane = this.planes[program[j]];
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

    // clear scene first
    this._clear();

    // enable first frame buffer for shader passes
    if(this._drawStacks.scenePasses.length > 0 && this._drawStacks.renderPasses.length === 0) {
        this._glState.scenePassIndex = 0;
        this._bindFrameBuffer(this.shaderPasses[this._drawStacks.scenePasses[0]].target);
    }

    // loop on our stacked planes
    this._drawPlaneStack("opaque");

    // draw transparent planes if needed
    if(this._drawStacks["transparent"].length) {
        // clear our depth buffer to display transparent objects
        this.gl.clearDepth(1.0);
        this.gl.clear(this.gl.DEPTH_BUFFER_BIT);

        this._drawPlaneStack("transparent");
    }

    // now render the shader passes
    // if we got one or multiple scene passes after the render passes, bind the first scene pass here
    if(this._drawStacks.scenePasses.length > 0 && this._drawStacks.renderPasses.length > 0) {
        this._glState.scenePassIndex = 0;
        this._bindFrameBuffer(this.shaderPasses[this._drawStacks.scenePasses[0]].target);
    }

    // first the render passes
    for(var i = 0; i < this._drawStacks.renderPasses.length; i++) {
        var renderPass = this.shaderPasses[this._drawStacks.renderPasses[i]];
        renderPass._drawPlane();
    }

    // then the scene passes
    if(this._drawStacks.scenePasses.length > 0) {
        for(var i = 0; i < this._drawStacks.scenePasses.length; i++) {
            var scenePass = this.shaderPasses[this._drawStacks.scenePasses[i]];
            scenePass._drawPlane();
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

    this.uuid = this._curtains._generateUUID();

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

    // face culling
    this.cullFace = params.cullFace;
    if(
        this.cullFace !== "back"
        && this.cullFace !== "front"
        && this.cullFace !== "none"
    ) {
        this.cullFace = "back";
    }

    // we will store our active textures in an array
    this._activeTextures = [];

    // set up init uniforms
    if(!params.uniforms) {
        params.uniforms = {};
    }

    this.uniforms = {};

    // create our uniforms objects
    if(params.uniforms) {
        for(var key in params.uniforms) {
            var uniform = params.uniforms[key];

            // fill our uniform object
            this.uniforms[key] = {
                name: uniform.name,
                type: uniform.type,
                value: uniform.value,
                lastValue: uniform.value,
            };
        }
    }

    // first we prepare the shaders to be set up
    var shaders = this._setupShaders(params);

    // then we set up the program as compiling can be quite slow
    this._usedProgram = this._curtains._setupProgram(shaders.vertexShaderCode, shaders.fragmentShaderCode, this);

    // our object that will handle all medias loading process
    this._loadingManager = {
        sourcesLoaded: 0,
        initSourcesToLoad: 0, // will change if there's any texture to load on init
        complete: false,
    };

    this.images = [];
    this.videos = [];
    this.canvases = [];
    this.textures = [];

    this.crossOrigin = params.crossOrigin || "anonymous";

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
        this._setUniforms();

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

    return "precision mediump float;\nattribute vec3 aVertexPosition;attribute vec2 aTextureCoord;uniform mat4 uMVMatrix;uniform mat4 uPMatrix;varying vec3 vVertexPosition;varying vec2 vTextureCoord;void main() {vTextureCoord = aTextureCoord;vVertexPosition = aVertexPosition;gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);}";
};


/***
 Get a default fragment shader that does nothing but draw black pixels
 ***/
Curtains.BasePlane.prototype._getDefaultFS = function() {
    return "precision mediump float;\nvarying vec3 vVertexPosition;varying vec2 vTextureCoord;void main( void ) {gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);}";
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
 ***/
Curtains.BasePlane.prototype._setUniforms = function() {
    var curtains = this._curtains;
    var gl = curtains.gl;

    // ensure we are using the right program
    curtains._useProgram(this._usedProgram);

    // check for program active textures
    var numUniforms = gl.getProgramParameter(this._usedProgram.program, gl.ACTIVE_UNIFORMS);
    for(var i = 0; i < numUniforms; i++) {
        var activeUniform = gl.getActiveUniform(this._usedProgram.program, i);
        // if it's a texture add it to our activeTextures array
        if(activeUniform.type === gl.SAMPLER_2D) {
            this._activeTextures.push(activeUniform);
        }
    }

    // set our uniforms if we got some
    if(this.uniforms) {
        for(var key in this.uniforms) {
            var uniform = this.uniforms[key];

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

    for(var y = 0; y < this._definition.height; ++y) {
        var v = y / this._definition.height;

        for(var x = 0; x < this._definition.width; ++x) {
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

    this._material.bufferInfos = {
        id: gl.createBuffer(),
        itemSize: 3,
        numberOfItems: this._material.uvs.length / 3, // divided by item size
    };

    // use vertex array objects if available
    if(this._curtains._isWebGL2) {
        this._vao = gl.createVertexArray();
        gl.bindVertexArray(this._vao);
    }
    else if(this._curtains._extensions['OES_vertex_array_object']) {
        this._vao = this._curtains._extensions['OES_vertex_array_object'].createVertexArrayOES();
        this._curtains._extensions['OES_vertex_array_object'].bindVertexArrayOES(this._vao);
    }

    // bind both attributes buffers
    gl.enableVertexAttribArray(this._attributes.vertexPosition.location);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._geometry.bufferInfos.id);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._geometry.vertices), gl.STATIC_DRAW);

    // Set where the vertexPosition attribute gets its data,
    gl.vertexAttribPointer(this._attributes.vertexPosition.location, this._geometry.bufferInfos.itemSize, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(this._attributes.textureCoord.location);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._material.bufferInfos.id);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._material.uvs), gl.STATIC_DRAW);

    gl.vertexAttribPointer(this._attributes.textureCoord.location, this._material.bufferInfos.itemSize, gl.FLOAT, false, 0, 0);

    // update current buffers ID
    this._curtains._glState.currentBuffersID = this._definition.buffersID;
};


/***
 Used internally handle context restoration
 ***/
Curtains.BasePlane.prototype._restoreContext = function() {
    var curtains = this._curtains;
    this._canDraw = false;

    if(this._matrices) {
        this._matrices = null;
    }

    this._attributes = null;

    this._geometry.bufferInfos = null;
    this._material.bufferInfos = null;

    // reset the used program based on our previous shaders code strings
    this._usedProgram = curtains._setupProgram(this._usedProgram.vsCode, this._usedProgram.fsCode, this);

    if(this._usedProgram) {
        // reset attributes
        this._setAttributes();

        // reset plane uniforms
        this._activeTextures = [];
        this._setUniforms();

        // reinitialize buffers
        this._initializeBuffers();

        // handle attached render targets
        if(this._type === "ShaderPass") {
            // recreate the render target and its texture
            if(this._isScenePass) {
                this.target._frameBuffer = null;
                this.target._depthBuffer = null;

                // remove its render target
                curtains.renderTargets.splice(this.target.index, 1);

                // remove its render target texture as well
                this.textures.splice(0, 1);

                this._createFrameBuffer();

                curtains._drawStacks.scenePasses.push(this.index);
            }
            else {
                // set the render target
                var target = curtains.renderTargets[this.target.index];
                this.setRenderTarget(target);
                this.target._shaderPass = target;

                // re init render texture from render target texture
                this.textures[0]._canDraw = false;
                this.textures[0]._setTextureUniforms();
                this.textures[0].setFromTexture(target.textures[0]);

                curtains._drawStacks.renderPasses.push(this.index);
            }
        }
        else if(this.target) {
            // reset its render target if needed
            this.setRenderTarget(curtains.renderTargets[this.target.index]);
        }

        // reset textures
        // we have reinitiated our ShaderPass render target texture above, so skip it
        for(var i = this._type === "ShaderPass" ? 1 : 0; i < this.textures.length; i++) {
            this.textures[i]._restoreContext();
        }

        // if this is a Plane object we need to reset its matrices, perspective and position
        if(this._type === "Plane") {
            this._initMatrices();

            // set our initial perspective matrix
            this.setPerspective(this._fov, this._nearPlane, this._farPlane);

            this._applyWorldPositions();

            // add the plane to our draw stack again as they have been emptied
            curtains._stackPlane(this);
        }

        this._canDraw = true;
    }
};



/*** PLANE SIZES AND TEXTURES HANDLING ***/

/***
 Set our plane dimensions and positions relative to document
 Triggers reflow!
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


/*** BOUNDING BOXES GETTERS ***/

/***
 Useful to get our plane HTML element bounding rectangle without triggering a reflow/layout

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
};


/***
 Get intersection points between a plane and the camera near plane
 When a plane gets clipped by the camera near plane, the clipped corner projected coords returned by _applyMatrixToPoint() are erronate
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
Curtains.BasePlane.prototype._getNearPlaneIntersections = function(corners, mvpCorners, clippedCorners) {
    // rebuild the clipped corners based on non clipped ones

    // find the intersection by adding a vector starting from a corner till we reach the near plane
    function getIntersection(refPoint, secondPoint) {
        // direction vector to add
        var vector = [
            secondPoint[0] - refPoint[0],
            secondPoint[1] - refPoint[1],
            secondPoint[2] - refPoint[2],
        ];
        // copy our corner refpoint
        var intersection = refPoint.slice();
        // iterate till we reach near plane
        while(intersection[2] > -1) {
            intersection[0] += vector[0];
            intersection[1] += vector[1];
            intersection[2] += vector[2];
        }

        return intersection;
    }

    if(clippedCorners.length === 1) {
        // we will have 5 corners to check so we'll need to push a new entry in our mvpCorners array
        if(clippedCorners[0] === 0) {
            // top left is culled
            // get intersection iterating from top right
            mvpCorners[0] = getIntersection(mvpCorners[1], this._curtains._applyMatrixToPoint([0.95, 1, 0], this._matrices.mVPMatrix));

            // get intersection iterating from bottom left
            mvpCorners.push(getIntersection(mvpCorners[3], this._curtains._applyMatrixToPoint([-1, -0.95, 0], this._matrices.mVPMatrix)));
        }
        else if(clippedCorners[0] === 1) {
            // top right is culled
            // get intersection iterating from top left
            mvpCorners[1] = getIntersection(mvpCorners[0], this._curtains._applyMatrixToPoint([-0.95, 1, 0], this._matrices.mVPMatrix));

            // get intersection iterating from bottom right
            mvpCorners.push(getIntersection(mvpCorners[2], this._curtains._applyMatrixToPoint([1, -0.95, 0], this._matrices.mVPMatrix)));
        }
        else if(clippedCorners[0] === 2) {
            // bottom right is culled
            // get intersection iterating from bottom left
            mvpCorners[2] = getIntersection(mvpCorners[3], this._curtains._applyMatrixToPoint([-0.95, -1, 0], this._matrices.mVPMatrix));

            // get intersection iterating from top right
            mvpCorners.push(getIntersection(mvpCorners[1], this._curtains._applyMatrixToPoint([1, 0.95, 0], this._matrices.mVPMatrix)));
        }
        else if(clippedCorners[0] === 3) {
            // bottom left is culled
            // get intersection iterating from bottom right
            mvpCorners[3] = getIntersection(mvpCorners[2], this._curtains._applyMatrixToPoint([0.95, -1, 0], this._matrices.mVPMatrix));

            // get intersection iterating from top left
            mvpCorners.push(getIntersection(mvpCorners[0], this._curtains._applyMatrixToPoint([-1, 0.95, 0], this._matrices.mVPMatrix)));
        }
    }
    else if(clippedCorners.length === 2) {
        if(clippedCorners[0] === 0 && clippedCorners[1] === 1) {
            // top part of the plane is culled by near plane
            // find intersection using bottom corners
            mvpCorners[0] = getIntersection(mvpCorners[3], this._curtains._applyMatrixToPoint([-1, -0.95, 0], this._matrices.mVPMatrix));
            mvpCorners[1] = getIntersection(mvpCorners[2], this._curtains._applyMatrixToPoint([1, -0.95, 0], this._matrices.mVPMatrix));
        }
        else if(clippedCorners[0] === 1 && clippedCorners[1] === 2) {
            // right part of the plane is culled by near plane
            // find intersection using left corners
            mvpCorners[1] = getIntersection(mvpCorners[0], this._curtains._applyMatrixToPoint([-0.95, 1, 0], this._matrices.mVPMatrix));
            mvpCorners[2] = getIntersection(mvpCorners[3], this._curtains._applyMatrixToPoint([-0.95, -1, 0], this._matrices.mVPMatrix));
        }
        else if(clippedCorners[0] === 2 && clippedCorners[1] === 3) {
            // bottom part of the plane is culled by near plane
            // find intersection using top corners
            mvpCorners[2] = getIntersection(mvpCorners[1], this._curtains._applyMatrixToPoint([1, 0.95, 0], this._matrices.mVPMatrix));
            mvpCorners[3] = getIntersection(mvpCorners[0], this._curtains._applyMatrixToPoint([-1, 0.95, 0], this._matrices.mVPMatrix));
        }
        else if(clippedCorners[0] === 0 && clippedCorners[1] === 3) {
            // left part of the plane is culled by near plane
            // find intersection using right corners
            mvpCorners[0] = getIntersection(mvpCorners[1], this._curtains._applyMatrixToPoint([0.95, 1, 0], this._matrices.mVPMatrix));
            mvpCorners[3] = getIntersection(mvpCorners[2], this._curtains._applyMatrixToPoint([0.95, -1, 0], this._matrices.mVPMatrix));
        }
    }
    else if(clippedCorners.length === 3) {
        // get the corner that is not clipped
        var nonClippedCorner = 0;
        for(var i = 0; i < corners.length; i++) {
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
            mvpCorners.push(getIntersection(mvpCorners[0], this._curtains._applyMatrixToPoint([-0.95, 1, 0], this._matrices.mVPMatrix)));
            // from top left corner to bottom
            mvpCorners.push(getIntersection(mvpCorners[0], this._curtains._applyMatrixToPoint([-1, 0.95, 0], this._matrices.mVPMatrix)));
        }
        else if(nonClippedCorner === 1) {
            // from top right corner to left
            mvpCorners.push(getIntersection(mvpCorners[0], this._curtains._applyMatrixToPoint([0.95, 1, 0], this._matrices.mVPMatrix)));
            // from top right corner to bottom
            mvpCorners.push(getIntersection(mvpCorners[0], this._curtains._applyMatrixToPoint([1, 0.95, 0], this._matrices.mVPMatrix)));
        }
        else if(nonClippedCorner === 2) {
            // from bottom right corner to left
            mvpCorners.push(getIntersection(mvpCorners[0], this._curtains._applyMatrixToPoint([0.95, -1, 0], this._matrices.mVPMatrix)));
            // from bottom right corner to top
            mvpCorners.push(getIntersection(mvpCorners[0], this._curtains._applyMatrixToPoint([1, -0.95, 0], this._matrices.mVPMatrix)));
        }
        else if(nonClippedCorner === 3) {
            // from bottom left corner to right
            mvpCorners.push(getIntersection(mvpCorners[0], this._curtains._applyMatrixToPoint([-0.95, -1, 0], this._matrices.mVPMatrix)));
            // from bottom left corner to top
            mvpCorners.push(getIntersection(mvpCorners[0], this._curtains._applyMatrixToPoint([-1, -0.95, 0], this._matrices.mVPMatrix)));
        }
    }
    else {
        // all 4 corners are culled! artificially apply wrong coords to force plane culling
        for(var i = 0; i < corners.length; i++) {
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
Curtains.BasePlane.prototype._getWorldCoords = function() {
    var corners = [
        [-1, 1, 0], // plane's top left corner
        [1, 1, 0], // plane's top right corner
        [1, -1, 0], // plane's bottom right corner
        [-1, -1, 0], // plane's bottom left corner
    ];

    // corners with model view projection matrix applied
    var mvpCorners = [];
    // eventual clipped corners
    var clippedCorners = [];

    // we are going to get our plane's four corners relative to our model view projection matrix
    for(var i = 0; i < corners.length; i++) {
        var mvpCorner = this._curtains._applyMatrixToPoint(corners[i], this._matrices.mVPMatrix);
        mvpCorners.push(mvpCorner);

        // Z position is > 1 or < -1 means the corner is clipped
        if(Math.abs(mvpCorner[2]) > 1) {
            clippedCorners.push(i);
        }
    }

    // near plane is clipping, get intersections between plane and near plane
    if(clippedCorners.length) {
        mvpCorners = this._getNearPlaneIntersections(corners, mvpCorners, clippedCorners);
    }

    // we need to check for the X and Y min and max values
    // use arbitrary integers that will be overrided anyway
    var minX = Infinity;
    var maxX = -Infinity;

    var minY = Infinity;
    var maxY = -Infinity;

    for(var i = 0; i < mvpCorners.length; i++) {
        var corner = mvpCorners[i];

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

    return {
        top: maxY,
        right: maxX,
        bottom: minY,
        left: minX,
    };
};


/***
 Useful to get our WebGL plane bounding box relative to the document
 Takes all transformations into account
 Used internally for frustum culling

 returns :
 @boundingRectangle (obj): an object containing our plane WebGL element bounding rectangle (width, height, top, bottom, right and left properties)
 ***/
Curtains.BasePlane.prototype.getWebGLBoundingRect = function() {
    // check that our view projection matrix is defined
    if(this._matrices.mVPMatrix) {
        // get our world space bouding rect
        var worldBBox = this._getWorldCoords();

        // normalize worldBBox to (0 -> 1) screen coordinates with [0, 0] being the top left corner and [1, 1] being the bottom right
        var screenBBox = {
            top: 1 - (worldBBox.top + 1) / 2,
            right: (worldBBox.right + 1) / 2,
            bottom: 1 - (worldBBox.bottom + 1) / 2,
            left: (worldBBox.left + 1) / 2,
        };

        screenBBox.width = screenBBox.right - screenBBox.left;
        screenBBox.height = screenBBox.bottom - screenBBox.top;

        // return our values ranging from 0 to 1 multiplied by our canvas sizes + canvas top and left offsets
        return {
            width: screenBBox.width * this._curtains._boundingRect.width,
            height: screenBBox.height * this._curtains._boundingRect.height,
            top: screenBBox.top * this._curtains._boundingRect.height + this._curtains._boundingRect.top,
            left: screenBBox.left * this._curtains._boundingRect.width + this._curtains._boundingRect.left,

            // add left and width to get right property
            right: screenBBox.left * this._curtains._boundingRect.width + this._curtains._boundingRect.left + screenBBox.width * this._curtains._boundingRect.width,
            // add top and height to get bottom property
            bottom: screenBBox.top * this._curtains._boundingRect.height + this._curtains._boundingRect.top + screenBBox.height * this._curtains._boundingRect.height,
        };
    }
    else {
        return this._boundingRect.document;
    }
};


/***
 Returns our plane WebGL bounding rectangle in document coordinates including additional drawCheckMargins

 returns :
 @boundingRectangle (obj): an object containing our plane WebGL element bounding rectangle including the draw check margins (top, bottom, right and left properties)
 ***/
Curtains.BasePlane.prototype._getWebGLDrawRect = function() {
    var boundingRect = this.getWebGLBoundingRect();

    return {
        top: boundingRect.top - this.drawCheckMargins.top,
        right: boundingRect.right + this.drawCheckMargins.right,
        bottom: boundingRect.bottom + this.drawCheckMargins.bottom,
        left: boundingRect.left - this.drawCheckMargins.left,
    };
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
        this.setPerspective(this._fov, this._nearPlane, this._farPlane);

        // apply new position
        this._applyWorldPositions();
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
Curtains.BasePlane.prototype.createTexture = function(params) {
    if(typeof params === "string") {
        params = {
            sampler: params,
        };

        if(!this._curtains.productionMode) {
            console.warn("Since v5.1 you should use an object to pass your sampler name with the createTexture() method. Please refer to the docs: https://www.curtainsjs.com/documentation.html (texture concerned: ", params.sampler, ")");
        }
    }

    if(!params) params = {};

    var texture = new Curtains.Texture(this, {
        index: this.textures.length,
        sampler: params.sampler || null,
        fromTexture: params.fromTexture || null,
        isFBOTexture: params.isFBOTexture || false, // used internally
    });

    // add our texture to the textures array
    this.textures.push(texture);

    return texture;
};


/***
 Check whether a plane has loaded all its initial sources and fires the onReady callback

 params :
 @sourcesArray (array) : array of html images, videos or canvases elements
 ***/
Curtains.BasePlane.prototype._isPlaneReady = function() {
    if(!this._loadingManager.complete && this._loadingManager.sourcesLoaded >= this._loadingManager.initSourcesToLoad) {
        this._loadingManager.complete = true;

        // force next frame rendering
        this._curtains.needRender();

        var self = this;
        setTimeout(function() {
            if(self._onReadyCallback) {
                self._onReadyCallback();
            }
        }, 0);
    }
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
 Handles media loading errors

 params :
 @source (html element) : html image, video or canvas element
 @error (object) : loading error
 ***/
Curtains.BasePlane.prototype._sourceLoadError = function(source, error) {
    if(!this._curtains.productionMode) {
        console.warn("There has been an error:", error, "while loading this source:", source);
    }
};


/***
 Check if this source is already assigned to a cached texture

 params :
 @source (html element) : html image, video or canvas element (only images for now)
 ***/
Curtains.BasePlane.prototype._getTextureFromCache = function(source) {
    var cachedTexture = false;
    if(this._curtains._imageCache.length > 0) {
        for(var i = 0; i < this._curtains._imageCache.length; i++) {
            var cacheTextureItem = this._curtains._imageCache[i];
            if(cacheTextureItem.source) {
                if(cacheTextureItem.type === "image" && cacheTextureItem.source.src === source.src) {
                    cachedTexture = cacheTextureItem;
                }
            }
        }
    }

    return cachedTexture;
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

    // check for cache
    var cachedTexture = this._getTextureFromCache(source);

    if(cachedTexture) {
        this.createTexture({
            sampler: image.sampler,
            fromTexture: cachedTexture,
        });
        this.images.push(cachedTexture.source);

        // fire parent plane onReady callback if needed
        this._isPlaneReady();

        return;
    }

    // create a new texture that will use our image later
    var texture = this.createTexture({
        sampler: image.sampler,
    });

    // handle our loaded data event inside the texture and tell our plane when the video is ready to play
    texture._onSourceLoadedHandler = texture._onSourceLoaded.bind(texture, image);

    // If the image is in the cache of the browser,
    // the 'load' event might have been triggered
    // before we registered the event handler.
    if(image.complete) {
        texture._onSourceLoaded(image);
    }
    else if(image.decode) {
        var self = this;
        image.decode().then(texture._onSourceLoadedHandler).catch(function() {
            // fallback to classic load & error events
            image.addEventListener('load', texture._onSourceLoadedHandler, false);
            image.addEventListener('error', self._sourceLoadError.bind(self, image), false);
        });
    }
    else {
        image.addEventListener('load', texture._onSourceLoadedHandler, false);
        image.addEventListener('error', this._sourceLoadError.bind(this, image), false);
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
    var texture = this.createTexture({
        sampler: video.sampler
    });

    // handle our loaded data event inside the texture and tell our plane when the video is ready to play
    texture._onSourceLoadedHandler = texture._onVideoLoadedData.bind(texture, video);
    video.addEventListener('canplaythrough', texture._onSourceLoadedHandler, false);
    video.addEventListener('error', this._sourceLoadError.bind(this, video), false);

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

    var texture = this.createTexture({
        sampler: canvas.sampler
    });

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
            if(playPromise !== undefined) {
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
    var curtains = this._curtains;
    var gl = curtains.gl;

    if(this._vao) {
        if(curtains._isWebGL2) {
            curtains.gl.bindVertexArray(this._vao);
        }
        else {
            curtains._extensions['OES_vertex_array_object'].bindVertexArrayOES(this._vao);
        }
    }
    else {
        // Set the vertices buffer
        gl.enableVertexAttribArray(this._attributes.vertexPosition.location);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._geometry.bufferInfos.id);

        gl.vertexAttribPointer(this._attributes.vertexPosition.location, this._geometry.bufferInfos.itemSize, gl.FLOAT, false, 0, 0);

        // Set where the texture coord attribute gets its data,
        gl.enableVertexAttribArray(this._attributes.textureCoord.location);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._material.bufferInfos.id);

        gl.vertexAttribPointer(this._attributes.textureCoord.location, this._material.bufferInfos.itemSize, gl.FLOAT, false, 0, 0);
    }

    // update current buffers ID
    curtains._glState.currentBuffersID = this._definition.buffersID;
};


/***
 This is used to set the WebGL context active texture and bind it

 params :
 @texture (texture object) : Our texture object containing our WebGL texture and its index
 ***/
Curtains.BasePlane.prototype._bindPlaneTexture = function(texture) {
    var gl = this._curtains.gl;

    if(texture._canDraw) {
        // tell WebGL we want to affect the texture at the plane's index unit
        gl.activeTexture(gl.TEXTURE0 + texture.index);
        // bind the texture to the plane's index unit
        gl.bindTexture(gl.TEXTURE_2D, texture._sampler.texture);
    }
};


/***
 This function adds a render target to a plane

 params :
 @renderTarger (RenderTarget): the render target to add to that plane
 ***/
Curtains.BasePlane.prototype.setRenderTarget = function(renderTarget) {
    if(!renderTarget || !renderTarget._type || renderTarget._type !== "RenderTarget") {
        if(!this._curtains.productionMode) {
            console.warn("Could not set the render target because the argument passed is not a RenderTarget class object", renderTarget);
        }

        return;
    }

    this.target = renderTarget;
};


/*** DRAW THE PLANE ***/

/***
 We draw the plane, ie bind the buffers, set the active textures and draw it
 If the plane type is a ShaderPass we also need to bind the right frame buffers
 ***/
Curtains.BasePlane.prototype._drawPlane = function() {
    var curtains = this._curtains;
    var gl = curtains.gl;

    // check if our plane is ready to draw
    if(this._canDraw) {
        // even if our plane should not be drawn we still execute its onRender callback and update its uniforms
        if(this._onRenderCallback) {
            this._onRenderCallback();
        }

        // to improve webgl pipeline performace, we might want to update each texture that needs an update here
        // see https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#texImagetexSubImage_uploads_particularly_with_videos_can_cause_pipeline_flushes

        if(this._type === "ShaderPass") {
            if(this._isScenePass) {
                // if this is a scene pass, check if theres one more coming next and eventually bind it
                if(curtains._glState.scenePassIndex + 1 < curtains._drawStacks.scenePasses.length) {
                    curtains._bindFrameBuffer(curtains.shaderPasses[curtains._drawStacks.scenePasses[curtains._glState.scenePassIndex + 1]].target);

                    curtains._glState.scenePassIndex++;
                }
                else {
                    curtains._bindFrameBuffer(null);
                }
            }
            else if(curtains._glState.scenePassIndex === null) {
                // we are rendering a bunch of planes inside a render target, unbind it
                curtains._bindFrameBuffer(null);
            }
        }
        else {
            // if we should render to a render target
            if(this.target) {
                curtains._bindFrameBuffer(this.target);
            }
            else if(curtains._glState.scenePassIndex === null) {
                curtains._bindFrameBuffer(null);
            }

            // update our perspective matrix
            this._setPerspectiveMatrix();

            // update our mv matrix
            this._setMVMatrix();
        }

        // now check if we really need to draw it and its textures
        if((this.alwaysDraw || this._shouldDraw) && this.visible) {
            // enable/disable depth test
            curtains._setDepth(this._depthTest);

            // face culling
            curtains._setFaceCulling(this.cullFace);

            // ensure we're using the right program
            curtains._useProgram(this._usedProgram);

            // update all uniforms set up by the user
            this._updateUniforms();

            // bind plane attributes buffers
            // if we're rendering on a frame buffer object, force buffers bindings to avoid bugs
            if(curtains._glState.currentBuffersID !== this._definition.buffersID || this.target) {
                this._bindPlaneBuffers();
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
        if(this._vao) {
            if(this._curtains._isWebGL2) {
                gl.deleteVertexArray(this._vao);
            }
            else {
                this._curtains._extensions['OES_vertex_array_object'].deleteVertexArrayOES(this._vao);
            }
        }

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

        if(this.target && this._type === "ShaderPass") {
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
 Set plane's initial params

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

    this._initTransformValues();

    // if we decide to load all sources on init or let the user do it manually
    this.autoloadSources = params.autoloadSources;
    if(this.autoloadSources === null || this.autoloadSources === undefined) {
        this.autoloadSources = true;
    }

    // set default fov
    this._fov = params.fov || 50;
    this._nearPlane = 0.1;
    this._farPlane = 150;

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
 Set/reset plane's transformation values: rotation, scale, translation, transform origin
 ***/
Curtains.Plane.prototype._initTransformValues = function() {
    this.rotation = {
        x: 0,
        y: 0,
        z: 0,
    };

    // initial quaternion
    this.quaternion = new Float32Array([0, 0, 0, 1]);

    this.relativeTranslation = {
        x: 0,
        y: 0,
        z: 0,
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
        z: 0,
    };
};


/***
 Init our plane position: set its matrices, its position and perspective
 ***/
Curtains.Plane.prototype._initPositions = function() {
    // set its matrices
    this._initMatrices();

    // set our initial perspective matrix
    this.setPerspective(this._fov, this._nearPlane, this._farPlane);

    // apply our css positions
    this._applyWorldPositions();
};


/***
 Load our initial sources if needed and calls onReady callback
 ***/
Curtains.Plane.prototype._initSources = function() {
    // finally load every sources already in our plane html element
    // load plane sources
    if(this.autoloadSources) {
        // load images
        var imagesArray = [];
        for(var i = 0; i < this.htmlElement.getElementsByTagName("img").length; i++) {
            imagesArray.push(this.htmlElement.getElementsByTagName("img")[i]);
        }
        if(imagesArray.length > 0) {
            this.loadSources(imagesArray);
        }

        // load videos
        var videosArray = [];
        for(var i = 0; i < this.htmlElement.getElementsByTagName("video").length; i++) {
            videosArray.push(this.htmlElement.getElementsByTagName("video")[i]);
        }
        if(videosArray.length > 0) {
            this.loadSources(videosArray);
        }

        // load canvases
        var canvasesArray = [];
        for(var i = 0; i < this.htmlElement.getElementsByTagName("canvas").length; i++) {
            canvasesArray.push(this.htmlElement.getElementsByTagName("canvas")[i]);
        }
        if(canvasesArray.length > 0) {
            this.loadSources(canvasesArray);
        }

        this._loadingManager.initSourcesToLoad = imagesArray.length + videosArray.length + canvasesArray.length;
    }

    if(this._loadingManager.initSourcesToLoad === 0) {
        // onReady callback
        this._isPlaneReady();

        if(!this._curtains.productionMode) {
            // if there's no images, no videos, no canvas, send a warning
            console.warn("This plane does not contain any image, video or canvas element. You may want to add some later with the loadSource() or loadSources() method.");
        }
    }

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
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]),
            location: gl.getUniformLocation(this._usedProgram.program, "uMVMatrix"),
        },
        pMatrix: {
            name: "uPMatrix",
            matrix: new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]), // will be set after
            location: gl.getUniformLocation(this._usedProgram.program, "uPMatrix"),
        }
    };
};


/***
 Reset our plane transformation values and HTML element if specified (and valid)

 params :
 @htmlElement (HTML element, optionnal) : if provided, new HTML element to use as a reference for sizes and position syncing.
 ***/
Curtains.Plane.prototype.resetPlane = function(htmlElement) {
    this._initTransformValues();

    if(htmlElement !== null && !!htmlElement) {
        this.htmlElement = htmlElement;

        this.updatePosition();
    }
    else if(!htmlElement && !this._curtains.productionMode) {
        console.warn("You are trying to reset a plane with a HTML element that does not exist. The old HTML element will be kept instead.");
    }
};


/***
 Set our plane dimensions and positions relative to clip spaces
 ***/
Curtains.Plane.prototype._setWorldSizes = function() {
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
    this._boundingRect.world = {
        width: this._boundingRect.document.width / curtains._boundingRect.width,
        height: this._boundingRect.document.height / curtains._boundingRect.height,
        top: (curtainsCenter.y - planeCenter.y) / curtains._boundingRect.height,
        left: (planeCenter.x - curtainsCenter.x) / curtains._boundingRect.height,
    };

    // since our vertices values range from -1 to 1
    // we need to scale them under the hood relatively to our canvas
    // to display an accurately sized plane
    this._boundingRect.world.scale = {
        x: (this._curtains._boundingRect.width / this._curtains._boundingRect.height) * this._boundingRect.world.width / 2,
        y: this._boundingRect.world.height / 2,
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

        var top = this._nearPlane * Math.tan((Math.PI / 180) * 0.5 * this._fov);
        var height = 2 * top;
        var width = aspect * height;
        var left = -0.5 * width;

        var right = left + width;
        var bottom = top - height;


        var x = 2 * this._nearPlane / (right - left);
        var y = 2 * this._nearPlane / (top - bottom);

        var a = (right + left) / (right - left);
        var b = (top + bottom) / (top - bottom);
        var c = -(this._farPlane + this._nearPlane) / (this._farPlane - this._nearPlane);
        var d = -2 * this._farPlane * this._nearPlane / (this._farPlane - this._nearPlane);

        this._matrices.pMatrix.matrix = new Float32Array([
            x, 0, 0, 0,
            0, y, 0, 0,
            a, b, c, -1,
            0, 0, d, 0
        ]);
    }

    // update our matrix uniform only if we share programs or if we actually have updated its values
    if(this.shareProgram || !this.shareProgram && this._updatePerspectiveMatrix) {
        this._curtains._useProgram(this._usedProgram);
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
    var fieldOfView = isNaN(fov) ? this._fov : parseFloat(fov);

    // clamp between 1 and 179
    fieldOfView = Math.max(1, Math.min(fieldOfView, 179));

    if(fieldOfView !== this._fov) {
        this._fov = fieldOfView;
    }

    // update the camera position anyway
    this._cameraZPosition = Math.tan((Math.PI / 180) * 0.5 * this._fov) * 2.0;

    // corresponding CSS perspective property value depending on canvas size and fov values
    // based on https://stackoverflow.com/questions/22421439/convert-field-of-view-value-to-css3d-perspective-value
    this._CSSPerspective = Math.pow(Math.pow(this._curtains._boundingRect.width / (2 * this._curtains.pixelRatio), 2) + Math.pow(this._curtains._boundingRect.height / (2 * this._curtains.pixelRatio), 2), 0.5) / Math.tan((this._fov / 2) * Math.PI / 180);

    // near plane
    this._nearPlane = isNaN(near) ? this._nearPlane : parseFloat(near);
    this._nearPlane = Math.max(this._nearPlane, 0.01);

    // far plane
    this._farPlane = isNaN(far) ? this._farPlane : parseFloat(far);
    this._farPlane = Math.max(this._farPlane, 50);

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
        // translation
        // along the Z axis it's based on the relativeTranslation.z, CSSPerspective and cameraZPosition values
        // we're computing it here because it will change when our fov changes
        this._translation.z = this.relativeTranslation.z / this._CSSPerspective;
        var translation = {
            x: this._translation.x,
            y: this._translation.y,
            z: -((1 - this._translation.z) / this._cameraZPosition),
        };

        var adjustedOrigin = {
            x: this.transformOrigin.x * 2 - 1, // between -1 and 1
            y: -(this.transformOrigin.y * 2 - 1), // between -1 and 1
        };

        var origin = {
            x: adjustedOrigin.x * this._boundingRect.world.scale.x,
            y: adjustedOrigin.y * this._boundingRect.world.scale.y,
            z: this.transformOrigin.z
        };

        var matrixFromOrigin = this._curtains._composeMatrixFromOrigin(translation, this.quaternion, this.scale, origin);
        var scaleMatrix = new Float32Array([
            this._boundingRect.world.scale.x, 0.0, 0.0, 0.0,
            0.0, this._boundingRect.world.scale.y, 0.0, 0.0,
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
        this._curtains._useProgram(this._usedProgram);
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
    scaleX = isNaN(scaleX) ? this.scale.x : parseFloat(scaleX);
    scaleY = isNaN(scaleY) ? this.scale.y : parseFloat(scaleY);

    scaleX = Math.max(scaleX, 0.001);
    scaleY = Math.max(scaleY, 0.001);

    // only apply if values changed
    if(scaleX !== this.scale.x || scaleY !== this.scale.y) {
        this.scale = {
            x: scaleX,
            y: scaleY
        };

        // adjust textures size
        for(var i = 0; i < this.textures.length; i++) {
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
    angleX = isNaN(angleX) ? this.rotation.x : parseFloat(angleX);
    angleY = isNaN(angleY) ? this.rotation.y : parseFloat(angleY);
    angleZ = isNaN(angleZ) ? this.rotation.z : parseFloat(angleZ);

    // only apply if values changed
    if(angleX !== this.rotation.x || angleY !== this.rotation.y || angleZ !== this.rotation.z) {
        this.rotation = {
            x: angleX,
            y: angleY,
            z: angleZ
        };

        this._setQuaternion();

        // we should update the plane mvMatrix
        this._updateMVMatrix = true;
    }
};


/***
 Sets our plane rotation quaternion using Euler angles and XYZ as axis order
 ***/
Curtains.Plane.prototype._setQuaternion = function() {
    var ax = this.rotation.x * 0.5;
    var ay = this.rotation.y * 0.5;
    var az = this.rotation.z * 0.5;

    var sinx = Math.sin(ax);
    var cosx = Math.cos(ax);
    var siny = Math.sin(ay);
    var cosy = Math.cos(ay);
    var sinz = Math.sin(az);
    var cosz = Math.cos(az);

    // XYZ order
    this.quaternion[0] = sinx * cosy * cosz + cosx * siny * sinz;
    this.quaternion[1] = cosx * siny * cosz - sinx * cosy * sinz;
    this.quaternion[2] = cosx * cosy * sinz + sinx * siny * cosz;
    this.quaternion[3] = cosx * cosy * cosz - sinx * siny * sinz;
};


/***
 This will set our plane transform origin
 (0, 0, 0) means plane's top left corner
 (1, 1, 0) means plane's bottom right corner
 (0.5, 0.5, -1) means behind plane's center

 params :
 @xOrigin (float): coordinate of transformation origin along width
 @yOrigin (float): coordinate of transformation origin along height
 @zOrigin (float): coordinate of transformation origin along depth
 ***/
Curtains.Plane.prototype.setTransformOrigin = function(xOrigin, yOrigin, zOrigin) {
    xOrigin = isNaN(xOrigin) ? this.transformOrigin.x : parseFloat(xOrigin);
    yOrigin = isNaN(yOrigin) ? this.transformOrigin.y : parseFloat(yOrigin);
    zOrigin = isNaN(zOrigin) ? this.transformOrigin.z : parseFloat(zOrigin);

    if(xOrigin !== this.transformOrigin.x || yOrigin !== this.transformOrigin.y || zOrigin !== this.transformOrigin.z) {
        this.transformOrigin = {
            x: xOrigin,
            y: yOrigin,
            z: zOrigin,
        };

        this._updateMVMatrix = true;
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
        z: 0,
    };
    if(this.relativeTranslation.x !== 0 || this.relativeTranslation.y !== 0 || this.relativeTranslation.z !== 0) {
        relativePosition = this._documentToLocalSpace(this.relativeTranslation.x, this.relativeTranslation.y);
    }

    this._translation.x = this._boundingRect.world.left + relativePosition.x;
    this._translation.y = this._boundingRect.world.top + relativePosition.y;

    // we should update the plane mvMatrix
    this._updateMVMatrix = true;
};


/***
 This function takes pixel values along X and Y axis and convert them to clip space coordinates, and then apply the corresponding translation

 params :
 @translationX (float): translation to apply on X axis
 @translationY (float): translation to apply on Y axis
 ***/
Curtains.Plane.prototype.setRelativePosition = function(translationX, translationY, translationZ) {
    translationX = isNaN(translationX) ? this.relativeTranslation.x : parseFloat(translationX);
    translationY = isNaN(translationY) ? this.relativeTranslation.y : parseFloat(translationY);
    translationZ = isNaN(translationZ) ? this.relativeTranslation.z : parseFloat(translationZ);

    // only apply if values changed
    if(translationX !== this.relativeTranslation.x || translationY !== this.relativeTranslation.y || translationZ !== this.relativeTranslation.z) {
        this.relativeTranslation = {
            x: translationX,
            y: translationY,
            z: translationZ,
        };

        this._setTranslation();
    }
};


/***
 This function takes pixel values along X and Y axis and convert them to clip space coordinates

 params :
 @xPosition (float): position to convert on X axis
 @yPosition (float): position to convert on Y axis

 returns :
 @relativePosition: plane's position in WebGL space
 ***/
Curtains.Plane.prototype._documentToLocalSpace = function(xPosition, yPosition) {
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
    var actualPlaneBounds = this._getWebGLDrawRect();

    var self = this;

    // if we decide to draw the plane only when visible inside the canvas
    // we got to check if its actually inside the canvas
    if(
        Math.round(actualPlaneBounds.right) <= this._curtains._boundingRect.left
        || Math.round(actualPlaneBounds.left) >= this._curtains._boundingRect.left + this._curtains._boundingRect.width
        || Math.round(actualPlaneBounds.bottom) <= this._curtains._boundingRect.top
        || Math.round(actualPlaneBounds.top) >= this._curtains._boundingRect.top + this._curtains._boundingRect.height
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
 This function returns if the plane is actually drawn (ie fully initiated, visible property set to true and not culled)
 ***/
Curtains.Plane.prototype.isDrawn = function() {
    return this._canDraw && this.visible && (this._shouldDraw || this.alwaysDraw);
};


/***
 This function uses our plane HTML Element bounding rectangle values and convert them to the world clip space coordinates, and then apply the corresponding translation
 ***/
Curtains.Plane.prototype._applyWorldPositions = function() {
    // set our plane sizes and positions relative to the world clipspace
    this._setWorldSizes();

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
    this._applyWorldPositions();
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
        this._applyWorldPositions();
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

    this._curtains._drawStacks[drawType]["programs"]["program-" + this._usedProgram.id] = drawStack;


    // update order array
    for(var i = 0; i < this._curtains._drawStacks[drawType]["order"].length; i++) {
        if(this._curtains._drawStacks[drawType]["order"][i] === this._usedProgram.id) {
            this._curtains._drawStacks[drawType]["order"].splice(i, 1);
        }
    }
    this._curtains._drawStacks[drawType]["order"].push(this._usedProgram.id);
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

    this._shaderPass = params.shaderPass || null;

    // whether to create a render buffer
    this._depth = params.depth || false;

    this._shouldClear = params.clear;
    if(this._shouldClear === null || this._shouldClear === undefined) {
        this._shouldClear = true;
    }

    this._minSize = {
        width: params.minWidth || 1024 * this._curtains.pixelRatio,
        height: params.minHeight || 1024 * this._curtains.pixelRatio,
    };

    this.userData = {};

    this.uuid = this._curtains._generateUUID();

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
    if(this._shaderPass && this._shaderPass._isScenePass) {
        this._size = {
            width: this._curtains._boundingRect.width,
            height: this._curtains._boundingRect.height,
        };
    }
    else {
        this._size = {
            width: Math.max(this._minSize.width, this._curtains._boundingRect.width),
            height: Math.max(this._minSize.height, this._curtains._boundingRect.height),
        };
    }
};

/***
 Resizes our RenderTarget (basically only resize it if it's a ShaderPass scene pass FBO)
 ***/
Curtains.RenderTarget.prototype.resize = function() {
    // resize render target only if its a child of a shader pass
    if(this._shaderPass && this._shaderPass._isScenePass) {
        this._setSize();

        // cancel clear on resize
        this._curtains._bindFrameBuffer(this, true);

        if(this._depth) {
            this._bindDepthBuffer();
        }

        this._curtains._bindFrameBuffer(null);
    }
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

    if(this.textures.length > 0) {
        // we're restoring context, re init the texture
        this.textures[0]._canDraw = false;
        this.textures[0]._init();
    }
    else {
        // attach the texture to the parent ShaderPass if it exists, to the render target otherwise
        var texture = new Curtains.Texture(this._shaderPass ? this._shaderPass : this, {
            index: this.textures.length,
            sampler: "uRenderTexture",
            isFBOTexture: true,
        });

        this.textures.push(texture);
    }

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

    // cancel clear on init
    this._curtains._bindFrameBuffer(this, true);

    this._createFBOTexture();

    // create a depth renderbuffer
    if(this._depth) {
        this._depthBuffer = gl.createRenderbuffer();
        this._bindDepthBuffer();
    }

    this._curtains._bindFrameBuffer(null);
};


/***
 Restore a render target
 Used only for render targets that are not attached to shader passes
 Those attached to shader passes are restored inside the _restoreContext method of the ShaderPass class
 ***/
Curtains.RenderTarget.prototype._restoreContext = function() {
    if(!this._shaderPass || !this._shaderPass._isScenePass) {
        // if there's a _shaderPass attached it will be re-attached in the _shaderPass's restoreContext method anyway
        this._shaderPass = null;

        // recreate frame buffer
        this._createFrameBuffer();
    }
};


/***
 Remove a RenderTarget buffers
 ***/
Curtains.RenderTarget.prototype._dispose = function() {
    if(this._frameBuffer) {
        this._curtains.gl.deleteFramebuffer(this._frameBuffer);
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

    // default to scene pass
    this._isScenePass = true;

    // inherit
    Curtains.BasePlane.call(this, curtainWrapper, curtainWrapper.container, params);

    this.index = this._curtains.shaderPasses.length;

    this._depth = params.depth || false;

    this._shouldClear = params.clear;
    if(this._shouldClear === null || this._shouldClear === undefined) {
        this._shouldClear = true;
    }

    this.target = params.renderTarget || null;
    if(this.target) {
        // if there's a target defined it's not a scene pass
        this._isScenePass = false;
        // inherit clear param
        this._shouldClear = this.target._shouldClear;
    }

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
    if(!this.target) {
        this._createFrameBuffer();
    }
    else {
        // set the render target
        this.setRenderTarget(this.target);
        this.target._shaderPass = this;

        // copy the render target texture
        var texture = new Curtains.Texture(this, {
            index: this.textures.length,
            sampler: "uRenderTexture",
            isFBOTexture: true,
            fromTexture: this.target.textures[0],
        });

        this.textures.push(texture);
    }

    // onReady callback
    this._isPlaneReady();

    this._canDraw = true;

    // be sure we'll update the scene even if drawing is disabled
    this._curtains.needRender();
};


/***
 Here we override the parent _getDefaultVS method
 because shader passes vs don't have projection and model view matrices
 ***/
Curtains.ShaderPass.prototype._getDefaultVS = function(params) {
    return "precision mediump float;\nattribute vec3 aVertexPosition;attribute vec2 aTextureCoord;varying vec3 vVertexPosition;varying vec2 vTextureCoord;void main() {vTextureCoord = aTextureCoord;vVertexPosition = aVertexPosition;gl_Position = vec4(aVertexPosition, 1.0);}";
};


/***
 Here we override the parent _getDefaultFS method
 taht way we can still draw our render texture
 ***/
Curtains.ShaderPass.prototype._getDefaultFS = function(params) {
    return "precision mediump float;\nvarying vec3 vVertexPosition;varying vec2 vTextureCoord;uniform sampler2D uRenderTexture;void main( void ) {gl_FragColor = texture2D(uRenderTexture, vTextureCoord);}";
};


/***
 Here we create our frame buffer object
 We're also adding a render buffer object to handle depth inside our shader pass
 ***/
Curtains.ShaderPass.prototype._createFrameBuffer = function() {
    var target = new Curtains.RenderTarget(this._curtains, {
        shaderPass: this,
        clear: this._shouldClear,
        depth: this._depth,
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

    this.uuid = this._curtains._generateUUID();

    if(!parent._usedProgram && !params.isFBOTexture) {
        if(!this._curtains.productionMode) {
            console.warn("Unable to create the texture because the program is not valid");
        }

        return;
    }

    this.index = parent.textures.length;

    // prepare texture sampler
    this._sampler = {
        isActive: false,
        name: params.sampler || "uSampler" + this.index
    };

    // we will always declare a texture matrix
    this._textureMatrix = {
        name: params.sampler ? params.sampler + "Matrix" : "uTextureMatrix" + this.index,
        matrix: null,
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

    // is it a frame buffer object texture?
    // if it's not, type will change when the source will be loaded
    this.type = params.isFBOTexture ? "fboTexture" : "empty";

    // useful flag to avoid binding texture that does not belong to current context
    this._canDraw = false;

    // is it set from an existing texture?
    if(params.fromTexture) {
        this._initFromTexture = true;

        // set sampler loation if needed
        if(this._parent._usedProgram) {
            // set our texture sampler uniform
            this._setTextureUniforms();
        }

        // copy from the original texture
        this.setFromTexture(params.fromTexture);
        // we're done!
        return;
    }

    this._initFromTexture = false;

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

    // texImage2D properties
    this._internalFormat = gl.RGBA;
    this._format = gl.RGBA;
    this._textureType = gl.UNSIGNED_BYTE;

    // set texture parameters once
    this._texParameters = false;

    this._flipY = false;

    // bind the texture the target (TEXTURE_2D) of the active texture unit.
    gl.bindTexture(gl.TEXTURE_2D, this._sampler.texture);

    // we don't use Y flip yet
    if(this._curtains._glState.flipY) {
        this._curtains._glState.flipY = this._flipY;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this._flipY);
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    // if the parent has a program it means its not a render target texture
    if(this._parent._usedProgram) {
        // set its size based on parent element size
        this._size = {
            width: this._parent._boundingRect.document.width,
            height: this._parent._boundingRect.document.height,
        };

        // set uniform
        this._setTextureUniforms();

        // its a plane texture
        if(this.type === "empty") {
            // draw a black plane before the real texture's content has been loaded
            gl.texImage2D(gl.TEXTURE_2D, 0, this._internalFormat, 1, 1, 0, this._format, this._textureType, new Uint8Array([0, 0, 0, 255]));

            // our texture source hasn't been loaded yet
            this._sourceLoaded = false;
        }
        else if(!this.source) {
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

        // set texture parameters
        this._setMipmaps();
    }

    this._canDraw = true;
};


/*** SEND DATA TO THE GPU ***/

/***
 Check if our textures is effectively used in our shaders
 If so, set it to active, get its uniform locations and bind it to our texture unit
 ***/
Curtains.Texture.prototype._setTextureUniforms = function() {
    // check if our texture is used in our program shaders
    // if so, get its uniform locations and bind it to our program
    for(var i = 0; i < this._parent._activeTextures.length; i++) {
        if(this._parent._activeTextures[i].name === this._sampler.name) {
            // this texture is active
            this._sampler.isActive = true;

            // set our texture sampler uniform
            this._sampler.location = this._curtains.gl.getUniformLocation(this._parent._usedProgram.program, this._sampler.name);
            // texture matrix uniform
            this._textureMatrix.location = this._curtains.gl.getUniformLocation(this._parent._usedProgram.program, this._textureMatrix.name);

            // use the program and get our sampler and texture matrices uniforms
            this._curtains._useProgram(this._parent._usedProgram);

            // tell the shader we bound the texture to our indexed texture unit
            this._curtains.gl.uniform1i(this._sampler.location, this.index);
        }
    }
};


/*** LOADING SOURCES ***/


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
        this._sourceLoaded = texture._sourceLoaded;

        this._internalFormat = texture._internalFormat;
        this._format = texture._format;
        this._textureType = texture._textureType;

        this._texParameters = texture._texParameters;

        this._originalTexture = texture;

        // update its texture matrix if needed and we're good to go!
        if(this._parent._usedProgram && (!this._canDraw || !this._textureMatrix.matrix)) {
            var sizes = this._getSizes();

            // always update texture matrix anyway
            this._updateTextureMatrix(sizes);

            this._canDraw = true;
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

    if(this.type === "empty") {
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
    }

    this._size = {
        width: this.source.naturalWidth || this.source.width || this.source.videoWidth,
        height: this.source.naturalHeight || this.source.height || this.source.videoHeight,
    };

    // our source is loaded now
    this._sourceLoaded = true;

    var gl = this._curtains.gl;

    // Bind the texture the target (TEXTURE_2D) of the active texture unit.
    gl.activeTexture(gl.TEXTURE0 + this.index);
    gl.bindTexture(gl.TEXTURE_2D, this._sampler.texture);

    // maybe we should handle alpha premultiplying separately for each texture
    // for now we just use our gl context premultipliedAlpha value
    if(this._curtains.premultipliedAlpha) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    }

    this._flipY = true;
    if(!this._curtains._glState.flipY) {
        this._curtains._glState.flipY = this._flipY;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this._flipY);
    }

    this.resize();

    // set our webgl texture only if it is an image
    // canvas and video textures will be updated anyway in the rendering loop
    // thanks to the shouldUpdate and _willUpdate flags
    if(this.type === "image") {
        gl.texImage2D(gl.TEXTURE_2D, 0, this._internalFormat, this._format, this._textureType, source);
        // set texture parameters
        this._setMipmaps();
    }

    // update scene
    this._curtains.needRender();
};


/***
 Sets the texture parameters
 Always clamp to edge
 Generates mipmapping for images in WebGL2 context
 ***/
Curtains.Texture.prototype._setMipmaps = function() {
    var gl = this._curtains.gl;

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // generate mip map only for images
    if(this._curtains._isWebGL2 && this.type === "image") {
        gl.generateMipmap(gl.TEXTURE_2D);
        // improve quality of scaled down images
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    }
    else {
        // Set the parameters so we can render any size image.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    this._texParameters = true;
};


/***
 This forces a texture to be updated on the next draw call
 ***/
Curtains.Texture.prototype.needUpdate = function() {
    this._forceUpdate = true;
};


/***
 This updates our texture
 Called inside our drawing loop if shouldUpdate property is set to true
 Typically used by videos or canvas
 ***/
Curtains.Texture.prototype._update = function() {
    var gl = this._curtains.gl;

    if(this.source) {
        gl.texImage2D(gl.TEXTURE_2D, 0, this._internalFormat, this._format, this._textureType, this.source);

        if(!this._texParameters) {
            this._setMipmaps();
        }
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
    scaleX = isNaN(scaleX) ? this.scale.x : parseFloat(scaleX);
    scaleY = isNaN(scaleY) ? this.scale.y : parseFloat(scaleY);

    scaleX = Math.max(scaleX, 0.001);
    scaleY = Math.max(scaleY, 0.001);

    if(scaleX !== this.scale.x || scaleY !== this.scale.y) {
        this.scale = {
            x: scaleX,
            y: scaleY,
        };

        this.resize();
    }
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
        if(!this._originalTexture) {
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
};


/***
 This calls our loading callback and set our media as texture source
 ***/
Curtains.Texture.prototype._onSourceLoaded = function(source) {
    // increment our loading manager
    this._parent._loadingManager.sourcesLoaded++;

    // fire callback during load (useful for a loader)
    var self = this;
    if(!this._sourceLoaded) {
        setTimeout(function() {
            if(self._parent._onPlaneLoadingCallback) {
                self._parent._onPlaneLoadingCallback(self);
            }
        }, 0);
    }

    // set the media as our texture source
    this.setSource(source);

    // fire parent plane onReady callback if needed
    this._parent._isPlaneReady();

    // add to the cache if needed
    if(this.type === "image") {
        var shouldCache = true;
        for(var i = 0; i < this._curtains._imageCache.length; i++) {
            if(this._curtains._imageCache[i].source && this._curtains._imageCache[i].source.src === source.src) {
                shouldCache = false;
            }
        }

        if(shouldCache) {
            this._curtains._imageCache.push(this);
        }
    }
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
    // only draw if the texture is active (used in the shader)
    if(this._sampler.isActive) {
        // bind the texture
        this._parent._bindPlaneTexture(this);

        // force flip y for textures that needs it
        if(this._flipY && !this._curtains._glState.flipY) {
            this._curtains._glState.flipY = this._flipY;
            this._curtains.gl.pixelStorei(this._curtains.gl.UNPACK_FLIP_Y_WEBGL, this._flipY);
        }

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
    }
};


/***
 Restore a WebGL texture that is a copy
 Depending on whether it's a copy from start or not, just reset its uniforms or run the full init
 And finally copy our original texture back again
 ***/
Curtains.Texture.prototype._restoreFromTexture = function() {
    if(this._initFromTexture) {
        this._setTextureUniforms();
    }
    else {
        this._init();
    }

    this.setFromTexture(this._originalTexture);
};


/***
 Restore our WebGL texture
 If it is an original texture, just re run the init function and eventually reset its source
 If it is a texture set from another texture, wait for the original texture to be ready first
 ***/
Curtains.Texture.prototype._restoreContext = function() {
    // avoid binding that texture before reseting it
    this._canDraw = false;
    this._sampler.isActive = false;

    // this is an original texture, reset it right away
    if(!this._originalTexture) {
        this._init();

        if(this.source) {
            // cache again if it is an image
            if(this.type === "image") {
                this._curtains._imageCache.push(this);
            }

            this.setSource(this.source);
            // force update
            this.needUpdate();
        }
    }
    else {
        // here we will have to wait for the original texture to be ready before resetting our copy
        var self = this;

        // original texture is not ready yet, wait for it!
        if(!this._originalTexture._canDraw) {
            var textureReadyInterval = setInterval(function() {
                if(self._originalTexture._canDraw) {
                    self._restoreFromTexture();
                    clearInterval(textureReadyInterval);
                }
            }, 16);
        }
        else {
            // original texture has been resetted already, wait a tick and restore this one
            setTimeout(function() {
                self._restoreFromTexture();
            }, 0);
        }
    }
};


/***
 This is used to destroy a texture and free the memory space
 Usually used on a plane/shader pass/render target removal
 ***/
Curtains.Texture.prototype._dispose = function() {
    if(this.type === "video") {
        // remove event listeners
        this.source.removeEventListener("canplaythrough", this._onSourceLoadedHandler, false);
        this.source.removeEventListener("error", this._parent._sourceLoadError, false);

        // empty source to properly delete video element and free the memory
        this.source.pause();
        this.source.removeAttribute("src");
        this.source.load();

        // clear source
        this.source = null;
    }
    else if(this.type === "canvas") {
        // clear all canvas states
        this.source.width = this.source.width;

        // clear source
        this.source = null;
    }
    else if(this.type === "image" && this._curtains._isDestroying) {
        // delete image only if we're destroying the context (keep in cache otherwise)
        this.source.removeEventListener("load", this._onSourceLoadedHandler, false);
        this.source.removeEventListener("error", this._parent._sourceLoadError, false);

        // clear source
        this.source = null;
    }

    var gl = this._curtains.gl;

    // do not delete original texture if this texture is a copy, or image texture if we're not destroying the context
    var shouldDelete = gl && !this._originalTexture && (this.type !== "image" || this._curtains._isDestroying);
    if(shouldDelete) {
        gl.activeTexture(gl.TEXTURE0 + this.index);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.deleteTexture(this._sampler.texture);
    }

    // decrease textures loaded
    this._parent._loadingManager && this._parent._loadingManager.sourcesLoaded--;
};