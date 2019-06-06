/***
 Little WebGL helper to apply images, videos or canvases as textures of planes
 Author: Martin Laxenaire https://www.martin-laxenaire.fr/
 Version: 2.0.0
 ***/


/*** CURTAINS CLASS ***/

/***
 This is our main class to call to init our curtains
 Basically sets up all necessary intern variables based on params and runs the init method

 params :
 @containerID (string): the container ID that will hold our canvas

 returns :
 @this: our Curtains element
 ***/
function Curtains(containerID, production) {
    this.planes = [];
    this._drawStack = [];

    this._drawingEnabled = true;
    this._forceRender = false;

    // set container
    this.container = document.getElementById(containerID || "canvas");

    this.productionMode = production || false;

    if(!this.container) {
        if(!this.productionMode) console.warn("You must specify a valid container ID");

        // call the error callback if provided
        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return;
    }

    this._init();

    return this;
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

    // this will set the size as well
    var pixelRatio = window.pixelRatio || 1;
    this.setPixelRatio(pixelRatio);

    // handling context
    this._loseContextExtension = this.glContext.getExtension('WEBGL_lose_context');

    this._contextLostHandler = this._contextLost.bind(this);
    this.glCanvas.addEventListener("webglcontextlost", this._contextLostHandler, false);

    this._contextRestoredHandler = this._contextRestored.bind(this);
    this.glCanvas.addEventListener("webglcontextrestored", this._contextRestoredHandler, false);

    // handling window resize event
    this._resizeHandler = this.resize.bind(this);
    window.addEventListener("resize", this._resizeHandler, false);

    // we can start rendering now
    this._readyToDraw();
};


/***
 Set the pixel ratio property and update everything by calling resize method
 ***/
Curtains.prototype.setPixelRatio = function(pixelRatio) {
    this.pixelRatio = parseFloat(Math.max(pixelRatio, 1)) || 1;
    // apply new pixel ratio to all our elements
    this.resize();
};


/***
 Set our container and canvas sizes
 ***/
Curtains.prototype._setSize = function() {
    // if container size has changed
    var containerBoundingRect = this.container.getBoundingClientRect();
    this._boundingRect = {
        width: containerBoundingRect.width * this.pixelRatio,
        height: containerBoundingRect.height * this.pixelRatio,
        top: containerBoundingRect.top * this.pixelRatio,
        left: containerBoundingRect.left * this.pixelRatio,
    };

    this.glCanvas.style.width  = Math.floor(this._boundingRect.width / this.pixelRatio) + "px";
    this.glCanvas.style.height = Math.floor(this._boundingRect.height / this.pixelRatio) + "px";

    this.glCanvas.width  = Math.floor(this._boundingRect.width);
    this.glCanvas.height = Math.floor(this._boundingRect.height);

    this.glContext.viewport(0, 0, this.glContext.drawingBufferWidth, this.glContext.drawingBufferHeight);
};


/***
 Resize our container and all the planes
 ***/
Curtains.prototype.resize = function() {
    this._setSize();

    // resize the planes only if they are fully initiated
    for(var i = 0; i < this.planes.length; i++) {
        if(this.planes[i]._canDraw) {
            this.planes[i].planeResize();
        }
    }
};


/***
 Enables the render loop.
 ***/
Curtains.prototype.enableDrawing = function() {
    this._drawingEnabled = true;
};

/***
 Disables the render loop.
 ***/
Curtains.prototype.disableDrawing = function() {
    this._drawingEnabled = false;
};

/***
 Forces the rendering of the next frame, even if disabled.
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

    var self = this;

    setTimeout(function() {
        if(self._onContextRestoredCallback) {
            self._onContextRestoredCallback();
        }
    }, 0);

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

    // wait for all planes to be deleted before stopping everything
    var self = this;
    var deleteInterval = setInterval(function() {
        if(self.planes.length === 0) {
            // clear interval
            clearInterval(deleteInterval);

            // clear the buffer to clean scene
            self.glContext.clear(self.glContext.DEPTH_BUFFER_BIT | self.glContext.COLOR_BUFFER_BIT);

            // cancel animation frame
            window.cancelAnimationFrame(self._animationFrameID);

            // remove event listeners
            window.removeEventListener("resize", self._resizeHandler, false);

            self.glCanvas.removeEventListener("webglcontextlost", self._contextLostHandler, false);
            self.glCanvas.removeEventListener("webglcontextrestored", self._contextRestoredHandler, false);

            // lose context
            if(self.glContext && self._loseContextExtension) {
                self._loseContextExtension.loseContext();
            }

            // remove canvas from DOM
            self.container.removeChild(self.glCanvas);
        }
    }, 100);
};



/***
 Create plane element

 params :
 @planeHtmlElement (html element) : the html element that we will use for our plane
 @params (obj) : see addPlane method

 returns :
 @plane: our newly created plane object
 ***/
Curtains.prototype._createPlane = function(planeHtmlElement, params) {
    var returnedPlane = new Curtains.Plane(this, planeHtmlElement, params);

    return returnedPlane;
};



