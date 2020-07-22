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
            alwaysDraw,
            visible,
            transparent,
            drawCheckMargins,
            autoloadSources,
            watchScroll,
            fov
        });

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
        this.createTexture({
            sampler: sampler,
            fromTexture: this.readPass.textures[0]
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
                this.swapPasses();
            }

            this._onPingPongAfterRenderCallback && this._onPingPongAfterRenderCallback();
        };
    }

    /***
     After each draw call, we'll swap the 2 render targets and copy the read pass texture again
     ***/
    swapPasses() {
        // swap read and write passes
        const tempFBO = this.readPass;
        this.readPass = this.writePass;
        this.writePass = tempFBO;

        // apply new texture
        this.textures[0].copy(this.readPass.textures[0]);
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
}