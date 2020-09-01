import {DOMMesh} from "../core/DOMMesh.js";
import {RenderTarget} from './RenderTarget.js';
import {Texture} from '../core/Texture.js';

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
export class ShaderPass extends DOMMesh {
    constructor(renderer, {
        // Mesh params
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

        // ShaderPass specific params
        depth = false,
        clear = true,
        renderTarget,
    }) {
        // force plane defintion to 1x1
        widthSegments = 1;
        heightSegments = 1;

        // always cull back face
        cullFace = "back";

        // never share a program between shader passes
        shareProgram = false;

        // use the renderer container as our HTML element to create a DOMMesh object
        super(renderer, renderer.container, "ShaderPass", {
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
            crossOrigin
        });

        // default to scene pass
        this._isScenePass = true;

        this.index = this.renderer.shaderPasses.length;

        this._depth = depth;

        this._shouldClear = clear;

        this.target = renderTarget;
        if(this.target) {
            // if there's a target defined it's not a scene pass
            this._isScenePass = false;
            // inherit clear param
            this._shouldClear = this.target._shouldClear;
        }

        // if the program is valid, go on
        if(this._program.compiled) {
            this._initShaderPass();

            // add shader pass to our renderer shaderPasses array
            this.renderer.shaderPasses.push(this);

            // wait one tick before adding our shader pass to the scene to avoid flickering black screen for one frame
            this.renderer.nextRender.add(() => {
                this.renderer.scene.addShaderPass(this);
            })
        }
    }


    /*** RESTORING CONTEXT ***/

    /***
     Used internally to handle context restoration after the program has been successfully compiled again
     ***/
    _programRestored() {
        // we just need to re add the shader pass to the scene stack
        if(this._isScenePass) {
            this.renderer.scene.stacks.scenePasses.push(this.index);
        }
        else {
            this.renderer.scene.stacks.renderPasses.push(this.index);
        }

        // restore the textures
        for(let i = 0; i < this.textures.length; i++) {
            this.textures[i]._parent = this;
            this.textures[i]._restoreContext();
        }

        this._canDraw = true;
    }


    /***
     Here we init additionnal shader pass planes properties
     This mainly consists in creating our render texture and add a frame buffer object
     ***/
    _initShaderPass() {
        // create our frame buffer
        if(!this.target) {
            this._createFrameBuffer();
        }
        else {
            // set the render target
            this.setRenderTarget(this.target);
            this.target._shaderPass = this;
        }

        // create a texture from the render target texture
        const texture = new Texture(this.renderer, {
            sampler: "uRenderTexture",
            isFBOTexture: true,
            fromTexture: this.target.getTexture(),
        });

        texture.addParent(this);

        // onReady callback
        this.loader._setLoaderSize(0);

        this._canDraw = true;

        // be sure we'll update the scene even if drawing is disabled
        this.renderer.needRender();
    }


    /***
     Here we create our frame buffer object
     We're also adding a render buffer object to handle depth inside our shader pass
     ***/
    _createFrameBuffer() {
        const target = new RenderTarget(this.renderer, {
            shaderPass: this,
            clear: this._shouldClear,
            depth: this._depth,
            texturesOptions: this._texturesOptions,
        });
        this.setRenderTarget(target);
    }


    /*** DRAWING ***/

    /***
     Specific instructions for the Shader pass class to execute before drawing it
     ***/
    _startDrawing() {
        // check if our plane is ready to draw
        if(this._canDraw) {
            // even if our plane should not be drawn we still execute its onRender callback and update its uniforms
            if(this._onRenderCallback) {
                this._onRenderCallback();
            }

            // to improve webgl pipeline performance, we might want to update each texture that needs an update here
            // see https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#texImagetexSubImage_uploads_particularly_with_videos_can_cause_pipeline_flushes


            if(this._isScenePass) {
                // if this is a scene pass, check if theres one more coming next and eventually bind it
                if(this.renderer.state.scenePassIndex + 1 < this.renderer.scene.stacks.scenePasses.length) {
                    this.renderer.bindFrameBuffer(this.renderer.shaderPasses[this.renderer.scene.stacks.scenePasses[this.renderer.state.scenePassIndex + 1]].target);

                    this.renderer.state.scenePassIndex++;
                }
                else {
                    this.renderer.bindFrameBuffer(null);
                }
            }
            else if(this.renderer.state.scenePassIndex === null) {
                // we are rendering a bunch of planes inside a render target, unbind it
                this.renderer.bindFrameBuffer(null);
            }

            // now check if we really need to draw it and its textures
            this._draw();
        }
    }
}