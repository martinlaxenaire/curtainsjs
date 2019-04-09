/***
 Little WebGL helper to apply images, videos or canvases as textures of planes
 Author: Martin Laxenaire https://www.martin-laxenaire.fr/
 Version: 1.8.0

 Compatibility
 PC: Chrome (65.0), Firefox (59.0.2), Microsoft Edge (41)
 Android 6.0: Chrome (64.0)
 ***/


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
    this.drawStack = [];

    this._drawingEnabled = true;
    this._needRender = false;

    // set container
    var container = containerID || "canvas";
    this.container = document.getElementById(container);

    this.productionMode = production || false;

    if(!this.container) {
        if(!this.productionMode) console.warn("You must specify a valid container ID");

        // call the error callback if provided
        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return false;
    }

    // our object that will handle all images loading process
    this.loadingManager = {
        texturesLoaded: 0,
    }

    this._init();

    return this;
}

/***
 Init by creating a canvas and webgl context, create all planes and load images
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

    // set our canvas sizes
    this.pixelRatio = window.devicePixelRatio || 1;

    this.container.boundingRect = this.container.getBoundingClientRect();

    this.glCanvas.style.width  = Math.floor(this.container.boundingRect.width) + "px";
    this.glCanvas.style.height = Math.floor(this.container.boundingRect.height) + "px";

    this.glCanvas.width  = Math.floor(this.container.boundingRect.width) * this.pixelRatio;
    this.glCanvas.height = Math.floor(this.container.boundingRect.height) * this.pixelRatio;

    // set our context viewport
    this.glContext.viewport(0, 0, this.glContext.drawingBufferWidth, this.glContext.drawingBufferHeight);

    // handling context
    this.glCanvas.addEventListener("webglcontextlost", this._contextLost.bind(this), false);
    this.glCanvas.addEventListener("webglcontextrestored", this._contextRestored.bind(this), false);

    // we can start rendering now
    this._readyToDraw();
};

/***
 Enables the render loop.
 ***/
Curtains.prototype.enableDrawing = function() {
	this._drawingEnabled = true;
}

/***
 Disables the render loop.
 ***/
Curtains.prototype.disableDrawing = function() {
	this._drawingEnabled = false;
}

/***
 Forces the rendering of the next frame, even if disabled.
 ***/
Curtains.prototype.needRender = function() {
	this._needRender = true;
}


/*** HANDLING ERRORS ***/

/***
 This is called when an error has been detected during init

 params :
 @callback (function) : a function to execute
 ***/
Curtains.prototype.onError = function(callback) {
    if(callback) {
        this._onErrorCallback = callback;
    }

    return this;
}


/*** INIT CHECK ***/

/***
 Used internally to check if our canvas and context have been created
 ***/
Curtains.prototype._isInitialized = function() {
    if(!this.glCanvas || !this.glContext) {
        if(!this.productionMode) console.warn("No WebGL canvas or context");

        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return false;
    }
};



/*** HANDLING CONTEXT ***/

/***
 Called when the WebGL context is lost
 ***/
Curtains.prototype._contextLost = function(event) {
    event.preventDefault();

    // cancel requestAnimationFrame
    if(this.requestAnimationFrameID) {
        window.cancelAnimationFrame(this.requestAnimationFrameID);
    }
};


/***
 Called when the WebGL context is restored
 ***/
Curtains.prototype._contextRestored = function() {
    // we need to reset everything : planes programs, shaders, buffers and textures !
    for(var i = 0; i < this.planes.length; i++) {
        var plane = this.planes[i];

        plane._restoreContext();
    }

    // requestAnimationFrame again
    var self = this;
    function animatePlanes() {

        self._drawScene();

        self.requestAnimationFrameID = window.requestAnimationFrame(animatePlanes);
    }

    animatePlanes();
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
        if(self.planes.length == 0) {
            // clear interval
            clearInterval(deleteInterval);

            // clear the buffer to clean scene
            self.glContext.clear(self.glContext.DEPTH_BUFFER_BIT | self.glContext.COLOR_BUFFER_BIT);

            // cancel animation frame
            window.cancelAnimationFrame(self.requestAnimationFrameID);

            // lose context
            if(self.glContext) {
                self.glContext.getExtension('WEBGL_lose_context').loseContext();
            }

            // remove canvas from DOM
            self.container.removeChild(self.glCanvas);
        }
    }, 100);


}



/***
 Create plane element

 params :
 @planeHtmlElement (html element) : the html element that we will use for our plane
 @params (obj) : see addPlane method
 ***/
Curtains.prototype._createPlane = function(planeHtmlElement, params) {
    var returnedPlane = new Plane(this, planeHtmlElement, params);
    this.planes.push(returnedPlane);

    return returnedPlane;
};



/***
 Create a plane element and load its images

 params :
 @planesHtmlElement (html element) : the html element that we will use for our plane
 @params (obj) : plane params :
 - vertexShaderID (string, optionnal) : the vertex shader ID. If not specified, will look for a data attribute data-vs-id on the plane HTML element. Will throw an error if nothing specified
 - fragmentShaderID (string, optionnal) : the fragment shader ID. If not specified, will look for a data attribute data-fs-id on the plane HTML element. Will throw an error if nothing specified
 - widthSegments (optionnal) : plane definition along the X axis (1 by default)
 - heightSegments (optionnal) : plane definition along the Y axis (1 by default)
 - mimicCSS (bool, optionnal) : define if the plane should mimic it's html element position (true by default)
 - imageCover (bool, optionnal) : define if the images must imitate css background-cover or just fit the plane (true by default)
 - crossOrigin (string, optionnal) : define the crossOrigin process to load images if any
 - fov (int, optionnal) : define the perspective field of view (default to 75)
 - uniforms (obj, otpionnal): the uniforms that will be passed to the shaders (if no uniforms specified there wont be any interaction with the plane)
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

        // load images
        var imagesArray = [];
        for(var j = 0; j < plane.htmlElement.getElementsByTagName("img").length; j++) {
            imagesArray.push(plane.htmlElement.getElementsByTagName("img")[j]);
        }

        // load videos
        var videosArray = [];
        for(var j = 0; j < plane.htmlElement.getElementsByTagName("video").length; j++) {
            videosArray.push(plane.htmlElement.getElementsByTagName("video")[j]);
        }

        // load canvases
        var canvasesArray = [];
        for(var j = 0; j < plane.htmlElement.getElementsByTagName("canvas").length; j++) {
            canvasesArray.push(plane.htmlElement.getElementsByTagName("canvas")[j]);
        }

        // load plane images
        if(imagesArray.length > 0) {
            plane.loadImages(imagesArray);
        }
        else {
            // no need to load any image right now
            plane.imagesLoaded = true;
        }

        // load plane videos
        if(videosArray.length > 0) {
            plane.loadVideos(videosArray);
        }
        else {
            // no need to load any video right now
            plane.videosLoaded = true;
        }

        // load plane canvases
        if(canvasesArray.length > 0) {
            plane.loadCanvases(canvasesArray);
        }
        else {
            // no need to load any video right now
            plane.canvasesLoaded = true;
        }

        if(imagesArray.length == 0 && videosArray.length == 0 && canvasesArray.length == 0 && !this.productionMode) { // there's no images, no videos, no canvas, send a warning
            console.warn("This plane does not contain any image, video or canvas element. You may want to add some later with the loadImages, loadVideos or loadCanvases method.");
        }

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
    plane.canDraw = false;

    // remove from draw stack

    // get the right stack where our planed is stored
    var definition = plane.definition.width * plane.definition.height + plane.definition.width;
    var drawStack = this.drawStack;
    var stackIndex;
    for(var i = 0; i < drawStack.length; i++) {
        if(drawStack[i].definition == definition) {
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
    this.drawStack[stackIndex].planesIndex.splice(planeStackIndex, 1);

    // now free the webgl part

    // unbind and delete the textures
    for(var i = 0; i < plane.textures.length; i++) {
        // if its a video texture, clear the update interval as well
        if(plane.textures[i].type == "video") {

            // empty source to properly delete video element and free the memory
            plane.videos[plane.textures[i].typeIndex].pause()
            plane.videos[plane.textures[i].typeIndex].removeAttribute('src');
            plane.videos[plane.textures[i].typeIndex].load();

            // clear the update interval
            if(plane.videos[plane.textures[i].typeIndex].updateInterval) {
                clearInterval(plane.videos[plane.textures[i].typeIndex].updateInterval);
            }
        }

        if(this.glContext) {
            this.glContext.activeTexture(this.glContext.TEXTURE0 + plane.textures[i].index);
            this.glContext.bindTexture(this.glContext.TEXTURE_2D, null);
            this.glContext.deleteTexture(plane.textures[i].glTexture);
        }

        // decrease textures loaded as it is our texture index and it is limited in WebGL
        this.loadingManager.texturesLoaded--;
    }

    if(this.glContext && plane) {
        // delete buffers
        // each time we check for existing properties to avoid errors
        if(plane.geometry) {
            this.glContext.bindBuffer(this.glContext.ARRAY_BUFFER, plane.geometry.bufferInfos.id);
            this.glContext.bufferData(this.glContext.ARRAY_BUFFER, 1, this.glContext.STATIC_DRAW);
            this.glContext.deleteBuffer(plane.geometry.bufferInfos.id);
        }

        if(plane.material) {
            this.glContext.bindBuffer(this.glContext.ARRAY_BUFFER, plane.material.bufferInfos.id);
            this.glContext.bufferData(this.glContext.ARRAY_BUFFER, 1, this.glContext.STATIC_DRAW);
            this.glContext.deleteBuffer(plane.material.bufferInfos.id);
        }

        // delete the shaders
        if(plane.shaders) {
            this.glContext.deleteShader(plane.shaders.fragmentShader);
            this.glContext.deleteShader(plane.shaders.vertexShader);
        }

        // and delete the program at last
        if(plane.program) {
            this.glContext.deleteProgram(plane.program);
        }
    }

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
    if(this.drawStack.length === 0) {
        var stack = {
            definition: planeDefinition,
            planesIndex: [this.planes.length],
            isReordering: false,
        }

        this.drawStack.push(stack);
    }
    else {
        // if it's not our first plane, check whether we already have registered a plane with this definition or not
        var hasSameDefinition = false;
        for(var i = 0; i < this.drawStack.length; i++) {
            if(this.drawStack[i].definition == planeDefinition) {
                // we already have a plane with this definition, push it inside planesIndex array
                hasSameDefinition = true;
                this.drawStack[i].planesIndex.push(this.planes.length);
            }
        }
        // we don't have a plane with this definition, we fill a new stack entry
        if(!hasSameDefinition) {
            var stack = {
                definition: planeDefinition,
                planesIndex: [this.planes.length],
                isReordering: false,
            }

            this.drawStack.push(stack);
        }
    }
}



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
    this._isInitialized();

    var shader = this.glContext.createShader(shaderType);

    this.glContext.shaderSource(shader, shaderCode);
    this.glContext.compileShader(shader);

    if (!this.glContext.getShaderParameter(shader, this.glContext.COMPILE_STATUS) && !this.glContext.isContextLost()) {
        if(!this.productionMode) console.warn("Errors occurred while compiling the shader:\n" + this.glContext.getShaderInfoLog(shader));

        // call the error callback if provided
        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return null;
    }
    return shader;
}


/***
 Decides if we have to resize our planes
 used internally in each requestAnimationFrame call
 ***/
