import { Renderer } from "./Renderer.js";
import { ScrollManager } from "../utils/ScrollManager.js";
import { throwWarning, lerp } from "../utils/utils.js";

const version = "8.1.6";

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
export class Curtains {
  constructor({
    // renderer container
    container,

    // webgl params
    alpha = true,
    premultipliedAlpha = false,
    antialias = true,
    depth = true,
    failIfMajorPerformanceCaveat = true,
    preserveDrawingBuffer = false,
    stencil = false,

    autoResize = true,
    autoRender = true,
    watchScroll = true,

    pixelRatio = window.devicePixelRatio || 1,
    renderingScale = 1,

    production = false,
  } = {}) {
    this.type = "Curtains";

    // if we should use auto resize (default to true)
    this._autoResize = autoResize;
    // if we should use auto render (default to true)
    this._autoRender = autoRender;
    // if we should watch the scroll (default to true)
    this._watchScroll = watchScroll;

    // pixel ratio and rendering scale
    this.pixelRatio = pixelRatio;
    // rendering scale
    renderingScale = isNaN(renderingScale) ? 1 : parseFloat(renderingScale);
    this._renderingScale = Math.max(0.25, Math.min(1, renderingScale));

    // webgl context parameters
    this.premultipliedAlpha = premultipliedAlpha;
    this.alpha = alpha;
    this.antialias = antialias;
    this.depth = depth;
    this.failIfMajorPerformanceCaveat = failIfMajorPerformanceCaveat;
    this.preserveDrawingBuffer = preserveDrawingBuffer;
    this.stencil = stencil;

    this.production = production;

    this.errors = false;

    // if a container has been provided, proceed to init
    if (container) {
      this.setContainer(container);
    } else if (!this.production) {
      throwWarning(
        this.type +
          ": no container provided in the initial parameters. Use setContainer() method to set one later and initialize the WebGL context"
      );
    }
  }