/***
 Create a plane element and load its images

 params :
 @planesHtmlElement (html element): the html element that we will use for our plane
 @params (obj): plane params:
 - vertexShaderID (string, optionnal): the vertex shader ID. If not specified, will look for a data attribute data-vs-id on the plane HTML element. Will throw an error if nothing specified
 - fragmentShaderID (string, optionnal): the fragment shader ID. If not specified, will look for a data attribute data-fs-id on the plane HTML element. Will throw an error if nothing specified
 - widthSegments (optionnal): plane definition along the X axis (1 by default)
 - heightSegments (optionnal): plane definition along the Y axis (1 by default)
 - mimicCSS (bool, optionnal): define if the plane should mimic it's html element position (true by default) DEPRECATED
 - alwaysDraw (bool, optionnal): define if the plane should always be drawn or it should be drawn only if its within the canvas (false by default)
 - imageCover (bool, optionnal): define if the images must imitate css background-cover or just fit the plane (true by default) DEPRECATED
 - autoloadSources (bool, optionnal): define if the sources should be load on init automatically (true by default)
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
 Completly remove a plane element (delete from draw stack, delete buffers and textures, empties object, remove)

 params :
 @plane (plane element) : the plane element to remove
 ***/
Curtains.prototype.removePlane = function(plane) {

    // first we want to stop drawing it
    plane._canDraw = false;

    // remove from draw stack

    // get the right stack where our planed is stored
    var definition = plane._definition.width * plane._definition.height + plane._definition.width;
    var drawStack = this._drawStack;
    var stackIndex;
    for(var i = 0; i < drawStack.length; i++) {
        if(drawStack[i].definition === definition) {
            stackIndex = i;
        }
    }

    // we don't want to draw that stack since we are manipulating it
    drawStack[stackIndex].isReordering = true;

    var planeStackIndex;
    for(var i = 0; i < drawStack[stackIndex].planesIndex.length; i++) {
        if(plane.index === drawStack[stackIndex].planesIndex[i]) {
            planeStackIndex = i;
        }
    }

    // before we delete it from the draw stack array we need to update all the indexes that come after it
    for(var i = planeStackIndex + 1; i < drawStack[stackIndex].planesIndex.length; i++) {
        drawStack[stackIndex].planesIndex[i]--;
    }

    // delete it from the draw stack
    this._drawStack[stackIndex].planesIndex.splice(planeStackIndex, 1);

    // now free the webgl part
    plane && plane._dispose();

    // remove from our Curtains planes array
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

    // we are no longer manipulating the drawstack, we can draw it again
    drawStack[stackIndex].isReordering = false;
};



/***
 This function will stack planes by their vertices arrays length in order to avoid redundant buffer binding calls
 ***/
Curtains.prototype._stackPlane = function(planeDefinition) {
    // if it's our first plane, just fill the drawStack array
    if(this._drawStack.length === 0) {
        var stack = {
            definition: planeDefinition,
            planesIndex: [this.planes.length],
            isReordering: false,
        }

        this._drawStack.push(stack);
    }
    else {
        // if it's not our first plane, check whether we already have registered a plane with this definition or not
        var hasSameDefinition = false;
        for(var i = 0; i < this._drawStack.length; i++) {
            if(this._drawStack[i].definition === planeDefinition) {
                // we already have a plane with this definition, push it inside planesIndex array
                hasSameDefinition = true;
                this._drawStack[i].planesIndex.push(this.planes.length);
            }
        }
        // we don't have a plane with this definition, we fill a new stack entry
        if(!hasSameDefinition) {
            var stack = {
                definition: planeDefinition,
                planesIndex: [this.planes.length],
                isReordering: false,
            }

            this._drawStack.push(stack);
        }
    }
};



/*** SHADERS CREATIONS ***/

/***
 Create our WebGL shaders based on our written shaders

 params :
 @shaderCode (string) : shader code
 @shaderType (shaderType) : WebGL shader type (vertex of fragment)

 returns :
 @shader (compiled shader): our compiled shader
 ***/
Curtains.prototype._createShader = function(shaderCode, shaderType) {
    var shader = this.glContext.createShader(shaderType);

    this.glContext.shaderSource(shader, shaderCode);
    this.glContext.compileShader(shader);

    if (!this.glContext.getShaderParameter(shader, this.glContext.COMPILE_STATUS)) {
        if(!this.productionMode) console.warn("Errors occurred while compiling the shader:\n" + this.glContext.getShaderInfoLog(shader));

        // call the error callback if provided
        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return null;
    }
    return shader;
};


/***
 Called to set whether the renderer will handle depth test or not
 Depth test is enabled by default

 params :
 @shouldHandleDepth (bool) : if we should enable or disable the depth test
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


/*** DRAW EVERYTHING ***/

/***
 This is called when everything is set up and ready to draw
 It will launch our requestAnimationFrame loop
 ***/
Curtains.prototype._readyToDraw = function() {
    // we are ready to go
    this.container.appendChild(this.glCanvas);

    // allows transparency
    this.glContext.blendFunc(this.glContext.SRC_ALPHA, this.glContext.ONE_MINUS_SRC_ALPHA);
    this.glContext.enable(this.glContext.BLEND);

    // enable depth by default
    this._handleDepth(true);

    console.log("curtains.js - v2.0");

    this._animate();
};


/***
 This just handles our drawing animation frame
 ***/
Curtains.prototype._animate = function() {
    this._drawScene();
    this._animationFrameID = window.requestAnimationFrame(this._animate.bind(this));
};


/***
 This is our draw call, ie what has to be called at each frame our our requestAnimationFrame loop
 sets our matrix and draw everything
 ***/