Curtains.prototype._reSize = function() {
    // if container size has changed
    var containerBoundingRect = this.container.getBoundingClientRect();

    if(parseInt(this.glCanvas.style.width) !== Math.floor(containerBoundingRect.width) || parseInt(this.glCanvas.style.height) !== Math.floor(containerBoundingRect.height)) {

        this.pixelRatio = window.devicePixelRatio || 1;

        this.container.boundingRect = containerBoundingRect;

        this.glCanvas.style.width  = Math.floor(this.container.boundingRect.width) + "px";
        this.glCanvas.style.height = Math.floor(this.container.boundingRect.height) + "px";

        this.glCanvas.width  = Math.floor(this.container.boundingRect.width) * this.pixelRatio;
        this.glCanvas.height = Math.floor(this.container.boundingRect.height) * this.pixelRatio;

        this.glContext.viewport(0, 0, this.glContext.drawingBufferWidth, this.glContext.drawingBufferHeight);

        // resize the planes only if they are fully initiated
        for(var i = 0; i < this.planes.length; i++) {
            if(this.planes[i].canDraw) {
                this.planes[i].planeResize();
            }
        }
    }
}


/***
 Called to set whether the renderer will handle depth test or not
 Depth test is enabled by default

 params :
 @shouldHandleDepth (bool) : if we should enable or disable the depth test
 ***/
Curtains.prototype._handleDepth = function(shouldHandleDepth) {
    this._isInitialized();

    this._shouldHandleDepth = shouldHandleDepth;

    if(shouldHandleDepth) {
        // enable depth test
        this.glContext.enable(this.glContext.DEPTH_TEST);
    }
    else {
        // disable depth test
        this.glContext.disable(this.glContext.DEPTH_TEST);
    }
}


/*** DRAW EVERYTHING ***/

/***
 This is called when everything is set up and ready to draw
 It will launch our requestAnimationFrame loop
 ***/
Curtains.prototype._readyToDraw = function() {
    this._isInitialized();

    // we are ready to go
    this.container.appendChild(this.glCanvas);

    // allows transparency
    this.glContext.blendFunc(this.glContext.SRC_ALPHA, this.glContext.ONE_MINUS_SRC_ALPHA);
    this.glContext.enable(this.glContext.BLEND);

    // enable depth by default
    this._handleDepth(true);

    console.log("curtains.js - v1.8");

    var self = this;
    function animatePlanes() {

        self._drawScene();

        self.requestAnimationFrameID = window.requestAnimationFrame(animatePlanes);
    }

    animatePlanes();
}



/***
 This is our draw call, ie what has to be called at each frame our our requestAnimationFrame loop
 sets our matrix and draw everything
 ***/
Curtains.prototype._drawScene = function() {
    // If needRender is true, force rendering this frame even if drawing is not enabled.
    // If not, only render if enabled.
    if(!this._drawingEnabled && !this._needRender) return;

    if(this._needRender) {
		this._needRender = false;
    }
    
    this._isInitialized();

    // Clear the color buffer,
    this.glContext.clearColor(0.0, 0.0, 0.0, 0.0);
    this.glContext.clearDepth(1.0);

    this._reSize();

    // loop on our stacked planes
    for(var i = 0; i < this.drawStack.length; i++) {
        if(!this.drawStack[i].isReordering) {
            for(var j = 0; j < this.drawStack[i].planesIndex.length; j++) {

                var plane = this.planes[this.drawStack[i].planesIndex[j]];
                // be sure the plane exists
                if(plane) {
                    // set/unset the depth test if needed
                    if(plane.shouldUseDepthTest && !this._shouldHandleDepth) {
                        this._handleDepth(true);
                    }
                    else if(!plane.shouldUseDepthTest && this._shouldHandleDepth) {
                        this._handleDepth(false);
                    }

                    if(j == 0) {
                        // draw the plane and bind the buffers
                        plane._drawPlane(true);
                    }
                    else {
                        // draw the plane without binding buffers
                        plane._drawPlane(false);
                    }
                }

            }
        }

    }

}



/*** PLANES CREATION ***/

/***
 Here we create our Plane object
 We have to create a shader program for each plane
 We will vreate a plane object containing the program, shaders, as well as other useful datas
 Once our shaders are linked to a program, we create their matrixes and set up their default attributes

 params :
 @curtainWrapper : our curtain object that wraps all the planes
 @plane (html element) : html div that contains one or more image.
 @params (obj) : see addPlanes method of the wrapper
 ***/
