function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = _getPrototypeOf(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

(function (global, factory) {
  (typeof exports === "undefined" ? "undefined" : _typeof(exports)) === 'object' && typeof module !== 'undefined' ? factory(exports) : typeof define === 'function' && define.amd ? define(['exports'], factory) : (global = global || self, factory(global.Curtains = {}));
})(this, function (exports) {
  'use strict';
  /***
   Throw a console warning with the passed arguments
   ***/

  var warningThrown = 0;

  function throwWarning() {
    if (warningThrown > 100) {
      return;
    } else if (warningThrown === 100) {
      console.warn("Curtains: too many warnings thrown, stop logging.");
    } else {
      var args = Array.prototype.slice.call(arguments);
      console.warn.apply(console, args);
    }

    warningThrown++;
  }
  /***
   Throw a console error with the passed arguments
   ***/


  function throwError() {
    var args = Array.prototype.slice.call(arguments);
    console.error.apply(console, args);
  }
  /***
   Generates an universal unique identifier
   ***/


  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0,
          v = c === 'x' ? r : r & 0x3 | 0x8;
      return v.toString(16).toUpperCase();
    });
  }
  /***
   Check whether a number is power of 2
     params:
   @value (float): number to check
   ***/


  function isPowerOf2(value) {
    return (value & value - 1) === 0;
  }
  /***
   Linear interpolation between two numbers
     params:
   @start (float): value to lerp
   @end (float): end value to use for lerp
   @amount (float): amount of lerp
   ***/


  function _lerp(start, end, amount) {
    return (1 - amount) * start + amount * end;
  }
  /***
   Here we create our Scene object
   The Scene will stack all the objects that will be drawn (planes and shader passes) in different arrays, and call them in the right order to be drawn.
     Based on the concept exposed here https://webglfundamentals.org/webgl/lessons/webgl-drawing-multiple-things.html
   The idea is to optimize the order of the rendered object so that the WebGL calls are kept to a strict minimum
     Planes will be placed in two groups: opaque (drawn first) and transparent (drawn last) objects
   We will also group them by their program IDs (planes that shares their programs are stacked together)
     params:
   @renderer (Renderer class object): our renderer class object
     returns :
   @this: our Scene
   ***/


  var Scene = /*#__PURE__*/function () {
    function Scene(renderer) {
      _classCallCheck(this, Scene);

      this.type = "Scene";

      if (!renderer || renderer.type !== "Renderer") {
        throwError(this.type + ": Renderer not passed as first argument", renderer);
      } else if (!renderer.gl) {
        throwError(this.type + ": Renderer WebGL context is undefined", renderer);
      }

      this.renderer = renderer;
      this.gl = renderer.gl;
      this.initStacks();
    }
    /***
     Init our Scene stacks object
     ***/


    _createClass(Scene, [{
      key: "initStacks",
      value: function initStacks() {
        this.stacks = {
          "opaque": {
            length: 0,
            programs: [],
            order: []
          },
          "transparent": {
            length: 0,
            programs: [],
            order: []
          },
          "renderPasses": [],
          "scenePasses": []
        };
      }
      /*** RESET STACKS ***/

      /***
       Reset the plane stacks (used when disposing a plane)
       ***/

    }, {
      key: "resetPlaneStacks",
      value: function resetPlaneStacks() {
        // clear the plane stacks
        this.stacks.opaque = {
          length: 0,
          programs: [],
          order: []
        };
        this.stacks.transparent = {
          length: 0,
          programs: [],
          order: []
        }; // rebuild them with the new plane indexes

        for (var i = 0; i < this.renderer.planes.length; i++) {
          this.addPlane(this.renderer.planes[i]);
        }
      }
      /***
       Reset the shader pass stacks (used when disposing a shader pass)
       ***/

    }, {
      key: "resetShaderPassStacks",
      value: function resetShaderPassStacks() {
        // now rebuild the drawStacks
        // start by clearing all drawstacks
        this.stacks.scenePasses = [];
        this.stacks.renderPasses = []; // restack our planes with new indexes

        for (var i = 0; i < this.renderer.shaderPasses.length; i++) {
          this.renderer.shaderPasses[i].index = i;

          if (this.renderer.shaderPasses[i]._isScenePass) {
            this.stacks.scenePasses.push(this.renderer.shaderPasses[i].index);
          } else {
            this.stacks.renderPasses.push(this.renderer.shaderPasses[i].index);
          }
        } // reset the scenePassIndex if needed


        if (this.stacks.scenePasses.length === 0) {
          this.renderer.state.scenePassIndex = null;
        }
      }
      /*** ADDING PLANES ***/

      /***
       Add a new entry to our opaque and transparent programs arrays
       ***/

    }, {
      key: "initProgramStack",
      value: function initProgramStack(programID) {
        this.stacks["opaque"]["programs"]["program-" + programID] = [];
        this.stacks["transparent"]["programs"]["program-" + programID] = [];
      }
      /***
       This function will stack planes by opaqueness/transparency, program ID and then indexes
       Stack order drawing process:
       - draw opaque then transparent planes
       - for each of those two stacks, iterate through the existing programs (following the "order" array) and draw their respective planes
       This is done to improve speed, notably when using shared programs, and reduce GL calls
         params:
       @plane (Plane object): plane to add to our scene
       ***/

    }, {
      key: "addPlane",
      value: function addPlane(plane) {
        if (!this.stacks["opaque"]["programs"]["program-" + plane._program.id]) {
          this.initProgramStack(plane._program.id);
        }

        var stackType = plane._transparent ? "transparent" : "opaque";
        var stack = this.stacks[stackType];

        if (stackType === "transparent") {
          stack["programs"]["program-" + plane._program.id].unshift(plane.index); // push to the order array only if it's not already in there


          if (!stack["order"].includes(plane._program.id)) {
            stack["order"].unshift(plane._program.id);
          }
        } else {
          stack["programs"]["program-" + plane._program.id].push(plane.index); // push to the order array only if it's not already in there


          if (!stack["order"].includes(plane._program.id)) {
            stack["order"].push(plane._program.id);
          }
        }

        stack.length++;
      }
      /***
       This function will remove a plane from our scene. This just reset the plane stacks for now.
       Useful if we'd want to change the way our draw stacks work and keep the logic separated from our renderer
         params:
       @plane (Plane object): plane to remove from our scene
       ***/

    }, {
      key: "removePlane",
      value: function removePlane(plane) {
        this.resetPlaneStacks();
      }
      /***
       Changing the position of a plane inside the correct plane stack to render it on top of the others
       ***/

    }, {
      key: "movePlaneToFront",
      value: function movePlaneToFront(plane) {
        var drawType = plane._transparent ? "transparent" : "opaque";
        var stack = this.stacks[drawType]["programs"]["program-" + plane._program.id];
        stack = stack.filter(function (index) {
          return index !== plane.index;
        });

        if (drawType === "transparent") {
          stack.unshift(plane.index);
        } else {
          stack.push(plane.index);
        }

        this.stacks[drawType]["programs"]["program-" + plane._program.id] = stack; // update order array

        this.stacks[drawType]["order"] = this.stacks[drawType]["order"].filter(function (programID) {
          return programID !== plane._program.id;
        });
        this.stacks[drawType]["order"].push(plane._program.id);
      }
      /*** ADDING POST PROCESSING ***/

      /***
       Add a shader pass to the stack
         params:
       @shaderPass (ShaderPass object): shaderPass to add to our scene
       ***/

    }, {
      key: "addShaderPass",
      value: function addShaderPass(shaderPass) {
        if (!shaderPass._isScenePass) {
          this.stacks.renderPasses.push(shaderPass.index);
        } else {
          this.stacks.scenePasses.push(shaderPass.index);
        }
      }
      /***
       This function will remove a shader pass from our scene. This just reset the shaderPass stacks for now.
       Useful if we'd want to change the way our draw stacks work and keep the logic separated from our renderer
         params:
       @shaderPass (ShaderPass object): shader pass to remove from our scene
       ***/

    }, {
      key: "removeShaderPass",
      value: function removeShaderPass(shaderPass) {
        this.resetShaderPassStacks();
      }
      /*** DRAWING SCENE ***/

      /***
       Loop through one of our stack (opaque or transparent objects) and draw its planes
       ***/

    }, {
      key: "drawStack",
      value: function drawStack(stackType) {
        for (var i = 0; i < this.stacks[stackType]["order"].length; i++) {
          var programID = this.stacks[stackType]["order"][i];
          var program = this.stacks[stackType]["programs"]["program-" + programID];

          for (var j = 0; j < program.length; j++) {
            var plane = this.renderer.planes[program[j]]; // be sure the plane exists

            if (plane) {
              // draw the plane
              plane._startDrawing();
            }
          }
        }
      }
      /***
       Enable the first Shader pass scene pass
       ***/

    }, {
      key: "enableShaderPass",
      value: function enableShaderPass() {
        if (this.stacks.scenePasses.length && this.stacks.renderPasses.length === 0 && this.renderer.planes.length) {
          this.renderer.state.scenePassIndex = 0;
          this.renderer.bindFrameBuffer(this.renderer.shaderPasses[this.stacks.scenePasses[0]].target);
        }
      }
      /***
       Draw the shader passes
       ***/

    }, {
      key: "drawShaderPasses",
      value: function drawShaderPasses() {
        // if we got one or multiple scene passes after the render passes, bind the first scene pass here
        if (this.stacks.scenePasses.length && this.stacks.renderPasses.length && this.renderer.planes.length) {
          this.renderer.state.scenePassIndex = 0;
          this.renderer.bindFrameBuffer(this.renderer.shaderPasses[this.stacks.scenePasses[0]].target);
        } // first the render passes


        for (var i = 0; i < this.stacks.renderPasses.length; i++) {
          this.renderer.shaderPasses[this.stacks.renderPasses[i]]._startDrawing();
        } // then the scene passes


        if (this.stacks.scenePasses.length > 0) {
          for (var _i = 0; _i < this.stacks.scenePasses.length; _i++) {
            this.renderer.shaderPasses[this.stacks.scenePasses[_i]]._startDrawing();
          }
        }
      }
      /***
       Draw our scene content
       ***/

    }, {
      key: "draw",
      value: function draw() {
        // enable first frame buffer for shader passes if needed
        this.enableShaderPass(); // loop on our stacked planes

        this.drawStack("opaque"); // draw transparent planes if needed

        if (this.stacks["transparent"].length) {
          // clear our depth buffer to display transparent objects
          this.gl.clearDepth(1.0);
          this.gl.clear(this.gl.DEPTH_BUFFER_BIT);
          this.drawStack("transparent");
        } // now render the shader passes


        this.drawShaderPasses();
      }
    }]);

    return Scene;
  }();
  /***
   Here we create a CacheManager class object
   This will store geometries attributes arrays, textures and WebGL programs in arrays
   This helps speed up slow synchronous CPU operations such as WebGL shaders compilations, images decoding, etc.
     returns :
   @this: our CacheManager class object
   ***/


  var CacheManager = /*#__PURE__*/function () {
    function CacheManager() {
      _classCallCheck(this, CacheManager);

      // never clear cached geometries
      this.geometries = [];
      this.clear();
    }
    /***
     Clear WebGL context depending cache arrays (used on init and context restoration)
     ***/


    _createClass(CacheManager, [{
      key: "clear",
      value: function clear() {
        // only cache images textures for now
        this.textures = []; // cached programs

        this.programs = [];
      }
      /*** GEOMETRIES ***/

      /***
       Check if this geometry is already in our cached geometries array
         params:
       @definitionID (integer): the geometry ID
       ***/

    }, {
      key: "getGeometryFromID",
      value: function getGeometryFromID(definitionID) {
        return this.geometries.find(function (element) {
          return element.id === definitionID;
        });
      }
      /***
       Add a geometry to our cache if not already in it
         params:
       @definitionID  (integer): the geometry ID to add to our cache
       @vertices (array): vertices coordinates array to add to our cache
       @uvs (array): uvs coordinates array to add to our cache
       ***/

    }, {
      key: "addGeometry",
      value: function addGeometry(definitionID, vertices, uvs) {
        this.geometries.push({
          id: definitionID,
          vertices: vertices,
          uvs: uvs
        });
      }
      /*** PROGRAMS ***/

      /***
       Compare two shaders strings to detect whether they are equal or not
         params:
       @firstShader (string): shader code
       @secondShader (string): shader code
         returns:
       @isSameShader (bool): whether both shaders are equal or not
       ***/

    }, {
      key: "isSameShader",
      value: function isSameShader(firstShader, secondShader) {
        return firstShader.localeCompare(secondShader) === 0;
      }
      /***
       Returns a program from our cache if this program's vertex and fragment shaders code are the same as the one provided
         params:
       @vsCode (string): vertex shader code
       @fsCode (string): fragment shader code
         returns:
       @program (Program class object or null): our program if it has been found
       ***/

    }, {
      key: "getProgramFromShaders",
      value: function getProgramFromShaders(vsCode, fsCode) {
        var _this = this;

        return this.programs.find(function (element) {
          return _this.isSameShader(element.vsCode, vsCode) && _this.isSameShader(element.fsCode, fsCode);
        });
      }
      /***
       Add a program to our cache
         params :
       @program (Program class object) : program to add to our cache
       ***/

    }, {
      key: "addProgram",
      value: function addProgram(program) {
        this.programs.push(program);
      }
      /*** TEXTURES ***/

      /***
       Check if this source is already in our cached textures array
         params :
       @source (HTML element) : html image, video or canvas element (only images for now)
       ***/

    }, {
      key: "getTextureFromSource",
      value: function getTextureFromSource(source) {
        // return the texture if the source is the same and if it's not the same texture
        return this.textures.find(function (element) {
          return element.source && element.source.src === source.src && element.uuid !== element.uuid;
        });
      }
      /***
       Add a texture to our cache if not already in it
         params :
       @texture (Texture class object) : texture to add to our cache
       ***/

    }, {
      key: "addTexture",
      value: function addTexture(texture) {
        var cachedTexture = this.getTextureFromSource(texture.source);

        if (!cachedTexture) {
          this.textures.push(texture);
        }
      }
      /***
       Removes a texture from the cache array
         params :
       @texture (Texture class object) : texture to remove from our cache
       ***/

    }, {
      key: "removeTexture",
      value: function removeTexture(texture) {
        // remove from our textures array
        this.textures = this.textures.filter(function (element) {
          return element.uuid !== texture.uuid;
        });
      }
    }]);

    return CacheManager;
  }();
  /***
   Here we create a CallbackQueueManager class object
   This allows to store callbacks in a queue array with a timeout of 0 to be executed on next render call
     returns:
   @this: our CallbackQueueManager class object
   ***/


  var CallbackQueueManager = /*#__PURE__*/function () {
    function CallbackQueueManager() {
      _classCallCheck(this, CallbackQueueManager);

      this.clear();
    }
    /***
     Clears our queue array (used on init)
     ***/


    _createClass(CallbackQueueManager, [{
      key: "clear",
      value: function clear() {
        this.queue = [];
      }
      /***
       Adds a callback to our queue list with a timeout of 0
         params:
       @callback (function): the callback to execute on next render call
       @keep (bool): whether to keep calling that callback on each rendering call or not (act as a setInterval). Default to false
         returns:
       @queueItem: the queue item. Allows to keep a track of it and set its keep property to false when needed
       ***/

    }, {
      key: "add",
      value: function add(callback) {
        var _this2 = this;

        var keep = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        var queueItem = {
          callback: callback,
          keep: keep,
          timeout: null // keep a reference to the timeout so we can safely delete if afterwards

        };
        queueItem.timeout = setTimeout(function () {
          _this2.queue.push(queueItem);
        }, 0);
        return queueItem;
      }
      /***
       Executes all callbacks in the queue and remove the ones that have their keep property set to false.
       Called at the beginning of each render call
       ***/

    }, {
      key: "execute",
      value: function execute() {
        var _this3 = this;

        // execute queue callbacks list
        this.queue.map(function (entry) {
          if (entry.callback) {
            entry.callback();
          } // clear our timeout


          clearTimeout(_this3.queue.timeout);
        }); // remove all items that have their keep property set to false

        this.queue = this.queue.filter(function (entry) {
          return entry.keep;
        });
      }
    }]);

    return CallbackQueueManager;
  }();
  /***
   Here we create our Renderer object
   It will create our WebGL context and handle everything that relates to it
   Will create a container, append a canvas, handle WebGL extensions, context lost/restoration events
   Will create a Scene class object that will keep tracks of all added objects
   Will also handle all global WebGL commands, like clearing scene, binding frame buffers, setting depth, blend func, etc.
   Will use a state object to handle all those commands and keep a track of what is being drawned to avoid redundant WebGL calls.
     params:
   @Curtainsparams see Curtains class object
     @onError (function): called when there has been an error while initiating the WebGL context
   @onContextLost (function): called when the WebGL context is lost
   @onContextRestored (function): called when the WebGL context is restored
   @onSceneChange (function): called every time an object has been added/removed from the scene
     returns :
   @this: our Renderer
  ***/
  // TODO deprecate all add* objects method and get rid of imports. BIG breaking change!


  var Renderer = /*#__PURE__*/function () {
    function Renderer(_ref) {
      var alpha = _ref.alpha,
          antialias = _ref.antialias,
          premultipliedAlpha = _ref.premultipliedAlpha,
          depth = _ref.depth,
          failIfMajorPerformanceCaveat = _ref.failIfMajorPerformanceCaveat,
          preserveDrawingBuffer = _ref.preserveDrawingBuffer,
          stencil = _ref.stencil,
          container = _ref.container,
          pixelRatio = _ref.pixelRatio,
          renderingScale = _ref.renderingScale,
          production = _ref.production,
          onError = _ref.onError,
          onContextLost = _ref.onContextLost,
          onContextRestored = _ref.onContextRestored,
          onDisposed = _ref.onDisposed,
          onSceneChange = _ref.onSceneChange;

      _classCallCheck(this, Renderer);

      this.type = "Renderer"; // context attributes

      this.alpha = alpha;
      this.antialias = antialias;
      this.premultipliedAlpha = premultipliedAlpha;
      this.depth = depth;
      this.failIfMajorPerformanceCaveat = failIfMajorPerformanceCaveat;
      this.preserveDrawingBuffer = preserveDrawingBuffer;
      this.stencil = stencil;
      this.container = container;
      this.pixelRatio = pixelRatio;
      this._renderingScale = renderingScale;
      this.production = production; // callbacks

      this.onError = onError;
      this.onContextLost = onContextLost;
      this.onContextRestored = onContextRestored;
      this.onDisposed = onDisposed; // keep sync between Curtains objects arrays and renderer objects arrays

      this.onSceneChange = onSceneChange; // managing our webgl draw states

      this.initState(); // create the canvas

      this.canvas = document.createElement("canvas"); // set our webgl context

      var glAttributes = {
        alpha: this.alpha,
        premultipliedAlpha: this.premultipliedAlpha,
        antialias: this.antialias,
        depth: this.depth,
        failIfMajorPerformanceCaveat: this.failIfMajorPerformanceCaveat,
        preserveDrawingBuffer: this.preserveDrawingBuffer,
        stencil: this.stencil
      }; // try webgl2 context first

      this.gl = this.canvas.getContext("webgl2", glAttributes);
      this._isWebGL2 = !!this.gl; // fallback to webgl1

      if (!this.gl) {
        this.gl = this.canvas.getContext("webgl", glAttributes) || this.canvas.getContext("experimental-webgl", glAttributes);
      } // WebGL context could not be created


      if (!this.gl) {
        if (!this.production) throwWarning(this.type + ": WebGL context could not be created");
        this.state.isActive = false;

        if (this.onError) {
          this.onError();
        }

        return;
      }

      this.initRenderer();
    }
    /***
     Set/reset our context state object
     ***/


    _createClass(Renderer, [{
      key: "initState",
      value: function initState() {
        this.state = {
          // if we are currently rendering
          isActive: true,
          isContextLost: true,
          drawingEnabled: true,
          forceRender: false,
          // current program ID
          currentProgramID: null,
          // if we're using depth test or not
          setDepth: null,
          // face culling
          cullFace: null,
          // current frame buffer ID
          frameBufferID: null,
          // current scene pass ID
          scenePassIndex: null,
          // textures
          activeTexture: null,
          unpackAlignment: null,
          flipY: null,
          premultiplyAlpha: null
        };
      }
      /***
       Add a callback queueing manager (execute functions on the next render call, see CallbackQueueManager class object)
       ***/

    }, {
      key: "initCallbackQueueManager",
      value: function initCallbackQueueManager() {
        this.nextRender = new CallbackQueueManager();
      }
      /***
       Init our renderer
       ***/

    }, {
      key: "initRenderer",
      value: function initRenderer() {
        this.planes = [];
        this.renderTargets = [];
        this.shaderPasses = []; // context is not lost

        this.state.isContextLost = false; // callback queue

        this.initCallbackQueueManager(); // set blend func

        this.setBlendFunc(); // enable depth by default

        this.setDepth(true); // texture cache

        this.cache = new CacheManager(); // init our scene

        this.scene = new Scene(this); // get webgl extensions

        this.getExtensions(); // handling context

        this._contextLostHandler = this.contextLost.bind(this);
        this.canvas.addEventListener("webglcontextlost", this._contextLostHandler, false);
        this._contextRestoredHandler = this.contextRestored.bind(this);
        this.canvas.addEventListener("webglcontextrestored", this._contextRestoredHandler, false);
      }
      /***
       Get all available WebGL extensions based on WebGL used version
       Called on init and on context restoration
       ***/

    }, {
      key: "getExtensions",
      value: function getExtensions() {
        this.extensions = [];

        if (this._isWebGL2) {
          this.extensions['EXT_color_buffer_float'] = this.gl.getExtension('EXT_color_buffer_float');
          this.extensions['OES_texture_float_linear'] = this.gl.getExtension('OES_texture_float_linear');
          this.extensions['EXT_texture_filter_anisotropic'] = this.gl.getExtension('EXT_texture_filter_anisotropic');
          this.extensions['WEBGL_lose_context'] = this.gl.getExtension('WEBGL_lose_context');
        } else {
          this.extensions['OES_vertex_array_object'] = this.gl.getExtension('OES_vertex_array_object');
          this.extensions['OES_texture_float'] = this.gl.getExtension('OES_texture_float');
          this.extensions['OES_texture_float_linear'] = this.gl.getExtension('OES_texture_float_linear');
          this.extensions['OES_texture_half_float'] = this.gl.getExtension('OES_texture_half_float');
          this.extensions['OES_texture_half_float_linear'] = this.gl.getExtension('OES_texture_half_float_linear');
          this.extensions['EXT_texture_filter_anisotropic'] = this.gl.getExtension('EXT_texture_filter_anisotropic');
          this.extensions['OES_element_index_uint'] = this.gl.getExtension('OES_element_index_uint');
          this.extensions['OES_standard_derivatives'] = this.gl.getExtension('OES_standard_derivatives');
          this.extensions['EXT_sRGB'] = this.gl.getExtension('EXT_sRGB');
          this.extensions['WEBGL_depth_texture'] = this.gl.getExtension('WEBGL_depth_texture');
          this.extensions['WEBGL_draw_buffers'] = this.gl.getExtension('WEBGL_draw_buffers');
          this.extensions['WEBGL_lose_context'] = this.gl.getExtension('WEBGL_lose_context');
        }
      }
      /*** HANDLING CONTEXT LOST/RESTORE ***/

      /***
       Called when the WebGL context is lost
       ***/

    }, {
      key: "contextLost",
      value: function contextLost(event) {
        var _this4 = this;

        this.state.isContextLost = true; // do not try to restore the context if we're disposing everything!

        if (!this.state.isActive) return;
        event.preventDefault();
        this.nextRender.add(function () {
          return _this4.onContextLost && _this4.onContextLost();
        });
      }
      /***
       Call this method to restore your context
       ***/

    }, {
      key: "restoreContext",
      value: function restoreContext() {
        // do not try to restore the context if we're disposing everything!
        if (!this.state.isActive) return;
        this.initState();

        if (this.gl && this.extensions['WEBGL_lose_context']) {
          this.extensions['WEBGL_lose_context'].restoreContext();
        } else {
          if (!this.gl && !this.production) {
            throwWarning(this.type + ": Could not restore the context because the context is not defined");
          } else if (!this.extensions['WEBGL_lose_context'] && !this.production) {
            throwWarning(this.type + ": Could not restore the context because the restore context extension is not defined");
          }

          if (this.onError) {
            this.onError();
          }
        }
      }
      /***
       Check that all objects and textures have been restored
         returns:
       @isRestored (bool): whether everything has been restored or not
       ***/

    }, {
      key: "isContextexFullyRestored",
      value: function isContextexFullyRestored() {
        var isRestored = true;

        for (var i = 0; i < this.renderTargets.length; i++) {
          if (!this.renderTargets[i].textures[0]._canDraw) {
            isRestored = false;
          }

          break;
        }

        if (isRestored) {
          for (var _i2 = 0; _i2 < this.planes.length; _i2++) {
            if (!this.planes[_i2]._canDraw) {
              isRestored = false;
              break;
            } else {
              for (var j = 0; j < this.planes[_i2].textures.length; j++) {
                if (!this.planes[_i2].textures[j]._canDraw) {
                  isRestored = false;
                  break;
                }
              }
            }
          }
        }

        if (isRestored) {
          for (var _i3 = 0; _i3 < this.shaderPasses.length; _i3++) {
            if (!this.shaderPasses[_i3]._canDraw) {
              isRestored = false;
              break;
            } else {
              for (var _j = 0; _j < this.shaderPasses[_i3].textures.length; _j++) {
                if (!this.shaderPasses[_i3].textures[_j]._canDraw) {
                  isRestored = false;
                  break;
                }
              }
            }
          }
        }

        return isRestored;
      }
      /***
       Called when the WebGL context is restored
       ***/

    }, {
      key: "contextRestored",
      value: function contextRestored() {
        var _this5 = this;

        this.getExtensions(); // set blend func

        this.setBlendFunc(); // enable depth by default

        this.setDepth(true); // clear texture and programs cache

        this.cache.clear(); // reset draw stacks

        this.scene.initStacks(); // we need to reset everything : planes programs, shaders, buffers and textures !

        for (var i = 0; i < this.renderTargets.length; i++) {
          this.renderTargets[i]._restoreContext();
        }

        for (var _i4 = 0; _i4 < this.planes.length; _i4++) {
          this.planes[_i4]._restoreContext();
        } // same goes for shader passes


        for (var _i5 = 0; _i5 < this.shaderPasses.length; _i5++) {
          this.shaderPasses[_i5]._restoreContext();
        } // callback if everything is restored


        var isRestoredQueue = this.nextRender.add(function () {
          var isRestored = _this5.isContextexFullyRestored();

          if (isRestored) {
            isRestoredQueue.keep = false; // start drawing again

            _this5.state.isContextLost = false;

            if (_this5.onContextRestored) {
              _this5.onContextRestored();
            } // we've changed the objects, keep Curtains class in sync with our renderer


            _this5.onSceneChange(); // force next frame render whatever our drawing flag value


            _this5.needRender();
          }
        }, true);
      }
      /*** SIZING ***/

      /***
       Updates pixelRatio property
       ***/

    }, {
      key: "setPixelRatio",
      value: function setPixelRatio(pixelRatio) {
        this.pixelRatio = pixelRatio;
      }
      /***
       Set/reset container sizes and WebGL viewport sizes
       ***/

    }, {
      key: "setSize",
      value: function setSize() {
        if (!this.gl) return; // get our container bounding client rectangle

        var containerBoundingRect = this.container.getBoundingClientRect(); // use the bounding rect values

        this._boundingRect = {
          width: containerBoundingRect.width * this.pixelRatio,
          height: containerBoundingRect.height * this.pixelRatio,
          top: containerBoundingRect.top * this.pixelRatio,
          left: containerBoundingRect.left * this.pixelRatio
        }; // iOS Safari > 8+ has a known bug due to navigation bar appearing/disappearing
        // this causes wrong bounding client rect calculations, especially negative top value when it shouldn't
        // to fix this we'll use a dirty but useful workaround
        // first we check if we're on iOS Safari

        var isSafari = !!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/);
        var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        if (isSafari && iOS) {
          // if we are on iOS Safari we'll need a custom function to retrieve our container absolute top position
          var getTopOffset = function getTopOffset(el) {
            var topOffset = 0;

            while (el && !isNaN(el.offsetTop)) {
              topOffset += el.offsetTop - el.scrollTop;
              el = el.offsetParent;
            }

            return topOffset;
          }; // use it to update our top value


          this._boundingRect.top = getTopOffset(this.container) * this.pixelRatio;
        }

        this.canvas.style.width = Math.floor(this._boundingRect.width / this.pixelRatio) + "px";
        this.canvas.style.height = Math.floor(this._boundingRect.height / this.pixelRatio) + "px";
        this.canvas.width = Math.floor(this._boundingRect.width * this._renderingScale);
        this.canvas.height = Math.floor(this._boundingRect.height * this._renderingScale);
        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
      }
      /***
       Resize all our elements: planes, shader passes and render targets
       Their textures will be resized as well
       ***/

    }, {
      key: "resize",
      value: function resize() {
        // resize the planes only if they are fully initiated
        for (var i = 0; i < this.planes.length; i++) {
          if (this.planes[i]._canDraw) {
            this.planes[i].resize();
          }
        } // resize the shader passes only if they are fully initiated


        for (var _i6 = 0; _i6 < this.shaderPasses.length; _i6++) {
          if (this.shaderPasses[_i6]._canDraw) {
            this.shaderPasses[_i6].resize();
          }
        } // resize the render targets


        for (var _i7 = 0; _i7 < this.renderTargets.length; _i7++) {
          this.renderTargets[_i7].resize();
        } // be sure we'll update the scene even if drawing is disabled


        this.needRender();
      }
      /*** CLEAR SCENE ***/

      /***
       Clear our WebGL scene colors and depth
       ***/

    }, {
      key: "clear",
      value: function clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      }
      /*** FRAME BUFFER OBJECTS ***/

      /***
       Called to bind or unbind a FBO
         params:
       @frameBuffer (frameBuffer): if frameBuffer is not null, bind it, unbind it otherwise
       @cancelClear (bool / undefined): if we should cancel clearing the frame buffer (typically on init & resize)
       ***/

    }, {
      key: "bindFrameBuffer",
      value: function bindFrameBuffer(frameBuffer, cancelClear) {
        var bufferId = null;

        if (frameBuffer) {
          bufferId = frameBuffer.index; // new frame buffer, bind it

          if (bufferId !== this.state.frameBufferID) {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frameBuffer._frameBuffer);
            this.gl.viewport(0, 0, frameBuffer._size.width, frameBuffer._size.height); // if we should clear the buffer content

            if (frameBuffer._shouldClear && !cancelClear) {
              this.clear();
            }
          }
        } else if (this.state.frameBufferID !== null) {
          this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
          this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
        }

        this.state.frameBufferID = bufferId;
      }
      /*** DEPTH ***/

      /***
       Called to set whether the renderer will handle depth test or not
       Depth test is enabled by default
         params:
       @setDepth (boolean): if we should enable or disable the depth test
       ***/

    }, {
      key: "setDepth",
      value: function setDepth(_setDepth) {
        if (_setDepth && !this.state.depthTest) {
          this.state.depthTest = _setDepth; // enable depth test

          this.gl.enable(this.gl.DEPTH_TEST);
        } else if (!_setDepth && this.state.depthTest) {
          this.state.depthTest = _setDepth; // disable depth test

          this.gl.disable(this.gl.DEPTH_TEST);
        }
      }
      /*** BLEND FUNC ***/

      /***
       Called to set the blending function (transparency)
       ***/

    }, {
      key: "setBlendFunc",
      value: function setBlendFunc() {
        // allows transparency
        // based on how three.js solves this
        this.gl.enable(this.gl.BLEND);

        if (this.premultipliedAlpha) {
          this.gl.blendFuncSeparate(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
        } else {
          this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
        }
      }
      /*** FACE CULLING ***/

      /***
       Called to set whether we should cull an object face or not
         params:
       @cullFace (boolean): what face we should cull
       ***/

    }, {
      key: "setFaceCulling",
      value: function setFaceCulling(cullFace) {
        if (this.state.cullFace !== cullFace) {
          this.state.cullFace = cullFace;

          if (cullFace === "none") {
            this.gl.disable(this.gl.CULL_FACE);
          } else {
            // default to back face culling
            var faceCulling = cullFace === "front" ? this.gl.FRONT : this.gl.BACK;
            this.gl.enable(this.gl.CULL_FACE);
            this.gl.cullFace(faceCulling);
          }
        }
      }
      /***
       Tell WebGL to use the specified program if it's not already in use
         params:
       @program (object): a program object
       ***/

    }, {
      key: "useProgram",
      value: function useProgram(program) {
        if (this.state.currentProgramID === null || this.state.currentProgramID !== program.id) {
          this.gl.useProgram(program.program);
          this.state.currentProgramID = program.id;
        }
      }
      /*** PLANES ***/

      /***
       Removes a Plane element (that has already been disposed) from the scene and the planes array
         params:
       @plane (Plane object): the plane to remove
       ***/

    }, {
      key: "removePlane",
      value: function removePlane(plane) {
        if (!this.gl) return; // remove from our planes array

        this.planes = this.planes.filter(function (element) {
          return element.uuid !== plane.uuid;
        }); // remove from scene stacks

        this.scene.removePlane(plane);
        plane = null; // clear the buffer to clean scene

        if (this.gl) this.clear(); // we've removed an object, keep Curtains class in sync with our renderer

        this.onSceneChange();
      }
      /*** POST PROCESSING ***/

      /***
       Completely remove a RenderTarget element
         params:
       @renderTarget (RenderTarget object): the render target to remove
       ***/

    }, {
      key: "removeRenderTarget",
      value: function removeRenderTarget(renderTarget) {
        if (!this.gl) return; // loop through all planes that might use that render target and reset it

        for (var i = 0; i < this.planes.length; i++) {
          if (this.planes[i].target && this.planes[i].target.uuid === renderTarget.uuid) {
            this.planes[i].target = null;
          }
        }

        this.renderTargets = this.renderTargets.filter(function (element) {
          return element.uuid !== renderTarget.uuid;
        }); // update render target indexes

        for (var _i8 = 0; _i8 < this.renderTargets.length; _i8++) {
          this.renderTargets[_i8].index = _i8;
        }

        renderTarget = null; // clear the buffer to clean scene

        if (this.gl) this.clear(); // we've removed an object, keep Curtains class in sync with our renderer

        this.onSceneChange();
      }
      /*** SHADER PASSES ***/

      /***
       Removes a ShaderPass element (that has already been disposed) from the scene and the shaderPasses array
         params:
       @shaderPass (ShaderPass object): the shader pass to remove
       ***/

    }, {
      key: "removeShaderPass",
      value: function removeShaderPass(shaderPass) {
        if (!this.gl) return; // remove from shaderPasses our array

        this.shaderPasses = this.shaderPasses.filter(function (element) {
          return element.uuid !== shaderPass.uuid;
        }); // remove from scene stacks

        this.scene.removeShaderPass(shaderPass);
        shaderPass = null; // clear the buffer to clean scene

        if (this.gl) this.clear(); // we've removed an object, keep Curtains class in sync with our renderer

        this.onSceneChange();
      }
      /***
       Enables the render loop
       ***/

    }, {
      key: "enableDrawing",
      value: function enableDrawing() {
        this.state.drawingEnabled = true;
      }
      /***
       Disables the render loop
       ***/

    }, {
      key: "disableDrawing",
      value: function disableDrawing() {
        this.state.drawingEnabled = false;
      }
      /***
       Forces the rendering of the next frame, even if disabled
       ***/

    }, {
      key: "needRender",
      value: function needRender() {
        this.state.forceRender = true;
      }
      /***
       Called at each draw call to render our scene and its content
       Also execute our nextRender callback queue
       ***/

    }, {
      key: "render",
      value: function render() {
        if (!this.gl) return; // clear scene first

        this.clear(); // draw our scene content

        this.scene.draw();
      }
      /*** DISPOSING ***/

      /***
       Delete all cached programs
       ***/

    }, {
      key: "deletePrograms",
      value: function deletePrograms() {
        // delete all programs from manager
        for (var i = 0; i < this.cache.programs.length; i++) {
          var program = this.cache.programs[i];
          this.gl.deleteProgram(program.program);
        }
      }
      /***
       Dispose our WebGL context and all its objects
       ***/

    }, {
      key: "dispose",
      value: function dispose() {
        var _this6 = this;

        if (!this.gl) return;
        this.state.isActive = false; // be sure to delete all planes

        while (this.planes.length > 0) {
          this.removePlane(this.planes[0]);
        } // we need to delete the shader passes also


        while (this.shaderPasses.length > 0) {
          this.removeShaderPass(this.shaderPasses[0]);
        } // finally we need to delete the render targets


        while (this.renderTargets.length > 0) {
          this.removeRenderTarget(this.renderTargets[0]);
        } // wait for all planes to be deleted before stopping everything


        var disposeQueue = this.nextRender.add(function () {
          if (_this6.planes.length === 0 && _this6.shaderPasses.length === 0 && _this6.renderTargets.length === 0) {
            // clear from callback queue
            disposeQueue.keep = false;

            _this6.deletePrograms(); // clear the buffer to clean scene


            _this6.clear();

            _this6.canvas.removeEventListener("webgllost", _this6._contextLostHandler, false);

            _this6.canvas.removeEventListener("webglrestored", _this6._contextRestoredHandler, false); // lose context


            if (_this6.gl && _this6.extensions['WEBGL_lose_context']) {
              _this6.extensions['WEBGL_lose_context'].loseContext();
            } // clear canvas state


            _this6.canvas.width = _this6.canvas.width;
            _this6.gl = null; // remove canvas from DOM

            _this6.container.removeChild(_this6.canvas);

            _this6.container = null;
            _this6.canvas = null;
            _this6.onDisposed && _this6.onDisposed();
          }
        }, true);
      }
    }]);

    return Renderer;
  }();
  /***
   Here we create a ScrollManager class object
   This keeps track of our scroll position, scroll deltas and triggers an onScroll callback
   Could either listen to the native scroll event or be hooked to any scroll (natural or virtual) scroll event
     params:
   @xOffset (float): scroll along X axis
   @yOffset (float): scroll along Y axis
   @lastXDelta (float): last scroll delta along X axis
   @lastYDelta (float): last scroll delta along Y axis
     @shouldWatch (bool): if the scroll manager should listen to the scroll event or not. Default to true.
     @onScroll (function): callback to execute each time the scroll values changed
     returns:
   @this: our ScrollManager class object
   ***/


  var ScrollManager = /*#__PURE__*/function () {
    function ScrollManager() {
      var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          _ref2$xOffset = _ref2.xOffset,
          xOffset = _ref2$xOffset === void 0 ? 0 : _ref2$xOffset,
          _ref2$yOffset = _ref2.yOffset,
          yOffset = _ref2$yOffset === void 0 ? 0 : _ref2$yOffset,
          _ref2$lastXDelta = _ref2.lastXDelta,
          lastXDelta = _ref2$lastXDelta === void 0 ? 0 : _ref2$lastXDelta,
          _ref2$lastYDelta = _ref2.lastYDelta,
          lastYDelta = _ref2$lastYDelta === void 0 ? 0 : _ref2$lastYDelta,
          _ref2$shouldWatch = _ref2.shouldWatch,
          shouldWatch = _ref2$shouldWatch === void 0 ? true : _ref2$shouldWatch,
          _ref2$onScroll = _ref2.onScroll,
          onScroll = _ref2$onScroll === void 0 ? function () {} : _ref2$onScroll;

      _classCallCheck(this, ScrollManager);

      this.xOffset = xOffset;
      this.yOffset = yOffset;
      this.lastXDelta = lastXDelta;
      this.lastYDelta = lastYDelta;
      this.shouldWatch = shouldWatch;
      this.onScroll = onScroll; // keep a ref to our scroll event

      this.handler = this.scroll.bind(this, true);

      if (this.shouldWatch) {
        window.addEventListener("scroll", this.handler, {
          passive: true
        });
      }
    }
    /***
     Called by the scroll event listener
     ***/


    _createClass(ScrollManager, [{
      key: "scroll",
      value: function scroll() {
        this.updateScrollValues(window.pageXOffset, window.pageYOffset);
      }
      /***
       Updates the scroll manager X and Y scroll values as well as last X and Y deltas
       Internally called by the scroll handler
       Could be called externally as well if the user wants to handle the scroll by himself
         params:
       @x (float): scroll value along X axis
       @y (float): scroll value along Y axis
       ***/

    }, {
      key: "updateScrollValues",
      value: function updateScrollValues(x, y) {
        // get our scroll delta values
        var lastScrollXValue = this.xOffset;
        this.xOffset = x;
        this.lastXDelta = lastScrollXValue - this.xOffset;
        var lastScrollYValue = this.yOffset;
        this.yOffset = y;
        this.lastYDelta = lastScrollYValue - this.yOffset;

        if (this.onScroll) {
          this.onScroll(this.lastXDelta, this.lastYDelta);
        }
      }
      /***
       Dispose our scroll manager (just remove our event listner if it had been added previously)
       ***/

    }, {
      key: "dispose",
      value: function dispose() {
        if (this.shouldWatch) {
          window.removeEventListener("scroll", this.handler, {
            passive: true
          });
        }
      }
    }]);

    return ScrollManager;
  }();
  /***
   Here we create our Curtains object
       params:
   @container (HTML element or string, optional): the container HTML element or ID that will hold our canvas. Could be set later if not passed as parameter here
     (WebGL context parameters)
   @alpha (bool, optional): whether the WebGL context should handle transparency. Default to true.
   @premultipliedAlpha (bool, optional): whether the WebGL context should handle premultiplied alpha. Default to false.
   @antialias (bool, optional): whether the WebGL context should use the default antialiasing. When using render targets, WebGL disables antialiasing, so you can safely set this to false to improve the performance. Default to true.
   @depth (bool, optional): whether the WebGL context should handle depth. Default to true.
   @failIfMajorPerformanceCaveat (bool, optional): whether the WebGL context creation should fail in case of major performance caveat. Default to true.
   @preserveDrawingBuffer (bool, optional): whether the WebGL context should preserve the drawing buffer. Default to false.
   @stencil (bool, optional): whether the WebGL context should handle stencil. Default to false.
     @autoResize (bool, optional): Whether the library should listen to the window resize event and actually resize the scene. Set it to false if you want to handle this by yourself using the resize() method. Default to true.
   @autoRender (bool, optional): Whether the library should create a request animation frame loop to render the scene. Set it to false if you want to handle this by yourself using the render() method. Default to true.
   @watchScroll (bool, optional): Whether the library should listen to the window scroll event. Set it to false if you want to handle this by yourself. Default to true.
     @pixelRatio (float, optional): Defines the pixel ratio value. Use it to limit it on init to increase performance. Default to window.devicePixelRatio.
   @renderingScale (float, optional): Use it to downscale your rendering canvas. May improve performance but will decrease quality. Default to 1 (minimum: 0.25, maximum: 1).
     @production (bool, optional): Whether the library should throw useful console warnings and errors and check shaders and programs compilation status. Default to false.
     returns :
   @this: our Renderer
   ***/


  var Curtains = /*#__PURE__*/function () {
    function Curtains() {
      var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          container = _ref3.container,
          _ref3$alpha = _ref3.alpha,
          alpha = _ref3$alpha === void 0 ? true : _ref3$alpha,
          _ref3$premultipliedAl = _ref3.premultipliedAlpha,
          premultipliedAlpha = _ref3$premultipliedAl === void 0 ? false : _ref3$premultipliedAl,
          _ref3$antialias = _ref3.antialias,
          antialias = _ref3$antialias === void 0 ? true : _ref3$antialias,
          _ref3$depth = _ref3.depth,
          depth = _ref3$depth === void 0 ? true : _ref3$depth,
          _ref3$failIfMajorPerf = _ref3.failIfMajorPerformanceCaveat,
          failIfMajorPerformanceCaveat = _ref3$failIfMajorPerf === void 0 ? true : _ref3$failIfMajorPerf,
          _ref3$preserveDrawing = _ref3.preserveDrawingBuffer,
          preserveDrawingBuffer = _ref3$preserveDrawing === void 0 ? false : _ref3$preserveDrawing,
          _ref3$stencil = _ref3.stencil,
          stencil = _ref3$stencil === void 0 ? false : _ref3$stencil,
          _ref3$autoResize = _ref3.autoResize,
          autoResize = _ref3$autoResize === void 0 ? true : _ref3$autoResize,
          _ref3$autoRender = _ref3.autoRender,
          autoRender = _ref3$autoRender === void 0 ? true : _ref3$autoRender,
          _ref3$watchScroll = _ref3.watchScroll,
          watchScroll = _ref3$watchScroll === void 0 ? true : _ref3$watchScroll,
          _ref3$pixelRatio = _ref3.pixelRatio,
          pixelRatio = _ref3$pixelRatio === void 0 ? window.devicePixelRatio || 1 : _ref3$pixelRatio,
          _ref3$renderingScale = _ref3.renderingScale,
          renderingScale = _ref3$renderingScale === void 0 ? 1 : _ref3$renderingScale,
          _ref3$production = _ref3.production,
          production = _ref3$production === void 0 ? false : _ref3$production;

      _classCallCheck(this, Curtains);

      this.type = "Curtains"; // if we should use auto resize (default to true)

      this._autoResize = autoResize; // if we should use auto render (default to true)

      this._autoRender = autoRender; // if we should watch the scroll (default to true)

      this._watchScroll = watchScroll; // pixel ratio and rendering scale

      this.pixelRatio = pixelRatio; // rendering scale

      renderingScale = isNaN(renderingScale) ? 1 : parseFloat(renderingScale);
      this._renderingScale = Math.max(0.25, Math.min(1, renderingScale)); // webgl context parameters

      this.premultipliedAlpha = premultipliedAlpha;
      this.alpha = alpha;
      this.antialias = antialias;
      this.depth = depth;
      this.failIfMajorPerformanceCaveat = failIfMajorPerformanceCaveat;
      this.preserveDrawingBuffer = preserveDrawingBuffer;
      this.stencil = stencil;
      this.production = production;
      this.errors = false; // if a container has been provided, proceed to init

      if (container) {
        this.setContainer(container);
      } else if (!this.production) {
        throwWarning(this.type + ": no container provided in the initial parameters. Use setContainer() method to set one later and initialize the WebGL context");
      }
    }
    /***
     Set up our Curtains container and start initializing everything
     Called on Curtains instancing if a params container has been provided, could be call afterwards else
     Useful with JS frameworks to init our Curtains class globally and then set the container in a canvas component afterwards to fully instantiate everything
       params:
     @container (HTML element or string): the container HTML element or ID that will hold our canvas
     ***/


    _createClass(Curtains, [{
      key: "setContainer",
      value: function setContainer(container) {
        if (!container) {
          var _container = document.createElement("div");

          _container.setAttribute("id", "curtains-canvas");

          document.body.appendChild(_container);
          this.container = _container;
          if (!this.production) throwWarning('Curtains: no valid container HTML element or ID provided, created a div with "curtains-canvas" ID instead');
        } else {
          if (typeof container === "string") {
            container = document.getElementById(container);

            if (!container) {
              var _container2 = document.createElement("div");

              _container2.setAttribute("id", "curtains-canvas");

              document.body.appendChild(_container2);
              this.container = _container2;
              if (!this.production) throwWarning('Curtains: no valid container HTML element or ID provided, created a div with "curtains-canvas" ID instead');
            } else {
              this.container = container;
            }
          } else if (container instanceof Element) {
            this.container = container;
          }
        }

        this._initCurtains();
      }
      /***
       Initialize everything that the class will need: WebGL renderer, scroll manager, sizes, listeners
       Then starts our animation frame loop if needed
       ***/

    }, {
      key: "_initCurtains",
      value: function _initCurtains() {
        this.planes = [];
        this.renderTargets = [];
        this.shaderPasses = []; // init webgl context

        this._initRenderer();

        if (!this.gl) return; // scroll

        this._initScroll(); // sizes


        this._setSize(); // event listeners


        this._addListeners(); // we are ready to go


        this.container.appendChild(this.canvas); // watermark

        console.log("curtains.js - v7.1"); // start rendering

        this._animationFrameID = null;

        if (this._autoRender) {
          this._animate();
        }
      }
      /*** WEBGL CONTEXT ***/

      /***
       Initialize the Renderer class object
       ***/

    }, {
      key: "_initRenderer",
      value: function _initRenderer() {
        var _this7 = this;

        this.renderer = new Renderer({
          alpha: this.alpha,
          antialias: this.antialias,
          premulitpliedAlpha: this.premultipliedAlpha,
          depth: this.depth,
          failIfMajorPerformanceCaveat: this.failIfMajorPerformanceCaveat,
          preserveDrawingBuffer: this.preserveDrawingBuffer,
          stencil: this.stencil,
          container: this.container,
          pixelRatio: this.pixelRatio,
          renderingScale: this._renderingScale,
          production: this.production,
          onError: function onError() {
            return _this7._onRendererError();
          },
          onContextLost: function onContextLost() {
            return _this7._onRendererContextLost();
          },
          onContextRestored: function onContextRestored() {
            return _this7._onRendererContextRestored();
          },
          onDisposed: function onDisposed() {
            return _this7._onRendererDisposed();
          },
          // keep sync between renderer planes, shader passes and render targets arrays and the Curtains ones
          onSceneChange: function onSceneChange() {
            return _this7._keepSync();
          }
        });
        this.gl = this.renderer.gl;
        this.canvas = this.renderer.canvas;
      }
      /***
       Force our renderer to restore the WebGL context
       ***/

    }, {
      key: "restoreContext",
      value: function restoreContext() {
        this.renderer.restoreContext();
      }
      /***
       This just handles our drawing animation frame
       ***/

    }, {
      key: "_animate",
      value: function _animate() {
        this.render();
        this._animationFrameID = window.requestAnimationFrame(this._animate.bind(this));
      }
      /*** RENDERING ***/

      /***
       Enables rendering
       ***/

    }, {
      key: "enableDrawing",
      value: function enableDrawing() {
        this.renderer.enableDrawing();
      }
      /***
       Disables rendering
       ***/

    }, {
      key: "disableDrawing",
      value: function disableDrawing() {
        this.renderer.disableDrawing();
      }
      /***
       Forces the rendering of the next frame, even if disabled
       ***/

    }, {
      key: "needRender",
      value: function needRender() {
        this.renderer.needRender();
      }
      /***
       Executes a callback on next frame
         params:
       @callback (function): callback to execute on next frame
       ***/

    }, {
      key: "nextRender",
      value: function nextRender(callback) {
        this.renderer.nextRender.add(callback);
      }
      /***
       Tells our renderer to render the scene if the drawing is enabled
       ***/

    }, {
      key: "render",
      value: function render() {
        // always execute callback queue
        this.renderer.nextRender.execute(); // If forceRender is true, force rendering this frame even if drawing is not enabled.
        // If not, only render if enabled.

        if (!this.renderer.state.drawingEnabled && !this.renderer.state.forceRender) {
          return;
        } // reset forceRender


        if (this.renderer.state.forceRender) {
          this.renderer.state.forceRender = false;
        } // Curtains onRender callback


        if (this._onRenderCallback) {
          this._onRenderCallback();
        }

        this.renderer.render();
      }
      /*** LISTENERS ***/

      /***
       Adds our resize event listener if needed
       ***/

    }, {
      key: "_addListeners",
      value: function _addListeners() {
        // handling window resize event
        this._resizeHandler = null;

        if (this._autoResize) {
          this._resizeHandler = this.resize.bind(this, true);
          window.addEventListener("resize", this._resizeHandler, false);
        }
      }
      /*** SIZING ***/

      /***
       Set the pixel ratio property and update everything by calling the resize() method
       ***/

    }, {
      key: "setPixelRatio",
      value: function setPixelRatio(pixelRatio, triggerCallback) {
        this.pixelRatio = parseFloat(Math.max(pixelRatio, 1)) || 1;
        this.renderer.setPixelRatio(pixelRatio); // apply new pixel ratio to all our elements but don't trigger onAfterResize callback

        this.resize(triggerCallback);
      }
      /***
       Set our renderer container and canvas sizes and update the scroll values
       ***/

    }, {
      key: "_setSize",
      value: function _setSize() {
        this.renderer.setSize(); // update scroll values ass well

        if (this._scrollManager.shouldWatch) {
          this._scrollManager.xOffset = window.pageXOffset;
          this._scrollManager.yOffset = window.pageYOffset;
        }
      }
      /***
       Useful to get our container bounding rectangle without triggering a reflow/layout
         returns :
       @boundingRectangle (object): an object containing our container bounding rectangle (width, height, top and left properties)
       ***/

    }, {
      key: "getBoundingRect",
      value: function getBoundingRect() {
        return this.renderer._boundingRect;
      }
      /***
       Resize our container and the renderer
         params:
       @triggerCallback (bool): Whether we should trigger onAfterResize callback
       ***/

    }, {
      key: "resize",
      value: function resize(triggerCallback) {
        var _this8 = this;

        if (!this.gl) return;

        this._setSize();

        this.renderer.resize();
        this.nextRender(function () {
          if (_this8._onAfterResizeCallback && triggerCallback) {
            _this8._onAfterResizeCallback();
          }
        });
      }
      /*** SCROLL ***/

      /***
       Init our ScrollManager class object
       ***/

    }, {
      key: "_initScroll",
      value: function _initScroll() {
        var _this9 = this;

        this._scrollManager = new ScrollManager({
          // init values
          xOffset: window.pageXOffset,
          yOffset: window.pageYOffset,
          lastXDelta: 0,
          lastYDelta: 0,
          shouldWatch: this._watchScroll,
          onScroll: function onScroll(lastXDelta, lastYDelta) {
            return _this9._updateScroll(lastXDelta, lastYDelta);
          }
        });
      }
      /***
       Handles the different values associated with a scroll event (scroll and delta values)
       If no plane watch the scroll then those values won't be retrieved to avoid unnecessary reflow calls
       If at least a plane is watching, update all watching planes positions based on the scroll values
       And force render for at least one frame to actually update the scene
       ***/

    }, {
      key: "_updateScroll",
      value: function _updateScroll(lastXDelta, lastYDelta) {
        for (var i = 0; i < this.planes.length; i++) {
          // if our plane is watching the scroll, update its position
          if (this.planes[i].watchScroll) {
            this.planes[i].updateScrollPosition(lastXDelta, lastYDelta);
          }
        } // be sure we'll update the scene even if drawing is disabled


        this.renderer.needRender();
        this._onScrollCallback && this._onScrollCallback();
      }
      /***
       Updates the scroll manager X and Y scroll values as well as last X and Y deltas
       Internally called by the scroll handler if at least one plane is watching the scroll
       Could be called externally as well if the user wants to handle the scroll by himself
         params:
       @x (float): scroll value along X axis
       @y (float): scroll value along Y axis
       ***/

    }, {
      key: "updateScrollValues",
      value: function updateScrollValues(x, y) {
        this._scrollManager.updateScrollValues(x, y);
      }
      /***
       Returns last delta scroll values
         returns:
       @delta (object): an object containing X and Y last delta values
       ***/

    }, {
      key: "getScrollDeltas",
      value: function getScrollDeltas() {
        return {
          x: this._scrollManager.lastXDelta,
          y: this._scrollManager.lastYDelta
        };
      }
      /***
       Returns last window scroll values
         returns:
       @scrollValues (object): an object containing X and Y last scroll values
       ***/

    }, {
      key: "getScrollValues",
      value: function getScrollValues() {
        return {
          x: this._scrollManager.xOffset,
          y: this._scrollManager.yOffset
        };
      }
      /*** ADDING / REMOVING OBJECTS TO THE RENDERER ***/

      /***
       Always keep sync between renderer and Curtains scene objects when adding/removing objects
       ***/

    }, {
      key: "_keepSync",
      value: function _keepSync() {
        this.planes = this.renderer.planes;
        this.shaderPasses = this.renderer.shaderPasses;
        this.renderTargets = this.renderer.renderTargets;
      }
      /*** UTILS ***/

      /***
       Linear interpolation helper defined in utils
       ***/

    }, {
      key: "lerp",
      value: function lerp(start, end, amount) {
        return _lerp(start, end, amount);
      }
      /*** EVENTS ***/

      /***
       This is called each time our container has been resized
         params :
       @callback (function) : a function to execute
         returns :
       @this: our Curtains element to handle chaining
       ***/

    }, {
      key: "onAfterResize",
      value: function onAfterResize(callback) {
        if (callback) {
          this._onAfterResizeCallback = callback;
        }

        return this;
      }
      /***
       This is called when an error has been detected
         params:
       @callback (function): a function to execute
         returns:
       @this: our Curtains element to handle chaining
       ***/

    }, {
      key: "onError",
      value: function onError(callback) {
        if (callback) {
          this._onErrorCallback = callback;
        }

        return this;
      }
      /***
       This triggers the onError callback and is called by the renderer when an error has been detected
       ***/

    }, {
      key: "_onRendererError",
      value: function _onRendererError() {
        var _this10 = this;

        // be sure that the callback has been registered and only call the global error callback once
        setTimeout(function () {
          if (_this10._onErrorCallback && !_this10.errors) {
            _this10._onErrorCallback();
          }

          _this10.errors = true;
        }, 0);
      }
      /***
       This is called once our context has been lost
         params:
       @callback (function): a function to execute
         returns:
       @this: our Curtains element to handle chaining
       ***/

    }, {
      key: "onContextLost",
      value: function onContextLost(callback) {
        if (callback) {
          this._onContextLostCallback = callback;
        }

        return this;
      }
      /***
       This triggers the onContextLost callback and is called by the renderer when the context has been lost
       ***/

    }, {
      key: "_onRendererContextLost",
      value: function _onRendererContextLost() {
        this._onContextLostCallback && this._onContextLostCallback();
      }
      /***
       This is called once our context has been restored
         params:
       @callback (function): a function to execute
         returns:
       @this: our Curtains element to handle chaining
       ***/

    }, {
      key: "onContextRestored",
      value: function onContextRestored(callback) {
        if (callback) {
          this._onContextRestoredCallback = callback;
        }

        return this;
      }
      /***
       This triggers the onContextRestored callback and is called by the renderer when the context has been restored
       ***/

    }, {
      key: "_onRendererContextRestored",
      value: function _onRendererContextRestored() {
        this._onContextRestoredCallback && this._onContextRestoredCallback();
      }
      /***
       This is called once at each request animation frame call
         params:
       @callback (function): a function to execute
         returns:
       @this: our Curtains element to handle chaining
       ***/

    }, {
      key: "onRender",
      value: function onRender(callback) {
        if (callback) {
          this._onRenderCallback = callback;
        }

        return this;
      }
      /***
       This is called each time window is scrolled and if our scrollManager is active
         params :
       @callback (function) : a function to execute
         returns :
       @this: our Curtains element to handle chaining
       ***/

    }, {
      key: "onScroll",
      value: function onScroll(callback) {
        if (callback) {
          this._onScrollCallback = callback;
        }

        return this;
      }
      /*** DESTROYING ***/

      /***
       Dispose everything
       ***/

    }, {
      key: "dispose",
      value: function dispose() {
        this.renderer.dispose();
      }
      /***
       This is called when the renderer has finished disposing all the WebGL stuff
       ***/

    }, {
      key: "_onRendererDisposed",
      value: function _onRendererDisposed() {
        // cancel animation frame
        this._animationFrameID && window.cancelAnimationFrame(this._animationFrameID); // remove event listeners

        this._resizeHandler && window.removeEventListener("resize", this._resizeHandler, false);
        this._scrollManager && this._scrollManager.dispose();
      }
    }]);

    return Curtains;
  }();
  /***
   Uniforms class manages uniforms setting and updating
     params:
   @renderer (Renderer class object): our renderer class object
   @program (object): our mesh's Program (see Program class object)
   @shared (bool): whether the program is shared or not
     @uniforms (object): our uniforms object:
   - name (string): uniform name to use in your shaders
   - type (uniform type): uniform type. Will try to detect it if not set (see https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/uniform)
   - value (float / int / Vec2 / Vec3 / Mat4 / array): initial value of the uniform
     returns:
   @this: our Uniforms manager
  ***/


  var Uniforms = /*#__PURE__*/function () {
    function Uniforms(renderer, program, shared, uniforms) {
      _classCallCheck(this, Uniforms);

      this.type = "Uniforms";

      if (!renderer || renderer.type !== "Renderer") {
        throwError(this.type + ": Renderer not passed as first argument", renderer);
      } else if (!renderer.gl) {
        throwError(this.type + ": Renderer WebGL context is undefined", renderer);
      }

      this.renderer = renderer;
      this.gl = renderer.gl;
      this.program = program;
      this.shared = shared;
      this.uniforms = {};

      if (uniforms) {
        for (var key in uniforms) {
          var uniform = uniforms[key]; // fill our uniform object

          this.uniforms[key] = {
            name: uniform.name,
            type: uniform.type,
            value: uniform.value,
            lastValue: uniform.value,
            update: null
          };
        }
      }
    }
    /***
     Set uniforms WebGL function based on their types
       params :
     @uniform (object): the uniform
     ***/


    _createClass(Uniforms, [{
      key: "handleUniformSetting",
      value: function handleUniformSetting(uniform) {
        switch (uniform.type) {
          case "1i":
            uniform.update = this.setUniform1i.bind(this);
            break;

          case "1iv":
            uniform.update = this.setUniform1iv.bind(this);
            break;

          case "1f":
            uniform.update = this.setUniform1f.bind(this);
            break;

          case "1fv":
            uniform.update = this.setUniform1fv.bind(this);
            break;

          case "2i":
            uniform.update = this.setUniform2i.bind(this);
            break;

          case "2iv":
            uniform.update = this.setUniform2iv.bind(this);
            break;

          case "2f":
            uniform.update = this.setUniform2f.bind(this);
            break;

          case "2fv":
            uniform.update = this.setUniform2fv.bind(this);
            break;

          case "3i":
            uniform.update = this.setUniform3i.bind(this);
            break;

          case "3iv":
            uniform.update = this.setUniform3iv.bind(this);
            break;

          case "3f":
            uniform.update = this.setUniform3f.bind(this);
            break;

          case "3fv":
            uniform.update = this.setUniform3fv.bind(this);
            break;

          case "4i":
            uniform.update = this.setUniform4i.bind(this);
            break;

          case "4iv":
            uniform.update = this.setUniform4iv.bind(this);
            break;

          case "4f":
            uniform.update = this.setUniform4f.bind(this);
            break;

          case "4fv":
            uniform.update = this.setUniform4fv.bind(this);
            break;

          case "mat2":
            uniform.update = this.setUniformMatrix2fv.bind(this);
            break;

          case "mat3":
            uniform.update = this.setUniformMatrix3fv.bind(this);
            break;

          case "mat4":
            uniform.update = this.setUniformMatrix4fv.bind(this);
            break;

          default:
            if (!this.renderer.production) throwWarning(this.type + ": This uniform type is not handled : ", uniform.type);
        }
      }
      /***
       Auto detect the format of the uniform (check if its a float, an integer, a Vector, a Matrix, an array...)
         params :
       @uniform (object): the uniform
       ***/

    }, {
      key: "setInternalFormat",
      value: function setInternalFormat(uniform) {
        if (uniform.value.type === "Vec2") {
          uniform._internalFormat = "Vec2";
        } else if (uniform.value.type === "Vec3") {
          uniform._internalFormat = "Vec3";
        } else if (uniform.value.type === "Mat4") {
          uniform._internalFormat = "Mat4";
        } else if (uniform.value.type === "Quat") {
          uniform._internalFormat = "Quat";
        } else if (Array.isArray(uniform.value)) {
          uniform._internalFormat = "array";
        } else if (uniform.value.constructor === Float32Array) {
          uniform._internalFormat = "mat";
        } else {
          uniform._internalFormat = "float";
        }
      }
      /***
       This inits our uniforms
       Sets its internal format and type if not provided then upload the uniform
       ***/

    }, {
      key: "setUniforms",
      value: function setUniforms() {
        // set our uniforms if we got some
        if (this.uniforms) {
          for (var key in this.uniforms) {
            var uniform = this.uniforms[key]; // set our uniform location

            uniform.location = this.gl.getUniformLocation(this.program, uniform.name); // handle Vec2, Vec3, Mat4, floats, arrays, etc

            if (!uniform._internalFormat) {
              this.setInternalFormat(uniform);
            }

            if (!uniform.type) {
              if (uniform._internalFormat === "Vec2") {
                uniform.type = "2f";
              } else if (uniform._internalFormat === "Vec3") {
                uniform.type = "3f";
              } else if (uniform._internalFormat === "Mat4") {
                uniform.type = "mat4";
              } else if (uniform._internalFormat === "array") {
                if (uniform.value.length === 4) {
                  uniform.type = "4f";
                  if (!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a 4f (array of 4 floats) uniform type");
                } else if (uniform.value.length === 3) {
                  uniform.type = "3f";
                  if (!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a 3f (array of 3 floats) uniform type");
                } else if (uniform.value.length === 2) {
                  uniform.type = "2f";
                  if (!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a 2f (array of 2 floats) uniform type");
                }
              } else if (uniform._internalFormat === "mat") {
                if (uniform.value.length === 16) {
                  uniform.type = "mat4";
                  if (!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a mat4 (4x4 matrix array) uniform type");
                } else if (uniform.value.length === 9) {
                  uniform.type = "mat3";
                  if (!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a mat3 (3x3 matrix array) uniform type");
                } else if (uniform.value.length === 4) {
                  uniform.type = "mat2";
                  if (!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a mat2 (2x2 matrix array) uniform type");
                }
              } else {
                uniform.type = "1f";
                if (!this.renderer.production) throwWarning(this.type + ": No uniform type declared for " + uniform.name + ", applied a 1f (float) uniform type");
              }
            } // set the uniforms update functions


            this.handleUniformSetting(uniform); // update the uniform

            uniform.update && uniform.update(uniform);
          }
        }
      }
      /***
       This updates all uniforms of an object that were set by the user
       It is called at each draw call
       ***/

    }, {
      key: "updateUniforms",
      value: function updateUniforms() {
        if (this.uniforms) {
          for (var key in this.uniforms) {
            var uniform = this.uniforms[key];
            var shouldUpdate = false;

            if (!this.shared) {
              if (!uniform.value.length && uniform.value !== uniform.lastValue) {
                shouldUpdate = true;
                uniform.lastValue = uniform.value;
              } else if (uniform._internalFormat === "Vec2" && !uniform.value.equals(uniform.lastValue)) {
                shouldUpdate = true;
                uniform.lastValue.copy(uniform.value);
              } else if (uniform._internalFormat === "Vec3" && !uniform.value.equals(uniform.lastValue)) {
                shouldUpdate = true;
                uniform.lastValue.copy(uniform.value);
              } else if (uniform._internalFormat === "Quat" && !uniform.value.equals(uniform.lastValue)) {
                shouldUpdate = true;
                uniform.lastValue.copy(uniform.value);
              } else if (JSON.stringify(uniform.value) !== JSON.stringify(uniform.lastValue)) {
                // compare two arrays
                shouldUpdate = true; // copy array

                uniform.lastValue = Array.from(uniform.value);
              }
            } else {
              shouldUpdate = true;
            }

            if (shouldUpdate) {
              // update our uniforms
              uniform.update && uniform.update(uniform);
            }
          }
        }
      }
      /***
       Use appropriate WebGL uniform setting function based on the uniform type
         params :
       @uniform (object): the uniform
       ***/

    }, {
      key: "setUniform1i",
      value: function setUniform1i(uniform) {
        this.gl.uniform1i(uniform.location, uniform.value);
      }
    }, {
      key: "setUniform1iv",
      value: function setUniform1iv(uniform) {
        this.gl.uniform1iv(uniform.location, uniform.value);
      }
    }, {
      key: "setUniform1f",
      value: function setUniform1f(uniform) {
        this.gl.uniform1f(uniform.location, uniform.value);
      }
    }, {
      key: "setUniform1fv",
      value: function setUniform1fv(uniform) {
        this.gl.uniform1fv(uniform.location, uniform.value);
      }
    }, {
      key: "setUniform2i",
      value: function setUniform2i(uniform) {
        uniform._internalFormat === "Vec2" ? this.gl.uniform2i(uniform.location, uniform.value.x, uniform.value.y) : this.gl.uniform2i(uniform.location, uniform.value[0], uniform.value[1]);
      }
    }, {
      key: "setUniform2iv",
      value: function setUniform2iv(uniform) {
        uniform._internalFormat === "Vec2" ? this.gl.uniform2iv(uniform.location, [uniform.value.x, uniform.value.y]) : this.gl.uniform2iv(uniform.location, uniform.value);
      }
    }, {
      key: "setUniform2f",
      value: function setUniform2f(uniform) {
        uniform._internalFormat === "Vec2" ? this.gl.uniform2f(uniform.location, uniform.value.x, uniform.value.y) : this.gl.uniform2f(uniform.location, uniform.value[0], uniform.value[1]);
      }
    }, {
      key: "setUniform2fv",
      value: function setUniform2fv(uniform) {
        uniform._internalFormat === "Vec2" ? this.gl.uniform2fv(uniform.location, [uniform.value.x, uniform.value.y]) : this.gl.uniform2fv(uniform.location, uniform.value);
      }
    }, {
      key: "setUniform3i",
      value: function setUniform3i(uniform) {
        uniform._internalFormat === "Vec3" ? this.gl.uniform3i(uniform.location, uniform.value.x, uniform.value.y, uniform.value.z) : this.gl.uniform3i(uniform.location, uniform.value[0], uniform.value[1], uniform.value[2]);
      }
    }, {
      key: "setUniform3iv",
      value: function setUniform3iv(uniform) {
        uniform._internalFormat === "Vec3" ? this.gl.uniform3iv(uniform.location, [uniform.value.x, uniform.value.y, uniform.value.z]) : this.gl.uniform3iv(uniform.location, uniform.value);
      }
    }, {
      key: "setUniform3f",
      value: function setUniform3f(uniform) {
        uniform._internalFormat === "Vec3" ? this.gl.uniform3f(uniform.location, uniform.value.x, uniform.value.y, uniform.value.z) : this.gl.uniform3f(uniform.location, uniform.value[0], uniform.value[1], uniform.value[2]);
      }
    }, {
      key: "setUniform3fv",
      value: function setUniform3fv(uniform) {
        uniform._internalFormat === "Vec3" ? this.gl.uniform3fv(uniform.location, [uniform.value.x, uniform.value.y, uniform.value.z]) : this.gl.uniform3fv(uniform.location, uniform.value);
      }
    }, {
      key: "setUniform4i",
      value: function setUniform4i(uniform) {
        uniform._internalFormat === "Quat" ? this.gl.uniform4i(uniform.location, uniform.value.elements[0], uniform.value.elements[1], uniform.value.elements[2], uniform.value[3]) : this.gl.uniform4i(uniform.location, uniform.value[0], uniform.value[1], uniform.value[2], uniform.value[3]);
      }
    }, {
      key: "setUniform4iv",
      value: function setUniform4iv(uniform) {
        uniform._internalFormat === "Quat" ? this.gl.uniform4iv(uniform.location, [uniform.value.elements[0], uniform.value.elements[1], uniform.value.elements[2], uniform.value[3]]) : this.gl.uniform4iv(uniform.location, uniform.value);
      }
    }, {
      key: "setUniform4f",
      value: function setUniform4f(uniform) {
        uniform._internalFormat === "Quat" ? this.gl.uniform4f(uniform.location, uniform.value.elements[0], uniform.value.elements[1], uniform.value.elements[2], uniform.value[3]) : this.gl.uniform4f(uniform.location, uniform.value[0], uniform.value[1], uniform.value[2], uniform.value[3]);
      }
    }, {
      key: "setUniform4fv",
      value: function setUniform4fv(uniform) {
        uniform._internalFormat === "Quat" ? this.gl.uniform4fv(uniform.location, [uniform.value.elements[0], uniform.value.elements[1], uniform.value.elements[2], uniform.value[3]]) : this.gl.uniform4fv(uniform.location, uniform.value);
      }
    }, {
      key: "setUniformMatrix2fv",
      value: function setUniformMatrix2fv(uniform) {
        this.gl.uniformMatrix2fv(uniform.location, false, uniform.value);
      }
    }, {
      key: "setUniformMatrix3fv",
      value: function setUniformMatrix3fv(uniform) {
        this.gl.uniformMatrix3fv(uniform.location, false, uniform.value);
      }
    }, {
      key: "setUniformMatrix4fv",
      value: function setUniformMatrix4fv(uniform) {
        uniform._internalFormat === "Mat4" ? this.gl.uniformMatrix4fv(uniform.location, false, uniform.value.elements) : this.gl.uniformMatrix4fv(uniform.location, false, uniform.value);
      }
    }]);

    return Uniforms;
  }();
  /***
   Program class that creates, compiles and links the shaders
   Use a cache system to get already compiled shaders and save some CPU
   Also responsible for the creation, setting and updating of the uniforms (see Uniforms class object)
     params:
   @renderer (Renderer class object): our renderer class object
     @parent (Plane/ShaderPass class object): the mesh that will use that program
   @vertexShader (string): vertex shader as a string
   @fragmentShader (string): fragment shader as a string
     returns:
   @this: our newly created Program
   ***/


  var Program = /*#__PURE__*/function () {
    function Program(renderer) {
      var _ref4 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
          parent = _ref4.parent,
          vertexShader = _ref4.vertexShader,
          fragmentShader = _ref4.fragmentShader;

      _classCallCheck(this, Program);

      this.type = "Program";

      if (!renderer || renderer.type !== "Renderer") {
        throwError(this.type + ": Renderer not passed as first argument", renderer);
      } else if (!renderer.gl) {
        throwError(this.type + ": Renderer WebGL context is undefined", renderer);
      }

      this.renderer = renderer;
      this.gl = this.renderer.gl;
      this.parent = parent;
      this.vsCode = vertexShader;
      this.fsCode = fragmentShader;
      this.compiled = true;
      this.setupProgram();
    }
    /***
     Compile our WebGL shaders based on our written shaders
       params:
     @shaderCode (string): shader code
     @shaderType (shaderType): WebGL shader type (vertex or fragment)
       returns:
     @shader (compiled shader): our compiled shader
     ***/


    _createClass(Program, [{
      key: "createShader",
      value: function createShader(shaderCode, shaderType) {
        var shader = this.gl.createShader(shaderType);
        this.gl.shaderSource(shader, shaderCode);
        this.gl.compileShader(shader); // check shader compilation status only when not in production mode

        if (!this.renderer.production) {
          if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            // shader debugging log as seen in THREE.js WebGLProgram source code
            var shaderTypeString = shaderType === this.gl.VERTEX_SHADER ? "vertex shader" : "fragment shader";
            var shaderSource = this.gl.getShaderSource(shader);
            var shaderLines = shaderSource.split('\n');

            for (var i = 0; i < shaderLines.length; i++) {
              shaderLines[i] = i + 1 + ': ' + shaderLines[i];
            }

            shaderLines = shaderLines.join("\n");
            throwWarning(this.type + ": Errors occurred while compiling the", shaderTypeString, ":\n", this.gl.getShaderInfoLog(shader));
            throwError(shaderLines);
            this.compiled = false;
            return null;
          }
        }

        return shader;
      }
      /***
       Compiles and creates new shaders
       ***/

    }, {
      key: "useNewShaders",
      value: function useNewShaders() {
        this.vertexShader = this.createShader(this.vsCode, this.gl.VERTEX_SHADER);
        this.fragmentShader = this.createShader(this.fsCode, this.gl.FRAGMENT_SHADER);

        if (!this.vertexShader || !this.fragmentShader) {
          if (!this.renderer.production) throwWarning(this.type + ": Unable to find or compile the vertex or fragment shader");
        }
      }
    }, {
      key: "setupProgram",

      /***
       Checks whether the program has already been registered before creating it
       If yes, use the compiled program if the program should be shared, or just use the compiled shaders to create a new one else with createProgram()
       If not, compile the shaders and call createProgram()
       ***/
      value: function setupProgram() {
        var existingProgram = this.renderer.cache.getProgramFromShaders(this.vsCode, this.fsCode); // we found an existing program

        if (existingProgram) {
          // if we've decided to share existing programs, just return the existing one
          if (this.parent.shareProgram) {
            //return existingProgram;
            this.shared = true;
            this.vertexShader = existingProgram.vertexShader;
            this.fragmentShader = existingProgram.fragmentShader;
            this.program = existingProgram.program;
            this.id = existingProgram.id;
            this.activeTextures = existingProgram.activeTextures;
          } else {
            // we need to create a new program but we don't have to re compile the shaders
            this.vertexShader = existingProgram.vertexShader;
            this.fragmentShader = existingProgram.fragmentShader; // copy active textures as well

            this.activeTextures = existingProgram.activeTextures;
            this.createProgram();
          }
        } else {
          // compile the new shaders and create a new program
          this.useNewShaders();

          if (this.compiled) {
            this.createProgram();
          }
        }
      }
      /***
       Used internally to set up program based on the created shaders and attach them to the program
       Sets a list of active textures that are actually used by the shaders to avoid binding unused textures during draw calls
       Add the program to the cache
       ***/

    }, {
      key: "createProgram",
      value: function createProgram() {
        // set program id and type
        this.id = this.renderer.cache.programs.length;
        this.shared = this.parent.shareProgram; // we need to create a new shader program

        this.program = this.gl.createProgram(); // if shaders are valid, go on

        this.gl.attachShader(this.program, this.vertexShader);
        this.gl.attachShader(this.program, this.fragmentShader);
        this.gl.linkProgram(this.program); // free the shaders handles

        this.gl.deleteShader(this.vertexShader);
        this.gl.deleteShader(this.fragmentShader); // TODO getProgramParameter even in production to avoid errors?
        // check the shader program creation status only when not in production mode

        if (!this.renderer.production) {
          if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            throwWarning(this.type + ": Unable to initialize the shader program.");
            this.compiled = false;
            return;
          }
        } // store active textures (those that are used in the shaders) to avoid binding unused textures


        if (!this.activeTextures) {
          this.activeTextures = []; // check for program active textures

          var numUniforms = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);

          for (var i = 0; i < numUniforms; i++) {
            var activeUniform = this.gl.getActiveUniform(this.program, i); // if it's a texture add it to our activeTextures array

            if (activeUniform.type === this.gl.SAMPLER_2D) {
              this.activeTextures.push(activeUniform.name);
            }
          }
        } // add it to our program manager programs list


        this.renderer.cache.addProgram(this);
      }
      /*** UNIFORMS ***/

      /***
       Creates and attach the uniform handlers to our program
         params:
       @uniforms (object): an object describing our uniforms (see Uniforms class object)
       ***/

    }, {
      key: "createUniforms",
      value: function createUniforms(uniforms) {
        this.uniformsManager = new Uniforms(this.renderer, this.program, this.shared, uniforms); // set them right away

        this.setUniforms();
      }
      /***
       Sets our uniforms (used on init and on context restoration)
       ***/

    }, {
      key: "setUniforms",
      value: function setUniforms() {
        // use this program
        this.renderer.useProgram(this);
        this.uniformsManager.setUniforms();
      }
      /***
       Updates our uniforms at each draw calls
       ***/

    }, {
      key: "updateUniforms",
      value: function updateUniforms() {
        // use this program
        this.renderer.useProgram(this);
        this.uniformsManager.updateUniforms();
      }
    }]);

    return Program;
  }();
  /***
   Geometry class handles attributes, VertexArrayObjects (if available) and vertices/UVs set up
     params:
   @renderer (Renderer class object): our renderer class object
     @program (object): our mesh's Program (see Program class object)
   @width (int): number of vertices along width
   @height (int): number of vertices along height
   @id (int): an integer based on geometry's width and height and used to avoid redundant buffer binding calls
     returns:
   @this: our newly created Geometry
   ***/


  var Geometry = /*#__PURE__*/function () {
    function Geometry(renderer) {
      var _ref5 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
          _ref5$program = _ref5.program,
          program = _ref5$program === void 0 ? null : _ref5$program,
          _ref5$width = _ref5.width,
          width = _ref5$width === void 0 ? 1 : _ref5$width,
          _ref5$height = _ref5.height,
          height = _ref5$height === void 0 ? 1 : _ref5$height;

      _classCallCheck(this, Geometry);

      this.type = "Geometry";

      if (!renderer || renderer.type !== "Renderer") {
        throwError(this.type + ": Renderer not passed as first argument", renderer);
      } else if (!renderer.gl) {
        throwError(this.type + ": Renderer WebGL context is undefined", renderer);
      }

      this.renderer = renderer;
      this.gl = this.renderer.gl; // unique plane buffers id based on width and height
      // used to get a geometry from cache

      this.definition = {
        id: width * height + width,
        width: width,
        height: height
      };
      this.setDefaultAttributes();
      this.setVerticesUVs();
    }
    /*** CONTEXT RESTORATION ***/

    /***
     Used internally to handle context restoration after the program has been successfully compiled again
     Reset the default attributes, the vertices and UVs and the program
     ***/


    _createClass(Geometry, [{
      key: "restoreContext",
      value: function restoreContext(program) {
        this.program = null;
        this.setDefaultAttributes();
        this.setVerticesUVs();
        this.setProgram(program);
      }
      /*** SET DEFAULT ATTRIBUTES ***/

      /***
       Our geometry default attributes that will handle the buffers
       We're just using vertices positions and texture coordinates
       ***/

    }, {
      key: "setDefaultAttributes",
      value: function setDefaultAttributes() {
        // our plane default attributes
        // if we'd want to introduce custom attributes we'd merge them with those
        this.attributes = {
          vertexPosition: {
            name: "aVertexPosition",
            size: 3
          },
          textureCoord: {
            name: "aTextureCoord",
            size: 3
          }
        };
      }
      /***
       Set our vertices and texture coordinates array
       Get them from the cache if possible
       ***/

    }, {
      key: "setVerticesUVs",
      value: function setVerticesUVs() {
        // we need to create our geometry and material objects
        var cachedGeometry = this.renderer.cache.getGeometryFromID(this.definition.id);

        if (cachedGeometry) {
          this.attributes.vertexPosition.array = cachedGeometry.vertices;
          this.attributes.textureCoord.array = cachedGeometry.uvs;
        } else {
          this.computeVerticesUVs(); // TODO better caching? We could pass all attributes to cache and handle arrays in there

          this.renderer.cache.addGeometry(this.definition.id, this.attributes.vertexPosition.array, this.attributes.textureCoord.array);
        }
      }
      /***
       Called on init and on context restoration to set up the attribute buffers
       Use VertexArrayObjects whenever possible
       ***/

    }, {
      key: "setProgram",
      value: function setProgram(program) {
        this.program = program.program;
        this.initAttributes(); // use vertex array objects if available

        if (this.renderer._isWebGL2) {
          this._vao = this.gl.createVertexArray();
          this.gl.bindVertexArray(this._vao);
        } else if (this.renderer.extensions['OES_vertex_array_object']) {
          this._vao = this.renderer.extensions['OES_vertex_array_object'].createVertexArrayOES();
          this.renderer.extensions['OES_vertex_array_object'].bindVertexArrayOES(this._vao);
        }

        this.initializeBuffers();
      }
      /***
       This creates our mesh attributes and buffers by looping over it
       ***/

    }, {
      key: "initAttributes",
      value: function initAttributes() {
        // loop through our attributes and create buffers and attributes locations
        for (var key in this.attributes) {
          this.attributes[key].location = this.gl.getAttribLocation(this.program, this.attributes[key].name);
          this.attributes[key].buffer = this.gl.createBuffer();
          this.attributes[key].numberOfItems = this.definition.width * this.definition.height * this.attributes[key].size * 2;
        }
      }
      /***
       This method is used internally to create our vertices coordinates and texture UVs
       we first create our UVs on a grid from [0, 0, 0] to [1, 1, 0]
       then we use the UVs to create our vertices coords
       ***/

    }, {
      key: "computeVerticesUVs",
      value: function computeVerticesUVs() {
        // geometry vertices and UVs
        this.attributes.vertexPosition.array = [];
        this.attributes.textureCoord.array = [];
        var vertices = this.attributes.vertexPosition.array;
        var uvs = this.attributes.textureCoord.array;

        for (var y = 0; y < this.definition.height; y++) {
          var v = y / this.definition.height;

          for (var x = 0; x < this.definition.width; x++) {
            var u = x / this.definition.width; // uvs and vertices
            // our uvs are ranging from 0 to 1, our vertices range from -1 to 1
            // first triangle

            uvs.push(u);
            uvs.push(v);
            uvs.push(0);
            vertices.push((u - 0.5) * 2);
            vertices.push((v - 0.5) * 2);
            vertices.push(0);
            uvs.push(u + 1 / this.definition.width);
            uvs.push(v);
            uvs.push(0);
            vertices.push((u + 1 / this.definition.width - 0.5) * 2);
            vertices.push((v - 0.5) * 2);
            vertices.push(0);
            uvs.push(u);
            uvs.push(v + 1 / this.definition.height);
            uvs.push(0);
            vertices.push((u - 0.5) * 2);
            vertices.push((v + 1 / this.definition.height - 0.5) * 2);
            vertices.push(0); // second triangle

            uvs.push(u);
            uvs.push(v + 1 / this.definition.height);
            uvs.push(0);
            vertices.push((u - 0.5) * 2);
            vertices.push((v + 1 / this.definition.height - 0.5) * 2);
            vertices.push(0);
            uvs.push(u + 1 / this.definition.width);
            uvs.push(v);
            uvs.push(0);
            vertices.push((u + 1 / this.definition.width - 0.5) * 2);
            vertices.push((v - 0.5) * 2);
            vertices.push(0);
            uvs.push(u + 1 / this.definition.width);
            uvs.push(v + 1 / this.definition.height);
            uvs.push(0);
            vertices.push((u + 1 / this.definition.width - 0.5) * 2);
            vertices.push((v + 1 / this.definition.height - 0.5) * 2);
            vertices.push(0);
          }
        }
      }
      /***
       This method enables and binds our attributes buffers
       ***/

    }, {
      key: "initializeBuffers",
      value: function initializeBuffers() {
        if (!this.attributes) return; // loop through our attributes

        for (var key in this.attributes) {
          // bind attribute buffer
          this.gl.enableVertexAttribArray(this.attributes[key].location);
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.attributes[key].buffer);
          this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.attributes[key].array), this.gl.STATIC_DRAW); // set where the attribute gets its data

          this.gl.vertexAttribPointer(this.attributes[key].location, this.attributes[key].size, this.gl.FLOAT, false, 0, 0);
        }
      }
      /***
       Used inside our draw call to set the correct plane buffers before drawing it
       ***/

    }, {
      key: "bindBuffers",
      value: function bindBuffers() {
        if (this._vao) {
          if (this.renderer._isWebGL2) {
            this.gl.bindVertexArray(this._vao);
          } else {
            this.renderer.extensions['OES_vertex_array_object'].bindVertexArrayOES(this._vao);
          }
        } else {
          // loop through our attributes to bind the buffers and set the attribute pointer
          for (var key in this.attributes) {
            this.gl.enableVertexAttribArray(this.attributes[key].location);
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.attributes[key].buffer);
            this.gl.vertexAttribPointer(this.attributes[key].location, this.attributes[key].size, this.gl.FLOAT, false, 0, 0);
          }
        }
      }
      /***
       Draw a geometry
       ***/

    }, {
      key: "draw",
      value: function draw() {
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.attributes.vertexPosition.numberOfItems);
      }
      /***
       Dispose a geometry (ie delete its vertex array objects and buffers)
       ***/

    }, {
      key: "dispose",
      value: function dispose() {
        // delete buffers
        // each time we check for existing properties to avoid errors
        if (this._vao) {
          if (this.renderer._isWebGL2) {
            this.gl.deleteVertexArray(this._vao);
          } else {
            this.renderer.extensions['OES_vertex_array_object'].deleteVertexArrayOES(this._vao);
          }
        }

        for (var key in this.attributes) {
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.attributes[key].buffer);
          this.gl.bufferData(this.gl.ARRAY_BUFFER, 1, this.gl.STATIC_DRAW);
          this.gl.deleteBuffer(this.attributes[key].buffer);
        }

        this.attributes = null;
      }
    }]);

    return Geometry;
  }();
  /***
   Here we create a Mat4 class object
   This is a really basic Matrix4 class used for matrix calculations
   Highly based on https://github.com/mrdoob/three.js/blob/dev/src/math/Matrix4.js and http://glmatrix.net/docs/mat4.js.html
     params :
   @elements (Float32Array of length 16): our matrix array. Default to identity matrix.
     returns :
   @this: our Mat4 class object
   ***/
  // TODO lot of (unused at the time) methods are missing


  var Mat4 = /*#__PURE__*/function () {
    function Mat4() {
      var elements = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

      _classCallCheck(this, Mat4);

      this.type = "Mat4";
      this.elements = elements;
    }
    /***
     Sets the matrix values from an array
       params:
     @array (array): an array of at least 16 elements
       returns:
     @this (Mat4 class object): this matrix after being set
     ***/


    _createClass(Mat4, [{
      key: "setFromArray",
      value: function setFromArray(array) {
        for (var i = 0; i < this.elements.length; i++) {
          this.elements[i] = array[i];
        }

        return this;
      }
      /***
       Copy another Mat4
         params:
       @matrix (Mat4 class object): matrix to copy
         returns:
       @this (Mat4 class object): this matrix after copy
       ***/

    }, {
      key: "copy",
      value: function copy(matrix) {
        var array = matrix.elements;
        this.elements[0] = array[0];
        this.elements[1] = array[1];
        this.elements[2] = array[2];
        this.elements[3] = array[3];
        this.elements[4] = array[4];
        this.elements[5] = array[5];
        this.elements[6] = array[6];
        this.elements[7] = array[7];
        this.elements[8] = array[8];
        this.elements[9] = array[9];
        this.elements[10] = array[10];
        this.elements[11] = array[11];
        this.elements[12] = array[12];
        this.elements[13] = array[13];
        this.elements[14] = array[14];
        this.elements[15] = array[15];
        return this;
      }
      /***
       Simple matrix multiplication helper
         params:
       @matrix (Mat4 class object): Mat4 to multiply with
         returns:
       @result (Mat4 class object): Mat4 after multiplication
       ***/

    }, {
      key: "multiply",
      value: function multiply(matrix) {
        var a = this.elements;
        var b = matrix.elements;
        var result = new Mat4();
        result.elements[0] = b[0] * a[0] + b[1] * a[4] + b[2] * a[8] + b[3] * a[12];
        result.elements[1] = b[0] * a[1] + b[1] * a[5] + b[2] * a[9] + b[3] * a[13];
        result.elements[2] = b[0] * a[2] + b[1] * a[6] + b[2] * a[10] + b[3] * a[14];
        result.elements[3] = b[0] * a[3] + b[1] * a[7] + b[2] * a[11] + b[3] * a[15];
        result.elements[4] = b[4] * a[0] + b[5] * a[4] + b[6] * a[8] + b[7] * a[12];
        result.elements[5] = b[4] * a[1] + b[5] * a[5] + b[6] * a[9] + b[7] * a[13];
        result.elements[6] = b[4] * a[2] + b[5] * a[6] + b[6] * a[10] + b[7] * a[14];
        result.elements[7] = b[4] * a[3] + b[5] * a[7] + b[6] * a[11] + b[7] * a[15];
        result.elements[8] = b[8] * a[0] + b[9] * a[4] + b[10] * a[8] + b[11] * a[12];
        result.elements[9] = b[8] * a[1] + b[9] * a[5] + b[10] * a[9] + b[11] * a[13];
        result.elements[10] = b[8] * a[2] + b[9] * a[6] + b[10] * a[10] + b[11] * a[14];
        result.elements[11] = b[8] * a[3] + b[9] * a[7] + b[10] * a[11] + b[11] * a[15];
        result.elements[12] = b[12] * a[0] + b[13] * a[4] + b[14] * a[8] + b[15] * a[12];
        result.elements[13] = b[12] * a[1] + b[13] * a[5] + b[14] * a[9] + b[15] * a[13];
        result.elements[14] = b[12] * a[2] + b[13] * a[6] + b[14] * a[10] + b[15] * a[14];
        result.elements[15] = b[12] * a[3] + b[13] * a[7] + b[14] * a[11] + b[15] * a[15];
        return result;
      }
      /***
       Get matrix inverse
         returns:
       @result (Mat4 class object): inverted Mat4
       ***/

    }, {
      key: "getInverse",
      value: function getInverse() {
        var te = this.elements;
        var out = new Mat4();
        var oe = out.elements;
        var a00 = te[0],
            a01 = te[1],
            a02 = te[2],
            a03 = te[3];
        var a10 = te[4],
            a11 = te[5],
            a12 = te[6],
            a13 = te[7];
        var a20 = te[8],
            a21 = te[9],
            a22 = te[10],
            a23 = te[11];
        var a30 = te[12],
            a31 = te[13],
            a32 = te[14],
            a33 = te[15];
        var b00 = a00 * a11 - a01 * a10;
        var b01 = a00 * a12 - a02 * a10;
        var b02 = a00 * a13 - a03 * a10;
        var b03 = a01 * a12 - a02 * a11;
        var b04 = a01 * a13 - a03 * a11;
        var b05 = a02 * a13 - a03 * a12;
        var b06 = a20 * a31 - a21 * a30;
        var b07 = a20 * a32 - a22 * a30;
        var b08 = a20 * a33 - a23 * a30;
        var b09 = a21 * a32 - a22 * a31;
        var b10 = a21 * a33 - a23 * a31;
        var b11 = a22 * a33 - a23 * a32; // Calculate the determinant

        var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

        if (!det) {
          return null;
        }

        det = 1 / det;
        oe[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        oe[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        oe[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        oe[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        oe[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        oe[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        oe[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        oe[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        oe[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        oe[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        oe[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        oe[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        oe[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        oe[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        oe[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        oe[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
        return out;
      }
      /***
       Simple Mat4 scaling helper
         params :
       @vector (Vec3 class object): Vec3 representing scale along X, Y and Z axis
         returns :
       @result (Mat4 class object): Mat4 after scaling
       ***/

    }, {
      key: "scale",
      value: function scale(vector) {
        var a = this.elements;
        var result = new Mat4();
        result.elements[0] = vector.x * a[0 * 4 + 0];
        result.elements[1] = vector.x * a[0 * 4 + 1];
        result.elements[2] = vector.x * a[0 * 4 + 2];
        result.elements[3] = vector.x * a[0 * 4 + 3];
        result.elements[4] = vector.y * a[1 * 4 + 0];
        result.elements[5] = vector.y * a[1 * 4 + 1];
        result.elements[6] = vector.y * a[1 * 4 + 2];
        result.elements[7] = vector.y * a[1 * 4 + 3];
        result.elements[8] = vector.z * a[2 * 4 + 0];
        result.elements[9] = vector.z * a[2 * 4 + 1];
        result.elements[10] = vector.z * a[2 * 4 + 2];
        result.elements[11] = vector.z * a[2 * 4 + 3];

        if (a !== result.elements) {
          result.elements[12] = a[12];
          result.elements[13] = a[13];
          result.elements[14] = a[14];
          result.elements[15] = a[15];
        }

        return result;
      }
      /***
       Creates a matrix from a quaternion rotation, vector translation and vector scale, rotating and scaling around the given origin
       Equivalent for applying translation, rotation and scale matrices but much faster
       Source code from: http://glmatrix.net/docs/mat4.js.html
         params :
       @translation (Vec3 class object): translation vector
       @quaternion (Quat class object): rotation quaternion
       @scale (Vec3 class object): scale vector
       @origin (Vec3 class object): origin vector around which to scale and rotate
         returns :
       @this (Mat4 class object): matrix after transformations
       ***/

    }, {
      key: "composeFromOrigin",
      value: function composeFromOrigin(translation, quaternion, scale, origin) {
        var matrix = this.elements; // Quaternion math

        var x = quaternion.elements[0],
            y = quaternion.elements[1],
            z = quaternion.elements[2],
            w = quaternion.elements[3];
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
        var sz = scale.z; // scale along Z is always equal to 1 anyway

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
        return this;
      }
    }]);

    return Mat4;
  }();
  /***
   Here we create a Vec2 class object
   This is a really basic Vector2 class used for vector calculations
   Highly based on https://github.com/mrdoob/three.js/blob/dev/src/math/Vector2.js and http://glmatrix.net/docs/vec2.js.html
     params :
   @x (float): X component of our vector
   @y (float): Y component of our vector
     returns :
   @this: our Vec2 class object
   ***/
  // TODO lot of (unused at the time) methods are missing


  var Vec2 = /*#__PURE__*/function () {
    function Vec2() {
      var x = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
      var y = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

      _classCallCheck(this, Vec2);

      this.type = "Vec2";
      this.set(x, y);
    }
    /***
     Sets the vector from values
       params:
     @x (float): X component of our vector
     @y (float): Y component of our vector
       returns:
     @this (Vec2): this vector after being set
     ***/


    _createClass(Vec2, [{
      key: "set",
      value: function set(x, y) {
        this.x = x;
        this.y = y;
        return this;
      }
      /***
       Adds a vector to this vector
         params:
       @vector (Vec2): vector to add
         returns:
       @this (Vec2): this vector after addition
       ***/

    }, {
      key: "add",
      value: function add(vector) {
        this.x += vector.x;
        this.y += vector.y;
        return this;
      }
      /***
       Adds a scalar to this vector
         params:
       @value (float): number to add
         returns:
       @this (Vec2): this vector after addition
       ***/

    }, {
      key: "addScalar",
      value: function addScalar(value) {
        this.x += value;
        this.y += value;
        return this;
      }
      /***
       Subtracts a vector from this vector
         params:
       @vector (Vec2): vector to use for subtraction
         returns:
       @this (Vec2): this vector after subtraction
       ***/

    }, {
      key: "sub",
      value: function sub(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
        return this;
      }
      /***
       Subtracts a scalar to this vector
         params:
       @value (float): number to use for subtraction
         returns:
       @this (Vec2): this vector after subtraction
       ***/

    }, {
      key: "subScalar",
      value: function subScalar(value) {
        this.x -= value;
        this.y -= value;
        return this;
      }
      /***
       Multiplies a vector with this vector
         params:
       @vector (Vec2): vector to use for multiplication
         returns:
       @this (Vec2): this vector after multiplication
       ***/

    }, {
      key: "multiply",
      value: function multiply(vector) {
        this.x *= vector.x;
        this.y *= vector.y;
        return this;
      }
      /***
       Multiplies a scalar with this vector
         params:
       @value (float): number to use for multiplication
         returns:
       @this (Vec2): this vector after multiplication
       ***/

    }, {
      key: "multiplyScalar",
      value: function multiplyScalar(value) {
        this.x *= value;
        this.y *= value;
        return this;
      }
      /***
       Copy a vector into this vector
         params:
       @vector (Vec2): vector to copy
         returns:
       @this (Vec2): this vector after copy
       ***/

    }, {
      key: "copy",
      value: function copy(vector) {
        this.x = vector.x;
        this.y = vector.y;
        return this;
      }
      /***
       Clone this vector
         returns:
       @vector (Vec2): cloned vector
       ***/

    }, {
      key: "clone",
      value: function clone() {
        return new Vec2(this.x, this.y);
      }
      /***
       Merges this vector with a vector when values are NaN. Mostly used internally.
         params:
       @vector (Vec2): vector to use for sanitization
         returns:
       @vector (Vec2): sanitized vector
       ***/

    }, {
      key: "sanitizeNaNValuesWith",
      value: function sanitizeNaNValuesWith(vector) {
        this.x = isNaN(this.x) ? vector.x : parseFloat(this.x);
        this.y = isNaN(this.y) ? vector.y : parseFloat(this.y);
        return this;
      }
      /***
       Apply max values to this vector
         params:
       @vector (Vec2): vector representing max values
         returns:
       @vector (Vec2): vector with max values applied
       ***/

    }, {
      key: "max",
      value: function max(vector) {
        this.x = Math.max(this.x, vector.x);
        this.y = Math.max(this.y, vector.y);
        return this;
      }
      /***
       Apply min values to this vector
         params:
       @vector (Vec2): vector representing min values
         returns:
       @vector (Vec2): vector with min values applied
       ***/

    }, {
      key: "min",
      value: function min(vector) {
        this.x = Math.min(this.x, vector.x);
        this.y = Math.min(this.y, vector.y);
        return this;
      }
      /***
       Checks if 2 vectors are equal
         params:
       @vector (Vec2): vector to compare
         returns:
       @isEqual (bool): whether the vectors are equals or not
       ***/

    }, {
      key: "equals",
      value: function equals(vector) {
        return this.x === vector.x && this.y === vector.y;
      }
      /***
       Normalize this vector
         returns:
       @this (Vec2): normalized vector
       ***/

    }, {
      key: "normalize",
      value: function normalize() {
        // normalize
        var len = this.x * this.x + this.y * this.y;

        if (len > 0) {
          len = 1 / Math.sqrt(len);
        }

        this.x *= len;
        this.y *= len;
        return this;
      }
      /***
       Calculates the dot product of 2 vectors
         params:
       @vector (Vec2): vector to use for dot product
         returns:
       @dotProduct (float): dot product of the 2 vectors
       ***/

    }, {
      key: "dot",
      value: function dot(vector) {
        return this.x * vector.x + this.y * vector.y;
      }
    }]);

    return Vec2;
  }();
  /***
   Texture class objects used by render targets, shader passes and planes.
     params:
   @renderer (Curtains renderer or Renderer class object): our curtains object OR our curtains renderer object
     @isFBOTexture (bool): Whether this texture is used by a render target/frame buffer object. Default to false
   @fromTexture (bool): Whether this texture should copy another texture right from init (and avoid creating a new webgl texture). Default to false
   @loader (TextureLoader class object): loader used to create that texture and load its source. Default to null
     @sampler (string): the texture sampler's name that will be used in the shaders
     @floatingPoint (string): texture floating point to apply. Could be "float", "half-float" or "none". Default to "none"
     @premultiplyAlpha (bool): Whether this texture should handle premultiplied alpha. Default to false
   @anisotropy (int): Texture anisotropy (see https://developer.mozilla.org/en-US/docs/Web/API/EXT_texture_filter_anisotropic). Default to 1
   @generateMipmap (bool): Whether to generate texture mipmaps (see https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/generateMipmap). Default to true except for frame buffer objects textures.
     see https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/samplerParameter
   @wrapS (GLenum): WebGL constant specifying the texture wrapping function for the texture coordinate S
   @wrapT (GLenum): WebGL constant specifying the texture wrapping function for the texture coordinate T
   @minFilter (GLenum): WebGL constant specifying the texture minification filter
   @magFilter (GLenum): WebGL constant specifying the texture magnification filter
     returns:
   @this: our newly created Texture class object
   ***/


  var Texture = /*#__PURE__*/function () {
    function Texture(renderer) {
      var _ref6 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
          _ref6$isFBOTexture = _ref6.isFBOTexture,
          isFBOTexture = _ref6$isFBOTexture === void 0 ? false : _ref6$isFBOTexture,
          _ref6$fromTexture = _ref6.fromTexture,
          fromTexture = _ref6$fromTexture === void 0 ? false : _ref6$fromTexture,
          loader = _ref6.loader,
          sampler = _ref6.sampler,
          _ref6$floatingPoint = _ref6.floatingPoint,
          floatingPoint = _ref6$floatingPoint === void 0 ? "none" : _ref6$floatingPoint,
          _ref6$premultiplyAlph = _ref6.premultiplyAlpha,
          premultiplyAlpha = _ref6$premultiplyAlph === void 0 ? false : _ref6$premultiplyAlph,
          _ref6$anisotropy = _ref6.anisotropy,
          anisotropy = _ref6$anisotropy === void 0 ? 1 : _ref6$anisotropy,
          _ref6$generateMipmap = _ref6.generateMipmap,
          generateMipmap = _ref6$generateMipmap === void 0 ? null : _ref6$generateMipmap,
          wrapS = _ref6.wrapS,
          wrapT = _ref6.wrapT,
          minFilter = _ref6.minFilter,
          magFilter = _ref6.magFilter;

      _classCallCheck(this, Texture);

      this.type = "Texture"; // we could pass our curtains object OR our curtains renderer object

      renderer = renderer && renderer.renderer || renderer;

      if (!renderer || renderer.type !== "Renderer") {
        throwError(this.type + ": Renderer not passed as first argument", renderer);
      } else if (!renderer.gl) {
        throwError(this.type + ": Renderer WebGL context is undefined", renderer);
      }

      this.renderer = renderer;
      this.gl = this.renderer.gl;
      this.uuid = generateUUID(); // texture parameters

      this._globalParameters = {
        // global gl context parameters
        unpackAlignment: 4,
        flipY: !isFBOTexture,
        premultiplyAlpha: premultiplyAlpha,
        // texImage2D properties
        floatingPoint: floatingPoint,
        type: this.gl.UNSIGNED_BYTE,
        internalFormat: this.gl.RGBA,
        format: this.gl.RGBA
      };
      this.parameters = {
        // per texture parameters
        anisotropy: anisotropy,
        generateMipmap: generateMipmap,
        wrapS: wrapS || this.gl.CLAMP_TO_EDGE,
        wrapT: wrapT || this.gl.CLAMP_TO_EDGE,
        minFilter: minFilter || this.gl.LINEAR,
        magFilter: magFilter || this.gl.LINEAR,
        _shouldUpdate: true
      }; // per texture state

      this._initState(); // is it a frame buffer object texture?
      // if it's not, type will change when the source will be loaded


      this.sourceType = isFBOTexture ? "fbo" : "empty";
      this._samplerName = sampler; // prepare texture sampler

      this._sampler = {
        isActive: false
      }; // we will always declare a texture matrix

      this._textureMatrix = {
        matrix: new Mat4()
      };
      this.scale = new Vec2(1, 1); // source loading and GPU uploading flags

      this._loader = loader;
      this._sourceLoaded = false;
      this._uploaded = false; // _willUpdate and shouldUpdate property are set to false by default
      // we will handle that in the setSource() method for videos and canvases

      this._willUpdate = false;
      this.shouldUpdate = false; // if we need to force a texture update

      this._forceUpdate = false; // custom user properties

      this.userData = {}; // useful flag to avoid binding texture that does not belong to current context

      this._canDraw = false; // is it set from an existing texture?

      if (fromTexture) {
        this._copyOnInit = true;
        this._copiedFrom = fromTexture; // everything else will be done when adding a parent to that texture

        return;
      }

      this._copyOnInit = false; // init our texture

      this._initTexture();
    }
    /***
     Init per-texture parameters state
     Called on init and on context restoration to force parameters settings
     ***/


    _createClass(Texture, [{
      key: "_initState",
      value: function _initState() {
        this._state = {
          anisotropy: 1,
          generateMipmap: false,
          wrapS: null,
          wrapT: null,
          minFilter: null,
          magFilter: this.gl.LINEAR // default to gl.LINEAR

        };
      }
      /***
       Init our texture object
       ***/

    }, {
      key: "_initTexture",
      value: function _initTexture() {
        // create our WebGL texture
        this._sampler.texture = this.gl.createTexture(); // bind the texture the target (TEXTURE_2D) of the active texture unit.

        this.gl.bindTexture(this.gl.TEXTURE_2D, this._sampler.texture);

        if (this.sourceType === "empty") {
          // draw a black plane before the real texture's content has been loaded
          this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this._globalParameters.internalFormat, 1, 1, 0, this._globalParameters.format, this._globalParameters.type, new Uint8Array([0, 0, 0, 255]));
          this._canDraw = true;
        }
      }
      /*** RESTORING CONTEXT ***/

      /***
       Restore a WebGL texture that is a copy
       Depending on whether it's a copy from start or not, just reset its uniforms or run the full init
       And finally copy our original texture back again
       ***/

    }, {
      key: "_restoreFromTexture",
      value: function _restoreFromTexture() {
        // init again if needed
        if (!this._copyOnInit) {
          this._initTexture();
        } // a texture shouldn't be restored if it does not have a parent
        // since it's always the parent that calls the _restoreContext() method


        if (this._parent) {
          // set uniforms again
          this._setTextureUniforms(); // update the texture matrix uniform as well


          this._setSize();
        } // copy our texture again


        this.copy(this._copiedFrom);
        this._canDraw = true;
      }
      /***
       Restore our WebGL texture
       If it is an original texture, just re run the init function and eventually reset its source
       If it is a texture set from another texture, wait for the original texture to be ready first
       ***/

    }, {
      key: "_restoreContext",
      value: function _restoreContext() {
        var _this11 = this;

        // avoid binding that texture before reseting it
        this._canDraw = false;
        this._sampler.isActive = false;

        this._initState(); // force mip map regeneration if needed


        this._state.generateMipmap = false;
        this.parameters._shouldUpdate = true; // this is an original texture, reset it right away

        if (!this._copiedFrom) {
          this._initTexture();

          if (this._parent) {
            this._setParent();
          }

          if (this.source) {
            this.setSource(this.source); // cache again if it is an image
            // also since it's an image it has been uploaded in setSource()

            if (this.sourceType === "image") {
              this.renderer.cache.addTexture(this);
            } else {
              // force update
              this.needUpdate();
            }
          }

          this._canDraw = true;
        } else {
          // wait for the original texure to be ready before attempting to restore the copy
          var queue = this.renderer.nextRender.add(function () {
            if (_this11._copiedFrom._canDraw) {
              _this11._restoreFromTexture(); // remove from callback queue


              queue.keep = false;
            }
          }, true);
        }
      }
      /*** ADD PARENT ***/

      /***
       Adds a parent to a texture
       Sets its index, its parent and add it to the parent textures array as well
       Then runs _setParent() to set the size and uniforms if needed
       ***/

    }, {
      key: "addParent",
      value: function addParent(parent) {
        if (!parent || parent.type !== "Plane" && parent.type !== "ShaderPass" && parent.type !== "RenderTarget") {
          if (!this.renderer.production) {
            throwWarning(this.type + ": cannot add texture as a child of ", parent, " because it is not a valid parent");
          }

          return;
        } // add parent property


        this._parent = parent; // update parent textures array

        this.index = this._parent.textures.length;

        this._parent.textures.push(this); // now set its parent for real


        this._setParent();
      }
      /***
       Sets the parent
       Basically sets the uniforms names and locations and sizes
       ***/

    }, {
      key: "_setParent",
      value: function _setParent() {
        var _this12 = this;

        // prepare texture sampler
        this._sampler.name = this._samplerName || "uSampler" + this.index; // we will always declare a texture matrix

        this._textureMatrix.name = this._samplerName ? this._samplerName + "Matrix" : "uTextureMatrix" + this.index; // if the parent has a program it means its not a render target texture

        if (this._parent._program) {
          if (!this._parent._program.compiled) {
            if (!this.renderer.production) {
              throwWarning(this.type + ": Unable to create the texture because the program is not valid");
            }

            return;
          } // set uniform


          this._setTextureUniforms();

          if (this._copyOnInit) {
            // copy the original texture on next render
            this.renderer.nextRender.add(function () {
              return _this12.copy(_this12._copiedFrom);
            }); // we're done!

            return;
          }

          if (!this.source) {
            // set its size based on parent element size for now
            this._size = {
              width: this._parent._boundingRect.document.width,
              height: this._parent._boundingRect.document.height
            };
          } else if (this._parent.loader) {
            // we're adding a parent to a texture that already has a source
            // it means the source should have been loaded before the parent was set
            // add it to the right asset array if needed
            this._parent.loader._addSourceToParent(this.source, this.sourceType);
          }

          this._setSize();
        } else if (this._parent.type === "RenderTarget") {
          // its a render target texture, it has no uniform location and no texture matrix
          this._size = {
            width: this._parent._size && this._parent._size.width || this.renderer._boundingRect.width,
            height: this._parent._size && this._parent._size.height || this.renderer._boundingRect.height
          }; // updload to gpu

          this._upload(); // update render texture parameters because it will never be drawn (hence not called)


          this._updateTexParameters();

          this._canDraw = true;
        }
      }
      /***
       Checks if this texture has a parent
         return:
       @hasParent (bool): whether this texture has a parent or not
       ***/

    }, {
      key: "hasParent",
      value: function hasParent() {
        return !!this._parent;
      }
      /*** SEND DATA TO THE GPU ***/

      /***
       Check if our textures is effectively used in our shaders
       If so, set it to active, get its uniform locations and bind it to our texture unit
       ***/

    }, {
      key: "_setTextureUniforms",
      value: function _setTextureUniforms() {
        // check if our texture is used in our program shaders
        // if so, get its uniform locations and bind it to our program
        for (var i = 0; i < this._parent._program.activeTextures.length; i++) {
          if (this._parent._program.activeTextures[i] === this._sampler.name) {
            // this texture is active
            this._sampler.isActive = true; // use the program and get our sampler and texture matrices uniforms

            this.renderer.useProgram(this._parent._program); // set our texture sampler uniform

            this._sampler.location = this.gl.getUniformLocation(this._parent._program.program, this._sampler.name); // texture matrix uniform

            this._textureMatrix.location = this.gl.getUniformLocation(this._parent._program.program, this._textureMatrix.name); // tell the shader we bound the texture to our indexed texture unit

            this.gl.uniform1i(this._sampler.location, this.index);
          }
        }
      }
      /***
       This copies an already existing Texture object to our texture
       DEPRECATED
         params:
       @texture (Texture): texture to set from
       ***/

    }, {
      key: "setFromTexture",
      value: function setFromTexture(texture) {
        if (!this.renderer.production) {
          throwWarning(this.type + ": setFromTexture() is deprecated, use copy() instead");
        }

        this.copy(texture);
      }
      /***
       This copies an already existing Texture object to our texture
         params:
       @texture (Texture): texture to set from
       ***/

    }, {
      key: "copy",
      value: function copy(texture) {
        if (!texture || texture.type !== "Texture") {
          if (!this.renderer.production) {
            throwWarning(this.type + ": Unable to set the texture from texture:", texture);
          }

          return;
        } // copy states
        //this._globalParameters = texture._globalParameters;


        this.parameters = texture.parameters;
        this._state = texture._state; // copy source

        this._size = texture._size;
        this._sourceLoaded = texture._sourceLoaded;
        this._uploaded = texture._uploaded;
        this.sourceType = texture.sourceType;
        this.source = texture.source;
        this._videoFrameCallbackID = texture._videoFrameCallbackID; // copy texture

        this._sampler.texture = texture._sampler.texture; // keep a track from the original one

        this._copiedFrom = texture; // update its texture matrix if needed and we're good to go!

        if (this._parent && this._parent._program && (!this._canDraw || !this._textureMatrix.matrix)) {
          this._setSize();

          this._canDraw = true;
        } // force rendering


        this.renderer.needRender();
      }
      /*** LOADING SOURCES ***/

      /***
       This uses our source as texture
         params:
       @source (images/video/canvas): either an image, a video or a canvas
       ***/

    }, {
      key: "setSource",
      value: function setSource(source) {
        var _this13 = this;

        // fire callback during load (useful for a loader)
        if (!this._sourceLoaded) {
          // texture source loaded callback
          this.renderer.nextRender.add(function () {
            return _this13._onSourceLoadedCallback && _this13._onSourceLoadedCallback();
          });
        } // check for cache


        var cachedTexture = this.renderer.cache.getTextureFromSource(source); // if we have a cached texture, just copy it

        if (cachedTexture) {
          // force texture uploaded callback
          if (!this._uploaded) {
            // GPU uploading callback
            this.renderer.nextRender.add(function () {
              return _this13._onSourceUploadedCallback && _this13._onSourceUploadedCallback();
            });
            this._uploaded = true;
          }

          this.copy(cachedTexture);
          this.resize();
          return;
        } // no cached texture, proceed normally


        this.source = source;

        if (this.sourceType === "empty") {
          if (source.tagName.toUpperCase() === "IMG") {
            this.sourceType = "image";
          } else if (source.tagName.toUpperCase() === "VIDEO") {
            this.sourceType = "video"; // a video should be updated by default
            // _willUpdate property will be set to true if the video has data to draw

            this.shouldUpdate = true;
          } else if (source.tagName.toUpperCase() === "CANVAS") {
            this.sourceType = "canvas"; // a canvas could change each frame so we need to update it by default

            this._willUpdate = true;
            this.shouldUpdate = true;
          } else if (!this.renderer.production) {
            throwWarning(this.type + ": this HTML tag could not be converted into a texture:", source.tagName);
          }
        }

        this._size = {
          width: this.source.naturalWidth || this.source.width || this.source.videoWidth,
          height: this.source.naturalHeight || this.source.height || this.source.videoHeight
        }; // our source is loaded now

        this._sourceLoaded = true; // no need to set WebGL active texture unit here, we'll do it at run time for each texture
        // binding the texture is enough

        this.gl.bindTexture(this.gl.TEXTURE_2D, this._sampler.texture);
        this.resize(); // upload our webgl texture only if it is an image
        // canvas and video textures will be updated anyway in the rendering loop
        // thanks to the shouldUpdate and _willUpdate flags

        if (this.sourceType === "image") {
          // generate mip maps if they have not been explicitly disabled
          this.parameters.generateMipmap = this.parameters.generateMipmap || this.parameters.generateMipmap === null;
          this.parameters._shouldUpdate = this.parameters.generateMipmap;
          this._state.generateMipmap = false;

          this._upload();
        } // update scene


        this.renderer.needRender();
      }
      /*** TEXTURE PARAMETERS ***/

      /***
       Updates textures parameters that depends on global WebGL context state
       Typically unpacking, flipY and premultiplied alpha
       Usually called before uploading a texture to the GPU
       ***/

    }, {
      key: "_updateGlobalTexParameters",
      value: function _updateGlobalTexParameters() {
        // unpack alignment
        if (this.renderer.state.unpackAlignment !== this._globalParameters.unpackAlignment) {
          this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, this._globalParameters.unpackAlignment);
          this.renderer.state.unpackAlignment = this._globalParameters.unpackAlignment;
        } // flip Y


        if (this.renderer.state.flipY !== this._globalParameters.flipY) {
          this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, this._globalParameters.flipY);
          this.renderer.state.flipY = this._globalParameters.flipY;
        } // premultiplied alpha


        if (this.renderer.state.premultiplyAlpha !== this._globalParameters.premultiplyAlpha) {
          this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this._globalParameters.premultiplyAlpha);
          this.renderer.state.premultiplyAlpha = this._globalParameters.premultiplyAlpha;
        } // floating point textures


        if (this._globalParameters.floatingPoint === "half-float") {
          if (this.renderer._isWebGL2 && this.renderer.extensions['EXT_color_buffer_float']) {
            this._globalParameters.internalFormat = this.gl.RGBA16F;
            this._globalParameters.type = this.gl.HALF_FLOAT;
          } else if (this.renderer.extensions['OES_texture_half_float']) {
            this._globalParameters.type = this.renderer.extensions['OES_texture_half_float'].HALF_FLOAT_OES;
          } else if (!this.renderer.production) {
            throwWarning(this.type + ": could not use half-float textures because the extension is not available");
          }
        } else if (this._globalParameters.floatingPoint === "float") {
          if (this.renderer._isWebGL2 && this.renderer.extensions['EXT_color_buffer_float']) {
            this._globalParameters.internalFormat = this.gl.RGBA16F;
            this._globalParameters.type = this.gl.FLOAT;
          } else if (this.renderer.extensions['OES_texture_float']) {
            this._globalParameters.type = this.renderer.extensions['OES_texture_half_float'].FLOAT;
          } else if (!this.renderer.production) {
            throwWarning(this.type + ": could not use float textures because the extension is not available");
          }
        }
      }
      /***
       Updates per-textures parameters
       Wrapping, filters, anisotropy and mipmaps generation
       Usually called after uploading a texture to the GPU
       ***/

    }, {
      key: "_updateTexParameters",
      value: function _updateTexParameters() {
        // be sure we're updating the right texture
        if (this.index && this.renderer.state.activeTexture !== this.index) {
          this._bindTexture(this);
        } // wrapS


        if (this.parameters.wrapS !== this._state.wrapS) {
          if (!this.renderer._isWebGL2 && (!isPowerOf2(this._size.width) || !isPowerOf2(this._size.height))) {
            this.parameters.wrapS = this.gl.CLAMP_TO_EDGE;
          } // handle wrong wrapS values


          if (this.parameters.wrapS !== this.gl.REPEAT && this.parameters.wrapS !== this.gl.CLAMP_TO_EDGE && this.parameters.wrapS !== this.gl.MIRRORED_REPEAT) {
            if (!this.renderer.production) {
              throwWarning(this.type + ": Wrong wrapS value", this.parameters.wrapS, "for this texture:", this, "\ngl.CLAMP_TO_EDGE wrapping will be used instead");
            }

            this.parameters.wrapS = this.gl.CLAMP_TO_EDGE;
          }

          this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.parameters.wrapS);
          this._state.wrapS = this.parameters.wrapS;
        } // wrapT


        if (this.parameters.wrapT !== this._state.wrapT) {
          if (!this.renderer._isWebGL2 && (!isPowerOf2(this._size.width) || !isPowerOf2(this._size.height))) {
            this.parameters.wrapT = this.gl.CLAMP_TO_EDGE;
          } // handle wrong wrapT values


          if (this.parameters.wrapT !== this.gl.REPEAT && this.parameters.wrapT !== this.gl.CLAMP_TO_EDGE && this.parameters.wrapT !== this.gl.MIRRORED_REPEAT) {
            if (!this.renderer.production) {
              throwWarning(this.type + ": Wrong wrapT value", this.parameters.wrapT, "for this texture:", this, "\ngl.CLAMP_TO_EDGE wrapping will be used instead");
            }

            this.parameters.wrapT = this.gl.CLAMP_TO_EDGE;
          }

          this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.parameters.wrapT);
          this._state.wrapT = this.parameters.wrapT;
        } // generate mip map only if it has a source


        if (this.parameters.generateMipmap && !this._state.generateMipmap && this.source) {
          if (!this.renderer._isWebGL2 && (!isPowerOf2(this._size.width) || !isPowerOf2(this._size.height))) {
            this.parameters.generateMipmap = false;
          } else {
            this.gl.generateMipmap(this.gl.TEXTURE_2D);
          }

          this._state.generateMipmap = this.parameters.generateMipmap;
        } // min filter


        if (this.parameters.minFilter !== this._state.minFilter) {
          // WebGL1 and non PO2
          if (!this.renderer._isWebGL2 && (!isPowerOf2(this._size.width) || !isPowerOf2(this._size.height))) {
            this.parameters.minFilter = this.gl.LINEAR;
          } // at this point if generateMipmap is null it means we will generate them later on


          if (!this.parameters.generateMipmap && this.parameters.generateMipmap !== null) {
            this.parameters.minFilter = this.gl.LINEAR;
          } // handle wrong minFilter values


          if (this.parameters.minFilter !== this.gl.LINEAR && this.parameters.minFilter !== this.gl.NEAREST && this.parameters.minFilter !== this.gl.NEAREST_MIPMAP_NEAREST && this.parameters.minFilter !== this.gl.LINEAR_MIPMAP_NEAREST && this.parameters.minFilter !== this.gl.NEAREST_MIPMAP_LINEAR && this.parameters.minFilter !== this.gl.LINEAR_MIPMAP_LINEAR) {
            if (!this.renderer.production) {
              throwWarning(this.type + ": Wrong minFilter value", this.parameters.minFilter, "for this texture:", this, "\ngl.LINEAR filtering will be used instead");
            }

            this.parameters.minFilter = this.gl.LINEAR;
          }

          this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.parameters.minFilter);
          this._state.minFilter = this.parameters.minFilter;
        } // mag filter


        if (this.parameters.magFilter !== this._state.magFilter) {
          if (!this.renderer._isWebGL2 && (!isPowerOf2(this._size.width) || !isPowerOf2(this._size.height))) {
            this.parameters.magFilter = this.gl.LINEAR;
          } // handle wrong magFilter values


          if (this.parameters.magFilter !== this.gl.LINEAR && this.parameters.magFilter !== this.gl.NEAREST) {
            if (!this.renderer.production) {
              throwWarning(this.type + ": Wrong magFilter value", this.parameters.magFilter, "for this texture:", this, "\ngl.LINEAR filtering will be used instead");
            }

            this.parameters.magFilter = this.gl.LINEAR;
          }

          this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.parameters.magFilter);
          this._state.magFilter = this.parameters.magFilter;
        } // anisotropy


        var anisotropyExt = this.renderer.extensions['EXT_texture_filter_anisotropic'];

        if (anisotropyExt && this.parameters.anisotropy !== this._state.anisotropy) {
          var max = this.gl.getParameter(anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
          this.parameters.anisotropy = Math.max(1, Math.min(this.parameters.anisotropy, max));
          this.gl.texParameterf(this.gl.TEXTURE_2D, anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT, this.parameters.anisotropy);
          this._state.anisotropy = this.parameters.anisotropy;
        }
      }
      /***
       Sets the texture wrapping for the texture coordinate S
         params:
       @wrapS (GLenum): WebGL constant specifying the texture wrapping function for the texture coordinate S
       ***/

    }, {
      key: "setWrapS",
      value: function setWrapS(wrapS) {
        if (this.parameters.wrapS !== wrapS) {
          this.parameters.wrapS = wrapS;
          this.parameters._shouldUpdate = true;
        }
      }
      /***
       Sets the texture wrapping for the texture coordinate T
         params:
       @wrapT (GLenum): WebGL constant specifying the texture wrapping function for the texture coordinate T
       ***/

    }, {
      key: "setWrapT",
      value: function setWrapT(wrapT) {
        if (this.parameters.wrapT !== wrapT) {
          this.parameters.wrapT = wrapT;
          this.parameters._shouldUpdate = true;
        }
      }
      /***
       Sets the texture minifaction filter value
         params:
       @minFilter (GLenum): WebGL constant specifying the texture minification filter
       ***/

    }, {
      key: "setMinFilter",
      value: function setMinFilter(minFilter) {
        if (this.parameters.minFilter !== minFilter) {
          this.parameters.minFilter = minFilter;
          this.parameters._shouldUpdate = true;
        }
      }
      /***
       Sets the texture magnifaction filter value
         params:
       @magFilter (GLenum): WebGL constant specifying the texture magnifaction filter
       ***/

    }, {
      key: "setMagFilter",
      value: function setMagFilter(magFilter) {
        if (this.parameters.magFilter !== magFilter) {
          this.parameters.magFilter = magFilter;
          this.parameters._shouldUpdate = true;
        }
      }
      /***
       Sets the texture anisotropy
         params:
       @anisotropy (int): Texture anisotropy value
       ***/

    }, {
      key: "setAnisotropy",
      value: function setAnisotropy(anisotropy) {
        anisotropy = isNaN(anisotropy) ? this.parameters.anisotropy : anisotropy;

        if (this.parameters.anisotropy !== anisotropy) {
          this.parameters.anisotropy = anisotropy;
          this.parameters._shouldUpdate = true;
        }
      }
      /***
       This forces a texture to be updated on the next draw call
       ***/

    }, {
      key: "needUpdate",
      value: function needUpdate() {
        this._forceUpdate = true;
      }
      /***
       This uses the requestVideoFrameCallback API to update the texture each time a new frame is displayed
       ***/

    }, {
      key: "_videoFrameCallback",
      value: function _videoFrameCallback() {
        var _this14 = this;

        this._willUpdate = true;
        this.source.requestVideoFrameCallback(function () {
          return _this14._videoFrameCallback();
        });
      }
      /***
       This updloads our texture to the GPU
       Called on init or inside our drawing loop if shouldUpdate property is set to true
       Typically used by videos or canvas
       ***/

    }, {
      key: "_upload",
      value: function _upload() {
        var _this15 = this;

        // set parameters that need to be set before texture uploading
        this._updateGlobalTexParameters();

        if (this.source) {
          this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this._globalParameters.internalFormat, this._globalParameters.format, this._globalParameters.type, this.source);
        } else if (this.sourceType === "fbo") {
          this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this._globalParameters.internalFormat, this._size.width, this._size.height, 0, this._globalParameters.format, this._globalParameters.type, this.source);
        } // texture has been uploaded


        if (!this._uploaded) {
          // GPU uploading callback
          this.renderer.nextRender.add(function () {
            return _this15._onSourceUploadedCallback && _this15._onSourceUploadedCallback();
          });
          this._uploaded = true;
        }
      }
      /*** TEXTURE SIZINGS ***/

      /***
       This is used to calculate how to crop/center an texture
         returns:
       @sizes (obj): an object containing plane sizes, source sizes and x and y offset to center the source in the plane
       ***/

    }, {
      key: "_getSizes",
      value: function _getSizes() {
        // if this is a fbo texture, its size is the same as its parent
        if (this.sourceType === "fbo") {
          return {
            parentWidth: this._parent._boundingRect.document.width,
            parentHeight: this._parent._boundingRect.document.height,
            sourceWidth: this._parent._boundingRect.document.width,
            sourceHeight: this._parent._boundingRect.document.height,
            xOffset: 0,
            yOffset: 0
          };
        } // remember our ShaderPass objects don't have a scale property


        var scale = this._parent.scale ? new Vec2(this._parent.scale.x, this._parent.scale.y) : new Vec2(1, 1);
        var parentWidth = this._parent._boundingRect.document.width * scale.x;
        var parentHeight = this._parent._boundingRect.document.height * scale.y;
        var sourceWidth = this._size.width;
        var sourceHeight = this._size.height;
        var sourceRatio = sourceWidth / sourceHeight;
        var parentRatio = parentWidth / parentHeight; // center image in its container

        var xOffset = 0;
        var yOffset = 0;

        if (parentRatio > sourceRatio) {
          // means parent is larger
          yOffset = Math.min(0, parentHeight - parentWidth * (1 / sourceRatio));
        } else if (parentRatio < sourceRatio) {
          // means parent is taller
          xOffset = Math.min(0, parentWidth - parentHeight * sourceRatio);
        }

        return {
          parentWidth: parentWidth,
          parentHeight: parentHeight,
          sourceWidth: sourceWidth,
          sourceHeight: sourceHeight,
          xOffset: xOffset,
          yOffset: yOffset
        };
      }
      /***
       Set the texture scale and then update its matrix
         params:
       @scale (Vec2 object): scale to apply on X and Y axes
       ***/

    }, {
      key: "setScale",
      value: function setScale(scale) {
        if (!scale.type || scale.type !== "Vec2") {
          if (!this.renderer.production) {
            throwWarning(this.type + ": Cannot set scale because the parameter passed is not of Vec2 type:", scale);
          }

          return;
        }

        scale.sanitizeNaNValuesWith(this.scale).max(new Vec2(0.001, 0.001));

        if (!scale.equals(this.scale)) {
          this.scale.copy(scale);
          this.resize();
        }
      }
      /***
       Gets our texture and parent sizes and tells our texture matrix to update based on those values
       ***/

    }, {
      key: "_setSize",
      value: function _setSize() {
        // if we need to update the texture matrix uniform
        if (this._parent && this._parent._program) {
          var sizes = this._getSizes(); // always update texture matrix anyway


          this._updateTextureMatrix(sizes);
        }
      }
      /***
       This is used to crop/center a texture
       If the texture is using texture matrix then we just have to update its matrix
       If it is a render pass texture we also upload the texture with its new size on the GPU
       ***/

    }, {
      key: "resize",
      value: function resize() {
        if (this.sourceType === "fbo") {
          // update size based on parent sizes (RenderTarget or ShaderPass)
          this._size = {
            width: this._parent._size && this._parent._size.width || this._parent._boundingRect.document.width,
            height: this._parent._size && this._parent._size.height || this._parent._boundingRect.document.height
          }; // reupload only if its not a texture set from another texture (means its a RenderTarget texture)

          if (!this._copiedFrom) {
            this.gl.bindTexture(this.gl.TEXTURE_2D, this._sampler.texture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this._globalParameters.internalFormat, this._size.width, this._size.height, 0, this._globalParameters.format, this._globalParameters.type, null);
          }
        } else if (this.source) {
          // reset texture sizes (useful for canvas because their dimensions might change on resize)
          this._size = {
            width: this.source.naturalWidth || this.source.width || this.source.videoWidth,
            height: this.source.naturalHeight || this.source.height || this.source.videoHeight
          };
        }

        this._setSize();
      }
      /***
       This updates our textures matrix uniform based on plane and sources sizes
         params:
       @sizes (object): object containing plane sizes, source sizes and x and y offset to center the source in the plane
       ***/

    }, {
      key: "_updateTextureMatrix",
      value: function _updateTextureMatrix(sizes) {
        // calculate scale to apply to the matrix
        var textureScale = new Vec2(sizes.parentWidth / (sizes.parentWidth - sizes.xOffset), sizes.parentHeight / (sizes.parentHeight - sizes.yOffset)); // apply texture scale

        textureScale.x /= this.scale.x;
        textureScale.y /= this.scale.y; // translate texture to center it

        var textureTranslation = new Mat4([1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, (1 - textureScale.x) / 2, (1 - textureScale.y) / 2, 0.0, 1.0]); // scale texture

        this._textureMatrix.matrix = textureTranslation.scale(textureScale); // update the texture matrix uniform

        this.renderer.useProgram(this._parent._program);
        this.gl.uniformMatrix4fv(this._textureMatrix.location, false, this._textureMatrix.matrix.elements);
      }
      /***
       This calls our loading callback and set our media as texture source
       ***/

    }, {
      key: "_onSourceLoaded",
      value: function _onSourceLoaded(source) {
        // set the media as our texture source
        this.setSource(source); // add to the cache if needed

        if (this.sourceType === "image") {
          this.renderer.cache.addTexture(this);
        }
      }
      /*** DRAWING ***/

      /***
       This is used to set the WebGL context active texture and bind it
         params:
       @texture (texture object): Our texture object containing our WebGL texture and its index
       ***/

    }, {
      key: "_bindTexture",
      value: function _bindTexture() {
        if (this._canDraw) {
          if (this.renderer.state.activeTexture !== this.index) {
            // tell WebGL we want to affect the texture at the plane's index unit
            this.gl.activeTexture(this.gl.TEXTURE0 + this.index);
            this.renderer.state.activeTexture = this.index;
          } // bind the texture to the plane's index unit


          this.gl.bindTexture(this.gl.TEXTURE_2D, this._sampler.texture);
        }
      }
      /***
       This is called to draw the texture
       ***/

    }, {
      key: "_draw",
      value: function _draw() {
        // only draw if the texture is active (used in the shader)
        if (this._sampler.isActive) {
          // bind the texture
          this._bindTexture(this); // if no videoFrameCallback check if the video is actually really playing


          if (this.sourceType === "video" && this.source && !this._videoFrameCallbackID && this.source.readyState >= this.source.HAVE_CURRENT_DATA && !this.source.paused) {
            this._willUpdate = true;
          }

          if (this._forceUpdate || this._willUpdate && this.shouldUpdate) {
            // force mipmaps regeneration if needed
            this._state.generateMipmap = false;

            this._upload();
          } // reset the video willUpdate flag


          if (this.sourceType === "video") {
            this._willUpdate = false;
          }

          this._forceUpdate = false;
        } // set parameters that need to be set after texture uploading


        if (this.parameters._shouldUpdate) {
          this._updateTexParameters();

          this.parameters._shouldUpdate = false;
        }
      }
      /*** EVENTS ***/

      /***
       This is called each time a source has been loaded for the first time
       TODO useless?
         params :
       @callback (function) : a function to execute
         returns :
       @this: our texture to handle chaining
       ***/

    }, {
      key: "onSourceLoaded",
      value: function onSourceLoaded(callback) {
        if (callback) {
          this._onSourceLoadedCallback = callback;
        }

        return this;
      }
      /***
       This is called each time a texture has been uploaded to the GPU for the first time
         params :
       @callback (function) : a function to execute
         returns :
       @this: our texture to handle chaining
       ***/

    }, {
      key: "onSourceUploaded",
      value: function onSourceUploaded(callback) {
        if (callback) {
          this._onSourceUploadedCallback = callback;
        }

        return this;
      }
      /*** DESTROYING ***/

      /***
       This is used to destroy a texture and free the memory space
       Usually used on a plane/shader pass/render target removal
         params:
       @force (bool, optional): force the texture to be deleted even if cached
       ***/

    }, {
      key: "_dispose",
      value: function _dispose() {
        var force = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

        if (this.sourceType === "video" || this.sourceType === "image" && !this.renderer.state.isActive) {
          // remove event listeners
          if (this._loader) {
            this._loader._removeSource(this);
          } // clear source


          this.source = null;
        } else if (this.sourceType === "canvas") {
          // clear all canvas states
          this.source.width = this.source.width; // clear source

          this.source = null;
        } // remove its parent


        this._parent = null; // do not delete original texture if this texture is a copy, or image texture if we're not destroying the context

        var shouldDelete = this.gl && !this._copiedFrom && (force || this.sourceType !== "image" || !this.renderer.state.isActive);

        if (shouldDelete) {
          // if the texture is in our textures cache array, remove it
          this.renderer.cache.removeTexture(this);
          this.gl.activeTexture(this.gl.TEXTURE0 + this.index);
          this.gl.bindTexture(this.gl.TEXTURE_2D, null);
          this.gl.deleteTexture(this._sampler.texture);
        }
      }
    }]);

    return Texture;
  }();
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
  // TODO create a new Image or Video element for each of this sources (allows to set crossorigin before src to avois CORS issues)?
  // TODO load assets with a web worker?


  var TextureLoader = /*#__PURE__*/function () {
    function TextureLoader(renderer) {
      var crossOrigin = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "anonymous";

      _classCallCheck(this, TextureLoader);

      this.type = "TextureLoader"; // we could pass our curtains object OR our curtains renderer object

      renderer = renderer && renderer.renderer || renderer; // throw warning if no renderer or webgl context

      if (!renderer || renderer.type !== "Renderer") {
        throwError(this.type + ": Renderer not passed as first argument", renderer);
      } else if (!renderer.gl) {
        throwError(this.type + ": Renderer WebGL context is undefined", renderer);
      } // renderer and webgl context


      this.renderer = renderer;
      this.gl = this.renderer.gl; // crossorigin policy to apply

      this.crossOrigin = crossOrigin; // keep a track of all sources loaded via this loader

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


    _createClass(TextureLoader, [{
      key: "_addElement",
      value: function _addElement(source, texture, successCallback, errorCallback) {
        var el = {
          source: source,
          texture: texture,
          load: this._sourceLoaded.bind(this, source, texture, successCallback),
          error: this._sourceLoadError.bind(this, source, errorCallback)
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

    }, {
      key: "_sourceLoadError",
      value: function _sourceLoadError(source, callback, error) {
        // execute callback
        if (callback) {
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

    }, {
      key: "_sourceLoaded",
      value: function _sourceLoaded(source, texture, callback) {
        var _this16 = this;

        // execute only once
        if (!texture._sourceLoaded) {
          texture._onSourceLoaded(source); // if this loader has a parent (means its a PlaneTextureLoader)


          if (this._parent) {
            // increment plane texture loader
            this._increment && this._increment();
            this.renderer.nextRender.add(function () {
              return _this16._parent._onLoadingCallback && _this16._parent._onLoadingCallback(texture);
            });
          }
        } // execute callback


        if (callback) {
          callback(texture);
        }
      }
      /***
       Get the source type based on its file extension if it's a string or it's tag name if its a HTML element
         params:
       @source (html element or string): html image, video, canvas element or source url
         returns :
       @sourceType (string): either "image", "video", "canvas" or null if source type cannot be determined
       ***/

    }, {
      key: "_getSourceType",
      value: function _getSourceType(source) {
        var sourceType;

        if (typeof source === "string") {
          // from https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#Supported_image_formats
          if (source.match(/\.(jpeg|jpg|jfif|pjpeg|pjp|gif|bmp|png|webp|svg)$/) !== null) {
            sourceType = "image";
          } else if (source.match(/\.(webm|mp4|ogg|mov)$/) !== null) {
            sourceType = "video";
          }
        } else {
          if (source.tagName.toUpperCase() === "IMG") {
            sourceType = "image";
          } else if (source.tagName.toUpperCase() === "VIDEO") {
            sourceType = "video";
          } else if (source.tagName.toUpperCase() === "CANVAS") {
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

    }, {
      key: "_createImage",
      value: function _createImage(source) {
        var image = new Image();
        image.crossOrigin = this.crossOrigin;
        image.src = source;
        return image;
      }
      /***
       Create a video HTML element based on a video source url
         params:
       @source (string): source url
         returns :
       @video (HTML video element): an HTML video element
       ***/

    }, {
      key: "_createVideo",
      value: function _createVideo(source) {
        var video = document.createElement('video');
        video.crossOrigin = this.crossOrigin;
        video.src = source;
        return video;
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

    }, {
      key: "loadSource",
      value: function loadSource(source, textureOptions, successCallback, errorCallback) {
        // get source type to use the right loader
        var sourceType = this._getSourceType(source);

        switch (sourceType) {
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

    }, {
      key: "loadSources",
      value: function loadSources(sources, texturesOptions, successCallback, errorCallback) {
        for (var i = 0; i < sources.length; i++) {
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

    }, {
      key: "loadImage",
      value: function loadImage(source) {
        var textureOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var successCallback = arguments.length > 2 ? arguments[2] : undefined;
        var errorCallback = arguments.length > 3 ? arguments[3] : undefined;

        if (typeof source === "string") {
          source = this._createImage(source);
        }

        source.crossOrigin = this.crossOrigin; // merge texture options with its parent textures options if needed

        if (this._parent) {
          textureOptions = Object.assign(textureOptions, this._parent._texturesOptions);
        } // check for cache


        var cachedTexture = this.renderer.cache.getTextureFromSource(source);

        if (cachedTexture) {
          var _texture = new Texture(this.renderer, {
            loader: this,
            fromTexture: cachedTexture,
            sampler: textureOptions.sampler || source.getAttribute("data-sampler"),
            premultiplyAlpha: textureOptions.premultiplyAlpha,
            anisotropy: textureOptions.anisotropy,
            generateMipmap: textureOptions.generateMipmap,
            wrapS: textureOptions.wrapS,
            wrapT: textureOptions.wrapT,
            minFilter: textureOptions.minFilter,
            magFilter: textureOptions.magFilter
          }); // execute sucess callback directly


          if (successCallback) {
            successCallback(_texture);
          } // if there's a parent (PlaneTextureLoader) add texture and source to it


          this._parent && this._addToParent(_texture, source, "image"); // that's all!

          return;
        } // create a new texture that will use our image later


        var texture = new Texture(this.renderer, {
          loader: this,
          sampler: textureOptions.sampler || source.getAttribute("data-sampler"),
          premultiplyAlpha: textureOptions.premultiplyAlpha,
          anisotropy: textureOptions.anisotropy,
          generateMipmap: textureOptions.generateMipmap,
          wrapS: textureOptions.wrapS,
          wrapT: textureOptions.wrapT,
          minFilter: textureOptions.minFilter,
          magFilter: textureOptions.magFilter
        }); // add a new entry in our elements array

        var el = this._addElement(source, texture, successCallback, errorCallback); // If the image is in the cache of the browser,
        // the 'load' event might have been triggered
        // before we registered the event handler.


        if (source.complete) {
          this._sourceLoaded(source, texture, successCallback);
        } else if (source.decode) {
          source.decode().then(this._sourceLoaded.bind(this, source, texture, successCallback))["catch"](function () {
            // fallback to classic load & error events
            source.addEventListener('load', el.load, false);
            source.addEventListener('error', el.error, false);
          });
        } else {
          source.addEventListener('load', el.load, false);
          source.addEventListener('error', el.error, false);
        } // if there's a parent (PlaneTextureLoader) add texture and source to it


        this._parent && this._addToParent(texture, source, "image");
      }
      /***
       This method loads an array of images by calling loadImage() for each one of them
         params:
       @sources (array of images / images url): array of html images elements or images url
       @texturesOptions (object): parameters to apply to the textures, such as sampler name, repeat wrapping, filters, anisotropy...
       @successCallback (function): function to execute when each source has been loaded
       @errorCallback (function): function to execute if a source fails to load
       ***/

    }, {
      key: "loadImages",
      value: function loadImages(sources, texturesOptions, successCallback, errorCallback) {
        for (var i = 0; i < sources.length; i++) {
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

    }, {
      key: "loadVideo",
      value: function loadVideo(source) {
        var textureOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var successCallback = arguments.length > 2 ? arguments[2] : undefined;
        var errorCallback = arguments.length > 3 ? arguments[3] : undefined;

        if (typeof source === "string") {
          source = this._createVideo(source);
        }

        source.preload = true;
        source.muted = true;
        source.loop = true;
        source.playsinline = true;
        source.crossOrigin = this.crossOrigin; // merge texture options with its parent textures options if needed

        if (this._parent) {
          textureOptions = Object.assign(textureOptions, this._parent._texturesOptions);
        } // create a new texture that will use our video later


        var texture = new Texture(this.renderer, {
          loader: this,
          sampler: textureOptions.sampler || source.getAttribute("data-sampler"),
          premultiplyAlpha: textureOptions.premultiplyAlpha,
          anisotropy: textureOptions.anisotropy,
          generateMipmap: textureOptions.generateMipmap,
          wrapS: textureOptions.wrapS,
          wrapT: textureOptions.wrapT,
          minFilter: textureOptions.minFilter,
          magFilter: textureOptions.magFilter
        }); // add a new entry in our elements array

        var el = this._addElement(source, texture, successCallback, errorCallback); // handle our loaded data event inside the texture and tell our plane when the video is ready to play


        source.addEventListener('canplaythrough', el.load, false);
        source.addEventListener('error', el.error, false); // If the video is in the cache of the browser,
        // the 'canplaythrough' event might have been triggered
        // before we registered the event handler.

        if (source.readyState >= source.HAVE_FUTURE_DATA && successCallback) {
          this._sourceLoaded(source, texture, successCallback);
        } // start loading our video


        source.load(); // if there's a parent (PlaneTextureLoader) add texture and source to it

        this._addToParent && this._addToParent(texture, source, "video"); // if requestVideoFrameCallback exist, use it to update our video texture

        if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
          el.videoFrameCallback = texture._videoFrameCallback.bind(texture);
          texture._videoFrameCallbackID = source.requestVideoFrameCallback(el.videoFrameCallback);
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

    }, {
      key: "loadVideos",
      value: function loadVideos(sources, texturesOptions, successCallback, errorCallback) {
        for (var i = 0; i < sources.length; i++) {
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

    }, {
      key: "loadCanvas",
      value: function loadCanvas(source) {
        var textureOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var successCallback = arguments.length > 2 ? arguments[2] : undefined;

        // merge texture options with its parent textures options if needed
        if (this._parent) {
          textureOptions = Object.assign(textureOptions, this._parent._texturesOptions);
        } // create a new texture that will use our source later


        var texture = new Texture(this.renderer, {
          loader: this,
          sampler: textureOptions.sampler || source.getAttribute("data-sampler"),
          premultiplyAlpha: textureOptions.premultiplyAlpha,
          anisotropy: textureOptions.anisotropy,
          generateMipmap: textureOptions.generateMipmap,
          wrapS: textureOptions.wrapS,
          wrapT: textureOptions.wrapT,
          minFilter: textureOptions.minFilter,
          magFilter: textureOptions.magFilter
        }); // add a new entry in our elements array

        this._addElement(source, texture, successCallback, null); // canvas are directly loaded


        this._sourceLoaded(source, texture, successCallback); // if there's a parent (PlaneTextureLoader) add texture and source to it


        this._parent && this._addToParent(texture, source, "canvas");
      }
      /***
       This method loads an array of images by calling loadCanvas() for each one of them
         params:
       @sources (array of canvas): array of html canvases elements
       @texturesOptions (object): parameters to apply to the textures, such as sampler name, repeat wrapping, filters, anisotropy...
       @successCallback (function): function to execute when each source has been loaded
       ***/

    }, {
      key: "loadCanvases",
      value: function loadCanvases(sources, texturesOptions, successCallback) {
        for (var i = 0; i < sources.length; i++) {
          this.loadCanvas(sources[i], texturesOptions, successCallback);
        }
      }
      /*** REMOVING EVENT LISTENERS ***/

      /***
       Cleanly removes a texture source by removing its associated event listeners
         params:
       @texture (Texture class object): The texture that contains our source
       ***/

    }, {
      key: "_removeSource",
      value: function _removeSource(texture) {
        // find our reference el in our els array
        var el = this.elements.find(function (element) {
          return element.texture.uuid === texture.uuid;
        }); // if we have an element, remove its associated event listeners

        if (el) {
          if (texture.sourceType === "image") {
            el.source.removeEventListener("load", el.load, false);
          } else if (texture.sourceType === "video") {
            // cancel video frame callback
            if (el.videoFrameCallback && texture._videoFrameCallbackID) {
              el.source.cancelVideoFrameCallback(texture._videoFrameCallbackID);
            }

            el.source.removeEventListener("canplaythrough", el.load, false); // empty source to properly delete video element and free the memory

            el.source.pause();
            el.source.removeAttribute("src");
            el.source.load();
          }

          el.source.removeEventListener("error", el.error, false);
        }
      }
    }]);

    return TextureLoader;
  }();
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


  var PlaneTextureLoader = /*#__PURE__*/function (_TextureLoader) {
    _inherits(PlaneTextureLoader, _TextureLoader);

    var _super = _createSuper(PlaneTextureLoader);

    function PlaneTextureLoader(renderer, parent) {
      var _this17;

      var _ref7 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
          _ref7$sourcesLoaded = _ref7.sourcesLoaded,
          sourcesLoaded = _ref7$sourcesLoaded === void 0 ? 0 : _ref7$sourcesLoaded,
          _ref7$sourcesToLoad = _ref7.sourcesToLoad,
          sourcesToLoad = _ref7$sourcesToLoad === void 0 ? 0 : _ref7$sourcesToLoad,
          _ref7$complete = _ref7.complete,
          complete = _ref7$complete === void 0 ? false : _ref7$complete,
          _ref7$onComplete = _ref7.onComplete,
          onComplete = _ref7$onComplete === void 0 ? function () {} : _ref7$onComplete;

      _classCallCheck(this, PlaneTextureLoader);

      _this17 = _super.call(this, renderer, parent.crossOrigin);
      _this17.type = "PlaneTextureLoader";
      _this17._parent = parent;

      if (_this17._parent.type !== "Plane" && _this17._parent.type !== "ShaderPass") {
        throwWarning(_this17.type + ": Wrong parent type assigned to this loader");
        _this17._parent = null;
      }

      _this17.sourcesLoaded = sourcesLoaded;
      _this17.sourcesToLoad = sourcesToLoad;
      _this17.complete = complete;
      _this17.onComplete = onComplete;
      return _this17;
    }
    /*** TRACK LOADING ***/

    /***
     Sets the total number of assets to load before firing the onComplete event
       params:
     @size (int): our curtains object OR our curtains renderer object
     ***/


    _createClass(PlaneTextureLoader, [{
      key: "_setLoaderSize",
      value: function _setLoaderSize(size) {
        var _this18 = this;

        this.sourcesToLoad = size;

        if (this.sourcesToLoad === 0) {
          this.complete = true;
          this.renderer.nextRender.add(function () {
            return _this18.onComplete && _this18.onComplete();
          });
        }
      }
      /***
       Increment the number of sources loaded
       ***/

    }, {
      key: "_increment",
      value: function _increment() {
        var _this19 = this;

        this.sourcesLoaded++;

        if (this.sourcesLoaded >= this.sourcesToLoad && !this.complete) {
          this.complete = true;
          this.renderer.nextRender.add(function () {
            return _this19.onComplete && _this19.onComplete();
          });
        }
      }
      /*** UPDATE PARENT SOURCES AND TEXTURES ARAYS ***/

      /***
       Adds the source to the correct parent assets array
         params:
       @source (html element): html image, video or canvas element that has been loaded
       @sourceType (string): either "image", "video" or "canvas"
       ***/

    }, {
      key: "_addSourceToParent",
      value: function _addSourceToParent(source, sourceType) {
        // add the source if it is not already in the correct parent assets array
        if (sourceType === "image") {
          var parentAssetArray = this._parent["images"];
          var isInParent = parentAssetArray.find(function (element) {
            return element.src === source.src;
          });
          !isInParent && parentAssetArray.push(source);
        } else if (sourceType === "video") {
          var _parentAssetArray = this._parent["videos"];

          var _isInParent = _parentAssetArray.find(function (element) {
            return element.src === source.src;
          });

          !_isInParent && _parentAssetArray.push(source);
        } else if (sourceType === "canvas") {
          var _parentAssetArray2 = this._parent["canvases"];

          var _isInParent2 = _parentAssetArray2.find(function (element) {
            return element.isEqualNode(source);
          });

          !_isInParent2 && _parentAssetArray2.push(source);
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

    }, {
      key: "_addToParent",
      value: function _addToParent(texture, source, sourceType) {
        this._addSourceToParent(source, sourceType); // add the texture to the parent


        this._parent && texture.addParent(this._parent);
      }
    }]);

    return PlaneTextureLoader;
  }(TextureLoader);

  var precisionMedium = "\nprecision mediump float;\n";
  var precisionMedium$1 = precisionMedium.replace(/\n/g, '');
  var defaultAttributes = "\nattribute vec3 aVertexPosition;\nattribute vec2 aTextureCoord;\n";
  var defaultAttributes$1 = defaultAttributes.replace(/\n/g, '');
  var defaultVaryings = "\nvarying vec3 vVertexPosition;\nvarying vec2 vTextureCoord;\n";
  var defaultVaryings$1 = defaultVaryings.replace(/\n/g, '');
  var planeVS = precisionMedium$1 + defaultAttributes$1 + defaultVaryings$1 + "\nuniform mat4 uMVMatrix;\nuniform mat4 uPMatrix;\n\nvoid main() {\n    vTextureCoord = aTextureCoord;\n    vVertexPosition = aVertexPosition;\n    \n    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);\n}\n";
  var planeVS$1 = planeVS.replace(/\n/g, '');
  var planeFS = precisionMedium$1 + defaultVaryings$1 + "\nvoid main() {\n    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n}\n";
  var planeFS$1 = planeFS.replace(/\n/g, '');
  var shaderPassVS = precisionMedium$1 + defaultAttributes$1 + defaultVaryings$1 + "\nvoid main() {\n    vTextureCoord = aTextureCoord;\n    vVertexPosition = aVertexPosition;\n    \n    gl_Position = vec4(aVertexPosition, 1.0);\n}\n";
  var shaderPassVS$1 = shaderPassVS.replace(/\n/g, '');
  var shaderPassFS = precisionMedium$1 + defaultVaryings$1 + "\nuniform sampler2D uRenderTexture;\n\nvoid main() {\n    gl_FragColor = texture2D(uRenderTexture, vTextureCoord);\n}\n";
  var shaderPassFS$1 = shaderPassFS.replace(/\n/g, '');
  /***
   Here we create our Mesh object
   We will create an object containing the program that handles shaders and uniforms, a geometry that handles attributes
   Also handles anything that relates to textures creation and basic drawing operations
     params:
   @renderer (Curtains renderer or Renderer class object): our curtains object OR our curtains renderer object
   @type (string): Object type (should be either "Plane" or "ShaderPass")
     @shareProgram (bool): Whether the mesh should share its program with other meshes. Results in only one program compilation for multiple meshes, but all their uniforms need to be updated at runtime
   @vertexShaderID (string, optional): the vertex shader script ID. If not specified, will look for a data attribute data-vs-id on the plane HTML element.
   @fragmentShaderID (string, optional): the fragment shader script ID. If not specified, will look for a data attribute data-fs-id on the plane HTML element.
   @vertexShader (string, optional): the vertex shader as a string. Will look for a vertexShaderID if not specified.
   @fragmentShader (string, optional): the fragment shader as a string. Will look for a fragmentShaderID if not specified.
   @uniforms (object, optional): the uniforms that will be passed to the shaders.
   @widthSegments (int, optional): mesh definition along the X axis (1 by default)
   @heightSegments (int, optional): mesh definition along the Y axis (1 by default)
   @depthTest (bool, optional): if the mesh should enable or disable the depth test. Default to true.
   @cullFace (string, optional): which face of the mesh should be culled. Could either be "back", "front" or "none". Default to "back".
   @texturesOptions (object, optional): options and parameters to apply to the textures loaded by the mesh's loader. See the Texture class object.
   @crossorigin (string, optional): defines the crossOrigin process to load images if any (default to "anonymous").
     returns:
   @this: our Mesh element
   ***/

  var Mesh = /*#__PURE__*/function () {
    function Mesh(renderer) {
      var _this20 = this;

      var type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "Mesh";

      var _ref8 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
          _ref8$shareProgram = _ref8.shareProgram,
          shareProgram = _ref8$shareProgram === void 0 ? false : _ref8$shareProgram,
          vertexShaderID = _ref8.vertexShaderID,
          fragmentShaderID = _ref8.fragmentShaderID,
          vertexShader = _ref8.vertexShader,
          fragmentShader = _ref8.fragmentShader,
          _ref8$uniforms = _ref8.uniforms,
          uniforms = _ref8$uniforms === void 0 ? {} : _ref8$uniforms,
          _ref8$widthSegments = _ref8.widthSegments,
          widthSegments = _ref8$widthSegments === void 0 ? 1 : _ref8$widthSegments,
          _ref8$heightSegments = _ref8.heightSegments,
          heightSegments = _ref8$heightSegments === void 0 ? 1 : _ref8$heightSegments,
          _ref8$depthTest = _ref8.depthTest,
          depthTest = _ref8$depthTest === void 0 ? true : _ref8$depthTest,
          _ref8$cullFace = _ref8.cullFace,
          cullFace = _ref8$cullFace === void 0 ? "back" : _ref8$cullFace,
          _ref8$texturesOptions = _ref8.texturesOptions,
          texturesOptions = _ref8$texturesOptions === void 0 ? {} : _ref8$texturesOptions,
          _ref8$crossOrigin = _ref8.crossOrigin,
          crossOrigin = _ref8$crossOrigin === void 0 ? "anonymous" : _ref8$crossOrigin;

      _classCallCheck(this, Mesh);

      this.type = type; // we could pass our curtains object OR our curtains renderer object

      renderer = renderer && renderer.renderer || renderer;

      if (!renderer || renderer.type !== "Renderer") {
        throwError(this.type + ": Curtains not passed as first argument or Curtains Renderer is missing", renderer); // no renderer, we can't use the renderer nextRender method

        setTimeout(function () {
          if (_this20._onErrorCallback) {
            _this20._onErrorCallback();
          }
        }, 0);
      }

      this.renderer = renderer;
      this.gl = this.renderer.gl;

      if (!this.gl) {
        if (!this.renderer.production) throwError(this.type + ": Unable to create a " + this.type + " because the Renderer WebGl context is not defined"); // we should assume there's still no renderer here, so no nextRender method

        setTimeout(function () {
          if (_this20._onErrorCallback) {
            _this20._onErrorCallback();
          }
        }, 0);
      }

      this._canDraw = false; // whether to share programs or not (could enhance performance if a lot of planes use the same shaders)

      this.shareProgram = shareProgram; // depth test

      this._depthTest = depthTest; // face culling

      this.cullFace = cullFace;

      if (this.cullFace !== "back" && this.cullFace !== "front" && this.cullFace !== "none") {
        this.cullFace = "back";
      } // textures


      this.textures = []; // default textures options depends on the type of Mesh and WebGL context

      texturesOptions = Object.assign({
        premultiplyAlpha: false,
        anisotropy: 1,
        floatingPoint: "none",
        // accepts "none", "half-float" or "float"
        wrapS: this.gl.CLAMP_TO_EDGE,
        wrapT: this.gl.CLAMP_TO_EDGE,
        minFilter: this.gl.LINEAR,
        magFilter: this.gl.LINEAR
      }, texturesOptions);
      this._texturesOptions = texturesOptions;
      this.crossOrigin = crossOrigin; // handling shaders

      if (!vertexShader) {
        if (!vertexShaderID || !document.getElementById(vertexShaderID)) {
          if (!this.renderer.production && this.type === "Plane") {
            throwWarning("Plane: No vertex shader provided, will use a default one");
          }

          vertexShader = this.type === "Plane" ? planeVS$1 : shaderPassVS$1;
        } else {
          vertexShader = document.getElementById(vertexShaderID).innerHTML;
        }
      }

      if (!fragmentShader) {
        if (!fragmentShaderID || !document.getElementById(fragmentShaderID)) {
          if (!this.renderer.production) throwWarning(this.type + ": No fragment shader provided, will use a default one");
          fragmentShader = this.type === "Plane" ? planeFS$1 : shaderPassFS$1;
        } else {
          fragmentShader = document.getElementById(fragmentShaderID).innerHTML;
        }
      } // init sizes and loader


      this._initMesh(); // geometry
      // set plane attributes


      widthSegments = parseInt(widthSegments);
      heightSegments = parseInt(heightSegments);
      this._geometry = new Geometry(this.renderer, {
        width: widthSegments,
        height: heightSegments // using a special ID for shader passes to avoid weird buffer binding bugs on mac devices
        //id: this.type === "ShaderPass" ? 1 : widthSegments * heightSegments + widthSegments

      });
      this._program = new Program(this.renderer, {
        parent: this,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader
      });

      if (this._program.compiled) {
        // create and set program uniforms
        this._program.createUniforms(uniforms); // make uniforms accessible directly


        this.uniforms = this._program.uniformsManager.uniforms; // geometry
        // set plane attributes

        this._geometry.setProgram(this._program); // we've added a new object, keep Curtains class in sync with our renderer


        this.renderer.onSceneChange();
      } else {
        this.renderer.nextRender.add(function () {
          return _this20._onErrorCallback && _this20._onErrorCallback();
        });
      }
    }

    _createClass(Mesh, [{
      key: "_initMesh",
      value: function _initMesh() {
        var _this21 = this;

        this.uuid = generateUUID(); // our Loader Class that will handle all medias loading process

        this.loader = new PlaneTextureLoader(this.renderer, this, {
          sourcesLoaded: 0,
          initSourcesToLoad: 0,
          // will change if there's any texture to load on init
          complete: false,
          onComplete: function onComplete() {
            _this21._onReadyCallback && _this21._onReadyCallback();

            _this21.renderer.needRender();
          }
        });
        this.images = [];
        this.videos = [];
        this.canvases = []; // allow the user to add custom data to the plane

        this.userData = {};
        this._canDraw = true;
      }
      /*** RESTORING CONTEXT ***/

      /***
       Used internally to handle context restoration
       ***/

    }, {
      key: "_restoreContext",
      value: function _restoreContext() {
        this._canDraw = false;

        if (this._matrices) {
          this._matrices = null;
        } // reset the used program based on our previous shaders code strings


        this._program = new Program(this.renderer, {
          parent: this,
          vertexShader: this._program.vsCode,
          fragmentShader: this._program.fsCode
        });

        if (this._program.compiled) {
          // reset geometry
          this._geometry.restoreContext(this._program); // create and set program uniforms


          this._program.createUniforms(this.uniforms); // make uniforms accessible directly


          this.uniforms = this._program.uniformsManager.uniforms; // program restored callback of Planes and ShaderPasses

          this._programRestored();
        }
      }
      /***
       This function adds a render target to a mesh
         params :
       @renderTarger (RenderTarget): the render target to add to that mesh
       ***/

    }, {
      key: "setRenderTarget",
      value: function setRenderTarget(renderTarget) {
        if (!renderTarget || renderTarget.type !== "RenderTarget") {
          if (!this.renderer.production) {
            throwWarning(this.type + ": Could not set the render target because the argument passed is not a RenderTarget class object", renderTarget);
          }

          return;
        }

        this.target = renderTarget;
      }
      /*** IMAGES, VIDEOS AND CANVASES LOADING ***/

      /***
       This method creates a new Texture and adds it to the mesh
         params :
       @textureOptions (object, optional) : Parameters to apply to that texture (see Texture class). Will be merged with the mesh default textures options
         returns :
       @texture: our newly created texture
       ***/

    }, {
      key: "createTexture",
      value: function createTexture() {
        var textureOptions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        // create a new texture with the specified options
        var texture = new Texture(this.renderer, Object.assign(this._texturesOptions, textureOptions)); // add the texture to the mesh

        texture.addParent(this);
        return texture;
      }
      /***
       Shortcut for addParent() Texture class method
       ***/

    }, {
      key: "addTexture",
      value: function addTexture(texture) {
        if (!texture || texture.type !== "Texture") {
          if (!this.renderer.production) {
            throwWarning(this.type + ": cannot add ", texture, " to this " + this.type + " because it is not a valid texture");
          }

          return;
        }

        texture.addParent(this);
      }
      /***
       This method handles the sources loading process
         params :
       @sourcesArray (array): array of html images, videos or canvases elements
       @texturesOptions (object, optional) : Parameters to apply to those textures (see Texture class). Will be merged with the mesh default textures options
       @successCallback (function): callback to execute on source loading success
       @errorCallback (function): callback to execute on source loading error
       ***/

    }, {
      key: "loadSources",
      value: function loadSources(sourcesArray) {
        var texturesOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var successCallback = arguments.length > 2 ? arguments[2] : undefined;
        var errorCallback = arguments.length > 3 ? arguments[3] : undefined;

        for (var i = 0; i < sourcesArray.length; i++) {
          this.loadSource(sourcesArray[i], texturesOptions, successCallback, errorCallback);
        }
      }
      /***
       This method loads one source using our mesh loader (see PlaneTextureLoader class)
         params :
       @source (html element) : html image, video or canvas element
       @textureOptions (object, optional) : Parameters to apply to that texture (see Texture class). Will be merged with the mesh default textures options
       @successCallback (function): callback to execute on source loading success
       @errorCallback (function): callback to execute on source loading error
       ***/

    }, {
      key: "loadSource",
      value: function loadSource(source) {
        var _this22 = this;

        var textureOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var successCallback = arguments.length > 2 ? arguments[2] : undefined;
        var errorCallback = arguments.length > 3 ? arguments[3] : undefined;
        this.loader.loadSource(source, Object.assign(this._texturesOptions, textureOptions), function (texture) {
          successCallback && successCallback(texture);
        }, function (source, error) {
          if (!_this22.renderer.production) {
            throwWarning(_this22.type + ": this HTML tag could not be converted into a texture:", source.tagName);
          }

          errorCallback && errorCallback(source, error);
        });
      }
      /***
       This method loads an image using our mesh loader (see PlaneTextureLoader class)
         params :
       @source (image) : html image element
       @textureOptions (object, optional) : Parameters to apply to that texture (see Texture class). Will be merged with the mesh default textures options
       @successCallback (function): callback to execute on source loading success
       @errorCallback (function): callback to execute on source loading error
       ***/

    }, {
      key: "loadImage",
      value: function loadImage(source) {
        var _this23 = this;

        var textureOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var successCallback = arguments.length > 2 ? arguments[2] : undefined;
        var errorCallback = arguments.length > 3 ? arguments[3] : undefined;
        this.loader.loadImage(source, Object.assign(this._texturesOptions, textureOptions), function (texture) {
          successCallback && successCallback(texture);
        }, function (source, error) {
          if (!_this23.renderer.production) {
            throwWarning(_this23.type + ": There has been an error:\n", error, "\nwhile loading this image:\n", source);
          }

          errorCallback && errorCallback(source, error);
        });
      }
      /***
       This method loads a video using the mesh loader (see PlaneTextureLoader class)
         params :
       @source (video) : html video element
       @textureOptions (object, optional) : Parameters to apply to that texture (see Texture class). Will be merged with the mesh default textures options
       @successCallback (function): callback to execute on source loading success
       @errorCallback (function): callback to execute on source loading error
       ***/

    }, {
      key: "loadVideo",
      value: function loadVideo(source) {
        var _this24 = this;

        var textureOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var successCallback = arguments.length > 2 ? arguments[2] : undefined;
        var errorCallback = arguments.length > 3 ? arguments[3] : undefined;
        this.loader.loadVideo(source, Object.assign(this._texturesOptions, textureOptions), function (texture) {
          successCallback && successCallback(texture);
        }, function (source, error) {
          if (!_this24.renderer.production) {
            throwWarning(_this24.type + ": There has been an error:\n", error, "\nwhile loading this video:\n", source);
          }

          errorCallback && errorCallback(source, error);
        });
      }
      /***
       This method loads a canvas using the mesh loader (see PlaneTextureLoader class)
         params :
       @source (canvas) : html canvas element
       @textureOptions (object, optional) : Parameters to apply to that texture (see Texture class). Will be merged with the mesh default textures options
       @successCallback (function): callback to execute on source loading success
       ***/

    }, {
      key: "loadCanvas",
      value: function loadCanvas(source) {
        var textureOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var successCallback = arguments.length > 2 ? arguments[2] : undefined;
        this.loader.loadCanvas(source, Object.assign(this._texturesOptions, textureOptions), function (texture) {
          successCallback && successCallback(texture);
        });
      }
      /*** LOAD ARRAYS ***/

      /***
       Loads an array of images
         params :
       @imagesArray (array) : array of html image elements
       @texturesOptions (object, optional) : Parameters to apply to those textures (see Texture class). Will be merged with the mesh default textures options
       @successCallback (function): callback to execute on source loading success
       @errorCallback (function): callback to execute on source loading error
       ***/

    }, {
      key: "loadImages",
      value: function loadImages(imagesArray) {
        var texturesOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var successCallback = arguments.length > 2 ? arguments[2] : undefined;
        var errorCallback = arguments.length > 3 ? arguments[3] : undefined;

        for (var i = 0; i < imagesArray.length; i++) {
          this.loadImage(imagesArray[i], texturesOptions, successCallback, errorCallback);
        }
      }
      /***
       Loads an array of videos
         params :
       @videosArray (array) : array of html video elements
       @texturesOptions (object, optional) : Parameters to apply to those textures (see Texture class). Will be merged with the mesh default textures options
       @successCallback (function): callback to execute on source loading success
       @errorCallback (function): callback to execute on source loading error
       ***/

    }, {
      key: "loadVideos",
      value: function loadVideos(videosArray) {
        var texturesOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var successCallback = arguments.length > 2 ? arguments[2] : undefined;
        var errorCallback = arguments.length > 3 ? arguments[3] : undefined;

        for (var i = 0; i < videosArray.length; i++) {
          this.loadVideo(videosArray[i], texturesOptions, successCallback, errorCallback);
        }
      }
      /***
       Loads an array of canvases
         params :
       @canvasesArray (array) : array of html canvas elements
       @texturesOptions (object, optional) : Parameters to apply to those textures (see Texture class). Will be merged with the mesh default textures options
       @successCallback (function): callback to execute on source loading success
       @errorCallback (function): callback to execute on source loading error
       ***/

    }, {
      key: "loadCanvases",
      value: function loadCanvases(canvasesArray) {
        var texturesOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var successCallback = arguments.length > 2 ? arguments[2] : undefined;

        for (var i = 0; i < canvasesArray.length; i++) {
          this.loadCanvas(canvasesArray[i], texturesOptions, successCallback);
        }
      }
      /***
       This has to be called in order to play the planes videos
       We need this because on mobile devices we can't start playing a video without a user action
       Once the video has started playing we set an interval and update a new frame to our our texture at a 30FPS rate
       ***/

    }, {
      key: "playVideos",
      value: function playVideos() {
        var _this25 = this;

        for (var i = 0; i < this.textures.length; i++) {
          var texture = this.textures[i];

          if (texture.sourceType === "video") {
            var playPromise = texture.source.play(); // In browsers that don’t yet support this functionality,
            // playPromise won’t be defined.

            if (playPromise !== undefined) {
              playPromise["catch"](function (error) {
                if (!_this25.renderer.production) throwWarning(_this25.type + ": Could not play the video : ", error);
              });
            }
          }
        }
      }
      /*** DRAW THE PLANE ***/

      /***
       We draw the plane, ie bind the buffers, set the active textures and draw it
       ***/

    }, {
      key: "_draw",
      value: function _draw() {
        // enable/disable depth test
        this.renderer.setDepth(this._depthTest); // face culling

        this.renderer.setFaceCulling(this.cullFace); // update all uniforms set up by the user

        this._program.updateUniforms(); // bind plane attributes buffers


        this._geometry.bindBuffers(); // draw all our plane textures


        for (var i = 0; i < this.textures.length; i++) {
          // draw (bind and maybe update) our texture
          this.textures[i]._draw();
        } // the draw call!


        this._geometry.draw(); // reset active texture TODO useless?


        this.renderer.state.activeTexture = null; // callback after draw

        this._onAfterRenderCallback && this._onAfterRenderCallback();
      }
      /*** EVENTS ***/

      /***
       This is called each time a mesh can't be instanciated
         params :
       @callback (function) : a function to execute
         returns :
       @this: our plane to handle chaining
       ***/

    }, {
      key: "onError",
      value: function onError(callback) {
        if (callback) {
          this._onErrorCallback = callback;
        }

        return this;
      }
      /***
       This is called each time a mesh's image has been loaded. Useful to handle a loader
         params :
       @callback (function) : a function to execute
         returns :
       @this: our plane to handle chaining
       ***/

    }, {
      key: "onLoading",
      value: function onLoading(callback) {
        if (callback) {
          this._onLoadingCallback = callback;
        }

        return this;
      }
      /***
       This is called when a mesh is ready to be drawn
         params :
       @callback (function) : a function to execute
         returns :
       @this: our plane to handle chaining
       ***/

    }, {
      key: "onReady",
      value: function onReady(callback) {
        if (callback) {
          this._onReadyCallback = callback;
        }

        return this;
      }
      /***
       This is called at each requestAnimationFrame call
         params :
       @callback (function) : a function to execute
         returns :
       @this: our plane to handle chaining
       ***/

    }, {
      key: "onRender",
      value: function onRender(callback) {
        if (callback) {
          this._onRenderCallback = callback;
        }

        return this;
      }
      /***
       This is called at each requestAnimationFrame call for each mesh after the draw call
         params :
       @callback (function) : a function to execute
         returns :
       @this: our plane to handle chaining
       ***/

    }, {
      key: "onAfterRender",
      value: function onAfterRender(callback) {
        if (callback) {
          this._onAfterRenderCallback = callback;
        }

        return this;
      }
      /*** DESTROYING ***/

      /***
       Remove an element by calling the appropriate renderer method
       ***/

    }, {
      key: "remove",
      value: function remove() {
        // first we want to stop drawing it
        this._canDraw = false; // force unbinding frame buffer

        if (this.target) {
          this.renderer.bindFrameBuffer(null);
        } // delete all the webgl bindings


        this._dispose();

        if (this.type === "Plane") {
          this.renderer.removePlane(this);
        } else if (this.type === "ShaderPass") {
          // remove its render target first
          if (this.target) {
            this.target._shaderPass = null;
            this.target.remove();
            this.target = null;
          }

          this.renderer.removeShaderPass(this);
        }
      }
      /***
       This deletes all our mesh webgl bindings and its textures
       ***/

    }, {
      key: "_dispose",
      value: function _dispose() {
        if (this.gl) {
          // dispose our geometry
          this._geometry && this._geometry.dispose();

          if (this.target && this.type === "ShaderPass") {
            this.renderer.removeRenderTarget(this.target); // remove the first texture since it has been deleted with the render target

            this.textures.shift();
          } // unbind and delete the textures


          for (var i = 0; i < this.textures.length; i++) {
            this.textures[i]._dispose();
          }

          this.textures = null;
        }
      }
    }]);

    return Mesh;
  }();
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


  var DOMMesh = /*#__PURE__*/function (_Mesh) {
    _inherits(DOMMesh, _Mesh);

    var _super2 = _createSuper(DOMMesh);

    function DOMMesh(renderer, htmlElement) {
      var _this26;

      var type = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "DOMMesh";

      var _ref9 = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {},
          shareProgram = _ref9.shareProgram,
          widthSegments = _ref9.widthSegments,
          heightSegments = _ref9.heightSegments,
          depthTest = _ref9.depthTest,
          cullFace = _ref9.cullFace,
          uniforms = _ref9.uniforms,
          vertexShaderID = _ref9.vertexShaderID,
          fragmentShaderID = _ref9.fragmentShaderID,
          vertexShader = _ref9.vertexShader,
          fragmentShader = _ref9.fragmentShader,
          texturesOptions = _ref9.texturesOptions,
          crossOrigin = _ref9.crossOrigin;

      _classCallCheck(this, DOMMesh);

      // handling HTML shaders scripts
      vertexShaderID = vertexShaderID || htmlElement && htmlElement.getAttribute("data-vs-id");
      fragmentShaderID = fragmentShaderID || htmlElement && htmlElement.getAttribute("data-fs-id");
      _this26 = _super2.call(this, renderer, type, {
        shareProgram: shareProgram,
        widthSegments: widthSegments,
        heightSegments: heightSegments,
        depthTest: depthTest,
        cullFace: cullFace,
        uniforms: uniforms,
        vertexShaderID: vertexShaderID,
        fragmentShaderID: fragmentShaderID,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        texturesOptions: texturesOptions,
        crossOrigin: crossOrigin
      }); // our HTML element

      _this26.htmlElement = htmlElement;

      if (!_this26.htmlElement || _this26.htmlElement.length === 0) {
        if (!_this26.renderer.production) throwWarning(_this26.type + ": The HTML element you specified does not currently exists in the DOM");
      } // set plane sizes


      _this26._setDocumentSizes();

      return _this26;
    }
    /*** PLANE SIZES ***/

    /***
     Set our plane dimensions and positions relative to document
     Triggers reflow!
     ***/


    _createClass(DOMMesh, [{
      key: "_setDocumentSizes",
      value: function _setDocumentSizes() {
        // set our basic initial infos
        var planeBoundingRect = this.htmlElement.getBoundingClientRect();
        if (!this._boundingRect) this._boundingRect = {}; // set plane dimensions in document space

        this._boundingRect.document = {
          width: planeBoundingRect.width * this.renderer.pixelRatio,
          height: planeBoundingRect.height * this.renderer.pixelRatio,
          top: planeBoundingRect.top * this.renderer.pixelRatio,
          left: planeBoundingRect.left * this.renderer.pixelRatio
        };
      }
    }, {
      key: "getBoundingRect",

      /*** BOUNDING BOXES GETTERS ***/

      /***
       Useful to get our plane HTML element bounding rectangle without triggering a reflow/layout
       returns :
       @boundingRectangle (obj): an object containing our plane HTML element bounding rectangle (width, height, top, bottom, right and left properties)
       ***/
      value: function getBoundingRect() {
        return {
          width: this._boundingRect.document.width,
          height: this._boundingRect.document.height,
          top: this._boundingRect.document.top,
          left: this._boundingRect.document.left,
          // right = left + width, bottom = top + height
          right: this._boundingRect.document.left + this._boundingRect.document.width,
          bottom: this._boundingRect.document.top + this._boundingRect.document.height
        };
      }
      /***
       Handles each plane resizing
       used internally when our container is resized
       TODO will soon be DEPRECATED!
       ***/

    }, {
      key: "planeResize",
      value: function planeResize() {
        if (!this.renderer.production) {
          throwWarning(this.type + ": planeResize() is deprecated, use resize() instead.");
        }

        this.resize();
      }
      /***
       Handles each plane resizing
       used internally when our container is resized
       ***/

    }, {
      key: "resize",
      value: function resize() {
        var _this27 = this;

        // reset plane dimensions
        this._setDocumentSizes(); // if this is a Plane object we need to update its perspective and positions


        if (this.type === "Plane") {
          // reset perspective
          this.setPerspective(this.camera.fov, this.camera.near, this.camera.far); // apply new position

          this._applyWorldPositions();
        } // resize all textures


        for (var i = 0; i < this.textures.length; i++) {
          this.textures[i].resize();
        } // handle our after resize event


        this.renderer.nextRender.add(function () {
          return _this27._onAfterResizeCallback && _this27._onAfterResizeCallback();
        });
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

    }, {
      key: "mouseToPlaneCoords",
      value: function mouseToPlaneCoords(mouseCoordinates) {
        // remember our ShaderPass objects don't have a scale property
        var scale = this.scale ? this.scale : new Vec2(1, 1); // we need to adjust our plane document bounding rect to it's webgl scale

        var scaleAdjustment = new Vec2((this._boundingRect.document.width - this._boundingRect.document.width * scale.x) / 2, (this._boundingRect.document.height - this._boundingRect.document.height * scale.y) / 2); // also we need to divide by pixel ratio

        var planeBoundingRect = {
          width: this._boundingRect.document.width * scale.x / this.renderer.pixelRatio,
          height: this._boundingRect.document.height * scale.y / this.renderer.pixelRatio,
          top: (this._boundingRect.document.top + scaleAdjustment.y) / this.renderer.pixelRatio,
          left: (this._boundingRect.document.left + scaleAdjustment.x) / this.renderer.pixelRatio
        }; // mouse position conversion from document to plane space

        return new Vec2((mouseCoordinates.x - planeBoundingRect.left) / planeBoundingRect.width * 2 - 1, 1 - (mouseCoordinates.y - planeBoundingRect.top) / planeBoundingRect.height * 2);
      }
      /*** EVENTS ***/

      /***
       This is called each time a plane has been resized
       params :
       @callback (function) : a function to execute
       returns :
       @this: our plane to handle chaining
       ***/

    }, {
      key: "onAfterResize",
      value: function onAfterResize(callback) {
        if (callback) {
          this._onAfterResizeCallback = callback;
        }

        return this;
      }
    }]);

    return DOMMesh;
  }(Mesh);
  /***
   Here we create a Vec3 class object
   This is a really basic Vector3 class used for vector calculations
   Highly based on https://github.com/mrdoob/three.js/blob/dev/src/math/Vector3.js and http://glmatrix.net/docs/vec3.js.html
     params :
   @x (float): X component of our vector
   @y (float): Y component of our vector
   @z (float): Z component of our vector
     returns :
   @this: our Vec3 class object
   ***/
  // TODO lot of (unused at the time) methods are missing


  var Vec3 = /*#__PURE__*/function () {
    function Vec3() {
      var x = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
      var y = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      var z = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

      _classCallCheck(this, Vec3);

      this.type = "Vec3";
      this.set(x, y, z);
    }
    /***
     Sets the vector from values
       params:
     @x (float): X component of our vector
     @y (float): Y component of our vector
     @z (float): Z component of our vector
       returns:
     @this (Vec2): this vector after being set
     ***/


    _createClass(Vec3, [{
      key: "set",
      value: function set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
      }
      /***
       Adds a vector to this vector
         params:
       @vector (Vec3): vector to add
         returns:
       @this (Vec3): this vector after addition
       ***/

    }, {
      key: "add",
      value: function add(vector) {
        this.x += vector.x;
        this.y += vector.y;
        this.z += vector.z;
        return this;
      }
      /***
       Adds a scalar to this vector
         params:
       @value (float): number to add
         returns:
       @this (Vec3): this vector after addition
       ***/

    }, {
      key: "addScalar",
      value: function addScalar(value) {
        this.x += value;
        this.y += value;
        this.z += value;
        return this;
      }
      /***
       Subtracts a vector from this vector
         params:
       @vector (Vec3): vector to use for subtraction
         returns:
       @this (Vec3): this vector after subtraction
       ***/

    }, {
      key: "sub",
      value: function sub(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
        this.z -= vector.z;
        return this;
      }
      /***
       Subtracts a scalar to this vector
         params:
       @value (float): number to use for subtraction
         returns:
       @this (Vec3): this vector after subtraction
       ***/

    }, {
      key: "subScalar",
      value: function subScalar(value) {
        this.x -= value;
        this.y -= value;
        this.z -= value;
        return this;
      }
      /***
       Multiplies a vector with this vector
         params:
       @vector (Vec3): vector to use for multiplication
         returns:
       @this (Vec3): this vector after multiplication
       ***/

    }, {
      key: "multiply",
      value: function multiply(vector) {
        this.x *= vector.x;
        this.y *= vector.y;
        this.z *= vector.z;
        return this;
      }
      /***
       Multiplies a scalar with this vector
         params:
       @value (float): number to use for multiplication
         returns:
       @this (Vec3): this vector after multiplication
       ***/

    }, {
      key: "multiplyScalar",
      value: function multiplyScalar(value) {
        this.x *= value;
        this.y *= value;
        this.z *= value;
        return this;
      }
      /***
       Copy a vector into this vector
         params:
       @vector (Vec3): vector to copy
         returns:
       @this (Vec3): this vector after copy
       ***/

    }, {
      key: "copy",
      value: function copy(vector) {
        this.x = vector.x;
        this.y = vector.y;
        this.z = vector.z;
        return this;
      }
      /***
       Clone this vector
         returns:
       @vector (Vec3): cloned vector
       ***/

    }, {
      key: "clone",
      value: function clone() {
        return new Vec3(this.x, this.y, this.z);
      }
      /***
       Merges this vector with a vector when values are NaN. Mostly used internally.
         params:
       @vector (Vec3): vector to use for sanitization
         returns:
       @vector (Vec3): sanitized vector
       ***/

    }, {
      key: "sanitizeNaNValuesWith",
      value: function sanitizeNaNValuesWith(vector) {
        this.x = isNaN(this.x) ? vector.x : parseFloat(this.x);
        this.y = isNaN(this.y) ? vector.y : parseFloat(this.y);
        this.z = isNaN(this.z) ? vector.z : parseFloat(this.z);
        return this;
      }
      /***
       Apply max values to this vector
         params:
       @vector (Vec3): vector representing max values
         returns:
       @vector (Vec3): vector with max values applied
       ***/

    }, {
      key: "max",
      value: function max(vector) {
        this.x = Math.max(this.x, vector.x);
        this.y = Math.max(this.y, vector.y);
        this.z = Math.max(this.z, vector.z);
        return this;
      }
      /***
       Apply min values to this vector
         params:
       @vector (Vec3): vector representing min values
         returns:
       @vector (Vec3): vector with min values applied
       ***/

    }, {
      key: "min",
      value: function min(vector) {
        this.x = Math.min(this.x, vector.x);
        this.y = Math.min(this.y, vector.y);
        this.z = Math.min(this.z, vector.z);
        return this;
      }
      /***
       Checks if 2 vectors are equal
         returns:
       @isEqual (bool): whether the vectors are equals or not
       ***/

    }, {
      key: "equals",
      value: function equals(vector) {
        return this.x === vector.x && this.y === vector.y && this.z === vector.z;
      }
      /***
       Normalize this vector
         returns:
       @this (Vec3): normalized vector
       ***/

    }, {
      key: "normalize",
      value: function normalize() {
        // normalize
        var len = this.x * this.x + this.y * this.y + this.z * this.z;

        if (len > 0) {
          len = 1 / Math.sqrt(len);
        }

        this.x *= len;
        this.y *= len;
        this.z *= len;
        return this;
      }
      /***
       Calculates the dot product of 2 vectors
         returns:
       @dotProduct (float): dot product of the 2 vectors
       ***/

    }, {
      key: "dot",
      value: function dot(vector) {
        return this.x * vector.x + this.y * vector.y + this.z * vector.z;
      }
      /***
       Apply a matrix 4 to a point (vec3)
       Useful to convert a point position from plane local world to webgl space using projection view matrix for example
       Source code from: http://glmatrix.net/docs/vec3.js.html
         params :
       @matrix (array): 4x4 matrix used
         returns :
       @this (Vec3): this vector after matrix application
       ***/

    }, {
      key: "applyMat4",
      value: function applyMat4(matrix) {
        var x = this.x,
            y = this.y,
            z = this.z;
        var mArray = matrix.elements;
        var w = mArray[3] * x + mArray[7] * y + mArray[11] * z + mArray[15];
        w = w || 1;
        this.x = (mArray[0] * x + mArray[4] * y + mArray[8] * z + mArray[12]) / w;
        this.y = (mArray[1] * x + mArray[5] * y + mArray[9] * z + mArray[13]) / w;
        this.z = (mArray[2] * x + mArray[6] * y + mArray[10] * z + mArray[14]) / w;
        return this;
      }
      /***
       Apply a quaternion (rotation in 3D space) to this vector
         params :
       @quaternion (Quat): quaternion to use
         returns :
       @this (Vec3): this vector after applying the transformation
       ***/

    }, {
      key: "applyQuat",
      value: function applyQuat(quaternion) {
        var x = this.x,
            y = this.y,
            z = this.z;
        var qx = quaternion.elements[0],
            qy = quaternion.elements[1],
            qz = quaternion.elements[2],
            qw = quaternion.elements[3]; // calculate quat * vector

        var ix = qw * x + qy * z - qz * y;
        var iy = qw * y + qz * x - qx * z;
        var iz = qw * z + qx * y - qy * x;
        var iw = -qx * x - qy * y - qz * z; // calculate result * inverse quat

        this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
        return this;
      }
      /***
       Project 3D coordinate to 2D point
         params:
       @camera (Camera): camera to use for projection
       ***/

    }, {
      key: "project",
      value: function project(camera) {
        this.applyMat4(camera.viewMatrix).applyMat4(camera.projectionMatrix);
        return this;
      }
      /***
       Unproject 2D point to 3D coordinate
         params:
       @camera (Camera): camera to use for projection
       ***/

    }, {
      key: "unproject",
      value: function unproject(camera) {
        this.applyMat4(camera.projectionMatrix.getInverse()).applyMat4(camera.worldMatrix);
        return this;
      }
    }]);

    return Vec3;
  }();
  /***
   Here we create our Camera object
   Creates a perspective camera and its projection matrix (which is used by Plane's class objects)
   Uses a dirty _shouldUpdate flag used to determine if we should update the matrix
     params:
   @fov (float, optional): the perspective field of view. Should be greater than 0 and lower than 180. Default to 50.
   @near (float, optional): near plane, the closest point where a mesh vertex is drawn. Default to 0.1.
   @far (float, optional): far plane, farthest point where a mesh vertex is drawn. Default to 150.
   @width (float, optional): width used to calculate the camera aspect ratio. Default to the renderer container's width.
   @height (float, optional): height used to calculate the camera aspect ratio. Default to the renderer container's height.
   @pixelRatio (float, optional): pixel ratio used to calculate the camera aspect ratio. Default to the renderer's pixel ratio.
     returns:
   @this: our Mesh element
   ***/


  var Camera = /*#__PURE__*/function () {
    function Camera() {
      var _ref10 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          _ref10$fov = _ref10.fov,
          fov = _ref10$fov === void 0 ? 50 : _ref10$fov,
          _ref10$near = _ref10.near,
          near = _ref10$near === void 0 ? 0.1 : _ref10$near,
          _ref10$far = _ref10.far,
          far = _ref10$far === void 0 ? 150 : _ref10$far,
          width = _ref10.width,
          height = _ref10.height,
          _ref10$pixelRatio = _ref10.pixelRatio,
          pixelRatio = _ref10$pixelRatio === void 0 ? 1 : _ref10$pixelRatio;

      _classCallCheck(this, Camera);

      this.position = new Vec3();
      this.projectionMatrix = new Mat4();
      this.worldMatrix = new Mat4();
      this.viewMatrix = new Mat4();
      this._shouldUpdate = false;
      this.setSize();
      this.setPerspective(fov, near, far, width, height, pixelRatio);
    }
    /***
     Sets the camera field of view
     Update the camera projection matrix only if the fov actually changed
       params:
     @fov (float, optional): field of view to use
     ***/


    _createClass(Camera, [{
      key: "setFov",
      value: function setFov(fov) {
        fov = isNaN(fov) ? this.fov : parseFloat(fov); // clamp between 1 and 179

        fov = Math.max(1, Math.min(fov, 179));

        if (fov !== this.fov) {
          this.fov = fov;
          this.setPosition();
          this.setCSSPerspective();
          this._shouldUpdate = true;
        }
      }
      /***
       Sets the camera near plane value
       Update the camera projection matrix only if the near plane actually changed
         params:
       @near (float, optional): near plane value to use
       ***/

    }, {
      key: "setNear",
      value: function setNear(near) {
        near = isNaN(near) ? this.near : parseFloat(near);
        near = Math.max(near, 0.01);

        if (near !== this.near) {
          this.near = near;
          this._shouldUpdate = true;
        }
      }
      /***
       Sets the camera far plane value
       Update the camera projection matrix only if the far plane actually changed
         params:
       @far (float, optional): far plane value to use
       ***/

    }, {
      key: "setFar",
      value: function setFar(far) {
        far = isNaN(far) ? this.far : parseFloat(far);
        far = Math.max(far, 50);

        if (far !== this.far) {
          this.far = far;
          this._shouldUpdate = true;
        }
      }
      /***
       Sets the camera pixel ratio value
       Update the camera projection matrix only if the pixel ratio actually changed
         params:
       @pixelRatio (float, optional): pixelRatio value to use
       ***/

    }, {
      key: "setPixelRatio",
      value: function setPixelRatio(pixelRatio) {
        if (pixelRatio !== this.pixelRatio) {
          this._shouldUpdate = true;
        }

        this.pixelRatio = pixelRatio;
      }
      /***
       Sets the camera width and height
       Update the camera projection matrix only if the width or height actually changed
         params:
       @width (float, optional): width value to use
       @height (float, optional): height value to use
       ***/

    }, {
      key: "setSize",
      value: function setSize(width, height) {
        if (width !== this.width || height !== this.height) {
          this._shouldUpdate = true;
        }

        this.width = width;
        this.height = height;
      }
      /***
       Sets the camera perspective
       Update the camera projection matrix if our _shouldUpdate flag is true
         params:
       @fov (float, optional): field of view to use
       @near (float, optional): near plane value to use
       @far (float, optional): far plane value to use
       @width (float, optional): width value to use
       @height (float, optional): height value to use
       @pixelRatio (float, optional): pixelRatio value to use
       ***/

    }, {
      key: "setPerspective",
      value: function setPerspective(fov, near, far, width, height, pixelRatio) {
        this.setPixelRatio(pixelRatio);
        this.setSize(width, height);
        this.setFov(fov);
        this.setNear(near);
        this.setFar(far);

        if (this._shouldUpdate) {
          this.updateProjectionMatrix();
        }
      }
      /***
       Sets the camera position based on its fov
       Used by the Plane class objects to scale the planes with the right amount
       ***/

    }, {
      key: "setPosition",
      value: function setPosition() {
        this.position.set(0, 0, Math.tan(Math.PI / 180 * 0.5 * this.fov) * 2.0); // update matrices

        this.worldMatrix.setFromArray([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, this.position.x, this.position.y, this.position.z, 1]);
        this.viewMatrix = this.viewMatrix.copy(this.worldMatrix).getInverse();
      }
      /***
       Sets a CSSPerspective property based on width, height, pixelRatio and fov
       Used to translate planes along the Z axis using pixel units as CSS would do
       ***/

    }, {
      key: "setCSSPerspective",
      value: function setCSSPerspective() {
        this.CSSPerspective = Math.pow(Math.pow(this.width / (2 * this.pixelRatio), 2) + Math.pow(this.height / (2 * this.pixelRatio), 2), 0.5) / (this.position.z * 0.5);
      }
      /***
       Updates the camera projection matrix
       ***/

    }, {
      key: "updateProjectionMatrix",
      value: function updateProjectionMatrix() {
        var aspect = this.width / this.height;
        var top = this.near * Math.tan(Math.PI / 180 * 0.5 * this.fov);
        var height = 2 * top;
        var width = aspect * height;
        var left = -0.5 * width;
        var right = left + width;
        var bottom = top - height;
        var x = 2 * this.near / (right - left);
        var y = 2 * this.near / (top - bottom);
        var a = (right + left) / (right - left);
        var b = (top + bottom) / (top - bottom);
        var c = -(this.far + this.near) / (this.far - this.near);
        var d = -2 * this.far * this.near / (this.far - this.near);
        this.projectionMatrix.setFromArray([x, 0, 0, 0, 0, y, 0, 0, a, b, c, -1, 0, 0, d, 0]);
      }
      /***
       Force the projection matrix to update (used in Plane class objects context restoration)
       ***/

    }, {
      key: "forceUpdate",
      value: function forceUpdate() {
        this._shouldUpdate = true;
      }
      /***
       Cancel the projection matrix update (used in Plane class objects after the projection matrix has been updated)
       ***/

    }, {
      key: "cancelUpdate",
      value: function cancelUpdate() {
        this._shouldUpdate = false;
      }
    }]);

    return Camera;
  }();
  /***
   Here we create a Quat class object
   This is a really basic Quaternion class used for rotation calculations
   Highly based on https://github.com/mrdoob/three.js/blob/dev/src/math/Quaternion.js
     params :
   @elements (Float32Array of length 4): our quaternion array. Default to identity quaternion.
     returns :
   @this: our Quat class object
   ***/
  // TODO lot of (unused at the time) methods are missing


  var Quat = /*#__PURE__*/function () {
    function Quat() {
      var elements = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : new Float32Array([0, 0, 0, 1]);
      var axisOrder = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "XYZ";

      _classCallCheck(this, Quat);

      this.type = "Quat";
      this.elements = elements; // rotation axis order

      this.axisOrder = axisOrder;
    }
    /***
     Sets the quaternion values from an array
       params:
     @array (array): an array of at least 4 elements
       returns:
     @this (Quat class object): this quaternion after being set
     ***/


    _createClass(Quat, [{
      key: "setFromArray",
      value: function setFromArray(array) {
        this.elements[0] = array[0];
        this.elements[1] = array[1];
        this.elements[2] = array[2];
        this.elements[3] = array[3];
        return this;
      }
      /***
       Sets the quaternion axis order
         params:
       @axisOrder (string): an array of at least 4 elements
         returns:
       @this (Quat class object): this quaternion after axis order has been set
       ***/

    }, {
      key: "setAxisOrder",
      value: function setAxisOrder(axisOrder) {
        // force uppercase for strict equality tests
        axisOrder = axisOrder.toUpperCase();

        switch (axisOrder) {
          case "XYZ":
          case "YXZ":
          case "ZXY":
          case "ZYX":
          case "YZX":
          case "XZY":
            this.axisOrder = axisOrder;
            break;

          default:
            // apply a default axis order
            this.axisOrder = "XYZ";
        }

        return this;
      }
      /***
       Copy a quaternion into this quaternion
         params:
       @vector (Quat): quaternion to copy
         returns:
       @this (Quat): this quaternion after copy
       ***/

    }, {
      key: "copy",
      value: function copy(quaternion) {
        this.elements = quaternion.elements;
        this.axisOrder = quaternion.axisOrder;
        return this;
      }
      /***
       Checks if 2 quaternions are equal
         returns:
       @isEqual (bool): whether the quaternions are equals or not
       ***/

    }, {
      key: "equals",
      value: function equals(quaternion) {
        return this.elements[0] === quaternion.elements[0] && this.elements[1] === quaternion.elements[1] && this.elements[2] === quaternion.elements[2] && this.elements[3] === quaternion.elements[3] && this.axisOrder === quaternion.axisOrder;
      }
      /***
       Sets a rotation quaternion using Euler angles and its axis order
         params:
       @vector (Vec3 class object): rotation vector to set our quaternion from
         returns :
       @this (Quat class object): quaternion after having applied the rotation
       ***/

    }, {
      key: "setFromVec3",
      value: function setFromVec3(vector) {
        var ax = vector.x * 0.5;
        var ay = vector.y * 0.5;
        var az = vector.z * 0.5;
        var cosx = Math.cos(ax);
        var cosy = Math.cos(ay);
        var cosz = Math.cos(az);
        var sinx = Math.sin(ax);
        var siny = Math.sin(ay);
        var sinz = Math.sin(az); // XYZ order

        if (this.axisOrder === "XYZ") {
          this.elements[0] = sinx * cosy * cosz + cosx * siny * sinz;
          this.elements[1] = cosx * siny * cosz - sinx * cosy * sinz;
          this.elements[2] = cosx * cosy * sinz + sinx * siny * cosz;
          this.elements[3] = cosx * cosy * cosz - sinx * siny * sinz;
        } else if (this.axisOrder === "YXZ") {
          this.elements[0] = sinx * cosy * cosz + cosx * siny * sinz;
          this.elements[1] = cosx * siny * cosz - sinx * cosy * sinz;
          this.elements[2] = cosx * cosy * sinz - sinx * siny * cosz;
          this.elements[3] = cosx * cosy * cosz + sinx * siny * sinz;
        } else if (this.axisOrder === "ZXY") {
          this.elements[0] = sinx * cosy * cosz - cosx * siny * sinz;
          this.elements[1] = cosx * siny * cosz + sinx * cosy * sinz;
          this.elements[2] = cosx * cosy * sinz + sinx * siny * cosz;
          this.elements[3] = cosx * cosy * cosz - sinx * siny * sinz;
        } else if (this.axisOrder === "ZYX") {
          this.elements[0] = sinx * cosy * cosz - cosx * siny * sinz;
          this.elements[1] = cosx * siny * cosz + sinx * cosy * sinz;
          this.elements[2] = cosx * cosy * sinz - sinx * siny * cosz;
          this.elements[3] = cosx * cosy * cosz + sinx * siny * sinz;
        } else if (this.axisOrder === "YZX") {
          this.elements[0] = sinx * cosy * cosz + cosx * siny * sinz;
          this.elements[1] = cosx * siny * cosz + sinx * cosy * sinz;
          this.elements[2] = cosx * cosy * sinz - sinx * siny * cosz;
          this.elements[3] = cosx * cosy * cosz - sinx * siny * sinz;
        } else if (this.axisOrder === "XZY") {
          this.elements[0] = sinx * cosy * cosz - cosx * siny * sinz;
          this.elements[1] = cosx * siny * cosz - sinx * cosy * sinz;
          this.elements[2] = cosx * cosy * sinz + sinx * siny * cosz;
          this.elements[3] = cosx * cosy * cosz + sinx * siny * sinz;
        }

        return this;
      }
    }]);

    return Quat;
  }();
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


  var Plane = /*#__PURE__*/function (_DOMMesh) {
    _inherits(Plane, _DOMMesh);

    var _super3 = _createSuper(Plane);

    function Plane(renderer, htmlElement) {
      var _this28;

      var _ref11 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
          shareProgram = _ref11.shareProgram,
          widthSegments = _ref11.widthSegments,
          heightSegments = _ref11.heightSegments,
          depthTest = _ref11.depthTest,
          cullFace = _ref11.cullFace,
          uniforms = _ref11.uniforms,
          vertexShaderID = _ref11.vertexShaderID,
          fragmentShaderID = _ref11.fragmentShaderID,
          vertexShader = _ref11.vertexShader,
          fragmentShader = _ref11.fragmentShader,
          texturesOptions = _ref11.texturesOptions,
          crossOrigin = _ref11.crossOrigin,
          _ref11$alwaysDraw = _ref11.alwaysDraw,
          alwaysDraw = _ref11$alwaysDraw === void 0 ? false : _ref11$alwaysDraw,
          _ref11$visible = _ref11.visible,
          visible = _ref11$visible === void 0 ? true : _ref11$visible,
          _ref11$transparent = _ref11.transparent,
          transparent = _ref11$transparent === void 0 ? false : _ref11$transparent,
          _ref11$drawCheckMargi = _ref11.drawCheckMargins,
          drawCheckMargins = _ref11$drawCheckMargi === void 0 ? {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      } : _ref11$drawCheckMargi,
          _ref11$autoloadSource = _ref11.autoloadSources,
          autoloadSources = _ref11$autoloadSource === void 0 ? true : _ref11$autoloadSource,
          _ref11$watchScroll = _ref11.watchScroll,
          watchScroll = _ref11$watchScroll === void 0 ? true : _ref11$watchScroll,
          _ref11$fov = _ref11.fov,
          fov = _ref11$fov === void 0 ? 50 : _ref11$fov;

      _classCallCheck(this, Plane);

      _this28 = _super3.call(this, renderer, htmlElement, "Plane", {
        shareProgram: shareProgram,
        widthSegments: widthSegments,
        heightSegments: heightSegments,
        depthTest: depthTest,
        cullFace: cullFace,
        uniforms: uniforms,
        vertexShaderID: vertexShaderID,
        fragmentShaderID: fragmentShaderID,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        texturesOptions: texturesOptions,
        crossOrigin: crossOrigin
      });
      _this28.index = _this28.renderer.planes.length; // used for FBOs

      _this28.target = null; // use frustum culling or not

      _this28.alwaysDraw = alwaysDraw; // should draw is set to true by default, we'll check it later

      _this28._shouldDraw = true;
      _this28.visible = visible; // if the plane has transparency

      _this28._transparent = transparent; // draw check margins in pixels
      // positive numbers means it can be displayed even when outside the viewport
      // negative numbers means it can be hidden even when inside the viewport

      _this28.drawCheckMargins = drawCheckMargins; // if we decide to load all sources on init or let the user do it manually

      _this28.autoloadSources = autoloadSources; // if we should watch scroll

      _this28.watchScroll = watchScroll; // define if we should update the plane's matrices when called in the draw loop

      _this28._updateMVMatrix = false; // init camera

      _this28.camera = new Camera({
        fov: fov,
        width: _this28.renderer._boundingRect.width,
        height: _this28.renderer._boundingRect.height,
        pixelRatio: _this28.renderer.pixelRatio
      }); // if program is valid, go on

      if (_this28._program.compiled) {
        // init our plane
        _this28._initPlane(); // add our plane to the scene stack and the renderer array


        _this28.renderer.scene.addPlane(_assertThisInitialized(_this28));

        _this28.renderer.planes.push(_assertThisInitialized(_this28));
      }

      return _this28;
    }
    /*** RESTORING CONTEXT ***/

    /***
     Used internally to handle context restoration after the program has been successfully compiled again
     ***/


    _createClass(Plane, [{
      key: "_programRestored",
      value: function _programRestored() {
        if (this.target) {
          // reset its render target if needed
          this.setRenderTarget(this.renderer.renderTargets[this.target.index]);
        }

        this._initMatrices(); // set our initial perspective matrix


        this.setPerspective(this.camera.fov, this.camera.near, this.camera.far);

        this._applyWorldPositions(); // add the plane to our draw stack again as it have been emptied


        this.renderer.scene.addPlane(this); // reset textures

        for (var i = 0; i < this.textures.length; i++) {
          this.textures[i]._parent = this;

          this.textures[i]._restoreContext();
        }

        this._canDraw = true;
      }
      /***
       Init our basic plane values (transformations, positions, camera, sources)
       ***/

    }, {
      key: "_initPlane",
      value: function _initPlane() {
        // init transformation values
        this._initTransformValues(); // init its position values


        this._initPositions(); // set camera values


        this.setPerspective(this.camera.fov, this.camera.near, this.camera.far); // load sources

        this._initSources();
      }
      /*** TRANSFORMATIONS, PROJECTION & MATRICES ***/

      /***
       Set/reset plane's transformation values: rotation, scale, translation, transform origin
       ***/

    }, {
      key: "_initTransformValues",
      value: function _initTransformValues() {
        this.rotation = new Vec3(); // initial quaternion

        this.quaternion = new Quat(); // translation in viewport coordinates

        this.relativeTranslation = new Vec3(); // translation in webgl coordinates

        this._translation = new Vec3(); // scale is a Vec3 with z always equal to 1

        this.scale = new Vec3(1, 1, 1); // set plane transform origin to center

        this.transformOrigin = new Vec3(0.5, 0.5, 0);
      }
      /***
       Reset our plane transformation values and HTML element if specified (and valid)
         params :
       @htmlElement (HTML element, optional) : if provided, new HTML element to use as a reference for sizes and position syncing.
       ***/

    }, {
      key: "resetPlane",
      value: function resetPlane(htmlElement) {
        this._initTransformValues();

        if (htmlElement !== null && !!htmlElement) {
          this.htmlElement = htmlElement;
          this.updatePosition();
        } else if (!htmlElement && !this.renderer.production) {
          throwWarning(this.type + ": You are trying to reset a plane with a HTML element that does not exist. The old HTML element will be kept instead.");
        }
      }
      /***
       Init our plane position: set its matrices, its position and perspective
       ***/

    }, {
      key: "_initPositions",
      value: function _initPositions() {
        // set its matrices
        this._initMatrices(); // apply our css positions


        this._applyWorldPositions();
      }
      /***
       Init our plane model view and projection matrices and set their uniform locations
       ***/

    }, {
      key: "_initMatrices",
      value: function _initMatrices() {
        // create our model view and projection matrix
        this._matrices = {
          mvMatrix: {
            name: "uMVMatrix",
            matrix: new Mat4(),
            location: this.gl.getUniformLocation(this._program.program, "uMVMatrix")
          },
          pMatrix: {
            name: "uPMatrix",
            matrix: new Mat4(),
            // will be set after
            location: this.gl.getUniformLocation(this._program.program, "uPMatrix")
          }
        };
      }
      /***
       Set our plane dimensions and positions relative to clip spaces
       ***/

    }, {
      key: "_setWorldSizes",
      value: function _setWorldSizes() {
        // dimensions and positions of our plane in the document and clip spaces
        // don't forget translations in webgl space are referring to the center of our plane and canvas
        var planeCenter = {
          x: this._boundingRect.document.width / 2 + this._boundingRect.document.left,
          y: this._boundingRect.document.height / 2 + this._boundingRect.document.top
        };
        var containerCenter = {
          x: this.renderer._boundingRect.width / 2 + this.renderer._boundingRect.left,
          y: this.renderer._boundingRect.height / 2 + this.renderer._boundingRect.top
        }; // our plane clip space informations

        this._boundingRect.world = {
          width: this._boundingRect.document.width / this.renderer._boundingRect.width,
          height: this._boundingRect.document.height / this.renderer._boundingRect.height,
          top: (containerCenter.y - planeCenter.y) / this.renderer._boundingRect.height,
          left: (planeCenter.x - containerCenter.x) / this.renderer._boundingRect.height
        }; // since our vertices values range from -1 to 1
        // we need to scale them under the hood relatively to our canvas
        // to display an accurately sized plane

        this._boundingRect.world.scale = {
          x: this.renderer._boundingRect.width / this.renderer._boundingRect.height * this._boundingRect.world.width / 2,
          y: this._boundingRect.world.height / 2
        };
      }
      /*** PLANES PERSPECTIVES, SCALES AND ROTATIONS ***/

      /***
       This will set our perspective matrix and update our perspective matrix uniform
       used internally at each draw call if needed
       ***/

    }, {
      key: "_setPerspectiveMatrix",
      value: function _setPerspectiveMatrix() {
        // update our matrix uniform only if we share programs or if we actually have updated its values
        if (this.shareProgram || !this.shareProgram && this.camera._shouldUpdate) {
          this.renderer.useProgram(this._program);
          this.gl.uniformMatrix4fv(this._matrices.pMatrix.location, false, this._matrices.pMatrix.matrix.elements);
        } // reset camera shouldUpdate flag


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

    }, {
      key: "setPerspective",
      value: function setPerspective(fov, near, far) {
        this.camera.setPerspective(fov, near, far, this.renderer._boundingRect.width, this.renderer._boundingRect.height, this.renderer.pixelRatio); // force camera update on context restoration

        if (this.renderer.state.isContextLost) {
          this.camera.forceUpdate();
        }

        this._matrices.pMatrix.matrix = this.camera.projectionMatrix; // if camera settings changed update the mvMatrix as well cause we need to update z translation based on new fov

        this._updateMVMatrix = this.camera._shouldUpdate;
      }
      /***
       This will set our model view matrix
       used internally at each draw call if needed
       It will calculate our matrix based on its plane translation, rotation and scale
       ***/

    }, {
      key: "_setMVMatrix",
      value: function _setMVMatrix() {
        if (this._updateMVMatrix) {
          // translation
          // along the Z axis it's based on the relativeTranslation.z, CSSPerspective and camera Z position values
          // we're computing it here because it will change when our fov changes
          this._translation.z = -((1 - this.relativeTranslation.z / this.camera.CSSPerspective) / this.camera.position.z); // get transformation origin relative to world space

          var origin = new Vec3((this.transformOrigin.x * 2 - 1) * // between -1 and 1
          this._boundingRect.world.scale.x, -(this.transformOrigin.y * 2 - 1) // between -1 and 1
          * this._boundingRect.world.scale.y, this.transformOrigin.z); // get our transformation matrix

          var transformFromOrigin = new Mat4().composeFromOrigin(this._translation, this.quaternion, this.scale, origin); // now scale our plane according to its world bounding rect

          var scaleMatrix = new Mat4([this._boundingRect.world.scale.x, 0, 0, 0, 0, this._boundingRect.world.scale.y, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); // we've got our model view matrix

          this._matrices.mvMatrix.matrix = transformFromOrigin.multiply(scaleMatrix); // this is the result of our projection matrix * our mv matrix, useful for bounding box calculations and frustum culling

          this._matrices.mVPMatrix = this._matrices.pMatrix.matrix.multiply(this._matrices.mvMatrix.matrix); // check if we should draw the plane but only if everything has been initialized

          if (!this.alwaysDraw) {
            this._shouldDrawCheck();
          }
        } // update our matrix uniform only if we share programs or if we actually have updated its values


        if (this.shareProgram || !this.shareProgram && this._updateMVMatrix) {
          this.renderer.useProgram(this._program);
          this.gl.uniformMatrix4fv(this._matrices.mvMatrix.location, false, this._matrices.mvMatrix.matrix.elements);
        } // reset our flag


        this._updateMVMatrix = false;
      }
      /***
       This will set our plane scale
       used internally but can be used externally as well
         params :
       @scale (Vec2 object): scale to apply on X and Y axes
       ***/

    }, {
      key: "setScale",
      value: function setScale(scale) {
        if (!scale.type || scale.type !== "Vec2") {
          if (!this.renderer.production) {
            throwWarning(this.type + ": Cannot set scale because the parameter passed is not of Vec2 type:", scale);
          }

          return;
        }

        scale.sanitizeNaNValuesWith(this.scale).max(new Vec2(0.001, 0.001)); // only apply if values changed

        if (scale.x !== this.scale.x || scale.y !== this.scale.y) {
          this.scale.set(scale.x, scale.y, 1); // adjust textures size

          for (var i = 0; i < this.textures.length; i++) {
            this.textures[i].resize();
          } // we should update the plane mvMatrix


          this._updateMVMatrix = true;
        }
      }
      /***
       This will set our plane rotation
       used internally but can be used externally as well
         params :
       @rotation (Vec3 object): rotation to apply on X, Y and Z axes (in radians)
       ***/

    }, {
      key: "setRotation",
      value: function setRotation(rotation) {
        if (!rotation.type || rotation.type !== "Vec3") {
          if (!this.renderer.production) {
            throwWarning(this.type + ": Cannot set rotation because the parameter passed is not of Vec3 type:", rotation);
          }

          return;
        }

        rotation.sanitizeNaNValuesWith(this.rotation); // only apply if values changed

        if (!rotation.equals(this.rotation)) {
          this.rotation.copy(rotation);
          this.quaternion.setFromVec3(this.rotation); // we should update the plane mvMatrix

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

    }, {
      key: "setTransformOrigin",
      value: function setTransformOrigin(origin) {
        if (!origin.type || origin.type !== "Vec3") {
          if (!this.renderer.production) {
            throwWarning(this.type + ": Cannot set transform origin because the parameter passed is not of Vec3 type:", origin);
          }

          return;
        }

        origin.sanitizeNaNValuesWith(this.transformOrigin);

        if (!origin.equals(this.transformOrigin)) {
          this.transformOrigin.copy(origin);
          this._updateMVMatrix = true;
        }
      }
      /***
       This will set our plane translation by adding plane computed bounding box values and computed relative position values
       ***/

    }, {
      key: "_setTranslation",
      value: function _setTranslation() {
        // avoid unnecessary calculations if we don't have a users set relative position
        var worldPosition = new Vec3();

        if (!this.relativeTranslation.equals(worldPosition)) {
          worldPosition = this._documentToWorldSpace(this.relativeTranslation);
        }

        this._translation.set(this._boundingRect.world.left + worldPosition.x, this._boundingRect.world.top + worldPosition.y, this._translation.z); // we should update the plane mvMatrix


        this._updateMVMatrix = true;
      }
      /***
       This function takes pixel values along X and Y axis and convert them to clip space coordinates, and then apply the corresponding translation
       TODO deprecated and will be removed soon
         params :
       @translation (Vec3): translation to apply on X, Y and Z axes
       ***/

    }, {
      key: "setRelativePosition",
      value: function setRelativePosition(translation) {
        if (!this.renderer.production) {
          throwWarning(this.type + ": setRelativePosition() is deprecated, use setRelativeTranslation() instead");
        }

        this.setRelativeTranslation(translation);
      }
      /***
       This function takes pixel values along X and Y axis and convert them to clip space coordinates, and then apply the corresponding translation
         params :
       @translation (Vec3): translation to apply on X, Y and Z axes
       ***/

    }, {
      key: "setRelativeTranslation",
      value: function setRelativeTranslation(translation) {
        if (!translation.type || translation.type !== "Vec3") {
          if (!this.renderer.production) {
            throwWarning(this.type + ": Cannot set translation because the parameter passed is not of Vec3 type:", translation);
          }

          return;
        }

        translation.sanitizeNaNValuesWith(this.relativeTranslation); // only apply if values changed

        if (!translation.equals(this.relativeTranslation)) {
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

    }, {
      key: "_documentToWorldSpace",
      value: function _documentToWorldSpace(vector) {
        var worldPosition = new Vec3(vector.x / (this.renderer._boundingRect.width / this.renderer.pixelRatio) * (this.renderer._boundingRect.width / this.renderer._boundingRect.height), -vector.y / (this.renderer._boundingRect.height / this.renderer.pixelRatio), vector.z);
        return worldPosition;
      }
    }, {
      key: "_getIntersection",

      /*** FRUSTUM CULLING (DRAW CHECK) ***/

      /***
       Find the intersection point by adding a vector starting from a corner till we reach the near plane
         params:
       @refPoint (Vec3 class object): corner of the plane from which we start to iterate from
       @secondPoint (Vec3 class object): second point near the refPoint to get a direction to use for iteration
         returns:
       @intersection (Vec3 class object): intersection between our plane and the camera near plane
       ***/
      value: function _getIntersection(refPoint, secondPoint) {
        // direction vector to add
        var direction = secondPoint.clone().sub(refPoint); // copy our corner refpoint

        var intersection = refPoint.clone(); // iterate till we reach near plane

        while (intersection.z > -1) {
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

    }, {
      key: "_getNearPlaneIntersections",
      value: function _getNearPlaneIntersections(corners, mvpCorners, clippedCorners) {
        // rebuild the clipped corners based on non clipped ones
        if (clippedCorners.length === 1) {
          // we will have 5 corners to check so we'll need to push a new entry in our mvpCorners array
          if (clippedCorners[0] === 0) {
            // top left is culled
            // get intersection iterating from top right
            mvpCorners[0] = this._getIntersection(mvpCorners[1], new Vec3(0.95, 1, 0).applyMat4(this._matrices.mVPMatrix)); // get intersection iterating from bottom left

            mvpCorners.push(this._getIntersection(mvpCorners[3], new Vec3(-1, -0.95, 0).applyMat4(this._matrices.mVPMatrix)));
          } else if (clippedCorners[0] === 1) {
            // top right is culled
            // get intersection iterating from top left
            mvpCorners[1] = this._getIntersection(mvpCorners[0], new Vec3(-0.95, 1, 0).applyMat4(this._matrices.mVPMatrix)); // get intersection iterating from bottom right

            mvpCorners.push(this._getIntersection(mvpCorners[2], new Vec3(1, -0.95, 0).applyMat4(this._matrices.mVPMatrix)));
          } else if (clippedCorners[0] === 2) {
            // bottom right is culled
            // get intersection iterating from bottom left
            mvpCorners[2] = this._getIntersection(mvpCorners[3], new Vec3(-0.95, -1, 0).applyMat4(this._matrices.mVPMatrix)); // get intersection iterating from top right

            mvpCorners.push(this._getIntersection(mvpCorners[1], new Vec3(1, 0.95, 0).applyMat4(this._matrices.mVPMatrix)));
          } else if (clippedCorners[0] === 3) {
            // bottom left is culled
            // get intersection iterating from bottom right
            mvpCorners[3] = this._getIntersection(mvpCorners[2], new Vec3(0.95, -1, 0).applyMat4(this._matrices.mVPMatrix)); // get intersection iterating from top left

            mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(-1, 0.95, 0).applyMat4(this._matrices.mVPMatrix)));
          }
        } else if (clippedCorners.length === 2) {
          if (clippedCorners[0] === 0 && clippedCorners[1] === 1) {
            // top part of the plane is culled by near plane
            // find intersection using bottom corners
            mvpCorners[0] = this._getIntersection(mvpCorners[3], new Vec3(-1, -0.95, 0).applyMat4(this._matrices.mVPMatrix));
            mvpCorners[1] = this._getIntersection(mvpCorners[2], new Vec3(1, -0.95, 0).applyMat4(this._matrices.mVPMatrix));
          } else if (clippedCorners[0] === 1 && clippedCorners[1] === 2) {
            // right part of the plane is culled by near plane
            // find intersection using left corners
            mvpCorners[1] = this._getIntersection(mvpCorners[0], new Vec3(-0.95, 1, 0).applyMat4(this._matrices.mVPMatrix));
            mvpCorners[2] = this._getIntersection(mvpCorners[3], new Vec3(-0.95, -1, 0).applyMat4(this._matrices.mVPMatrix));
          } else if (clippedCorners[0] === 2 && clippedCorners[1] === 3) {
            // bottom part of the plane is culled by near plane
            // find intersection using top corners
            mvpCorners[2] = this._getIntersection(mvpCorners[1], new Vec3(1, 0.95, 0).applyMat4(this._matrices.mVPMatrix));
            mvpCorners[3] = this._getIntersection(mvpCorners[0], new Vec3(-1, 0.95, 0).applyMat4(this._matrices.mVPMatrix));
          } else if (clippedCorners[0] === 0 && clippedCorners[1] === 3) {
            // left part of the plane is culled by near plane
            // find intersection using right corners
            mvpCorners[0] = this._getIntersection(mvpCorners[1], new Vec3(0.95, 1, 0).applyMat4(this._matrices.mVPMatrix));
            mvpCorners[3] = this._getIntersection(mvpCorners[2], new Vec3(0.95, -1, 0).applyMat4(this._matrices.mVPMatrix));
          }
        } else if (clippedCorners.length === 3) {
          // get the corner that is not clipped
          var nonClippedCorner = 0;

          for (var i = 0; i < corners.length; i++) {
            if (!clippedCorners.includes(i)) {
              nonClippedCorner = i;
            }
          } // we will have just 3 corners so reset our mvpCorners array with just the visible corner


          mvpCorners = [mvpCorners[nonClippedCorner]];

          if (nonClippedCorner === 0) {
            // from top left corner to right
            mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(-0.95, 1, 0).applyMat4(this._matrices.mVPMatrix))); // from top left corner to bottom

            mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(-1, 0.95, 0).applyMat4(this._matrices.mVPMatrix)));
          } else if (nonClippedCorner === 1) {
            // from top right corner to left
            mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(0.95, 1, 0).applyMat4(this._matrices.mVPMatrix))); // from top right corner to bottom

            mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(1, 0.95, 0).applyMat4(this._matrices.mVPMatrix)));
          } else if (nonClippedCorner === 2) {
            // from bottom right corner to left
            mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(0.95, -1, 0).applyMat4(this._matrices.mVPMatrix))); // from bottom right corner to top

            mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(1, -0.95, 0).applyMat4(this._matrices.mVPMatrix)));
          } else if (nonClippedCorner === 3) {
            // from bottom left corner to right
            mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(-0.95, -1, 0).applyMat4(this._matrices.mVPMatrix))); // from bottom left corner to top

            mvpCorners.push(this._getIntersection(mvpCorners[0], new Vec3(-1 - 0.95, 0).applyMat4(this._matrices.mVPMatrix)));
          }
        } else {
          // all 4 corners are culled! artificially apply wrong coords to force plane culling
          for (var _i9 = 0; _i9 < corners.length; _i9++) {
            mvpCorners[_i9][0] = 10000;
            mvpCorners[_i9][1] = 10000;
          }
        }

        return mvpCorners;
      }
    }, {
      key: "_getWorldCoords",

      /***
       Useful to get our WebGL plane bounding box in the world space
       Takes all transformations into account
       Used internally for frustum culling
         returns :
       @boundingRectangle (obj): an object containing our plane WebGL element 4 corners coordinates: top left corner is [-1, 1] and bottom right corner is [1, -1]
       ***/
      value: function _getWorldCoords() {
        var corners = [new Vec3(-1, 1, 0), // plane's top left corner
        new Vec3(1, 1, 0), // plane's top right corner
        new Vec3(1, -1, 0), // plane's bottom right corner
        new Vec3(-1, -1, 0) // plane's bottom left corner
        ]; // corners with model view projection matrix applied

        var mvpCorners = []; // eventual clipped corners

        var clippedCorners = []; // we are going to get our plane's four corners relative to our model view projection matrix

        for (var i = 0; i < corners.length; i++) {
          var mvpCorner = corners[i].applyMat4(this._matrices.mVPMatrix);
          mvpCorners.push(mvpCorner); // Z position is > 1 or < -1 means the corner is clipped

          if (Math.abs(mvpCorner.z) > 1) {
            clippedCorners.push(i);
          }
        } // near plane is clipping, get intersections between plane and near plane


        if (clippedCorners.length) {
          mvpCorners = this._getNearPlaneIntersections(corners, mvpCorners, clippedCorners);
        } // we need to check for the X and Y min and max values
        // use arbitrary integers that will be overriden anyway


        var minX = Infinity;
        var maxX = -Infinity;
        var minY = Infinity;
        var maxY = -Infinity;

        for (var _i10 = 0; _i10 < mvpCorners.length; _i10++) {
          var corner = mvpCorners[_i10];

          if (corner.x < minX) {
            minX = corner.x;
          }

          if (corner.x > maxX) {
            maxX = corner.x;
          }

          if (corner.y < minY) {
            minY = corner.y;
          }

          if (corner.y > maxY) {
            maxY = corner.y;
          }
        }

        return {
          top: maxY,
          right: maxX,
          bottom: minY,
          left: minX
        };
      }
    }, {
      key: "_computeWebGLBoundingRect",

      /***
       Transpose our plane corners coordinates from world space to document space
       Sets an object with the accurate plane WebGL bounding rect relative to document
       ***/
      value: function _computeWebGLBoundingRect() {
        // get our world space bouding rect
        var worldBBox = this._getWorldCoords(); // normalize worldBBox to (0 -> 1) screen coordinates with [0, 0] being the top left corner and [1, 1] being the bottom right


        var screenBBox = {
          top: 1 - (worldBBox.top + 1) / 2,
          right: (worldBBox.right + 1) / 2,
          bottom: 1 - (worldBBox.bottom + 1) / 2,
          left: (worldBBox.left + 1) / 2
        };
        screenBBox.width = screenBBox.right - screenBBox.left;
        screenBBox.height = screenBBox.bottom - screenBBox.top; // return our values ranging from 0 to 1 multiplied by our canvas sizes + canvas top and left offsets

        this._boundingRect.worldToDocument = {
          width: screenBBox.width * this.renderer._boundingRect.width,
          height: screenBBox.height * this.renderer._boundingRect.height,
          top: screenBBox.top * this.renderer._boundingRect.height + this.renderer._boundingRect.top,
          left: screenBBox.left * this.renderer._boundingRect.width + this.renderer._boundingRect.left,
          // add left and width to get right property
          right: screenBBox.left * this.renderer._boundingRect.width + this.renderer._boundingRect.left + screenBBox.width * this.renderer._boundingRect.width,
          // add top and height to get bottom property
          bottom: screenBBox.top * this.renderer._boundingRect.height + this.renderer._boundingRect.top + screenBBox.height * this.renderer._boundingRect.height
        };
      }
      /***
       Returns our plane WebGL bounding rect relative to document
         returns :
       @boundingRectangle (obj): an object containing our plane WebGL element bounding rectangle (width, height, top, bottom, right and left properties)
       ***/

    }, {
      key: "getWebGLBoundingRect",
      value: function getWebGLBoundingRect() {
        if (!this._matrices.mVPMatrix) {
          return this._boundingRect.document;
        } else if (!this._boundingRect.worldToDocument || this.alwaysDraw) {
          this._computeWebGLBoundingRect();
        }

        return this._boundingRect.worldToDocument;
      }
      /***
       Returns our plane WebGL bounding rectangle in document coordinates including additional drawCheckMargins
         returns :
       @boundingRectangle (obj): an object containing our plane WebGL element bounding rectangle including the draw check margins (top, bottom, right and left properties)
       ***/

    }, {
      key: "_getWebGLDrawRect",
      value: function _getWebGLDrawRect() {
        this._computeWebGLBoundingRect();

        return {
          top: this._boundingRect.worldToDocument.top - this.drawCheckMargins.top,
          right: this._boundingRect.worldToDocument.right + this.drawCheckMargins.right,
          bottom: this._boundingRect.worldToDocument.bottom + this.drawCheckMargins.bottom,
          left: this._boundingRect.worldToDocument.left - this.drawCheckMargins.left
        };
      }
      /***
       This function checks if the plane is currently visible in the canvas and sets _shouldDraw property according to this test
       This is our real frustum culling check
       ***/

    }, {
      key: "_shouldDrawCheck",
      value: function _shouldDrawCheck() {
        var _this29 = this;

        // get plane bounding rect
        var actualPlaneBounds = this._getWebGLDrawRect(); // if we decide to draw the plane only when visible inside the canvas
        // we got to check if its actually inside the canvas


        if (Math.round(actualPlaneBounds.right) <= this.renderer._boundingRect.left || Math.round(actualPlaneBounds.left) >= this.renderer._boundingRect.left + this.renderer._boundingRect.width || Math.round(actualPlaneBounds.bottom) <= this.renderer._boundingRect.top || Math.round(actualPlaneBounds.top) >= this.renderer._boundingRect.top + this.renderer._boundingRect.height) {
          if (this._shouldDraw) {
            this._shouldDraw = false; // callback for leaving view

            this.renderer.nextRender.add(function () {
              return _this29._onLeaveViewCallback && _this29._onLeaveViewCallback();
            });
          }
        } else {
          if (!this._shouldDraw) {
            // callback for entering view
            this.renderer.nextRender.add(function () {
              return _this29._onReEnterViewCallback && _this29._onReEnterViewCallback();
            });
          }

          this._shouldDraw = true;
        }
      }
      /***
       This function returns if the plane is actually drawn (ie fully initiated, visible property set to true and not culled)
       ***/

    }, {
      key: "isDrawn",
      value: function isDrawn() {
        return this._canDraw && this.visible && (this._shouldDraw || this.alwaysDraw);
      }
      /***
       This function uses our plane HTML Element bounding rectangle values and convert them to the world clip space coordinates, and then apply the corresponding translation
       ***/

    }, {
      key: "_applyWorldPositions",
      value: function _applyWorldPositions() {
        // set our plane sizes and positions relative to the world clipspace
        this._setWorldSizes(); // set the translation values


        this._setTranslation();
      }
      /***
       This function updates the plane position based on its CSS positions and transformations values.
       Useful if the HTML element has been moved while the container size has not changed.
       ***/

    }, {
      key: "updatePosition",
      value: function updatePosition() {
        // set the new plane sizes and positions relative to document by triggering getBoundingClientRect()
        this._setDocumentSizes(); // apply them


        this._applyWorldPositions();
      }
      /***
       This function updates the plane position based on the Curtains class scroll manager values
         params:
       @lastXDelta (float): last scroll value along X axis
       @lastYDelta (float): last scroll value along Y axis
       ***/

    }, {
      key: "updateScrollPosition",
      value: function updateScrollPosition(lastXDelta, lastYDelta) {
        // actually update the plane position only if last X delta or last Y delta is not equal to 0
        if (lastXDelta || lastYDelta) {
          // set new positions based on our delta without triggering reflow
          this._boundingRect.document.top += lastYDelta * this.renderer.pixelRatio;
          this._boundingRect.document.left += lastXDelta * this.renderer.pixelRatio; // apply them

          this._applyWorldPositions();
        }
      }
    }, {
      key: "enableDepthTest",

      /*** DEPTH AND RENDER ORDER ***/

      /***
       This function set/unset the depth test for that plane
         params :
       @shouldEnableDepthTest (bool): enable/disable depth test for that plane
       ***/
      value: function enableDepthTest(shouldEnableDepthTest) {
        this._depthTest = shouldEnableDepthTest;
      }
      /***
       This function puts the plane at the end of the draw stack, allowing it to overlap any other plane
       ***/

    }, {
      key: "moveToFront",
      value: function moveToFront() {
        // disable the depth test
        this.enableDepthTest(false);
        this.renderer.scene.movePlaneToFront(this);
      }
      /*** SOURCES ***/

      /***
       Load our initial sources if needed and calls onReady callback
       ***/

    }, {
      key: "_initSources",
      value: function _initSources() {
        // finally load every sources already in our plane html element
        // load plane sources
        var loaderSize = 0;

        if (this.autoloadSources) {
          // load images
          var imagesArray = [];

          for (var i = 0; i < this.htmlElement.getElementsByTagName("img").length; i++) {
            imagesArray.push(this.htmlElement.getElementsByTagName("img")[i]);
          }

          if (imagesArray.length > 0) {
            this.loadImages(imagesArray);
          } // load videos


          var videosArray = [];

          for (var _i11 = 0; _i11 < this.htmlElement.getElementsByTagName("video").length; _i11++) {
            videosArray.push(this.htmlElement.getElementsByTagName("video")[_i11]);
          }

          if (videosArray.length > 0) {
            this.loadVideos(videosArray);
          } // load canvases


          var canvasesArray = [];

          for (var _i12 = 0; _i12 < this.htmlElement.getElementsByTagName("canvas").length; _i12++) {
            canvasesArray.push(this.htmlElement.getElementsByTagName("canvas")[_i12]);
          }

          if (canvasesArray.length > 0) {
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

    }, {
      key: "_startDrawing",
      value: function _startDrawing() {
        // check if our plane is ready to draw
        if (this._canDraw) {
          // even if our plane should not be drawn we still execute its onRender callback and update its uniforms
          if (this._onRenderCallback) {
            this._onRenderCallback();
          } // to improve webgl pipeline performace, we might want to update each texture that needs an update here
          // see https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#texImagetexSubImage_uploads_particularly_with_videos_can_cause_pipeline_flushes
          // if we should render to a render target


          if (this.target) {
            this.renderer.bindFrameBuffer(this.target);
          } else if (this.renderer.state.scenePassIndex === null) {
            this.renderer.bindFrameBuffer(null);
          } // update our perspective matrix


          this._setPerspectiveMatrix(); // update our mv matrix


          this._setMVMatrix(); // now check if we really need to draw it and its textures


          if ((this.alwaysDraw || this._shouldDraw) && this.visible) {
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

    }, {
      key: "onReEnterView",
      value: function onReEnterView(callback) {
        if (callback) {
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

    }, {
      key: "onLeaveView",
      value: function onLeaveView(callback) {
        if (callback) {
          this._onLeaveViewCallback = callback;
        }

        return this;
      }
    }]);

    return Plane;
  }(DOMMesh);
  /***
   Here we create a RenderTarget class object
     params :
   @renderer (Curtains renderer or Renderer class object): our curtains object OR our curtains renderer object
     @shaderPass (ShaderPass class object): shader pass that will use that render target. Default to null
   @depth (bool, optional): whether to create a depth buffer (handle depth inside your render target). Default to false.
   @clear (bool, optional): whether the content of the render target should be cleared before being drawn. Should be set to false to handle ping-pong shading. Default to true.
     @minWidth (float, optional): minimum width of the render target
   @minHeight (float, optional): minimum height of the render target
     @texturesOptions (object, optional): options and parameters to apply to the render target texture. See the Texture class object.
     returns :
   @this: our RenderTarget class object
   ***/


  var RenderTarget = /*#__PURE__*/function () {
    function RenderTarget(renderer) {
      var _ref12 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
          shaderPass = _ref12.shaderPass,
          _ref12$depth = _ref12.depth,
          depth = _ref12$depth === void 0 ? false : _ref12$depth,
          _ref12$clear = _ref12.clear,
          clear = _ref12$clear === void 0 ? true : _ref12$clear,
          _ref12$minWidth = _ref12.minWidth,
          minWidth = _ref12$minWidth === void 0 ? 1024 : _ref12$minWidth,
          _ref12$minHeight = _ref12.minHeight,
          minHeight = _ref12$minHeight === void 0 ? 1024 : _ref12$minHeight,
          _ref12$texturesOption = _ref12.texturesOptions,
          texturesOptions = _ref12$texturesOption === void 0 ? {} : _ref12$texturesOption;

      _classCallCheck(this, RenderTarget);

      this.type = "RenderTarget"; // we could pass our curtains object OR our curtains renderer object

      renderer = renderer && renderer.renderer || renderer;

      if (!renderer || renderer.type !== "Renderer") {
        throwError(this.type + ": Renderer not passed as first argument", renderer);
      } else if (!renderer.gl) {
        throwError(this.type + ": Renderer WebGL context is undefined", renderer);
      }

      this.renderer = renderer;
      this.gl = this.renderer.gl;
      this.index = this.renderer.renderTargets.length;
      this._shaderPass = shaderPass; // whether to create a render buffer

      this._depth = depth;
      this._shouldClear = clear;
      this._minSize = {
        width: minWidth * this.renderer.pixelRatio,
        height: minHeight * this.renderer.pixelRatio
      }; // default textures options depends on the type of Mesh and WebGL context

      texturesOptions = Object.assign({
        // set default sampler to "uRenderTexture" and isFBOTexture to true
        sampler: "uRenderTexture",
        isFBOTexture: true,
        premultiplyAlpha: false,
        anisotropy: 1,
        generateMipmap: false,
        floatingPoint: "none",
        wrapS: this.gl.CLAMP_TO_EDGE,
        wrapT: this.gl.CLAMP_TO_EDGE,
        minFilter: this.gl.LINEAR,
        magFilter: this.gl.LINEAR
      }, texturesOptions);
      this._texturesOptions = texturesOptions;
      this.userData = {};
      this.uuid = generateUUID();
      this.renderer.renderTargets.push(this); // we've added a new object, keep Curtains class in sync with our renderer

      this.renderer.onSceneChange();

      this._initRenderTarget();
    }
    /***
     Init our RenderTarget by setting its size, creating a textures array and then calling _createFrameBuffer()
     ***/


    _createClass(RenderTarget, [{
      key: "_initRenderTarget",
      value: function _initRenderTarget() {
        this._setSize(); // create our render texture


        this.textures = []; // create our frame buffer

        this._createFrameBuffer();
      }
      /*** RESTORING CONTEXT ***/

      /***
       Restore a render target
       Basically just re init it
       ***/

    }, {
      key: "_restoreContext",
      value: function _restoreContext() {
        // reset size
        this._setSize(); // re create our frame buffer and restore its texture


        this._createFrameBuffer();
      }
      /***
       Sets our RenderTarget size based on its parent plane size
       ***/

    }, {
      key: "_setSize",
      value: function _setSize() {
        if (this._shaderPass && this._shaderPass._isScenePass) {
          this._size = {
            width: this.renderer._boundingRect.width,
            height: this.renderer._boundingRect.height
          };
        } else {
          this._size = {
            width: Math.max(this._minSize.width, this.renderer._boundingRect.width),
            height: Math.max(this._minSize.height, this.renderer._boundingRect.height)
          };
        }
      }
      /***
       Resizes our RenderTarget (only resize it if it's a ShaderPass scene pass FBO)
       ***/

    }, {
      key: "resize",
      value: function resize() {
        // resize render target only if its a child of a shader pass
        if (this._shaderPass) {
          this._setSize();

          this.textures[0].resize(); // cancel clear on resize

          this.renderer.bindFrameBuffer(this, true);

          if (this._depth) {
            this._bindDepthBuffer();
          }

          this.renderer.bindFrameBuffer(null);
        }
      }
      /***
       Binds our depth buffer
       ***/

    }, {
      key: "_bindDepthBuffer",
      value: function _bindDepthBuffer() {
        // render to our target texture by binding the framebuffer
        if (this._depthBuffer) {
          this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this._depthBuffer); // allocate renderbuffer

          this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, this._size.width, this._size.height); // attach renderbuffer

          this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.RENDERBUFFER, this._depthBuffer);
        }
      }
      /***
       Here we create our frame buffer object
       We're also adding a render buffer object to handle depth if needed
       ***/

    }, {
      key: "_createFrameBuffer",
      value: function _createFrameBuffer() {
        this._frameBuffer = this.gl.createFramebuffer(); // cancel clear on init

        this.renderer.bindFrameBuffer(this, true); // if textures array is not empty it means we're restoring the context

        if (this.textures.length) {
          this.textures[0]._parent = this;

          this.textures[0]._restoreContext();
        } else {
          // create a texture
          var texture = new Texture(this.renderer, this._texturesOptions); // adds the render target as parent and adds the texture to our textures array as well

          texture.addParent(this);
        } // attach the texture as the first color attachment
        // this.textures[0]._sampler.texture contains our WebGLTexture object


        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.textures[0]._sampler.texture, 0); // create a depth renderbuffer

        if (this._depth) {
          this._depthBuffer = this.gl.createRenderbuffer();

          this._bindDepthBuffer();
        }

        this.renderer.bindFrameBuffer(null);
      }
      /*** GET THE RENDER TARGET TEXTURE ***/

      /***
       Returns the render target's texture
         returns :
       @texture (Texture class object): our RenderTarget's texture
       ***/

    }, {
      key: "getTexture",
      value: function getTexture() {
        return this.textures[0];
      }
      /*** DESTROYING ***/

      /***
       Remove an element by calling the appropriate renderer method
       ***/

    }, {
      key: "remove",
      value: function remove() {
        // check if it is attached to a shader pass
        if (this._shaderPass) {
          if (!this.renderer.production) {
            throwWarning(this.type + ": You're trying to remove a RenderTarget attached to a ShaderPass. You should remove that ShaderPass instead:", this._shaderPass);
          }

          return;
        }

        this._dispose();

        this.renderer.removeRenderTarget(this);
      }
      /***
       Delete a RenderTarget buffers and its associated texture
       ***/

    }, {
      key: "_dispose",
      value: function _dispose() {
        if (this._frameBuffer) {
          this.gl.deleteFramebuffer(this._frameBuffer);
          this._frameBuffer = null;
        }

        if (this._depthBuffer) {
          this.gl.deleteRenderbuffer(this._depthBuffer);
          this._depthBuffer = null;
        }

        this.textures[0]._dispose();

        this.textures = [];
      }
    }]);

    return RenderTarget;
  }();
  /*** SHADERPASS CLASS ***/

  /***
   Here we create our ShaderPass object
   We will extend our DOMMesh class that handles all the WebGL part and basic HTML sizings
   ShaderPass class will add the frame buffer by creating a new RenderTarget class object
     params :
   @renderer (Curtains renderer or Renderer class object): our curtains object OR our curtains renderer object
     @Meshparams (object): see Mesh class object
     @depth (boolean, optionnal): whether the shader pass render target should use a depth buffer (see RenderTarget class object). Default to false.
   @clear (boolean, optional): whether the shader pass render target content should be cleared before being drawn (see RenderTarget class object). Default to true.
   @renderTarget (RenderTarget class object, optional): an already existing render target to use. Default to null.
     returns :
   @this: our ShaderPass element
   ***/


  var ShaderPass = /*#__PURE__*/function (_DOMMesh2) {
    _inherits(ShaderPass, _DOMMesh2);

    var _super4 = _createSuper(ShaderPass);

    function ShaderPass(renderer, _ref13) {
      var _this30;

      var shareProgram = _ref13.shareProgram,
          widthSegments = _ref13.widthSegments,
          heightSegments = _ref13.heightSegments,
          depthTest = _ref13.depthTest,
          cullFace = _ref13.cullFace,
          uniforms = _ref13.uniforms,
          vertexShaderID = _ref13.vertexShaderID,
          fragmentShaderID = _ref13.fragmentShaderID,
          vertexShader = _ref13.vertexShader,
          fragmentShader = _ref13.fragmentShader,
          texturesOptions = _ref13.texturesOptions,
          crossOrigin = _ref13.crossOrigin,
          _ref13$depth = _ref13.depth,
          depth = _ref13$depth === void 0 ? false : _ref13$depth,
          _ref13$clear = _ref13.clear,
          clear = _ref13$clear === void 0 ? true : _ref13$clear,
          renderTarget = _ref13.renderTarget;

      _classCallCheck(this, ShaderPass);

      // force plane defintion to 1x1
      widthSegments = 1;
      heightSegments = 1; // always cull back face

      cullFace = "back"; // never share a program between shader passes

      shareProgram = false; // use the renderer container as our HTML element to create a DOMMesh object

      _this30 = _super4.call(this, renderer, renderer.container, "ShaderPass", {
        shareProgram: shareProgram,
        widthSegments: widthSegments,
        heightSegments: heightSegments,
        depthTest: depthTest,
        cullFace: cullFace,
        uniforms: uniforms,
        vertexShaderID: vertexShaderID,
        fragmentShaderID: fragmentShaderID,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        texturesOptions: texturesOptions,
        crossOrigin: crossOrigin
      }); // default to scene pass

      _this30._isScenePass = true;
      _this30.index = _this30.renderer.shaderPasses.length;
      _this30._depth = depth;
      _this30._shouldClear = clear;
      _this30.target = renderTarget;

      if (_this30.target) {
        // if there's a target defined it's not a scene pass
        _this30._isScenePass = false; // inherit clear param

        _this30._shouldClear = _this30.target._shouldClear;
      } // if the program is valid, go on


      if (_this30._program.compiled) {
        _this30._initShaderPass(); // add shader pass to our renderer shaderPasses array


        _this30.renderer.shaderPasses.push(_assertThisInitialized(_this30)); // wait one tick before adding our shader pass to the scene to avoid flickering black screen for one frame


        _this30.renderer.nextRender.add(function () {
          _this30.renderer.scene.addShaderPass(_assertThisInitialized(_this30));
        });
      }

      return _this30;
    }
    /*** RESTORING CONTEXT ***/

    /***
     Used internally to handle context restoration after the program has been successfully compiled again
     ***/


    _createClass(ShaderPass, [{
      key: "_programRestored",
      value: function _programRestored() {
        // we just need to re add the shader pass to the scene stack
        if (this._isScenePass) {
          this.renderer.scene.stacks.scenePasses.push(this.index);
        } else {
          this.renderer.scene.stacks.renderPasses.push(this.index);
        } // restore the textures


        for (var i = 0; i < this.textures.length; i++) {
          this.textures[i]._parent = this;

          this.textures[i]._restoreContext();
        }

        this._canDraw = true;
      }
      /***
       Here we init additionnal shader pass planes properties
       This mainly consists in creating our render texture and add a frame buffer object
       ***/

    }, {
      key: "_initShaderPass",
      value: function _initShaderPass() {
        // create our frame buffer
        if (!this.target) {
          this._createFrameBuffer();
        } else {
          // set the render target
          this.setRenderTarget(this.target);
          this.target._shaderPass = this;
        } // create a texture from the render target texture


        var texture = new Texture(this.renderer, {
          sampler: "uRenderTexture",
          isFBOTexture: true,
          fromTexture: this.target.getTexture()
        });
        texture.addParent(this); // onReady callback

        this.loader._setLoaderSize(0);

        this._canDraw = true; // be sure we'll update the scene even if drawing is disabled

        this.renderer.needRender();
      }
      /***
       Here we create our frame buffer object
       We're also adding a render buffer object to handle depth inside our shader pass
       ***/

    }, {
      key: "_createFrameBuffer",
      value: function _createFrameBuffer() {
        var target = new RenderTarget(this.renderer, {
          shaderPass: this,
          clear: this._shouldClear,
          depth: this._depth,
          texturesOptions: this._texturesOptions
        });
        this.setRenderTarget(target);
      }
      /*** DRAWING ***/

      /***
       Specific instructions for the Shader pass class to execute before drawing it
       ***/

    }, {
      key: "_startDrawing",
      value: function _startDrawing() {
        // check if our plane is ready to draw
        if (this._canDraw) {
          // even if our plane should not be drawn we still execute its onRender callback and update its uniforms
          if (this._onRenderCallback) {
            this._onRenderCallback();
          } // to improve webgl pipeline performance, we might want to update each texture that needs an update here
          // see https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#texImagetexSubImage_uploads_particularly_with_videos_can_cause_pipeline_flushes


          if (this._isScenePass) {
            // if this is a scene pass, check if theres one more coming next and eventually bind it
            if (this.renderer.state.scenePassIndex + 1 < this.renderer.scene.stacks.scenePasses.length) {
              this.renderer.bindFrameBuffer(this.renderer.shaderPasses[this.renderer.scene.stacks.scenePasses[this.renderer.state.scenePassIndex + 1]].target);
              this.renderer.state.scenePassIndex++;
            } else {
              this.renderer.bindFrameBuffer(null);
            }
          } else if (this.renderer.state.scenePassIndex === null) {
            // we are rendering a bunch of planes inside a render target, unbind it
            this.renderer.bindFrameBuffer(null);
          } // now check if we really need to draw it and its textures


          this._draw();
        }
      }
    }]);

    return ShaderPass;
  }(DOMMesh);
  /*** FBO PING PONG PLANE CLASS ***/

  /***
   A little helper to create a plane that will perform FBO ping pong
   This plane will use FBOs swapping, using these following steps:
   - create two render targets (read and write)
   - create a texture onto which we'll draw
   - before drawing our plane (onRender callback), apply the write pass as our plane render target
   - after drawing our plane (onAfterRender callback), swap the read and write pass and copy the read pass texture again
     params:
   @sampler (string): sampler name used to create our texture and that will be used inside your shader
   @planeParams: see Plane class object
     returns :
   @this: our PingPongPlane element
   ***/


  var PingPongPlane = /*#__PURE__*/function (_Plane) {
    _inherits(PingPongPlane, _Plane);

    var _super5 = _createSuper(PingPongPlane);

    function PingPongPlane(curtains, htmlElement) {
      var _this31;

      var _ref14 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
          _ref14$sampler = _ref14.sampler,
          sampler = _ref14$sampler === void 0 ? "uPingPongTexture" : _ref14$sampler,
          shareProgram = _ref14.shareProgram,
          widthSegments = _ref14.widthSegments,
          heightSegments = _ref14.heightSegments,
          depthTest = _ref14.depthTest,
          cullFace = _ref14.cullFace,
          uniforms = _ref14.uniforms,
          vertexShaderID = _ref14.vertexShaderID,
          fragmentShaderID = _ref14.fragmentShaderID,
          vertexShader = _ref14.vertexShader,
          fragmentShader = _ref14.fragmentShader,
          texturesOptions = _ref14.texturesOptions,
          crossOrigin = _ref14.crossOrigin,
          alwaysDraw = _ref14.alwaysDraw,
          visible = _ref14.visible,
          transparent = _ref14.transparent,
          drawCheckMargins = _ref14.drawCheckMargins,
          autoloadSources = _ref14.autoloadSources,
          watchScroll = _ref14.watchScroll,
          fov = _ref14.fov;

      _classCallCheck(this, PingPongPlane);

      // force depthTest and autoloadSources to false
      depthTest = false;
      autoloadSources = false; // create our plane

      _this31 = _super5.call(this, curtains, htmlElement, {
        shareProgram: shareProgram,
        widthSegments: widthSegments,
        heightSegments: heightSegments,
        depthTest: depthTest,
        cullFace: cullFace,
        uniforms: uniforms,
        vertexShaderID: vertexShaderID,
        fragmentShaderID: fragmentShaderID,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        texturesOptions: texturesOptions,
        crossOrigin: crossOrigin,
        alwaysDraw: alwaysDraw,
        visible: visible,
        transparent: transparent,
        drawCheckMargins: drawCheckMargins,
        autoloadSources: autoloadSources,
        watchScroll: watchScroll,
        fov: fov
      }); // create 2 render targets

      _this31.readPass = new RenderTarget(curtains, {
        depth: false,
        clear: false,
        texturesOptions: texturesOptions
      });
      _this31.writePass = new RenderTarget(curtains, {
        depth: false,
        clear: false,
        texturesOptions: texturesOptions
      }); // create a texture where we'll draw

      _this31.createTexture({
        sampler: sampler,
        fromTexture: _this31.readPass.getTexture()
      }); // override onRender and onAfterRender callbacks


      _this31._onRenderCallback = function () {
        // update the render target
        _this31.writePass && _this31.setRenderTarget(_this31.writePass);
        _this31._onPingPongRenderCallback && _this31._onPingPongRenderCallback();
      };

      _this31._onAfterRenderCallback = function () {
        // swap FBOs and update texture
        if (_this31.readPass && _this31.writePass && _this31.textures[0]) {
          _this31._swapPasses();
        }

        _this31._onPingPongAfterRenderCallback && _this31._onPingPongAfterRenderCallback();
      };

      return _this31;
    }
    /***
     After each draw call, we'll swap the 2 render targets and copy the read pass texture again
     ***/


    _createClass(PingPongPlane, [{
      key: "_swapPasses",
      value: function _swapPasses() {
        // swap read and write passes
        var tempFBO = this.readPass;
        this.readPass = this.writePass;
        this.writePass = tempFBO; // apply new texture

        this.textures[0].copy(this.readPass.getTexture());
      }
      /***
       Returns the created texture where we're writing
       ***/

    }, {
      key: "getTexture",
      value: function getTexture() {
        return this.textures[0];
      }
      /*** OVERRIDE USED EVENTS ***/

      /***
       This is called at each requestAnimationFrame call
         params :
       @callback (function) : a function to execute
         returns :
       @this: our plane to handle chaining
       ***/

    }, {
      key: "onRender",
      value: function onRender(callback) {
        if (callback) {
          this._onPingPongRenderCallback = callback;
        }

        return this;
      }
      /***
       This is called at each requestAnimationFrame call
         params :
       @callback (function) : a function to execute
         returns :
       @this: our plane to handle chaining
       ***/

    }, {
      key: "onAfterRender",
      value: function onAfterRender(callback) {
        if (callback) {
          this._onPingPongAfterRenderCallback = callback;
        }

        return this;
      }
    }]);

    return PingPongPlane;
  }(Plane);
  /*** FXAAPASS CLASS ***/

  /***
   Here we create our FXAAPass object
   This is just a regular ShaderPass with preset shaders and a resolution uniform
     params: see ShaderPas class object
     returns :
   @this: our FXAAPass element
   ***/


  var FXAAPass = function FXAAPass(curtains) {
    var _this32 = this;

    var _ref15 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        depthTest = _ref15.depthTest,
        texturesOptions = _ref15.texturesOptions,
        crossOrigin = _ref15.crossOrigin,
        depth = _ref15.depth,
        clear = _ref15.clear,
        renderTarget = _ref15.renderTarget;

    _classCallCheck(this, FXAAPass);

    // taken from https://github.com/spite/Wagner/blob/master/fragment-shaders/fxaa-fs.glsl
    var fragmentShader = "\n            precision mediump float;\n            \n            varying vec3 vVertexPosition;\n            varying vec2 vTextureCoord;\n        \n            uniform sampler2D uRenderTexture;\n            \n            uniform vec2 uResolution;\n            \n            #define FXAA_REDUCE_MIN   (1.0/128.0)\n            #define FXAA_REDUCE_MUL   (1.0/8.0)\n            #define FXAA_SPAN_MAX     8.0\n            \n            void main() {\n                vec2 res = 1.0 / uResolution;\n            \n                vec3 rgbNW = texture2D(uRenderTexture, (vTextureCoord.xy + vec2(-1.0, -1.0) * res)).xyz;\n                vec3 rgbNE = texture2D(uRenderTexture, (vTextureCoord.xy + vec2(1.0, -1.0) * res)).xyz;\n                vec3 rgbSW = texture2D(uRenderTexture, (vTextureCoord.xy + vec2(-1.0, 1.0) * res)).xyz;\n                vec3 rgbSE = texture2D(uRenderTexture, (vTextureCoord.xy + vec2(1.0, 1.0) * res)).xyz;\n                vec4 rgbaM = texture2D(uRenderTexture, vTextureCoord.xy * res);\n                vec3 rgbM = rgbaM.xyz;\n                vec3 luma = vec3(0.299, 0.587, 0.114);\n            \n                float lumaNW = dot(rgbNW, luma);\n                float lumaNE = dot(rgbNE, luma);\n                float lumaSW = dot(rgbSW, luma);\n                float lumaSE = dot(rgbSE, luma);\n                float lumaM  = dot(rgbM,  luma);\n                float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));\n                float lumaMax = max(lumaM, max(max(lumaNW, lumaNE) , max(lumaSW, lumaSE)));\n            \n                vec2 dir;\n                dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));\n                dir.y = ((lumaNW + lumaSW) - (lumaNE + lumaSE));\n            \n                float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);\n            \n                float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);\n                dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX),\n                      max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),\n                            dir * rcpDirMin)) * res;\n                vec4 rgbA = (1.0/2.0) * (\n                texture2D(uRenderTexture, vTextureCoord.xy + dir * (1.0/3.0 - 0.5)) +\n                texture2D(uRenderTexture, vTextureCoord.xy + dir * (2.0/3.0 - 0.5)));\n                vec4 rgbB = rgbA * (1.0/2.0) + (1.0/4.0) * (\n                texture2D(uRenderTexture, vTextureCoord.xy + dir * (0.0/3.0 - 0.5)) +\n                texture2D(uRenderTexture, vTextureCoord.xy + dir * (3.0/3.0 - 0.5)));\n                float lumaB = dot(rgbB, vec4(luma, 0.0));\n            \n                if ((lumaB < lumaMin) || (lumaB > lumaMax)) {\n                    gl_FragColor = rgbA;\n                } else {\n                    gl_FragColor = rgbB;\n                }\n            }\n        ";
    var renderer = curtains.renderer || curtains;
    var uniforms = {
      resolution: {
        name: "uResolution",
        type: "2f",
        value: [renderer._boundingRect.width, renderer._boundingRect.height]
      }
    };
    this.pass = new ShaderPass(curtains, {
      // Mesh params
      depthTest: depthTest,
      fragmentShader: fragmentShader,
      uniforms: uniforms,
      texturesOptions: texturesOptions,
      crossOrigin: crossOrigin,
      // ShaderPass specific params
      depth: depth,
      clear: clear,
      renderTarget: renderTarget
    });
    this.pass.onAfterResize(function () {
      _this32.pass.uniforms.resolution.value = [_this32.pass.renderer._boundingRect.width, _this32.pass.renderer._boundingRect.height];
    });
  };

  exports.Curtains = Curtains;
  exports.FXAAPass = FXAAPass;
  exports.Mat4 = Mat4;
  exports.PingPongPlane = PingPongPlane;
  exports.Plane = Plane;
  exports.RenderTarget = RenderTarget;
  exports.ShaderPass = ShaderPass;
  exports.Texture = Texture;
  exports.TextureLoader = TextureLoader;
  exports.Vec2 = Vec2;
  exports.Vec3 = Vec3;
  Object.defineProperty(exports, '__esModule', {
    value: true
  });
});
