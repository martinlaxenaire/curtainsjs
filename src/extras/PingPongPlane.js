import {Plane} from "../core/Plane.js";
import {RenderTarget} from "../framebuffers/RenderTarget.js";

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
export class PingPongPlane extends Plane {
    constructor(curtains, htmlElement, {
        sampler = "uPingPongTexture",

        // Plane params
        widthSegments,
        heightSegments,
        renderOrder, // does not have much sense
        depthTest,
        cullFace,
        uniforms,
        vertexShaderID,
        fragmentShaderID,
        vertexShader,
        fragmentShader,
        texturesOptions,
        crossOrigin,
        alwaysDraw,
        visible,
        transparent,
        drawCheckMargins,
        autoloadSources,
        watchScroll,
        fov,
    } = {}) {
        // force depthTest and autoloadSources to false
        depthTest = false;
        autoloadSources = false;

        // create our plane
        super(curtains, htmlElement, {
            widthSegments,
            heightSegments,
            renderOrder,
            depthTest,
            cullFace,
            uniforms,
            vertexShaderID,
            fragmentShaderID,
            vertexShader,
            fragmentShader,
            texturesOptions,
            crossOrigin,
            alwaysDraw,
            visible,
            transparent,
            drawCheckMargins,
            autoloadSources,
            watchScroll,
            fov,
        });

        // remove from stack, update type to PingPongPlane and then stack again
        this.renderer.scene.removePlane(this);
        this.type = "PingPongPlane";
        this.renderer.scene.addPlane(this);

        // create 2 render targets
        this.readPass = new RenderTarget(curtains, {
            depth: false,
            clear: false,
            texturesOptions: texturesOptions,
        });

        this.writePass = new RenderTarget(curtains, {
            depth: false,
            clear: false,
            texturesOptions: texturesOptions,
        });

        // create a texture where we'll draw
        const texture = this.createTexture({
            sampler: sampler
        });

        const readPassTexture = this.readPass.getTexture();
        readPassTexture.onSourceUploaded(() => {
            texture.copy(readPassTexture);
        });

        // override onRender and onAfterRender callbacks
        this._onRenderCallback = () => {
            // update the render target
            this.writePass && this.setRenderTarget(this.writePass);

            this._onPingPongRenderCallback && this._onPingPongRenderCallback();
        };

        this._onAfterRenderCallback = () => {
            // swap FBOs and update texture
            if(this.readPass && this.writePass && this.textures[0]) {
                this._swapPasses();
            }

            this._onPingPongAfterRenderCallback && this._onPingPongAfterRenderCallback();
        };
    }

    /***
     After each draw call, we'll swap the 2 render targets and copy the read pass texture again
     ***/
    _swapPasses() {
        // swap read and write passes
        const tempFBO = this.readPass;
        this.readPass = this.writePass;
        this.writePass = tempFBO;

        // apply new texture
        this.textures[0].copy(this.readPass.getTexture());
    }

    /***
     Returns the created texture where we're writing
     ***/
    getTexture() {
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
    onRender(callback) {
        if(callback) {
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
    onAfterRender(callback) {
        if(callback) {
            this._onPingPongAfterRenderCallback = callback;
        }

        return this;
    }


    /*** DESTROYING ***/

    /***
     Override the regular remove method to remove the 2 render targets
     ***/
    remove() {
        // first we want to stop drawing it
        this._canDraw = false;

        this.target = null;
        // force unbinding frame buffer
        this.renderer.bindFrameBuffer(null);

        // manually dispose the frame buffers (do not delete their textures)
        if(this.writePass._frameBuffer) {
            this.gl.deleteFramebuffer(this.writePass._frameBuffer);
            this.writePass._frameBuffer = null;
        }
        if(this.writePass._depthBuffer) {
            this.gl.deleteRenderbuffer(this.writePass._depthBuffer);
            this.writePass._depthBuffer = null;
        }
        this.renderer.removeRenderTarget(this.writePass);

        if(this.readPass._frameBuffer) {
            this.gl.deleteFramebuffer(this.readPass._frameBuffer);
            this.readPass._frameBuffer = null;
        }
        if(this.readPass._depthBuffer) {
            this.gl.deleteRenderbuffer(this.readPass._depthBuffer);
            this.readPass._depthBuffer = null;
        }
        this.renderer.removeRenderTarget(this.readPass);

        // delete all the webgl bindings
        this._dispose();

        // finally remove plane
        this.renderer.removePlane(this);
    }
}