function Plane(curtainWrapper, plane, params) {
    this.wrapper = curtainWrapper;

    this.htmlElement = plane;
    this.images = [];
    this.videos = [];
    this.canvases = [];
    this.textures = [];

    this.index = this.wrapper.planes.length;

    this.canDraw = false;

    this.definition = {
        width: parseInt(params.widthSegments) || 1,
        height: parseInt(params.heightSegments) || 1
    }

    // define if we want to mimic css positions
    this.mimicCSS = params.mimicCSS;
    if(this.mimicCSS === null || this.mimicCSS === undefined) {
        this.mimicCSS = true;
    }

    // define if we want the image to fit exactly the plane's size or if they mimic the background-cover
    // this is mainly a performance issue : either we use directly the image as a texture or we draw it inside a canvas before (which is costful)
    this.imageCover = params.imageCover;
    if(this.imageCover === null || this.imageCover === undefined) {
        this.imageCover = true;
    }

    this.crossOrigin = params.crossOrigin || "anonymous",

        // set default fov
        this.fov = params.fov || 75;

    // enable depth test by default
    this.shouldUseDepthTest = true;

    // set our basic initial infos
    var planeElementBoundingRect = this.htmlElement.getBoundingClientRect();
    this.size = {
        width: (planeElementBoundingRect.width * this.wrapper.pixelRatio || this.wrapper.glCanvas.width),
        height: (planeElementBoundingRect.height * this.wrapper.pixelRatio || this.wrapper.glCanvas.height),
    }

    this.offset = {
        top: (planeElementBoundingRect.top || this.wrapper.container.boundingRect.top),
        left: (planeElementBoundingRect.left || this.wrapper.container.boundingRect.left),
    }

    this.scale = {
        x: 1,
        y: 1
    }

    this.translation = {
        x: 0,
        y: 0,
        z: 0
    }

    this.rotation = {
        x: 0,
        y: 0,
        z: 0,
    }

    this.relativeTranslation = {
        x: 0,
        y: 0,
    }

    // handling shaders
    var vsId = params.vertexShaderID || plane.getAttribute("data-vs-id");
    var fsId = params.fragmentShaderID || plane.getAttribute("data-fs-id");

    var vsIdHTML, fsIdHTML;

    if(!params.vertexShader) {
        if(!vsId || !document.getElementById(vsId)) {
            if(!this.wrapper.productionMode) console.warn("No vertex shader provided, will use a default one");

            vsIdHTML = "#ifdef GL_ES\nprecision mediump float;\n#endif\nattribute vec3 aVertexPosition;\nattribute vec2 aTextureCoord;\nuniform mat4 uMVMatrix;\nuniform mat4 uPMatrix;\nvarying vec3 vVertexPosition;\nvarying vec2 vTextureCoord;\nvoid main() {vTextureCoord = aTextureCoord;vVertexPosition = aVertexPosition;gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);}";
        }
        else {
            vsIdHTML = document.getElementById(vsId).innerHTML;
        }
    }

    if(!params.fragmentShader) {
        if(!fsId || !document.getElementById(fsId)) {
            if(!this.wrapper.productionMode) console.warn("No fragment shader provided, will use a default one");

            fsIdHTML = "#ifdef GL_ES\nprecision mediump float;\n#endif\nvarying vec3 vVertexPosition;\nvarying vec2 vTextureCoord;\nvoid main( void ) {gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);}";
        }
        else {
            fsIdHTML = document.getElementById(fsId).innerHTML;
        }
    }

    this.shaders = {};

    this.shaders.vertexShaderCode = params.vertexShader || vsIdHTML;
    this.shaders.fragmentShaderCode = params.fragmentShader || fsIdHTML;

    // set up shaders, program and attributes
    this._setupPlane();


    // handle uniforms
    if(!params.uniforms) {
        if(!this.wrapper.productionMode) console.warn("You are setting a plane without uniforms, you won't be able to interact with it. Please check your addPlane method for : ", this.htmlElement);

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
                coreUniform: false,
            }
        });
    }
    // then we set the plane uniforms locations
    this._setUniforms(this.uniforms);



    var widthSegments = Math.floor(params.widthSegments) || 1; // 1 is default definition
    var heightSegments = Math.floor(params.heightSegments) || 1;

    // we need to sort planes by their definitions : widthSegments * heightSegments
    // but we have to keep in mind that 10*15 and 15*10 are not the same vertices definion, so we add widthSegments to differenciate them
    this.wrapper._stackPlane(widthSegments * heightSegments + widthSegments);

    return this;
}


/***
 Used internally handle context restore
 ***/
Plane.prototype._restoreContext = function() {
    this.canDraw = false;

    // remove and reset everything that depends on the context
    this.shaders.vertexShader = null;
    this.shaders.fragmentShader = null;

    this.program = null;

    this.matrix = null;

    this.attributes = null;

    this.textures = [];

    this.geometry.bufferInfos = null;
    this.material.bufferInfos = null;

    // reset plane shaders, programs and attributes
    this._setupPlane();

    // reset plane uniforms
    this._setUniforms(this.uniforms);

    // reset textures
    this._createTextures("image");
    this._createTextures("video");
}


/***
 Used internally to set up shaders, program and attributes
 ***/
Plane.prototype._setupPlane = function() {
    var glContext = this.wrapper.glContext;

    // create shader program
    this.program = glContext.createProgram();

    // Create shaders,
    this.shaders.vertexShader = this.wrapper._createShader(this.shaders.vertexShaderCode, glContext.VERTEX_SHADER);
    this.shaders.fragmentShader = this.wrapper._createShader(this.shaders.fragmentShaderCode, glContext.FRAGMENT_SHADER);

    if((!this.shaders.vertexShader || !this.shaders.fragmentShader) && !this.wrapper.productionMode) {
        if(!this.wrapper.productionMode) console.warn("Unable to find the vertex or fragment shader");

        // call the error callback if provided
        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return false;
    }


    glContext.attachShader(this.program, this.shaders.vertexShader);
    glContext.attachShader(this.program, this.shaders.fragmentShader);
    glContext.linkProgram(this.program);

    // Check the shader program creation status,
    if (!glContext.getProgramParameter(this.program, glContext.LINK_STATUS) && !glContext.isContextLost()) {
        if(!this.wrapper.productionMode) console.warn("Unable to initialize the shader program.");

        // call the error callback if provided
        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return false;
    }

    // Set the current shader in use,
    glContext.useProgram(this.program);

    this.matrix = {};
    // projection and model view matrix
    // create our modelview and projection matrix
    this.matrix.mvMatrix = new Float32Array([
        1.0,   0.0,  0.0,  0.0,
        0.0,  1.0,   0.0,  0.0,
        0.0,  0.0,  1.0,   0.0,
        0.0,  0.0,  0.0,  1.0
    ]);

    this.matrix.pMatrix = this._setPerspectiveMatrix(this.fov, 0.1, this.fov * 2);

    // matrix uniforms
    this.matrix.pMatrixUniform = glContext.getUniformLocation(this.program, "uPMatrix");
    this.matrix.mvMatrixUniform = glContext.getUniformLocation(this.program, "uMVMatrix");

    // set default attributes
    var defaultAttributes = {
        vertexPosition: "aVertexPosition",
        textureCoord: "aTextureCoord",
    }

    this._setAttributes(defaultAttributes);
};


/***
 Used internally to check if the plane shader program has been created
 ***/
Plane.prototype._isProgramInitialized = function() {
    if(!this.program) {
        if(!this.wrapper.productionMode) console.warn("No WebGL program for this plane");

        // call the error callback if provided
        if(this._onErrorCallback) {
            this._onErrorCallback()
        }

        return false;
    }
};


/*** METHODS FIRED ON THE DIFFERENT STEP OF THE SCRIPT ***/

/***
 This is called each time a plane's image has been loaded. Useful to handle a loader

 params :
 @callback (function) : a function to execute
 ***/
Plane.prototype.onLoading = function(callback) {
    if(callback) {
        this.onPlaneLoadingCallback = callback;
    }

    return this;
}


/***
 This is called when a plane is ready to be drawn

 params :
 @callback (function) : a function to execute
 ***/
Plane.prototype.onReady = function(callback) {
    if(callback) {
        this._onReadyCallback = callback;
    }

    return this;
}


/***
 This is called at each requestAnimationFrame call

 params :
 @callback (function) : a function to execute
 ***/
Plane.prototype.onRender = function(callback) {
    if(callback) {
        this.onRenderCallback = callback;
    }

    return this;
}


/***
 This will set our texture sampler uniforms and then set our plane vertices and texture coords buffers

 params :
 @uniforms (obj) : an object with our uniforms to set
 @widthSegments (integer): plane definition along X axis
 @heightSegments (integer): plane definition along Y axis
 ***/
Plane.prototype._setPlaneDefinition = function(widthSegments, heightSegments) {

    var glContext = this.wrapper.glContext;
    // ensure we are using the right program
    glContext.useProgram(this.program);
    // here we are setting texture sampler uniform under the hood
    // we will link it later
    for(var i = 0; i < this.textures.length; i++) {
        if(this.textures[i].sampler) {
            var samplerUniform = this.textures[i].sampler;
            this.uniforms[samplerUniform] = {};
            this.uniforms[samplerUniform].location = glContext.getUniformLocation(this.program, samplerUniform);
            this.uniforms[samplerUniform].coreUniform = true;

            // tell the shader we bound the texture to our indexed texture unit
            glContext.uniform1i(this.uniforms[samplerUniform].location, this.textures[i].index);
        }
        else {
            this.uniforms["sampler" + this.textures[i].index] = {};
            // inside the shaders, the samplers will be named "uSampler" + index of the image inside the plane
            this.uniforms["sampler" + this.textures[i].index].location = glContext.getUniformLocation(this.program, "uSampler" + i);
            this.uniforms["sampler" + this.textures[i].index].coreUniform = true;

            // tell the shader we bound the texture to our indexed texture unit
            glContext.uniform1i(this.uniforms["sampler" + this.textures[i].index].location, this.textures[i].index);
        }
    }

    this._initializeBuffers(widthSegments, heightSegments);
}