Curtains.prototype._drawScene = function() {
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

    // clear the color buffer,
    this.glContext.clearColor(0.0, 0.0, 0.0, 0.0);
    this.glContext.clearDepth(1.0);

    // loop on our stacked planes
    for(var i = 0; i < this._drawStack.length; i++) {
        if(!this._drawStack[i].isReordering) {
            for(var j = 0; j < this._drawStack[i].planesIndex.length; j++) {

                var plane = this.planes[this._drawStack[i].planesIndex[j]];
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
        }
    }
};


/*** EVENTS ***/

/***
 This is called when an error has been detected during init

 params :
 @callback (function) : a function to execute

 returns :
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

 params :
 @callback (function) : a function to execute

 returns :
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

 params :
 @callback (function) : a function to execute

 returns :
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

 params :
 @callback (function) : a function to execute

 returns :
 @this: our Curtains element to handle chaining
 ***/
Curtains.prototype.onRender = function(callback) {
    if(callback) {
        this.__onRenderCallback = callback;
    }

    return this;
};




/*** PLANE CLASS ***/

/***
 Here we create our Plane object (note that we are using the Curtains namespace to avoid polluting the global scope)
 We will create a plane object containing the program, shaders, as well as other useful data
 Once our shaders are linked to a program, we create their matrices and set up their default attributes

 params :
 @curtainWrapper : our curtain object that wraps all the planes
 @plane (html element) : html div that contains 0 or more media elements.
 @params (obj) : see addPlanes method of the wrapper

 returns :
 @this: our Plane element
 ***/
Curtains.Plane = function(curtainWrapper, plane, params) {
    this._wrapper = curtainWrapper;

    this.htmlElement = plane;

    this.index = this._wrapper.planes.length;

    this._init(plane, params);

    this._wrapper.planes.push(this);

    return this;
}


/***
 Init our plane object and its properties
 ***/
Curtains.Plane.prototype._init = function(plane, params) {
    if(!params) params = {};

    // first we prepare the shaders to be set up
    this._setupShaders(params);

    // then we set up the program as compiling can be quite slow
    var isProgramValid = this._setupPlaneProgram();

    // set plane initial parameters
    this._setInitParams(params);

    this.images = [];
    this.videos = [];
    this.canvases = [];
    this.textures = [];

    // if program and shaders are valid, go on
    if(isProgramValid) {
        this._setAttributes();

        var wrapper = this._wrapper;

        // set plane sizes
        this._setDocumentSizes();
        this._setComputedSizes();

        // set infos that will be used by our model view matrix
        this.scale = {
            x: 1,
            y: 1
        };

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

        // we need to sort planes by their definitions : widthSegments * heightSegments
        // but we have to keep in mind that 10*15 and 15*10 are not the same vertices definion, so we add widthSegments to differenciate them
        wrapper._stackPlane(this._definition.width * this._definition.height + this._definition.width);

        // set plane definitions, vertices, uvs and stuff
        this._initializeBuffers();


        // finally load all its textures
        // our object that will handle all images loading process
        this._loadingManager = {
            sourcesLoaded: 0,
            initSourcesToLoad: 0,
        };

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

        if(this._loadingManager.initSourcesToLoad === 0 && !wrapper.productionMode) {
            // if there's no images, no videos, no canvas, send a warning
            console.warn("This plane does not contain any image, video or canvas element. You may want to add some later with the loadSource() or loadSources() method.");
        }

        // handling our plane onReady callback with an interval
        // maybe i could improve this by using the raf loop and a flag
        var loadedInterval;
        var self = this;

        // check if everything is ready depending on the number of sources we need to load on init
        loadedInterval = setInterval(function() {
            // everything is loaded
            if(self._loadingManager.sourcesLoaded >= self._loadingManager.initSourcesToLoad) {
                clearInterval(loadedInterval);

                if(self._onReadyCallback) {
                    self._onReadyCallback();
                }
            }
        }, 16);
    }
};


/***
 Set plane's initial params

 params :
 @params (obj) : see addPlanes method of the wrapper
 ***/
Curtains.Plane.prototype._setInitParams = function(params) {
    var wrapper = this._wrapper;

    // if our plain is ready to be drawn
    this._canDraw = false;
    // if our plane should always be drawn or if it should be drawn only when inside the viewport
    this.alwaysDraw = params.alwaysDraw || false;
    // should draw is set to true by default, we'll check it later
    this._shouldDraw = true;

    this._definition = {
        width: parseInt(params.widthSegments) || 1,
        height: parseInt(params.heightSegments) || 1
    };


    if((params.mimicCSS || params.mimicCSS === false) && !wrapper.productionMode) {
        console.warn("mimicCSS property is deprecated since v2.0 as the planes will always copy their html elements sizes and positions.");
    }

    // old way to handle image scaling, deprecated
    this.imageCover = params.imageCover || false;
    if(this.imageCover && !wrapper.productionMode) {
        console.warn("imageCover property is deprecated. Please use texture matrix in your shader instead.");
    }

    // if we decide to load all sources on init or let the user do it manually
    this.autoloadSources = params.autoloadSources;
    if(this.autoloadSources === null || this.autoloadSources === undefined) {
        this.autoloadSources = true;
    }

    this.crossOrigin = params.crossOrigin || "anonymous";

    // set default fov
    this._fov = params._fov || 75;

    // enable depth test by default
    this._shouldUseDepthTest = true;


    // handle uniforms
    if(!params.uniforms) {
        if(!wrapper.productionMode) console.warn("You are setting a plane without uniforms, you won't be able to interact with it. Please check your addPlane method for : ", this.htmlElement);

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
};


/***
 Used internally to set up shaders
 ***/
Curtains.Plane.prototype._setupShaders = function(params) {
    var wrapper = this._wrapper;

    // handling shaders
    var vsId = params.vertexShaderID || this.htmlElement.getAttribute("data-vs-id");
    var fsId = params.fragmentShaderID || this.htmlElement.getAttribute("data-fs-id");

    var vsIdHTML, fsIdHTML;

    if(!params.vertexShader) {
        if(!vsId || !document.getElementById(vsId)) {
            if(!wrapper.productionMode) console.warn("No vertex shader provided, will use a default one");

            vsIdHTML = "#ifdef GL_ES\nprecision mediump float;\n#endif\nattribute vec3 aVertexPosition;attribute vec2 aTextureCoord;uniform mat4 uMVMatrix;uniform mat4 uPMatrix;varying vec3 vVertexPosition;varying vec2 vTextureCoord;void main() {vTextureCoord = aTextureCoord;vVertexPosition = aVertexPosition;gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);}";
        }
        else {
            vsIdHTML = document.getElementById(vsId).innerHTML;
        }
    }

    if(!params.fragmentShader) {
        if(!fsId || !document.getElementById(fsId)) {
            if(!wrapper.productionMode) console.warn("No fragment shader provided, will use a default one");

            fsIdHTML = "#ifdef GL_ES\nprecision mediump float;\n#endif\nvarying vec3 vVertexPosition;varying vec2 vTextureCoord;void main( void ) {gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);}";
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
 Used internally to set up program and attributes
 ***/
Curtains.Plane.prototype._setupPlaneProgram = function() {
    var isProgramValid = true;

    var wrapper = this._wrapper;
    var glContext = wrapper.glContext;

    // create shader program
    this._program = glContext.createProgram();

    // Create shaders,
    this._shaders.vertexShader = wrapper._createShader(this._shaders.vertexShaderCode, glContext.VERTEX_SHADER);
    this._shaders.fragmentShader = wrapper._createShader(this._shaders.fragmentShaderCode, glContext.FRAGMENT_SHADER);

    if((!this._shaders.vertexShader || !this._shaders.fragmentShader) && !wrapper.productionMode) {
        if(!wrapper.productionMode) console.warn("Unable to find or compile the vertex or fragment shader");

        // call the error callback if provided
        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        isProgramValid = false;
    }

    // if shaders are valid, go on
    if(isProgramValid) {
        glContext.attachShader(this._program, this._shaders.vertexShader);
        glContext.attachShader(this._program, this._shaders.fragmentShader);
        glContext.linkProgram(this._program);

        // Check the shader program creation status,
        if (!glContext.getProgramParameter(this._program, glContext.LINK_STATUS)) {
            if(!wrapper.productionMode) console.warn("Unable to initialize the shader program.");

            // call the error callback if provided
            if(this._onErrorCallback) {
                this._onErrorCallback()
            }

            isProgramValid = false;
        }

        // Set the current shader in use,
        glContext.useProgram(this._program);

        // then we set the plane uniforms locations
        this._setUniforms(this.uniforms);

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
    }

    return isProgramValid;
};



/***
 Set our plane dimensions and positions relative to document
 ***/
Curtains.Plane.prototype._setDocumentSizes = function() {
    var wrapper = this._wrapper;

    // set our basic initial infos
    var planeBoundingRect = this.htmlElement.getBoundingClientRect();

    // just in case the html element is missing from the DOM, set its container values instead
    if(planeBoundingRect.width === 0 && planeBoundingRect.height === 0) {
        planeBoundingRect = wrapper._boundingRect;
    }

    // set plane dimensions in document space
    this._boundingRect = {
        document: {
            width: planeBoundingRect.width * wrapper.pixelRatio,
            height: planeBoundingRect.height * wrapper.pixelRatio,
            top: planeBoundingRect.top * wrapper.pixelRatio,
            left: planeBoundingRect.left * wrapper.pixelRatio,
        },
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



/***
 Used internally handle context restore
 ***/
Curtains.Plane.prototype._restoreContext = function() {
    this._canDraw = false;

    // remove and reset everything that depends on the context
    this._shaders.vertexShader = null;
    this._shaders.fragmentShader = null;

    this._program = null;

    this._matrices = null;

    this._attributes = null;

    this._geometry.bufferInfos = null;
    this._material.bufferInfos = null;

    // reset plane shaders, programs and attributes
    var isProgramValid = this._setupPlaneProgram();

    if(isProgramValid) {
        // reset plane uniforms
        this._setUniforms(this.uniforms);

        // reinitialize buffers
        this._initializeBuffers();

        // reset textures
        for(var i = 0; i < this.textures.length; i++) {
            var source = this.textures[i].source;
            this.textures[i]._init();
            this.textures[i].setSource(source);
        }
    }
};


/*** PLANE VERTICES AND BUFFERS ***/

/***
 This method is used internally to create our vertices coordinates and texture UVs
 we first create our UVs on a grid from [0, 0, 0] to [1, 1, 0]
 then we use the UVs to create our vertices coords
 ***/
Curtains.Plane.prototype._setPlaneVertices = function() {
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
 This method has to be called externally after our textures have been created
 Creates our buffers : vertex buffer and texture coord buffer
 We also resize our textures to be sure they'll fit our plane

 Once everything is done we call our ready callback function

 params :
 @widthSegments (integer): plane definition along X axis
 @heightSegments (integer): plane definition along Y axis
 ***/
Curtains.Plane.prototype._initializeBuffers = function() {
    var wrapper = this._wrapper;
    var glContext = wrapper.glContext;

    // we could not use plane._size property here because it might have changed since its creation
    // if the plane does not have any texture yet, a window resize does not trigger the resize function

    // if this our first time we need to create our geometry and material objects
    if(!this._geometry && !this._material) {
        this._setPlaneVertices();
    }

    // apply our css positions
    this._applyCSSPositions();

    // set our initial perspective matrix
    this.setPerspective(this._fov, 0.1, this._fov * 2);

    if(!this._attributes) return;

    // now we'll create vertices and uvs attributes
    this._geometry.bufferInfos = {
        id: glContext.createBuffer(),
        itemSize: 3,
        numberOfItems: this._geometry.vertices.length / 3, // divided by item size
    };

    glContext.bindBuffer(glContext.ARRAY_BUFFER, this._geometry.bufferInfos.id);
    glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(this._geometry.vertices), glContext.STATIC_DRAW);

    // Set where the vertexPosition attribute gets its data,
    glContext.vertexAttribPointer(this._attributes.vertexPosition.location, this._geometry.bufferInfos.itemSize, glContext.FLOAT, false, 0, 0);
    glContext.enableVertexAttribArray(this._attributes.vertexPosition.location);


    this._material.bufferInfos = {
        id: glContext.createBuffer(),
        itemSize: 3,
        numberOfItems: this._material.uvs.length / 3, // divided by item size
    };

    glContext.bindBuffer(glContext.ARRAY_BUFFER, this._material.bufferInfos.id);
    glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(this._material.uvs), glContext.STATIC_DRAW);

    glContext.vertexAttribPointer(this._attributes.textureCoord.location, this._material.bufferInfos.itemSize, glContext.FLOAT, false, 0, 0);
    glContext.enableVertexAttribArray(this._attributes.textureCoord.location);

    // everything is set up, we can draw the plane now
    this._canDraw = true;
};



/*** FINISH INIT ***/


/*** PLANE ATTRIBUTES & UNIFORMS ***/

/*** ATTRIBUTES ***/

/***
 This set our plane vertex shader attributes
 used internally but can be used externally as well

 BE CAREFUL : if an attribute is set here, it MUST be DECLARED and USED inside our plane vertex shader
 ***/
Curtains.Plane.prototype._setAttributes = function() {
    // set default attributes
    var attributes = {
        vertexPosition: "aVertexPosition",
        textureCoord: "aTextureCoord",
    };

    if(!this._attributes) this._attributes = {};

    var self = this;
    Object.keys(attributes).map(function(objectKey, index) {
        var value = attributes[objectKey];
        self._attributes[objectKey] = {
            name: value,
            location: self._wrapper.glContext.getAttribLocation(self._program, value),
        };
    });
};



/*** UNIFORMS ***/

/***
 This is a little helper to set uniforms based on their types

 params :
 @uniformType (string): the uniform type
 @uniformLocation (WebGLUniformLocation obj): location of the current program uniform
 @uniformValue (float/integer or array of float/integer): value to set
 ***/
Curtains.Plane.prototype._handleUniformSetting = function(uniformType, uniformLocation, uniformValue) {
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
 This set our shaders uniforms

 params :
 @uniforms (obj): uniforms to apply
 ***/
Curtains.Plane.prototype._setUniforms = function(uniforms) {
    var wrapper = this._wrapper;
    // ensure we are using the right program
    wrapper.glContext.useProgram(this._program);

    var self = this;
    // set our uniforms if we got some
    if(uniforms) {
        Object.keys(uniforms).map(function(objectKey, index) {
            var uniform = uniforms[objectKey];

            // set our uniform location
            self.uniforms[objectKey].location = wrapper.glContext.getUniformLocation(self._program, uniform.name);

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
            self._handleUniformSetting(uniform.type, self.uniforms[objectKey].location, uniform.value);
        });
    }
};


/***
 This updates all uniforms of a plane that were set by the user
 It is called at each draw call
 ***/
Curtains.Plane.prototype._updateUniforms = function() {
    if(this.uniforms) {
        var self = this;
        Object.keys(self.uniforms).map(function(objectKey) {

            var uniform = self.uniforms[objectKey];

            var location = uniform.location;
            var value = uniform.value;
            var type = uniform.type;

            // update our uniforms
            self._handleUniformSetting(type, location, value);
        });
    }
};



/*** PLANES SIZES, SCALES AND ROTATIONS ***/


/***
 Simple matrix multiplication helper

 params :
 @a (array): first matrix
 @b (array): second matrix

 returns :
 @out: matrix after multiplication
 ***/
Curtains.Plane.prototype._multiplyMatrix = function(a, b) {
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
Curtains.Plane.prototype._scaleMatrix = function(matrix, scaleX, scaleY, scaleZ) {
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
    var fieldOfView = parseInt(fov) || 75;
    if(fieldOfView < 0) {
        fieldOfView = 0;
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
        this._setMVMatrix();
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
    // then we set the plane uniforms locations
    this._setUniforms(this.uniforms);

    var wrapper = this._wrapper;

    var identity = new Float32Array([
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0
    ]);

    var planeTranslation = new Float32Array([
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        this._translation.x,  this._translation.y,  this._translation.z - (this._fov / 2),  1.0
    ]);

    var xRotation = new Float32Array([
        1.0, 0.0, 0.0, 0.0,
        0.0, Math.cos(this.rotation.x), Math.sin(this.rotation.x), 0.0,
        0.0, -Math.sin(this.rotation.x), Math.cos(this.rotation.x), 0.0,
        0.0, 0.0, 0.0, 1.0
    ]);

    var yRotation = new Float32Array([
        Math.cos(this.rotation.y), 0.0, -Math.sin(this.rotation.y), 0.0,
        0.0, 1.0, 0.0, 0.0,
        Math.sin(this.rotation.y), 0.0, Math.cos(this.rotation.y), 0.0,
        0.0, 0.0, 0.0, 1.0
    ]);

    var zRotation = new Float32Array([
        Math.cos(this.rotation.z), Math.sin(this.rotation.z), 0.0, 0.0,
        -Math.sin(this.rotation.z), Math.cos(this.rotation.z), 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0
    ]);

    // here we will silently set our scale based on the canvas size and the plane inner size
    var relativeScale = {
        x: this.scale.x * ((wrapper._boundingRect.width / wrapper._boundingRect.height) * this._boundingRect.computed.width / 2),
        y: this.scale.y * this._boundingRect.computed.height / 2,
    };

    var scale = new Float32Array([
        relativeScale.x, 0.0, 0.0, 0.0,
        0.0, relativeScale.y, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0
    ]);


    // we calculate the new model view matrix based on translation, rotation and scale
    // first multiply identity matrix with translation
    // second, rotate around X, Y then Z
    // third multiply by scale
    var nextMVMatrix = this._multiplyMatrix(identity, planeTranslation);
    nextMVMatrix = this._multiplyMatrix(nextMVMatrix, xRotation);
    nextMVMatrix = this._multiplyMatrix(nextMVMatrix, yRotation);
    nextMVMatrix = this._multiplyMatrix(nextMVMatrix, zRotation);
    nextMVMatrix = this._multiplyMatrix(nextMVMatrix, scale);

    if(this._matrices) {
        this._matrices.mvMatrix.matrix = nextMVMatrix;

        wrapper.glContext.useProgram(this._program);
        wrapper.glContext.uniformMatrix4fv(this._matrices.mvMatrix.location, false, this._matrices.mvMatrix.matrix);
    }
};


/***
 This will set our plane scale
 used internally but can be used externally as well

 params :
 @scaleX (float): scale to apply on X axis
 @scaleY (float): scale to apply on Y axis
 @scaleZ (float): scale to apply on Z axis
 ***/
Curtains.Plane.prototype.setScale = function(scaleX, scaleY) {
    scaleX = parseFloat(scaleX) || 1;
    scaleX = Math.max(scaleX, 0.001); // ensure we won't have a 0 scale

    scaleY = parseFloat(scaleY) || 1;
    scaleY = Math.max(scaleY, 0.001); // ensure we won't have a 0 scale

    this.scale = {
        x: scaleX,
        y: scaleY
    };

    if(!this.alwaysDraw) {
        this._shouldDrawCheck();
    }

    // set mvMatrix
    this._setMVMatrix();

    // adjust textures size
    for(var i = 0; i < this.textures.length; i++) {
        this.textures[i]._adjustTextureSize();
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

    this.rotation = {
        x: angleX,
        y: angleY,
        z: angleZ
    };

    // set mvMatrix
    this._setMVMatrix();
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

    // check if we should draw the plane
    if(!this.alwaysDraw) {
        this._shouldDrawCheck();
    }

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
 This function takes the mouse position relative to the document and returns it relative to our plane
 It ranges from -1 to 1 on both axis

 params :
 @xPosition (float): position to convert on X axis
 @yPosition (float): position to convert on Y axis

 returns :
 @mousePosition: the mouse position relative to our plane in WebGL space coordinates
 ***/
Curtains.Plane.prototype.mouseToPlaneCoords = function(xMousePosition, yMousePosition) {
    // we need to adjust our plane document bounding rect to it's webgl scale
    var scaleAdjustment = {
        x: (this._boundingRect.document.width - this._boundingRect.document.width * this.scale.x) / 2,
        y: (this._boundingRect.document.height - this._boundingRect.document.height * this.scale.y) / 2,
    };

    // also we need to divide by pixel ratio
    var planeBoundingRect = {
        width: (this._boundingRect.document.width * this.scale.x) / this._wrapper.pixelRatio,
        height: (this._boundingRect.document.height * this.scale.y) / this._wrapper.pixelRatio,
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
 This function checks if the plane is currently visible in the canvas and sets _shouldDraw property according to this test
 This checks DOM positions for now but we might want to improve it to use real frustum calculations
 ***/
Curtains.Plane.prototype._shouldDrawCheck = function() {
    // we could think of a way to add margin to the should draw check
    var MARGIN = 0;

    // we need to take scale into account
    var scaleAdjustment = {
        x: (this._boundingRect.document.width - this._boundingRect.document.width * this.scale.x) / 2,
        y: (this._boundingRect.document.height - this._boundingRect.document.height * this.scale.y) / 2,
    };

    // get plane actual boundaries including its scale and relative translation
    var actualPlaneBounds = {
        top: this._boundingRect.document.top + this.relativeTranslation.y + scaleAdjustment.y,
        right: this._boundingRect.document.left + this.relativeTranslation.x + this._boundingRect.document.width - scaleAdjustment.x,
        bottom: this._boundingRect.document.top + this.relativeTranslation.y + this._boundingRect.document.height - scaleAdjustment.y,
        left: this._boundingRect.document.left + this.relativeTranslation.x + scaleAdjustment.x,
    };

    var self = this;

    // if we decide to draw the plane only when visible inside the canvas
    // we got to check if its actually inside the canvas
    if(
        actualPlaneBounds.right < -MARGIN
        || actualPlaneBounds.left > this._wrapper._boundingRect.width + MARGIN
        || actualPlaneBounds.bottom < -MARGIN
        || actualPlaneBounds.top > this._wrapper._boundingRect.height + MARGIN
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
 This function update the plane position based on its CSS positions and transformations values.
 Useful if the HTML element has been moved while the container size has not changed.
 ***/
Curtains.Plane.prototype.updatePosition = function() {
    // set the new plane sizes and positions relative to document
    this._setDocumentSizes();
    // apply them
    this._applyCSSPositions();
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

    // get the right stack where our planed is stored
    var definition = this._definition.width * this._definition.height + this._definition.width;
    var drawStack = this._wrapper._drawStack;
    var stack;
    for(var i = 0; i < drawStack.length; i++) {
        if(drawStack[i].definition === definition) {
            stack = drawStack[i];
        }
    }

    // start the reordering process (useful to prevent drawing while manipulating the stack)
    stack.isReordering = true;

    // get plane index
    var index = this.index;

    // no need to reorder if the stack has only one plane
    if(stack.planesIndex.length > 0) {
        // loop through the plane's stack, remove its index
        for(var i = 0; i < stack.planesIndex.length; i++) {
            if(stack.planesIndex[i] === index) {
                stack.planesIndex.splice(i, 1);
            }
        }
        // adds the plane index at the end of the stack depending on the depth test
        stack.planesIndex.push(this.index);

    }

    // now we need to do the same with the draw stacks
    if(drawStack.length > 0) {
        for(var i = 0; i < drawStack.length; i++) {
            if(drawStack[i].definition === definition) {
                drawStack.splice(i, 1);
            }
        }
        // adds the stack index at the end of the draw stacks
        drawStack.push(stack);
    }

    // stack has been reordered
    stack.isReordering = false;
};



/*** PLANE SIZES AND TEXTURES HANDLING ***/


/***
 Handles each plane resizing
 used internally when our container is resized
 ***/
Curtains.Plane.prototype.planeResize = function() {
    // reset perspective
    this.setPerspective(this._fov, 0.1, this._fov * 2);

    // reset plane dimensions
    this._setDocumentSizes();
    this._setComputedSizes();

    // apply new position
    this._applyCSSPositions();

    // resize all textures
    for(var i = 0; i < this.textures.length; i++) {
        this.textures[i]._adjustTextureSize();
    }
};




/*** IMAGES, VIDEOS AND CANVASES LOADING ***/

/***
 This method creates a new Texture associated to the plane

 params :
 @type (string) : texture type, either image, video or canvas

 returns :
 @t: our newly created texture
 ***/
Curtains.Plane.prototype.createTexture = function(sampler) {
    var t = new Curtains.Texture(this, {
        index: this.textures.length,
        sampler: sampler,
    });

    return t;
};


/***
 This method handles the sources loading process

 params :
 @sourcesArray (array) : array of html images, videos or canvases elements
 ***/
Curtains.Plane.prototype.loadSources = function(sourcesArray) {
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
Curtains.Plane.prototype.loadSource = function(source) {
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
Curtains.Plane.prototype.loadImage = function(source) {
    image = source;

    image.crossOrigin = this.crossOrigin;
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
Curtains.Plane.prototype.loadVideo = function(source) {
    var video = source;

    video.preload = true;
    video.muted = true;
    video.loop = true;

    video.sampler = source.getAttribute("data-sampler") || null;

    video.crossOrigin = this.crossOrigin;

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
Curtains.Plane.prototype.loadCanvas = function(source) {
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
Curtains.Plane.prototype.loadImages = function(imagesArray) {
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
Curtains.Plane.prototype.loadVideos = function(videosArray) {
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
Curtains.Plane.prototype.loadCanvases = function(canvasesArray) {
    for(var i = 0; i < canvasesArray.length; i++) {
        this.loadCanvas(canvasesArray[i]);
    }
};



/***
 This has to be called in order to play the planes videos
 We need this because on mobile devices we can't start playing a video without a user action
 Once the video has started playing we set an interval and update a new frame to our our texture at a 30FPS rate
 ***/
Curtains.Plane.prototype.playVideos = function() {
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


/***
 Used inside our draw call to set the correct plane buffers before drawing it
 ***/
Curtains.Plane.prototype._bindPlaneBuffers = function() {
    var glContext = this._wrapper.glContext;

    // Set the vertices buffer
    glContext.bindBuffer(glContext.ARRAY_BUFFER, this._geometry.bufferInfos.id);

    glContext.vertexAttribPointer(this._attributes.vertexPosition.location, this._geometry.bufferInfos.itemSize, glContext.FLOAT, false, 0, 0);
    glContext.enableVertexAttribArray(this._attributes.vertexPosition.location);

    // Set where the texture coord attribute gets its data,
    glContext.bindBuffer(glContext.ARRAY_BUFFER, this._material.bufferInfos.id);

    glContext.vertexAttribPointer(this._attributes.textureCoord.location, this._material.bufferInfos.itemSize, glContext.FLOAT, false, 0, 0);
    glContext.enableVertexAttribArray(this._attributes.textureCoord.location);
};


/***
 This is used to set the WebGL context active texture and bind it

 params :
 @texture (texture object) : Our texture object containing our WebGL texture and its index
 ***/
Curtains.Plane.prototype._bindPlaneTexture = function(texture) {
    var glContext = this._wrapper.glContext;
    // tell WebGL we want to affect the texture at the plane's index unit
    glContext.activeTexture(glContext.TEXTURE0 + texture.index);
    // bind the texture to the plane's index unit
    glContext.bindTexture(glContext.TEXTURE_2D, texture._sampler.texture);
};


/*** DRAW THE PLANE ***/

/***
 We draw the plane, ie bind the buffers, set the active textures and draw it
 ***/
Curtains.Plane.prototype._drawPlane = function() {
    var glContext = this._wrapper.glContext;

    // check if our plane is ready to draw
    if(this._canDraw) {
        // ensure we're using the right program
        glContext.useProgram(this._program);

        // even if our plane should not be drawn we still execute its onRender callback and update its uniforms

        // execute our plane onRender callback
        if(this._onRenderCallback) {
            this._onRenderCallback();
        }

        // update all uniforms set up by the user
        this._updateUniforms();

        // now check if we really need to draw it and its textures
        if(this._shouldDraw) {
            // draw all our plane textures
            for(var i = 0; i < this.textures.length; i++) {
                // draw (bind and maybe update) our texture
                this.textures[i]._drawTexture();
            }

            // bind plane buffers
            this._bindPlaneBuffers();

            // the draw call!
            glContext.drawArrays(glContext.TRIANGLES, 0, this._geometry.bufferInfos.numberOfItems);
        }
    }
};


/***
 This deletes all our plane webgl bindings and its textures
 ***/
Curtains.Plane.prototype._dispose = function() {
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


/*** PLANE EVENTS ***/

/***
 This is called each time a plane's image has been loaded. Useful to handle a loader

 params :
 @callback (function) : a function to execute

 returns :
 @this: our plane to handle chaining
 ***/
Curtains.Plane.prototype.onLoading = function(callback) {
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
Curtains.Plane.prototype.onReady = function(callback) {
    if(callback) {
        this._onReadyCallback = callback;
    }

    return this;
};


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


/***
 This is called at each requestAnimationFrame call

 params :
 @callback (function) : a function to execute

 returns :
 @this: our plane to handle chaining
 ***/
Curtains.Plane.prototype.onRender = function(callback) {
    if(callback) {
        this._onRenderCallback = callback;
    }

    return this;
};



/*** TEXTURE CLASS ***/

/***
 Here we create our Texture object (note that we are using the Curtains namespace to avoid polluting the global scope)

 params :
 @plane (html element) : html div that contains one or more image.
 @params (obj) : see createTexture method of the Plane

 returns :
 @this: our newly created texture object
 ***/
Curtains.Texture = function(plane, params) {
    // set up base properties
    this._plane = plane;
    this._wrapper = plane._wrapper;

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
    this._init();

    plane.textures.push(this);

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

    this.index = plane.textures.length;

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
};


/*** LOADING SOURCESS ***/

/***
 This use our source as texture

 params :
 @source (images/video/canvas) : either an image, a video or a canvas
 ***/
Curtains.Texture.prototype.setSource = function(source) {
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
        width: this.source.width || this.source.videoWidth,
        height: this.source.height || this.source.videoHeight,
    };

    var glContext = this._wrapper.glContext;

    glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, true);

    // Bind the texture the target (TEXTURE_2D) of the active texture unit.
    glContext.bindTexture(glContext.TEXTURE_2D, this._sampler.texture);

    // Set the parameters so we can render any size image.
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.LINEAR);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.LINEAR);

    this._adjustTextureSize();

    // set our webgl texture
    glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, source);
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

 returns :
 @sizes: an object containing plane sizes, source sizes and x and y offset to center the source in the plane
 ***/
Curtains.Texture.prototype._getSizes = function() {
    var planeWidth  = this._plane._boundingRect.document.width * this._plane.scale.x;
    var planeHeight = this._plane._boundingRect.document.height * this._plane.scale.y;

    var sourceWidth = this._size.width;
    var sourceHeight = this._size.height;

    var sourceRatio = sourceWidth / sourceHeight;
    var planeRatio = planeWidth / planeHeight;

    // center image in its container
    var xOffset = 0;
    var yOffset = 0;

    if(planeRatio > sourceRatio) { // means plane is larger
        yOffset = Math.min(0, (planeHeight - (planeWidth * (1 / sourceRatio))) / 2);
    }
    else if(planeRatio < sourceRatio) { // means plane is taller
        xOffset = Math.min(0, (planeWidth - (planeHeight * sourceRatio)) / 2);
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

 params :
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
    // no point in resizing texture if it does not have a source yet
    if(this.source) {
        var sizes = this._getSizes();

        // always update texture matrix anyway
        this._updateTextureMatrix(sizes);
    }
};

/***
 This updates our textures matrix uniform based on plane and sources sizes

 params :
 @sizes (object) : object containing plane sizes, source sizes and x and y offset to center the source in the plane
 ***/
Curtains.Texture.prototype._updateTextureMatrix = function(sizes) {
    // calculate scale to apply to the matrix
    var texScale = {
        x: sizes.planeWidth / (sizes.planeWidth - (sizes.xOffset * 2)),
        y: sizes.planeHeight / (sizes.planeHeight - (sizes.yOffset * 2)),
    };

    // apply texture scale
    texScale.x /= this.scale.x;
    texScale.y /= this.scale.y;

    // translate texture to center it
    var textureTranslation = new Float32Array([
        1.0,   0.0,  0.0,  0.0,
        0.0,  1.0,   0.0,  0.0,
        0.0,  0.0,  1.0,   0.0,
        (1 - texScale.x) / 2, (1 - texScale.y) / 2, 0.0, 1.0
    ]);

    // scale texture
    this._textureMatrix.matrix = this._plane._scaleMatrix(
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

    if(this.type === "video" && this.source && this.source.readyState >= this.source.HAVE_CURRENT_DATA) {
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