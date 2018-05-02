/***
    Little WebGL helper to apply images as textures of planes
    Author: Martin Laxenaire https://www.martin-laxenaire.fr/
    Version: 1.0

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
function Curtains(containerID) {

    this.planes = [];

    // set container
    var container = containerID || "canvas";
    this.container = document.getElementById(container);

    if(!this.container) {
        console.warn("You must specify a valid container ID");
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

    // reset webgl context so we won't lose other ones
    if(this.glContext) {
        this.glContext.getExtension('WEBGL_lose_context').loseContext();
        this.glContext = null;
    }
    this.glContext = this.glCanvas.getContext("webgl", { alpha: true }) || this.glCanvas.getContext("experimental-webgl");

    // set our canvas sizes
    this.glCanvas.width = this.container.clientWidth;
    this.glCanvas.height = this.container.clientHeight;

    // set our context viewport
    this.glContext.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);

    // we can start rendering now
    this._readyToDraw();
};


/*** INIT CHECK ***/

/***
Used internally to check if our canvas and context have been created
***/
Curtains.prototype._isInitialized = function() {
    if(!this.glCanvas || !this.glContext) {
        console.warn("No WebGL canvas or context");
        return false;
    }
};

/***
Dispose everything
***/
Curtains.prototype.dispose = function() {
    window.cancelAnimationFrame(this.requestAnimationFrameID);

    if(this.glContext) {
        this.glContext.getExtension('WEBGL_lose_context').loseContext();
        this.glContext = null;
    }
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

    if(!planeHtmlElement || planeHtmlElement.length === 0) {
        console.warn("The html element you specified does not currently exists in the DOM");
        return false;
    }

    // init the plane
    var plane = this._createPlane(planeHtmlElement, params);

    // load images
    var imagesArray = [];
    for(var j = 0; j < plane.htmlElement.getElementsByTagName("img").length; j++) {
        imagesArray.push(plane.htmlElement.getElementsByTagName("img")[j]);
    }

    // load plane images
    if(imagesArray.length > 0) {
        plane.loadImages(imagesArray);
    }
    else { // there's no images, send a warning
        console.warn("This plane does not contain any image element. You may want to add some later with the loadImages method.");
    }

    // set plane uniforms
    if(!params.uniforms) {
        params.uniforms = {};
        console.warn("You are setting a plane without uniforms, you won't be able to interact with it. Please check your addPlane method for : ", plane.htmlElement);
    }
    plane._setUniforms(params.uniforms);

    return plane;
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
    this._isInitialized();

    var shader = this.glContext.createShader(shaderType);

    this.glContext.shaderSource(shader, shaderCode);
    this.glContext.compileShader(shader);

    if (!this.glContext.getShaderParameter(shader, this.glContext.COMPILE_STATUS)) {
        console.log("Errors occurred while compiling the shader:\n" + this.glContext.getShaderInfoLog(shader));
        this.container.classList.add('no-webgl-curtains');
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
    if(this.glCanvas.width !== Math.floor(this.container.clientWidth) || this.glCanvas.height !== Math.floor(this.container.clientHeight)) {

        this.glCanvas.width  = Math.floor(this.container.clientWidth);
        this.glCanvas.height = Math.floor(this.container.clientHeight);

        this.glContext.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);

        // resize the planes only if they are fully initiated
        for(var i = 0; i < this.planes.length; i++) {
            if(this.planes[i].canDraw) {
                this.planes[i].planeResize();
            }
        }
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

    this.glContext.enable(this.glContext.DEPTH_TEST);
    // allows transparency
    this.glContext.blendFunc(this.glContext.SRC_ALPHA, this.glContext.ONE_MINUS_SRC_ALPHA);
    this.glContext.enable(this.glContext.BLEND);

    console.log("curtains.js - v1.0");

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
    this._isInitialized();

    // Clear the color buffer,
    this.glContext.clearColor(0.0, 0.0, 0.0, 0.0);
    this.glContext.clearDepth(1.0);
    //this.glContext.clear(this.glContext.COLOR_BUFFER_BIT | this.glContext.DEPTH_BUFFER_BIT);

    this._reSize();

    // loop on our planes
    for(var i = 0; i < this.planes.length; i++) {
        var plane = this.planes[i];

        // check if we are using the correct webgl program and if everything is ready (because of asynchronous)
        if(this.glContext.isProgram(plane.program) && plane.canDraw) {

            this.glContext.useProgram(plane.program);

            // execute our plane onRender callback
            if(plane.onRenderCallback) {
                plane.onRenderCallback();
            }

            // reset active textures so they won't be mixed up
            for(var j = 0; j < plane.textures.length; j++) {
                this.glContext.activeTexture(this.glContext.TEXTURE0 + plane.textures[j].index);
                // bind the texture to the plane's index unit
                this.glContext.bindTexture(this.glContext.TEXTURE_2D, plane.textures[j]);
            }


            // update all uniforms set up by user
            plane._updateUniforms();

            // bind buffers
            plane._bindPlaneBuffers();

            this.glContext.uniformMatrix4fv(plane.matrix.pMatrixUniform, false, plane.matrix.pMatrix);
            this.glContext.uniformMatrix4fv(plane.matrix.mvMatrixUniform, false, plane.matrix.mvMatrix);

            // the draw call!
            this.glContext.drawArrays(this.glContext.TRIANGLES, 0, plane.geometry.verticesBuffer.numberOfItems);
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

    this.crossOrigin = params.crossOrigin,

    // set default fov
    this.fov = params.fov || 75;


    var vsId = params.vertexShaderID || plane.getAttribute("data-vs-id");
    var fsId = params.fragmentShaderID || plane.getAttribute("data-fs-id");

    if(!vsId || !fsId) {
        console.warn("No vertex or fragment shaders ID provided");
        return false;
    }

    var glContext = this.wrapper.glContext;

    // create shader program
    this.program = glContext.createProgram();

    this.shaders = {};

    this.shaders.vertexShaderCode = document.getElementById(vsId).innerHTML;
    this.shaders.fragmentShaderCode = document.getElementById(fsId).innerHTML;

    // Create shaders,
    this.shaders.vertexShader = this.wrapper._createShader(this.shaders.vertexShaderCode, glContext.VERTEX_SHADER);
    this.shaders.fragmentShader = this.wrapper._createShader(this.shaders.fragmentShaderCode, glContext.FRAGMENT_SHADER);

    if(!this.shaders.vertexShader || !this.shaders.fragmentShader) {
        console.warn("Unable to find the vertex or fragment shader");
        this.wrapper.container.classList.add('no-webgl-curtains');
        return false;
    }


    glContext.attachShader(this.program, this.shaders.vertexShader);
    glContext.attachShader(this.program, this.shaders.fragmentShader);
    glContext.linkProgram(this.program);

    // Check the shader program creation status,
    if (!glContext.getProgramParameter(this.program, glContext.LINK_STATUS)) {
       console.warn("Unable to initialize the shader program.");
       this.wrapper.container.classList.add('no-webgl-curtains');
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

     // set up scale
     this.scale = {
         x: 1,
         y: 1
     }

     // matrix uniforms
     this.matrix.pMatrixUniform = glContext.getUniformLocation(this.program, "uPMatrix");
     this.matrix.mvMatrixUniform = glContext.getUniformLocation(this.program, "uMVMatrix");


     // set default attributes
     var defaultAttributes = {
         vertexPosition: "aVertexPosition",
         textureCoord: "aTextureCoord",
     }

     this._setAttributes(defaultAttributes);

     return this;
}


/***
Used internally to check if the plane shader program has been created
***/
Plane.prototype._isProgramInitialized = function() {
    if(!this.program) {
        console.warn("No WebGL program for this plane");
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
This is called when all plane textures have been loaded. Used to set plane's definition (ie width and height segments)
TODO really needed ??!

params :
    @callback (function) : a function to execute
***/
Plane.prototype.planeTexturesLoaded = function(callback) {
    if(callback) {
        this._texturesLoadedCallback = callback;
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
        if(this.images[i].sampler) {
            var samplerUniform = this.images[i].sampler;
            this.uniforms[samplerUniform] = {};
            this.uniforms[samplerUniform].location = glContext.getUniformLocation(this.program, samplerUniform);
            this.uniforms[samplerUniform].coreUniform = true;

            // Indiquer au shader que nous avons lié la texture à l'unité de texture 0
            glContext.uniform1i(this.uniforms[samplerUniform].location, this.textures[i].index);
        }
        else {
            this.uniforms["sampler" + this.textures[i].index] = {};
            // inside the shaders, the samplers will be named "uSampler" + index of the image inside the plane
            this.uniforms["sampler" + this.textures[i].index].location = glContext.getUniformLocation(this.program, "uSampler" + i);
            this.uniforms["sampler" + this.textures[i].index].coreUniform = true;

            // Indiquer au shader que nous avons lié la texture à l'unité de texture 0
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

    planeWidth = this.htmlElement.clientWidth || this.wrapper.glCanvas.width;
    planeHeight = this.htmlElement.clientHeight || this.wrapper.glCanvas.height;

    this.size = {
        width: planeWidth,
        height: planeHeight,
    }

    this.geometry = {};

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

    this.rotation = {
        x: 0,
        y: 0,
        z: 0,
    }

    this.relativeTranslation = {
        x: 0,
        y: 0,
    }

    // we translate our plane from 0 to -this.fov / 2 on the Z axis
    // this is the value that makes the plane fit our canvas based on our projection matrix
    if(this.mimicCSS) {
        this._applyCSSPositions();
    }
    else {
        this.setTranslation(0, 0, 0);
    }


    // scale the texture now that we know all our sizes
    for(var i = 0; i < this.textures.length; i++) {
        // adjust size
        this._adjustTextureSize(i);
    }

    var returnedVertices = this._setPlaneVertices(widthSegments, heightSegments);

    var glContext = this.wrapper.glContext;

    // first the plane vertices
    this.geometry.vertices = returnedVertices.vertices;

    this.geometry.verticesBuffer = glContext.createBuffer();
    glContext.bindBuffer(glContext.ARRAY_BUFFER, this.geometry.verticesBuffer);

    glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(this.geometry.vertices), glContext.STATIC_DRAW);

    this.geometry.verticesBuffer.itemSize = 3;
    this.geometry.verticesBuffer.numberOfItems = this.geometry.vertices.length / this.geometry.verticesBuffer.itemSize;

    // now the texture UVs coordinates
    this.material = {};
    this.material.uvs = returnedVertices.uvs;

    this.material.texCoordBuffer = glContext.createBuffer();
    glContext.bindBuffer(glContext.ARRAY_BUFFER, this.material.texCoordBuffer);

    glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(this.material.uvs), glContext.STATIC_DRAW);

    this.material.texCoordBuffer.itemSize = 3;
    this.material.texCoordBuffer.numberOfItems = this.material.uvs.length / this.material.texCoordBuffer.itemSize;


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
    this.wrapper._isInitialized();

    this._isProgramInitialized();

    var glContext = this.wrapper.glContext;

    // Set the vertices buffer (I know it's already bound, but that's where it normally
   // belongs in the workflow),
   glContext.bindBuffer(glContext.ARRAY_BUFFER, this.geometry.verticesBuffer);
   // Set where the vertexPosition attribute gets its data,
   glContext.vertexAttribPointer(this.attributes.vertexPosition, this.geometry.verticesBuffer.itemSize, glContext.FLOAT, false, 0, 0);
   glContext.enableVertexAttribArray(this.attributes.vertexPosition);

   // Set where the texture coord attribute gets its data,
   glContext.bindBuffer(glContext.ARRAY_BUFFER, this.material.texCoordBuffer);
   glContext.vertexAttribPointer(this.attributes.textureCoord, this.material.texCoordBuffer.itemSize, glContext.FLOAT, false, 0, 0);
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

    else {
        console.log("This uniform type is not handled : ", uniformType);
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

    if(!this.uniforms) this.uniforms = {};




    var self = this;
    // set our uniforms if we got some
    if(uniforms) {
        Object.keys(uniforms).map(function(objectKey, index) {
            var uniform = uniforms[objectKey];

            // fill our uniform object
            self.uniforms[objectKey] = {
                location: self.wrapper.glContext.getUniformLocation(self.program, uniform.name),
                name: uniform.name,
                type: uniform.type,
                value: uniform.value,
                coreUniform: false,
            }

            // set the uniforms
            self._handleUniformSetting(uniform.type, self.uniforms[objectKey].location, uniform.value);
        });
    }
}


/***
This updates all uniforms of a plane that are not part of the core (ie set by user)
It is called at each draw call
***/
Plane.prototype._updateUniforms = function() {

    this.wrapper._isInitialized();

    this._isProgramInitialized();

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
        x: this.clipSpace.x + ((xPosition / this.wrapper.glCanvas.width) * this.clipSpace.width),
        y: this.clipSpace.y - (yPosition / this.wrapper.glCanvas.height)
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
    var planeOffset = this.htmlElement.getBoundingClientRect();
    var wrapperOffset = this.wrapper.container.getBoundingClientRect();

    var mousePosition = {
        x: ((((xMousePosition - wrapperOffset.left) - (planeOffset.left + window.pageXOffset)) / this.size.width) * 2) - 1,
        y: 1 - ((((yMousePosition - wrapperOffset.top) - (planeOffset.top + window.pageYOffset)) / this.size.height) * 2)
    }

    return mousePosition;
}


/***
This function takes the plane CSS positions and convert them to clip space coordinates, and then apply the corresponding translation
***/
Plane.prototype._applyCSSPositions = function() {
    var planeAspect = this.size.width / this.size.height;

    // plane position
    var cssPositions = {
        top: this.htmlElement.getBoundingClientRect().top - this.wrapper.container.getBoundingClientRect().top,
        left: this.htmlElement.getBoundingClientRect().left - this.wrapper.container.getBoundingClientRect().left,
    }

    // our position relative to the clip space
    var relativePosition = this._documentToPlaneSpace(cssPositions.left, cssPositions.top);

    this.relativeTranslation = {
        x: cssPositions.left,
        y: cssPositions.top
    };

    // set the translation
    this.setTranslation(relativePosition.x, relativePosition.y, 0);
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
     // first multiplyidentity matrix with translation
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
    var planeWidth = this.htmlElement.clientWidth;
    var planeHeight = this.htmlElement.clientHeight;

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

                    planeWidth = this.htmlElement.clientWidth;
                    planeHeight = this.htmlElement.clientHeight;
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
            for(var i = 0; i < this.images.length; i++) {
                this._adjustTextureSize(i);
            }
        }
    }
}




/*** IMAGES LOADING ***/

/***
This method handles the image loading process
uses an interval to check if we have loaded all the images
Once everything is loaded we have to reorder them inside an array since they are not necesserally loaded in order

params :
    @imagesArray (array) : array of html image element source
***/
Plane.prototype.loadImages = function(imagesArray) {
    var image;
    var self = this;

    for(var i = 0; i < imagesArray.length; i++) {

        image = new Image();
        image.onload = function() {
            self.images.push(this);

            // fire callback during load (useful for a loader)
            if(self.onPlaneLoadingCallback) {

                self.onPlaneLoadingCallback();
            }
        }

        if(self.crossOrigin !== null && self.crossOrigin !== undefined) {
            image.crossOrigin = self.crossOrigin;
        }
        image.sampler = imagesArray[i].getAttribute("data-sampler") || null;
        image.src = imagesArray[i].src;
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
                self._createTexturesFromImages();
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
    @originalArray (array) : array of html image element source
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

    this._createTexturesFromImages();
}


/*** HANDLING TEXTURES ***/

/***
Loop through our loaded images array and create a webgl texture for each ones
If we have specified a afterInit callback it is then run (used to set up plae uniforms and buffers)
Else it will set up a basic plane (without uniforms)
***/
Plane.prototype._createTexturesFromImages = function() {

    this.wrapper._isInitialized();

    var glContext = this.wrapper.glContext;

    for(var i = 0; i < this.images.length; i++) {
        // Create a texture object that will contain the image.
        var texture = glContext.createTexture();

        // Bind the texture the target (TEXTURE_2D) of the active texture unit.
        glContext.bindTexture(glContext.TEXTURE_2D, texture);

        // Flip the image's Y axis to match the WebGL texture coordinate space.
        glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, true);

        // Set the parameters so we can render any size image.
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.LINEAR);
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.LINEAR);


        texture.index = this.wrapper.loadingManager.texturesLoaded;

        this.textures.push(texture);
        this.wrapper.loadingManager.texturesLoaded++;
    }

    // set the plane definition (ie vertices & uvs)
    this._setPlaneDefinition(this.definition.width, this.definition.height);

    // fire the textures loaded callback
    if(this._texturesLoadedCallback) {
        this._texturesLoadedCallback();
    }
}



/***
This is used to resize one of the texture inside a plane images array
Called internally inside a loop to resize all textures at once

params :
    @index (integer) : index of the texture to adjust
***/
Plane.prototype._adjustTextureSize = function(index) {
    this.wrapper._isInitialized();

    var pixelRatio = window.devicePixelRatio || 1;

    // we resize and reposition the image
    // we write it at the right size and position in a canvas and then use that canvas as a texture
    var image = this.images[index];

    var glContext = this.wrapper.glContext;

    if(!this.imageCover) {
        glContext.useProgram(this.program);
        // tell WebGL we want to affect the texture at the plane's index unit
        glContext.activeTexture(glContext.TEXTURE0 + this.textures[index].index);
        // bind the texture to the plane's index unit
        glContext.bindTexture(glContext.TEXTURE_2D, this.textures[index]);

        glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, image);
    }
    else {
        var drawCanvas = document.createElement("canvas");
        var drawCtx = drawCanvas.getContext("2d");

        drawCanvas.width  = this.size.width;
        drawCanvas.height = this.size.height;

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

        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        drawCtx.drawImage( image, imgXPos, imgYPos, drawCanvas.width - (imgXPos * 2), drawCanvas.height - (imgYPos * 2));

        glContext.useProgram(this.program);
        // tell WebGL we want to affect the texture at the plane's index unit
        glContext.activeTexture(glContext.TEXTURE0 + this.textures[index].index);
        // bind the texture to the plane's index unit
        glContext.bindTexture(glContext.TEXTURE_2D, this.textures[index]);

        glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, drawCanvas);
    }
}