/*** PLANE VERTICES AND BUFFERS ***/

/***
 This method is used internally to create our vertices coordinates and texture UVs
 we first create our UVs on a grid from [0, 0, 0] to [1, 1, 0]
 then we use the UVs to create our vertices coords

 params :
 @widthSegments (integer): plane definition along X axis
 @heightSegments (integer): plane definition along Y axis

 returns :
 @returnedVertices (obj): and object containing uvs and vertices coordinates
 ***/
Plane.prototype._setPlaneVertices = function(widthSegments, heightSegments) {
    // buffers
    var returnedVertices = {};
    returnedVertices.vertices = [];
    returnedVertices.uvs = [];

    for (var y = 0; y < heightSegments; ++y) {
        var v = y / heightSegments;

        for (var x = 0; x < widthSegments; ++x) {
            var u = x / widthSegments;

            // uvs and vertices
            // our uvs are ranging from 0 to 1, our vertices range from -1 to 1

            // first triangle
            returnedVertices.uvs.push(u);
            returnedVertices.uvs.push(v);
            returnedVertices.uvs.push(0);

            returnedVertices.vertices.push((u - 0.5) * 2);
            returnedVertices.vertices.push((v - 0.5) * 2);
            returnedVertices.vertices.push(0);

            returnedVertices.uvs.push(u + (1 / widthSegments));
            returnedVertices.uvs.push(v);
            returnedVertices.uvs.push(0);

            returnedVertices.vertices.push(((u + (1 / widthSegments)) - 0.5) * 2);
            returnedVertices.vertices.push((v - 0.5) * 2);
            returnedVertices.vertices.push(0);

            returnedVertices.uvs.push(u);
            returnedVertices.uvs.push(v + (1 / heightSegments));
            returnedVertices.uvs.push(0);

            returnedVertices.vertices.push((u - 0.5) * 2);
            returnedVertices.vertices.push(((v + (1 / heightSegments)) - 0.5) * 2);
            returnedVertices.vertices.push(0);

            // second triangle
            returnedVertices.uvs.push(u);
            returnedVertices.uvs.push(v + (1 / heightSegments));
            returnedVertices.uvs.push(0);

            returnedVertices.vertices.push((u - 0.5) * 2);
            returnedVertices.vertices.push(((v + (1 / heightSegments)) - 0.5) * 2);
            returnedVertices.vertices.push(0);

            returnedVertices.uvs.push(u + (1 / widthSegments));
            returnedVertices.uvs.push(v + (1 / heightSegments));
            returnedVertices.uvs.push(0);

            returnedVertices.vertices.push(((u + (1 / widthSegments)) - 0.5) * 2);
            returnedVertices.vertices.push(((v + (1 / heightSegments)) - 0.5) * 2);
            returnedVertices.vertices.push(0);

            returnedVertices.uvs.push(u + (1 / widthSegments));
            returnedVertices.uvs.push(v);
            returnedVertices.uvs.push(0);

            returnedVertices.vertices.push(((u + (1 / widthSegments)) - 0.5) * 2);
            returnedVertices.vertices.push((v - 0.5) * 2);
            returnedVertices.vertices.push(0);
        }
    }

    return returnedVertices;
}


/***
 This method has to be called externally after our textures have been created
 Creates our buffers : vertex buffer and texture coord buffer
 We also resize our textures to be sure they'll fit our plane

 Once everything is done we call our ready callback function

 params :
 @widthSegments (integer): plane definition along X axis
 @heightSegments (integer): plane definition along Y axis
 ***/
Plane.prototype._initializeBuffers = function(widthSegments, heightSegments) {
    this.wrapper._isInitialized();

    this._isProgramInitialized();

    widthSegments = Math.floor(widthSegments) || 1; // 1 is default definition
    heightSegments = Math.floor(heightSegments) || 1;

    // we could not use plane.size property here because it might have changed since its creation
    // if the plane does not have any texture yet, a window resize does not trigger the resize function
    var planeElementBoundingRect = this.htmlElement.getBoundingClientRect();
    var planeWidth = planeElementBoundingRect.width * this.wrapper.pixelRatio || this.wrapper.glCanvas.width;
    var planeHeight = planeElementBoundingRect.height * this.wrapper.pixelRatio || this.wrapper.glCanvas.height;

    // if this our first time we need to create our geometry and material objects
    if(!this.geometry && !this.material) {
        var returnedVertices = this._setPlaneVertices(widthSegments, heightSegments);

        // first the plane vertices
        this.geometry = {};
        this.geometry.vertices = returnedVertices.vertices;

        // now the texture UVs coordinates
        this.material = {};
        this.material.uvs = returnedVertices.uvs;
    }


    // set plane scale relative to its canvas parent
    this.geometry.innerScale = {
        x: planeWidth / this.wrapper.glCanvas.width,
        y: planeHeight / this.wrapper.glCanvas.height
    };


    // remember 0 is the center on the X axis and Y are inverted
    this.clipSpace = {
        x:  ((this.geometry.innerScale.x - 1) * ((this.wrapper.glCanvas.width / this.wrapper.glCanvas.height) / 2)) / this.scale.x,
        y: ((1 - this.geometry.innerScale.y) / 2) / this.scale.y,
        width: this.wrapper.glCanvas.width / this.wrapper.glCanvas.height,
        height: 2,
    }

    // apply our css positions
    if(this.mimicCSS) {
        this._applyCSSPositions();
    }
    else {
        this.setTranslation(0, 0, 0);
    }


    // scale the texture now that we know all our sizes
    for(var i = 0; i < this.textures.length; i++) {
        // adjust size
        // second parameter is set to true to bind the texture as its the first time we're drawing it
        this._adjustTextureSize(i, true);
    }

    var glContext = this.wrapper.glContext;



    this.geometry.bufferInfos = {};

    this.geometry.bufferInfos.id = glContext.createBuffer();
    glContext.bindBuffer(glContext.ARRAY_BUFFER, this.geometry.bufferInfos.id);

    glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(this.geometry.vertices), glContext.STATIC_DRAW);

    this.geometry.bufferInfos.itemSize = 3;
    this.geometry.bufferInfos.numberOfItems = this.geometry.vertices.length / this.geometry.bufferInfos.itemSize;

    // Set where the vertexPosition attribute gets its data,
    glContext.vertexAttribPointer(this.attributes.vertexPosition, this.geometry.bufferInfos.itemSize, glContext.FLOAT, false, 0, 0);
    glContext.enableVertexAttribArray(this.attributes.vertexPosition);




    this.material.bufferInfos = {};

    this.material.bufferInfos.id = glContext.createBuffer();
    glContext.bindBuffer(glContext.ARRAY_BUFFER, this.material.bufferInfos.id);

    glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(this.material.uvs), glContext.STATIC_DRAW);

    this.material.bufferInfos.itemSize = 3;
    this.material.bufferInfos.numberOfItems = this.material.uvs.length / this.material.bufferInfos.itemSize;

    glContext.vertexAttribPointer(this.attributes.textureCoord, this.material.bufferInfos.itemSize, glContext.FLOAT, false, 0, 0);
    glContext.enableVertexAttribArray(this.attributes.textureCoord);


    // everything is set up, we can draw the plane now
    this.canDraw = true;

    if(this._onReadyCallback) {
        this._onReadyCallback()
    }
}



/*** FINISH INIT ***/

/***
 Used inside our draw call to set the correct plane buffers before drawing it
 ***/
Plane.prototype._bindPlaneBuffers = function() {
    var glContext = this.wrapper.glContext;

    // Set the vertices buffer
    glContext.bindBuffer(glContext.ARRAY_BUFFER, this.geometry.bufferInfos.id);

    glContext.vertexAttribPointer(this.attributes.vertexPosition, this.geometry.bufferInfos.itemSize, glContext.FLOAT, false, 0, 0);
    glContext.enableVertexAttribArray(this.attributes.vertexPosition);

    // Set where the texture coord attribute gets its data,
    glContext.bindBuffer(glContext.ARRAY_BUFFER, this.material.bufferInfos.id);

    glContext.vertexAttribPointer(this.attributes.textureCoord, this.material.bufferInfos.itemSize, glContext.FLOAT, false, 0, 0);
    glContext.enableVertexAttribArray(this.attributes.textureCoord);
}


/*** PLANE ATTRIBUTES & UNIFORMS ***/

/*** ATTRIBUTES ***/