  /***
     Set up our Curtains container and start initializing everything
     Called on Curtains instancing if a params container has been provided, could be call afterwards else
     Useful with JS frameworks to init our Curtains class globally and then set the container in a canvas component afterwards to fully instantiate everything

     params:
     @container (HTML element or string): the container HTML element or ID that will hold our canvas
     ***/
  setContainer(container) {
    if (!container) {
      let container = document.createElement("div");
      container.setAttribute("id", "curtains-canvas");
      document.body.appendChild(container);
      this.container = container;
      if (!this.production)
        throwWarning(
          'Curtains: no valid container HTML element or ID provided, created a div with "curtains-canvas" ID instead'
        );
    } else {
      if (typeof container === "string") {
        container = document.getElementById(container);

        if (!container) {
          let container = document.createElement("div");
          container.setAttribute("id", "curtains-canvas");
          document.body.appendChild(container);
          this.container = container;
          if (!this.production)
            throwWarning(
              'Curtains: no valid container HTML element or ID provided, created a div with "curtains-canvas" ID instead'
            );
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
  _initCurtains() {
    this.planes = [];
    this.renderTargets = [];
    this.shaderPasses = [];

    // init webgl context
    this._initRenderer();

    if (!this.gl) return;

    // scroll
    this._initScroll();

    // sizes
    this._setSize();

    // event listeners
    this._addListeners();

    // we are ready to go
    this.container.appendChild(this.canvas);

    // watermark
    //console.log("curtains.js - v" + version);

    // start rendering
    this._animationFrameID = null;
    if (this._autoRender) {
      this._animate();
    }
  }

  /*** WEBGL CONTEXT ***/

  /***
     Initialize the Renderer class object
     ***/
  _initRenderer() {
    this.renderer = new Renderer({
      alpha: this.alpha,
      antialias: this.antialias,
      premultipliedAlpha: this.premultipliedAlpha,
      depth: this.depth,
      failIfMajorPerformanceCaveat: this.failIfMajorPerformanceCaveat,
      preserveDrawingBuffer: this.preserveDrawingBuffer,
      stencil: this.stencil,

      container: this.container,
      pixelRatio: this.pixelRatio,
      renderingScale: this._renderingScale,

      production: this.production,

      onError: () => this._onRendererError(),
      onSuccess: () => this._onRendererSuccess(),
      onContextLost: () => this._onRendererContextLost(),
      onContextRestored: () => this._onRendererContextRestored(),
      onDisposed: () => this._onRendererDisposed(),
      // keep sync between renderer planes, shader passes and render targets arrays and the Curtains ones
      onSceneChange: () => this._keepSync(),
    });

    this.gl = this.renderer.gl;
    this.canvas = this.renderer.canvas;
  }

  /***
     Force our renderer to restore the WebGL context
     ***/
  restoreContext() {
    this.renderer.restoreContext();
  }

  /***
     This just handles our drawing animation frame
     ***/
  _animate() {
    this.render();
    this._animationFrameID = window.requestAnimationFrame(
      this._animate.bind(this)
    );
  }

  /*** RENDERING ***/

  /***
     Enables rendering
     ***/
  enableDrawing() {
    this.renderer.enableDrawing();
  }

  /***
     Disables rendering
     ***/
  disableDrawing() {
    this.renderer.disableDrawing();
  }

  /***
     Forces the rendering of the next frame, even if disabled
     ***/
  needRender() {
    this.renderer.needRender();
  }

  /***
     Executes a callback on next frame

     params:
     @callback (function): callback to execute on next frame
     @keep (bool): whether to keep calling that callback on each rendering call or not (act as a setInterval). Default to false

     returns:
     @queueItem: the queue item. Allows to keep a track of it and set its keep property to false when needed
     ***/
  nextRender(callback, keep = false) {
    return this.renderer.nextRender.add(callback, keep);
  }

  /***
     Clear our WebGL renderer colors and depth buffers
     ***/
  clear() {
    this.renderer && this.renderer.clear();
  }

  /***
     Clear our WebGL renderer depth buffer
     ***/
  clearDepth() {
    this.renderer && this.renderer.clearDepth();
  }

  /***
     Clear our WebGL renderer color buffer
     ***/
  clearColor() {
    this.renderer && this.renderer.clearColor();
  }

  /***
     Check whether the created context is WebGL2

     return:
     @isWebGL2 (bool): whether the created WebGL context is 2.0 or not
     ***/
  isWebGL2() {
    return this.gl ? this.renderer._isWebGL2 : false;
  }

  /***
     Tells our renderer to render the scene if the drawing is enabled
     ***/
  render() {
    // always execute callback queue
    this.renderer.nextRender.execute();

    // If forceRender is true, force rendering this frame even if drawing is not enabled.
    // If not, only render if enabled.
    if (
      !this.renderer.state.drawingEnabled &&
      !this.renderer.state.forceRender
    ) {
      return;
    }

    // reset forceRender
    if (this.renderer.state.forceRender) {
      this.renderer.state.forceRender = false;
    }

    // Curtains onRender callback
    if (this._onRenderCallback) {
      this._onRenderCallback();
    }

    this.renderer.render();
  }

  /*** LISTENERS ***/

  /***
     Adds our resize event listener if needed
     ***/
  _addListeners() {
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
  setPixelRatio(pixelRatio, triggerCallback) {
    this.pixelRatio = parseFloat(Math.max(pixelRatio, 1)) || 1;
    this.renderer.setPixelRatio(pixelRatio);
    // apply new pixel ratio to all our elements but don't trigger onAfterResize callback
    this.resize(triggerCallback);
  }

  /***
     Set our renderer container and canvas sizes and update the scroll values
     ***/
  _setSize() {
    this.renderer.setSize();

    // update scroll values ass well
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
  getBoundingRect() {
    return this.renderer._boundingRect;
  }

  /***
     Resize our container and the renderer

     params:
     @triggerCallback (bool): Whether we should trigger onAfterResize callback
     ***/
  resize(triggerCallback) {
    if (!this.gl) return;

    this._setSize();

    this.renderer.resize();

    this.nextRender(() => {
      if (this._onAfterResizeCallback && triggerCallback) {
        this._onAfterResizeCallback();
      }
    });
  }

  /*** SCROLL ***/

  /***
     Init our ScrollManager class object
     ***/
  _initScroll() {
    this._scrollManager = new ScrollManager({
      // init values
      xOffset: window.pageXOffset,
      yOffset: 0,
      lastXDelta: 0,
      lastYDelta: 0,
      shouldWatch: this._watchScroll,

      onScroll: (lastXDelta, lastYDelta) =>
        this._updateScroll(lastXDelta, lastYDelta),
    });
  }

  /***
     Handles the different values associated with a scroll event (scroll and delta values)
     If no plane watch the scroll then those values won't be retrieved to avoid unnecessary reflow calls
     If at least a plane is watching, update all watching planes positions based on the scroll values
     And force render for at least one frame to actually update the scene
     ***/
  _updateScroll(lastXDelta, lastYDelta) {
    for (let i = 0; i < this.planes.length; i++) {
      // if our plane is watching the scroll, update its position
      if (this.planes[i].watchScroll) {
        this.planes[i].updateScrollPosition(lastXDelta, lastYDelta);
      }
    }

    // be sure we'll update the scene even if drawing is disabled
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
  updateScrollValues(x, y) {
    this._scrollManager.updateScrollValues(x, y);
  }

  /***
     Returns last delta scroll values

     returns:
     @delta (object): an object containing X and Y last delta values
     ***/
  getScrollDeltas() {
    return {
      x: this._scrollManager.lastXDelta,
      y: this._scrollManager.lastYDelta,
    };
  }

  /***
     Returns last window scroll values

     returns:
     @scrollValues (object): an object containing X and Y last scroll values
     ***/
  getScrollValues() {
    return {
      x: this._scrollManager.xOffset,
      y: this._scrollManager.yOffset,
    };
  }

  /*** ADDING / REMOVING OBJECTS TO THE RENDERER ***/

  /***
     Always keep sync between renderer and Curtains scene objects when adding/removing objects
     ***/
  _keepSync() {
    this.planes = this.renderer.planes;
    this.shaderPasses = this.renderer.shaderPasses;
    this.renderTargets = this.renderer.renderTargets;
  }

  /*** UTILS ***/

  /***
     Linear interpolation helper defined in utils
     ***/
  lerp(start, end, amount) {
    return lerp(start, end, amount);
  }

  /*** EVENTS ***/

  /***
     This is called each time our container has been resized

     params :
     @callback (function) : a function to execute

     returns :
     @this: our Curtains element to handle chaining
     ***/
  onAfterResize(callback) {
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
  onError(callback) {
    if (callback) {
      this._onErrorCallback = callback;
    }

    return this;
  }

  /***
     This triggers the onError callback and is called by the renderer when an error has been detected
     ***/
  _onRendererError() {
    // be sure that the callback has been registered and only call the global error callback once
    setTimeout(() => {
      if (this._onErrorCallback && !this.errors) {
        this._onErrorCallback();
      }
      this.errors = true;
    }, 0);
  }

  /***
     This is called when the WebGL context has been successfully created

     params:
     @callback (function): a function to execute

     returns:
     @this: our Curtains element to handle chaining
     ***/
  onSuccess(callback) {
    if (callback) {
      this._onSuccessCallback = callback;
    }

    return this;
  }

  /***
     This triggers the onSuccess callback and is called by the renderer when the context has been successfully created
     ***/
  _onRendererSuccess() {
    setTimeout(() => {
      this._onSuccessCallback && this._onSuccessCallback();
    }, 0);
  }

  /***
     This is called once our context has been lost

     params:
     @callback (function): a function to execute

     returns:
     @this: our Curtains element to handle chaining
     ***/
  onContextLost(callback) {
    if (callback) {
      this._onContextLostCallback = callback;
    }

    return this;
  }

  /***
     This triggers the onContextLost callback and is called by the renderer when the context has been lost
     ***/
  _onRendererContextLost() {
    this._onContextLostCallback && this._onContextLostCallback();
  }

  /***
     This is called once our context has been restored

     params:
     @callback (function): a function to execute

     returns:
     @this: our Curtains element to handle chaining
     ***/
  onContextRestored(callback) {
    if (callback) {
      this._onContextRestoredCallback = callback;
    }

    return this;
  }

  /***
     This triggers the onContextRestored callback and is called by the renderer when the context has been restored
     ***/
  _onRendererContextRestored() {
    this._onContextRestoredCallback && this._onContextRestoredCallback();
  }

  /***
     This is called once at each request animation frame call

     params:
     @callback (function): a function to execute

     returns:
     @this: our Curtains element to handle chaining
     ***/
  onRender(callback) {
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
  onScroll(callback) {
    if (callback) {
      this._onScrollCallback = callback;
    }

    return this;
  }

  /*** DESTROYING ***/

  /***
     Dispose everything
     ***/
  dispose() {
    this.renderer.dispose();
  }

  /***
     This is called when the renderer has finished disposing all the WebGL stuff
     ***/
  _onRendererDisposed() {
    // cancel animation frame
    this._animationFrameID &&
      window.cancelAnimationFrame(this._animationFrameID);

    // remove event listeners
    this._resizeHandler &&
      window.removeEventListener("resize", this._resizeHandler, false);
    this._scrollManager && this._scrollManager.dispose();
  }
}