/***
 This set our plane vertex shader attributes
 used internally but can be used externally as well

 BE CAREFUL : if an attribute is set here, it MUST be DECLARED and USED inside our plane vertex shader

 params :
 @attributes (obj): attributes to apply
 ***/
Plane.prototype._setAttributes = function(attributes) {
    this.wrapper._isInitialized();

    this._isProgramInitialized();

    if(!this.attributes) this.attributes = {};

    var self = this;
    Object.keys(attributes).map(function(objectKey, index) {
        var value = attributes[objectKey];
        self.attributes[objectKey] = self.wrapper.glContext.getAttribLocation(self.program, value);
    });
}



/*** UNIFORMS ***/

/***
 This is a little helper to set uniforms based on their types

 params :
 @uniformType (string): the uniform type
 @uniformLocation (WebGLUniformLocation obj): location of the current program uniform
 @uniformValue (float/integer or array of float/integer): value to set
 ***/
Plane.prototype._handleUniformSetting = function(uniformType, uniformLocation, uniformValue) {

    var glContext = this.wrapper.glContext;

    if(uniformType == "1i") {
        glContext.uniform1i(uniformLocation, uniformValue);
    }
    else if(uniformType == "1iv") {
        glContext.uniform1iv(uniformLocation, uniformValue);
    }
    else if(uniformType == "1f") {
        glContext.uniform1f(uniformLocation, uniformValue);
    }
    else if(uniformType == "1fv") {
        glContext.uniform1fv(uniformLocation, uniformValue);
    }

    else if(uniformType == "2i") {
        glContext.uniform2i(uniformLocation, uniformValue[0], uniformValue[1]);
    }
    else if(uniformType == "2iv") {
        glContext.uniform2iv(uniformLocation, uniformValue);
    }
    else if(uniformType == "2f") {
        glContext.uniform2f(uniformLocation, uniformValue[0], uniformValue[1]);
    }
    else if(uniformType == "2fv") {
        glContext.uniform2fv(uniformLocation, uniformValue);
    }

    else if(uniformType == "3i") {
        glContext.uniform3i(uniformLocation, uniformValue[0], uniformValue[1], uniformValue[2]);
    }
    else if(uniformType == "3iv") {
        glContext.uniform3iv(uniformLocation, uniformValue);
    }
    else if(uniformType == "3f") {
        glContext.uniform3f(uniformLocation, uniformValue[0], uniformValue[1], uniformValue[2]);
    }
    else if(uniformType == "3fv") {
        glContext.uniform3fv(uniformLocation, uniformValue);
    }

    else if(uniformType == "4i") {
        glContext.uniform4i(uniformLocation, uniformValue[0], uniformValue[1], uniformValue[2], uniformValue[3]);
    }
    else if(uniformType == "4iv") {
        glContext.uniform4iv(uniformLocation, uniformValue);
    }
    else if(uniformType == "4f") {
        glContext.uniform4f(uniformLocation, uniformValue[0], uniformValue[1], uniformValue[2], uniformValue[3]);
    }
    else if(uniformType == "4fv") {
        glContext.uniform4fv(uniformLocation, uniformValue);
    }

    else if(uniformType == "mat2") {
        glContext.uniformMatrix2fv(uniformLocation, false, uniformValue)
    }
    else if(uniformType == "mat3") {
        glContext.uniformMatrix3fv(uniformLocation, false, uniformValue)
    }
    else if(uniformType == "mat4") {
        glContext.uniformMatrix4fv(uniformLocation, false, uniformValue)
    }

    else if(!this.wrapper.productionMode) {
        console.warn("This uniform type is not handled : ", uniformType);
    }
}


/***
 This set our shaders uniforms

 params :
 @uniforms (obj): uniforms to apply
 ***/
Plane.prototype._setUniforms = function(uniforms) {

    this.wrapper._isInitialized();

    this._isProgramInitialized();

    // ensure we are using the right program
    this.wrapper.glContext.useProgram(this.program);

    var self = this;
    // set our uniforms if we got some
    if(uniforms) {
        Object.keys(uniforms).map(function(objectKey, index) {
            var uniform = uniforms[objectKey];
            if(!uniform.coreUniform) {

                // set our uniform location
                self.uniforms[objectKey].location = self.wrapper.glContext.getUniformLocation(self.program, uniform.name);

                if(!uniform.type) {
                    if(Array.isArray(uniform.value)) {
                        if(uniform.value.length == 4) {
                            uniform.type = "4f";

                            if(!this.wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a 4f (array of 4 floats) uniform type");
                        }
                        else if(uniform.value.length == 3) {
                            uniform.type = "3f";

                            if(!this.wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a 3f (array of 3 floats) uniform type");
                        }
                        else if(uniform.value.length == 2) {
                            uniform.type = "2f";

                            if(!this.wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a 2f (array of 2 floats) uniform type");
                        }
                    }
                    else if(uniform.value.constructor === Float32Array) {
                        if(uniform.value.length == 16) {
                            uniform.type = "mat4";

                            if(!this.wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a mat4 (4x4 matrix array) uniform type");
                        }
                        else if(uniform.value.length == 9) {
                            uniform.type = "mat3";

                            if(!this.wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a mat3 (3x3 matrix array) uniform type");
                        }
                        else  if(uniform.value.length == 4) {
                            uniform.type = "mat2";

                            if(!this.wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a mat2 (2x2 matrix array) uniform type");
                        }
                    }
                    else {
                        uniform.type = "1f";

                        if(!this.wrapper.productionMode) console.warn("No uniform type declared for " + uniform.name + ", applied a 1f (float) uniform type");
                    }
                }

                // set the uniforms
                self._handleUniformSetting(uniform.type, self.uniforms[objectKey].location, uniform.value);
            }
        });
    }
}


/***
 This updates all uniforms of a plane that are not part of the core (ie set by user)
 It is called at each draw call
 ***/
Plane.prototype._updateUniforms = function() {

    // ensure we are using the right program
    this.wrapper.glContext.useProgram(this.program);

    if(this.uniforms && this.wrapper.glContext.isProgram(this.program)) {

        var uniforms = this.uniforms;
        var self = this;
        Object.keys(uniforms).map(function(objectKey, index) {

            var uniform = uniforms[objectKey];

            // update only uniforms that are not part of the core
            if(!uniform.coreUniform) {

                var location = uniform.location;
                var value = uniform.value;
                var type = uniform.type;

                // update our uniforms
                self._handleUniformSetting(type, location, value);
            }
        });
    }
}



/*** PLANES SIZES, SCALES AND ROTATIONS ***/


/***
 Simple matrix multiplication helper

 params :
 @a (array): first matrix
 @b (array): second matrix

 returns :
 @out: matrix after multiplication
 ***/
Plane.prototype._multiplyMatrix = function(a, b) {
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
}


/***
 This will set our perspective matrix

 params :
 @fov (float): the field of view
 @near (float): the nearest point where object are displayed
 @far (float): the farthest point where object are displayed
 ***/
Plane.prototype._setPerspectiveMatrix = function(fov, near, far) {
    var aspect = this.wrapper.glCanvas.width / this.wrapper.glCanvas.height;

    if(fov !== this.fov) {
        this.fov = fov;
    }

    var perspectiveMatrix = [
        fov / aspect, 0, 0, 0,
        0, fov, 0, 0,
        0, 0, (near + far) * (1 / (near - far)), -1,
        0, 0, near * far * (1 / (near - far)) * 2, 0
    ];

    return perspectiveMatrix;
}


/***
 This will set our perspective matrix
 used internally but can be used externally as well to change fov for example

 params :
 @fov (float): the field of view
 @near (float): the nearest point where object are displayed
 @far (float): the farthest point where object are displayed
 ***/
Plane.prototype.setPerspective = function(fov, near, far) {

    var fieldOfView = parseInt(fov) || 75;
    if(fieldOfView < 0) {
        fieldOfView = 0;
    }
    else if(fieldOfView > 180) {
        fieldOfView = 180;
    }

    var nearPlane = parseFloat(near) || 0.1;
    var farPlane = parseFloat(far) || 100;

    var xTranslation = this.translation.x || 0;
    var yTranslation = this.translation.y || 0;

    this.matrix.pMatrix = this._setPerspectiveMatrix(fieldOfView, nearPlane, farPlane);
    this.setTranslation(xTranslation, yTranslation, 0);
}


/***
 This will set our plane scale
 used internally but can be used externally as well

 params :
 @scaleX (float): scale to apply on X axis
 @scaleY (float): scale to apply on Y axis
 @scaleZ (float): scale to apply on Z axis
 ***/
Plane.prototype.setScale = function(scaleX, scaleY) {
    this.wrapper._isInitialized();

    this._isProgramInitialized();

    scaleX = parseFloat(scaleX) || 1;
    scaleX = Math.max(scaleX, 0.001); // ensure we won't have a 0 scale

    scaleY = parseFloat(scaleY) || 1;
    scaleY = Math.max(scaleY, 0.001); // ensure we won't have a 0 scale

    this.scale = {
        x: scaleX,
        y: scaleY
    }

    // set mvMatrix
    this.matrix.mvMatrix = this._setMVMatrix();

    // scale the texture to adapt to new scale
    for(var i = 0; i < this.textures.length; i++) {
        // adjust size
        // second parameter is set to false : we don't need to bind the texture that doesn't have imageCover again
        this._adjustTextureSize(i, false);
    }
}


/***
 This will set our plane rotation
 used internally but can be used externally as well

 params :
 @angleX (float): rotation to apply on X axis (in radians)
 @angleY (float): rotation to apply on Y axis (in radians)
 @angleZ (float): rotation to apply on Z axis (in radians)
 ***/
Plane.prototype.setRotation = function(angleX, angleY, angleZ) {
    this.wrapper._isInitialized();

    this._isProgramInitialized();

    angleX = parseFloat(angleX) || 0;
    angleY = parseFloat(angleY) || 0;
    angleZ = parseFloat(angleZ) || 0;

    this.rotation = {
        x: angleX,
        y: angleY,
        z: angleZ
    };

    // set mvMatrix
    this.matrix.mvMatrix = this._setMVMatrix();
}


/***
 This will set our plane translation
 used internally but can be used externally as well (be carefull as it is using values relative to clip space and not pixels)

 params :
 @translationX (float): translation to apply on X axis
 @translationY (float): translation to apply on Y axis
 @translationZ (float): translation to apply on Z axis
 ***/
Plane.prototype.setTranslation = function(translationX, translationY, translationZ) {
    this.wrapper._isInitialized();

    this._isProgramInitialized();

    translationX = translationX || 0;
    translationY = translationY || 0;
    translationZ = translationZ || 0;

    this.translation = {
        x: translationX,
        y: translationY,
        z: translationZ
    }

    // set mvMatrix
    this.matrix.mvMatrix = this._setMVMatrix();
}


/***
 This function takes pixel values along X and Y axis and convert them to clip space coordinates, and then apply the corresponding translation

 params :
 @translationX (float): translation to apply on X axis
 @translationY (float): translation to apply on Y axis
 ***/
Plane.prototype.setRelativePosition = function(translationX, translationY) {

    var relativePosition = this._documentToPlaneSpace(translationX, translationY);

    this.relativeTranslation = {
        x: translationX,
        y: translationY
    };

    this.setTranslation(relativePosition.x, relativePosition.y, this.translation.z);
}


/***
 This function takes pixel values along X and Y axis and convert them to clip space coordinates

 params :
 @xPosition (float): position to convert on X axis
 @yPosition (float): position to convert on Y axis
 ***/
Plane.prototype._documentToPlaneSpace = function(xPosition, yPosition) {
    var relativePosition = {
        x: this.clipSpace.x + ((xPosition / (this.wrapper.glCanvas.width / this.wrapper.pixelRatio)) * this.clipSpace.width),
        y: this.clipSpace.y - (yPosition / (this.wrapper.glCanvas.height / this.wrapper.pixelRatio))
    }

    return relativePosition;
}


/***
 This function takes the mouse position relative to the document and returns it relative to our plane
 It ranges from -1 to 1 on both axis

 params :
 @xPosition (float): position to convert on X axis
 @yPosition (float): position to convert on Y axis
 ***/
Plane.prototype.mouseToPlaneCoords = function(xMousePosition, yMousePosition) {

    var mousePosition = {
        x: (((xMousePosition - (this.offset.left + window.pageXOffset)) / (this.size.width / this.wrapper.pixelRatio)) * 2) - 1,
        y: 1 - (((yMousePosition - (this.offset.top + window.pageYOffset)) / (this.size.height / this.wrapper.pixelRatio)) * 2)
    }

    return mousePosition;
}


/***
 This function takes the plane CSS positions and convert them to clip space coordinates, and then apply the corresponding translation
 ***/
Plane.prototype._applyCSSPositions = function() {
    var planeAspect = this.size.width / this.size.height;
    var wrapperOffset = this.wrapper.container.boundingRect;

    // plane position
    var cssPositions = {
        top: this.offset.top - wrapperOffset.top,
        left: this.offset.left - wrapperOffset.left,
    }

    // our position relative to the clip space
    var relativePosition = this._documentToPlaneSpace(cssPositions.left, cssPositions.top);

    this.relativeTranslation = {
        x: cssPositions.left,
        y: cssPositions.top
    };

    // set the translation
    this.setTranslation(relativePosition.x, relativePosition.y, this.translation.z);
}


/***
 This function update the plane position based on its CSS positions and transformations values.
 Useful if the HTML element has been moved while the container size has not changed.
 Only triggered if the plane has the mimicCSS property set to true.
 ***/
Plane.prototype.updatePosition = function() {
    if(this.mimicCSS) {
        var planeElementBoundingRect = this.htmlElement.getBoundingClientRect();

        this.offset = {
            top: planeElementBoundingRect.top,
            left: planeElementBoundingRect.left,
        }

        this._applyCSSPositions();
    }
}


/***
 This function set/unset the depth test for that plane

 params :
 @shouldEnableDepthTest (bool): enable/disable depth test for that plane
 ***/
Plane.prototype.enableDepthTest = function(shouldEnableDepthTest) {
    this.shouldUseDepthTest = shouldEnableDepthTest;
}


/***
 This function puts the plane at the end of the draw stack, allowing it to overlap any other plane
 ***/
Plane.prototype.moveToFront = function() {

    this.enableDepthTest(false);

    // get the right stack where our planed is stored
    var definition = this.definition.width * this.definition.height + this.definition.width;
    var drawStack = this.wrapper.drawStack;
    var stack;
    for(var i = 0; i < drawStack.length; i++) {
        if(drawStack[i].definition == definition) {
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
            if(stack.planesIndex[i] == index) {
                stack.planesIndex.splice(i, 1);
            }
        }
        // adds the plane index at the end of the stack depending on the depth test
        stack.planesIndex.push(this.index);

    }

    // now we need to do the same with the draw stacks
    if(drawStack.length > 0) {
        for(var i = 0; i < drawStack.length; i++) {
            if(drawStack[i].definition == definition) {
                drawStack.splice(i, 1);
            }
        }
        // adds the stack index at the end of the draw stacks
        drawStack.push(stack);
    }

    // stack has been reordered
    stack.isReordering = false;
}


/***
 This will set our model view matrix
 used internally at each draw call
 It will calculate our matrix based on its plane translation, rotation and scale
 ***/
Plane.prototype._setMVMatrix = function() {

    var identity = new Float32Array([
        1.0,   0.0,  0.0,  0.0,
        0.0,  1.0,   0.0,  0.0,
        0.0,  0.0,  1.0,   0.0,
        0.0,  0.0,  0.0,  1.0
    ]);

    var zTranslation = this.translation.z - (this.fov / 2);

    var planeTranslation = new Float32Array([
        1.0,   0.0,  0.0,  0.0,
        0.0,  1.0,   0.0,  0.0,
        0.0,  0.0,  1.0,   0.0,
        this.translation.x,  this.translation.y,  zTranslation,  1.0
    ]);

    var xRotation = new Float32Array([
        1.0,  0.0,  0.0,  0.0,
        0.0,  Math.cos(this.rotation.x),  Math.sin(this.rotation.x),  0.0,
        0.0,  -Math.sin(this.rotation.x),  Math.cos(this.rotation.x),  0.0,
        0.0,  0.0,  0.0,  1.0
    ]);

    var yRotation = new Float32Array([
        Math.cos(this.rotation.y),  0.0,  -Math.sin(this.rotation.y),  0.0,
        0.0,  1.0,  0.0,  0.0,
        Math.sin(this.rotation.y),  0.0,  Math.cos(this.rotation.y),  0.0,
        0.0,  0.0,  0.0,  1.0
    ]);

    var zRotation = new Float32Array([
        Math.cos(this.rotation.z),  Math.sin(this.rotation.z),  0.0,  0.0,
        -Math.sin(this.rotation.z),  Math.cos(this.rotation.z),  0.0,  0.0,
        0.0,  0.0,  1.0,  0.0,
        0.0,  0.0,  0.0,  1.0
    ]);



    // here we will silently set our scale based on the canvas size and the plane inner size
    var relativeScale = {
        x: this.scale.x * ((this.wrapper.glCanvas.width / this.wrapper.glCanvas.height) * this.geometry.innerScale.x / 2),
        y: this.scale.y * this.geometry.innerScale.y / 2,
    };

    var scale = new Float32Array([
        relativeScale.x,  0.0,  0.0,  0.0,
        0.0,  relativeScale.y,  0.0,  0.0,
        0.0,  0.0,  1.0,  0.0,
        0.0,  0.0,  0.0,  1.0
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

    return nextMVMatrix;
}


/*** PLANE SIZES AND TEXTURES HANDLING ***/


/***
 Handles each plane resizing
 used internally when our container is resized
 ***/
Plane.prototype.planeResize = function() {
    // canvas aspect ratio
    var wrapperAspectRatio = this.wrapper.glCanvas.width / this.wrapper.glCanvas.height;

    // reset perspective
    this.matrix.pMatrix = this._setPerspectiveMatrix(this.fov, 0.1, this.fov * 2);

    // our plane width and height
    var planeElementBoundingRect = this.htmlElement.getBoundingClientRect();
    var planeWidth = planeElementBoundingRect.width * this.wrapper.pixelRatio;
    var planeHeight = planeElementBoundingRect.height * this.wrapper.pixelRatio;

    // if div is not in the DOM anymore, probably because there's been a ajax call in between
    // we loop through the DOM looking if they are back
    // if not, we just don't resize
    // if yes, we reset the plane htmlElement
    if(!planeWidth && !planeHeight) {
        var potentialPlanes = document.getElementsByClassName(this.htmlElement.className);
        if(potentialPlanes.length > 0) {
            for(var i = 0; i < potentialPlanes.length; i++) {
                if(potentialPlanes[i].isEqualNode(this.htmlElement)) {
                    this.htmlElement = potentialPlanes[i];
                    var planeBoundingRect = this.htmlElement.getBoundingClientRect();

                    planeWidth = planeBoundingRect.width * this.wrapper.pixelRatio;
                    planeHeight = planeBoundingRect.height * this.wrapper.pixelRatio;
                }
            }
        }
    }

    // resize plane only if it is in the DOM
    if(planeWidth && planeHeight) {

        var shouldResizeTextures = false;
        if(planeWidth !== this.size.width || planeHeight !== this.size.height) {
            shouldResizeTextures = true;
        }

        this.size = {
            width: planeWidth,
            height: planeHeight,
        }

        this.offset = {
            top: planeElementBoundingRect.top,
            left: planeElementBoundingRect.left,
        }

        // reset plane inner scale (ie its size relative to its container)
        this.geometry.innerScale = {
            x: planeWidth / this.wrapper.glCanvas.width,
            y: planeHeight / this.wrapper.glCanvas.height
        };

        // reset plane clip space
        this.clipSpace = {
            x:  ((this.geometry.innerScale.x - 1) * (wrapperAspectRatio / 2)) / this.scale.x,
            y: ((1 - this.geometry.innerScale.y) / 2) / this.scale.y,
            width: wrapperAspectRatio,
            height: 2,
        }

        if(this.mimicCSS) {
            this._applyCSSPositions();
        }
        else {
            this.setTranslation(this.translation.x, this.translation.y, this.translation.z);
        }

        // resize all textures only if plane size has changed
        if(shouldResizeTextures) {
            for(var i = 0; i < this.textures.length; i++) {
                // second parameter is set to false : we don't need to bind the texture that doesn't have imageCover again
                this._adjustTextureSize(i, false);
            }
        }
    }
}




/*** IMAGES, VIDEOS AND CANVASES LOADING ***/

/***
 This method handles the image loading process
 uses an interval to check if we have loaded all the images
 Once everything is loaded we have to reorder them inside an array since they are not necesserally loaded in order

 params :
 @imagesArray (array) : array of html image elements
 ***/
Plane.prototype.loadImages = function(imagesArray) {
    var image;
    var self = this;

    // reset our loading flag
    this.imagesLoaded = false;

    for(var i = 0; i < imagesArray.length; i++) {

        image = new Image();
        image.onload = function() {
            self.images.push(this);

            // fire callback during load (useful for a loader)
            if(self.onPlaneLoadingCallback) {

                self.onPlaneLoadingCallback();
            }
        }

        image.crossOrigin = self.crossOrigin;
        image.sampler = imagesArray[i].getAttribute("data-sampler") || null;
        image.src = imagesArray[i].src;

        image.shouldUpdate = true;
    }

    // we need to be sure that we have loaded all the images
    var waitForImagesInterval = setInterval(function() {
        if(self.images.length == imagesArray.length) {
            clearInterval(waitForImagesInterval);
            // if there's more than 1 image we need to reorder our images array
            if(imagesArray.length > 1) {
                self._reorderImages(imagesArray);
            }
            else {
                self._createTextures("image");
            }
        }
    }, 100);

    return this;
}



/***
 Once all of our images are loaded we need to reorder them based on the original array,
 as javascript does not always load images in the order they are passed
 After they are reordered we can create the textures

 params :
 @originalArray (array) : array of html image elements
 ***/
Plane.prototype._reorderImages = function(originalArray) {

    var orderedImages = [];

    for(var i = 0; i < originalArray.length; i++) {
        for(var j = 0; j < this.images.length; j++) {
            if(this.images[j].src == originalArray[i].src) {
                orderedImages[i] = this.images[j];
            }
        }
    }

    this.images = orderedImages;

    this._createTextures("image");
}



/***
 This method handles the video loading process
 uses an interval to check if we have loaded all the videos

 params :
 @videosArray (array) : array of html video elements
 ***/
Plane.prototype.loadVideos = function(videosArray) {
    var video;
    var self = this;

    // reset our loading flag
    this.videosLoaded = false;

    var glContext = this.wrapper.glContext;

    function initVideo(plane, index) {
        video = document.createElement('video');

        video.preload = true;
        video.muted = true;
        video.loop = true;

        // here we set the video dimensions arbitrary to power of 2 to help improve performance
        video.width = 512;
        video.height = 512;

        video.sampler = videosArray[index].getAttribute("data-sampler") || null;

        video.crossOrigin = self.crossOrigin;

        // our video has not yet started for the first time
        video.firstStarted = false;
        var startedPlaying = false;
        var timeUpdating = false;

        // at first we don't want to update frames since there's nothing to show
        video.frameUpdate = false;

        // a boolean if we want to stop updating our texture (if the plane is hidden for example)
        video.shouldUpdate = true;

        var isReadyInterval;

        function startVideoUploading(video) {
            video.firstStarted = true;

            // if our update interval has not been started yet, we're launching it
            // our 33ms interval should cover videos up to 30FPS
            if(!video.updateInterval) {
                video.updateInterval = setInterval(function() {
                    // we should draw a new frame
                    video.frameUpdate = true;

                    // now that we can play the video, flip Y the texture
                    glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, true);
                }, 33);
            }
        }

        function isVideoReady(video) {
            if(startedPlaying && timeUpdating && !video.firstStarted) {
                // be sure we have enough data to upload our video texture
                isReadyInterval = setInterval(function() {
                    if(video.readyState >= video.HAVE_CURRENT_DATA) {
                        clearInterval(isReadyInterval);
                        startVideoUploading(video);
                    }
                }, 10);
            }
        }

        video.addEventListener("timeupdate", function() {
            timeUpdating = true;
            isVideoReady(this);
        });

        video.addEventListener("play", function() {
            startedPlaying = true;
            isVideoReady(this);
        });

        // handle only one src
        if(videosArray[index].src) {
            video.src = videosArray[index].src;
            video.type = videosArray[index].type;
        }
        else if(videosArray[index].getElementsByTagName('source').length > 0) {
            // handle multiple sources
            for(var j = 0; j < videosArray[index].getElementsByTagName('source').length; j++) {
                var source = document.createElement("source");
                source.setAttribute("src", videosArray[index].getElementsByTagName('source')[j].src);
                source.setAttribute("type", videosArray[index].getElementsByTagName('source')[j].type);
                video.appendChild(source);
            }
        }

        plane.videos.push(video);

        // fire callback during load (useful for a loader)
        if(plane.onPlaneLoadingCallback) {

            plane.onPlaneLoadingCallback();
        }
    }

    for(var i = 0; i < videosArray.length; i++) {
        initVideo(this, i);
    }

    // we need to be sure that we have loaded all the images
    var waitForVideosInterval = setInterval(function() {
        if(self.videos.length == videosArray.length) {
            clearInterval(waitForVideosInterval);
            // create our videos textures
            self._createTextures("video");
        }
    }, 100);

    return this;
}


/***
 This has to be called in order to play the planes videos
 We need this because on mobile devices we can't start playing a video without a user action
 ***/
Plane.prototype.playVideos = function() {
    for(var i = 0; i < this.textures.length; i++) {
        if(this.textures[i].type == "video") {
            var playPromise = this.videos[this.textures[i].typeIndex].play();

            // In browsers that don’t yet support this functionality,
            // playPromise won’t be defined.
            var texture = this.textures[i];
            var self = this;
            if (playPromise !== undefined) {
                playPromise.catch(function(error) {
                    if(!self.wrapper.productionMode) console.warn("Could not play the video : ", error);
                });
            }
        }
    }
}




/***
 This method handles the canvas loading process
 uses an interval to check if we have loaded all the canvases

 params :
 @canvasArray (array) : array of html canvas elements
 ***/
Plane.prototype.loadCanvases = function(canvasesArray) {
    var canvas;
    var self = this;

    // reset our loading flag
    this.canvasesLoaded = false;

    for(var i = 0; i < canvasesArray.length; i++) {

        canvas = canvasesArray[i];

        canvas.sampler = canvasesArray[i].getAttribute("data-sampler") || null;

        canvas.shouldUpdate = true;

        this.canvases.push(canvas);

        // fire callback during load (useful for a loader)
        if(this.onPlaneLoadingCallback) {

            this.onPlaneLoadingCallback();
        }
    }

    // we need to be sure that we have loaded all the images
    var waitForVideosInterval = setInterval(function() {
        if(self.canvases.length == canvasesArray.length) {
            clearInterval(waitForVideosInterval);
            // create our canvas textures
            // the name "canvase" is a bit hacky but is due to its plural form
            self._createTextures("canvase");
        }
    }, 100);

    return this;
}


/*** HANDLING TEXTURES ***/

/***
 Loop through our loaded images array and create a webgl texture for each ones
 If we have specified a afterInit callback it is then run (used to set up plae uniforms and buffers)
 Else it will set up a basic plane (without uniforms)
 ***/
Plane.prototype._createTextures = function(textureType) {

    this.wrapper._isInitialized();

    function createTexture(plane, textureType, index) {

        var glContext = plane.wrapper.glContext;

        // Create a texture object that will contain the image.
        var texture = {};

        texture.type = textureType;
        texture.typeIndex = index;
        texture.sampler = plane[textureType + "s"][index].sampler || null;

        texture.glTexture = glContext.createTexture();

        if(texture.type != "video") {
            glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, true);
        }

        // Bind the texture the target (TEXTURE_2D) of the active texture unit.
        glContext.bindTexture(glContext.TEXTURE_2D, texture.glTexture);

        // Set the parameters so we can render any size image.
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.LINEAR);
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.LINEAR);


        texture.index = plane.wrapper.loadingManager.texturesLoaded;

        plane.textures.push(texture);
        plane.wrapper.loadingManager.texturesLoaded++;
    }

    for(var i = 0; i < this[textureType + "s"].length; i++) {
        createTexture(this, textureType, i);
    }

    this[textureType + "sLoaded"] = true;

    // when everything is loaded set the plane definition (ie vertices & uvs)
    if(this.imagesLoaded && this.videosLoaded && this.canvasesLoaded && this.wrapper.glContext.getProgramParameter(this.program, this.wrapper.glContext.LINK_STATUS)) {
        this._setPlaneDefinition(this.definition.width, this.definition.height);
    }
}



/***
 This is used to set the WebGL context active texture and bind it

 params :
 @texture (texture object) : Our texture object containing our WebGL texture and its index
 ***/
Plane.prototype._bindPlaneTexture = function(texture) {
    var glContext = this.wrapper.glContext;
    // tell WebGL we want to affect the texture at the plane's index unit
    glContext.activeTexture(glContext.TEXTURE0 + texture.index);
    // bind the texture to the plane's index unit
    glContext.bindTexture(glContext.TEXTURE_2D, texture.glTexture);
}


/***
 This is used to resize one of the texture inside a plane images array
 Called internally inside a loop to resize all textures at once

 params :
 @index (integer) : index of the texture to adjust
 @shouldBindTexture (integer) : if we should bind the texture (always true on initialization and if imageCover is set to true)
 ***/
Plane.prototype._adjustTextureSize = function(index, shouldBindTexture) {
    this.wrapper._isInitialized();

    // we will only resize image textures here because videos textures are created directly in the draw loop
    if(this.textures[index].type == "image") {
        // we resize and reposition the image
        // we write it at the right size and position in a canvas and then use that canvas as a texture
        var image = this.images[this.textures[index].typeIndex];

        var glContext = this.wrapper.glContext;

        if(this.imageCover && image.shouldUpdate) {
            // we are going to draw the image inside a canvas, centered and cropped to act like a background cover
            var drawCanvas = document.createElement("canvas");
            var drawCtx = drawCanvas.getContext("2d");

            drawCanvas.width  = this.size.width * this.scale.x;
            drawCanvas.height = this.size.height * this.scale.y;

            var imgWidth = image.width;
            var imgHeight = image.height;

            var imgRatio = imgWidth / imgHeight;
            var canvasRatio = drawCanvas.width / drawCanvas.height;

            // center image in its container
            var imgXPos = 0;
            var imgYPos = 0;

            if(canvasRatio > imgRatio) { // means canvas is larger
                imgYPos = Math.min(0, (drawCanvas.height - (drawCanvas.width * (1 / imgRatio))) / 2);
            }
            else if(canvasRatio < imgRatio) { // means canvas is taller
                imgXPos = Math.min(0, (drawCanvas.width - (drawCanvas.height * imgRatio)) / 2);
            }

            // we will use Math.round() to boost performance
            drawCtx.drawImage(image, 0, 0, imgWidth, imgHeight, imgXPos, Math.round(imgYPos), Math.round(drawCanvas.width - (imgXPos * 2)), Math.round(drawCanvas.height - (imgYPos * 2)));

            glContext.useProgram(this.program);

            // bind the texture
            this._bindPlaneTexture(this.textures[index]);

            glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, drawCanvas);

        }
        else if(shouldBindTexture) {

            glContext.useProgram(this.program);

            // bind the texture
            this._bindPlaneTexture(this.textures[index]);

            glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, image);

        }
    }

}


/*** DRAW THE PLANE ***/

/***
 We draw the plane, ie bind the buffers, set the active textures and draw it

 params :
 @shouldBindBuffers (bool) : defines if we should rebind the buffers or not
 ***/
Plane.prototype._drawPlane = function(shouldBindBuffers) {
    var glContext = this.wrapper.glContext;

    // check if everything is ready (because of asynchronous creation and loading)
    if(this.canDraw) {

        // execute our plane onRender callback
        if(this.onRenderCallback) {
            this.onRenderCallback();
        }

        function drawTexture(glContext, plane, index) {
            var texture = plane.textures[index];

            // bind the texture
            plane._bindPlaneTexture(texture);

            // if our texture is a video we need to redraw it each time the frame has changed
            if(texture.type == "video") {
                if(plane.videos[texture.typeIndex].firstStarted) {
                    if(plane.videos[texture.typeIndex].frameUpdate && plane.videos[texture.typeIndex].shouldUpdate) {
                        // if our flag is set to true we draw the next frame
                        glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, plane.videos[texture.typeIndex]);

                        // reset our flag until next setInterval loop
                        plane.videos[texture.typeIndex].frameUpdate = false;
                    }
                }
                else {
                    // cancel flip Y because the texture is non DOM element
                    glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, false);
                    // if the video has not yet started for the first time (ie there's nothing to show) we just draw a black plane
                    glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, 1, 1, 0, glContext.RGBA, glContext.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
                }
            }
            else if(texture.type == "canvase" && plane.canvases[texture.typeIndex].shouldUpdate) {
                glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, plane.canvases[texture.typeIndex]);
            }
        }

        // reset active textures so they won't be mixed up
        for(var i = 0; i < this.textures.length; i++) {
            drawTexture(glContext, this, i);
        }


        // update all uniforms set up by the user
        this._updateUniforms();

        // bind buffers
        if(shouldBindBuffers) {
            this._bindPlaneBuffers();
        }


        glContext.uniformMatrix4fv(this.matrix.pMatrixUniform, false, this.matrix.pMatrix);
        glContext.uniformMatrix4fv(this.matrix.mvMatrixUniform, false, this.matrix.mvMatrix);

        // the draw call!
        glContext.drawArrays(glContext.TRIANGLES, 0, this.geometry.bufferInfos.numberOfItems);
    }

}