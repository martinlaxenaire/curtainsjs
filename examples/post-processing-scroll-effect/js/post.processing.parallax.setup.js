import {Curtains, Plane, ShaderPass, Vec2, Vec3} from '../../../src/index.mjs';

window.addEventListener("load", () => {
    // keep track of the number of plane we're currently drawing
    let planeDrawn = 0;
    const debugElement = document.getElementById("debug-value");

    // set up our WebGL context and append the canvas to our wrapper
    const curtains = new Curtains({
        container: "canvas",
        antialias: false, // render targets will disable default antialiasing anyway
        pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
    });

    curtains.onRender(() => {
        // update our planes deformation
        // increase/decrease the effect
        scrollEffect = curtains.lerp(scrollEffect, 0, 0.05);

        // update our number of planes drawn debug value
        debugElement.innerText = planeDrawn;
    }).onScroll(() => {
        // get scroll deltas to apply the effect on scroll
        const delta = curtains.getScrollDeltas();

        // invert value for the effect
        delta.y = -delta.y;

        // threshold
        if(delta.y > 60) {
            delta.y = 60;
        }
        else if(delta.y < -60) {
            delta.y = -60;
        }

        if(Math.abs(delta.y) > Math.abs(scrollEffect)) {
            scrollEffect = curtains.lerp(scrollEffect, delta.y, 0.5);
        }

        // update the plane positions during scroll
        for(let i = 0; i < planes.length; i++) {
            // apply additional translation, scale and rotation
            applyPlanesParallax(i);
        }

    }).onError(() => {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains", "planes-loaded");
    }).onContextLost(() => {
        // on context lost, try to restore the context
        curtains.restoreContext();
    });

    // we will keep track of all our planes in an array
    const planes = [];
    let scrollEffect = 0;

    // get our planes elements
    const planeElements = document.getElementsByClassName("plane");

    const vs = `
        precision mediump float;
    
        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;
    
        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;
    
        uniform mat4 planeTextureMatrix;
    
        // custom variables
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        void main() { 
            gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
    
            // varyings
            vVertexPosition = aVertexPosition;
            vTextureCoord = (planeTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
        }
    `;

    const fs = `
        precision mediump float;
    
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        uniform sampler2D planeTexture;
    
        void main() {
            // just display our texture
            gl_FragColor = texture2D(planeTexture, vTextureCoord);
        }
    `;

    // add our planes and handle them
    for(let i = 0; i < planeElements.length; i++) {
        const plane = new Plane(curtains, planeElements[i], {
            vertexShader: vs,
            fragmentShader: fs,
        }); // we don't need any params here

        planes.push(plane);

        handlePlanes(i);
    }


    // handle all the planes
    function handlePlanes(index) {
        const plane = planes[index];

        plane.onReady(() => {
            // we need to fill the counter with all our planes
            // not that onLeaveView will be called before onReady
            planeDrawn++;

            // apply parallax on load
            applyPlanesParallax(index);

            // once everything is ready, display everything
            if(index === planes.length - 1) {
                document.body.classList.add("planes-loaded");
            }
        }).onAfterResize(() => {
            // apply new parallax values after resize
            applyPlanesParallax(index);
        }).onRender(() => {

            // scale plane and its texture
            plane.scale.y = 1 + Math.abs(scrollEffect) / 300;
            plane.textures[0].scale.y = 1 + Math.abs(scrollEffect) / 150;
        }).onReEnterView(() => {
            // plane is drawn again
            planeDrawn++;
        }).onLeaveView(() => {
            // plane is not drawn anymore
            planeDrawn--;
        });
    }

    function applyPlanesParallax(index) {
        // calculate the parallax effect

        // get our window height: remember our canvas is a bit taller
        const windowHeight = curtains.getBoundingRect().height / 1.2;
        // get our plane center coordinate
        const planeBoundingRect = planes[index].getBoundingRect();
        const planeOffsetTop = planeBoundingRect.top + planeBoundingRect.height / 2;
        // get a float value based on window height (0 means the plane is centered)
        const parallaxEffect = (planeOffsetTop - windowHeight / 2) / windowHeight;

        // apply the parallax effect
        planes[index].relativeTranslation.y = parallaxEffect * windowHeight / 4;
    }


    // post processing
    const firstFs = `
        precision mediump float;
    
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        uniform sampler2D uRenderTexture;
    
        uniform float uScrollEffect;
    
        void main() {
            // invert colors
            vec4 scene = texture2D(uRenderTexture, vTextureCoord);
            vec4 invertedColors = texture2D(uRenderTexture, vTextureCoord);
    
            if(
                vTextureCoord.x > 0.625 && vTextureCoord.x < 0.875 && vTextureCoord.y > 0.625 && vTextureCoord.y < 0.875
                || vTextureCoord.x > 0.125 && vTextureCoord.x < 0.375 && vTextureCoord.y > 0.125 && vTextureCoord.y < 0.375
            ) {
                invertedColors.rgb = vec3(1.0 - invertedColors.rgb);
            }
    
            vec4 finalColor = mix(scene, invertedColors, abs(uScrollEffect) / 60.0);
    
            gl_FragColor = finalColor;
        }
    `;

    const firstShaderPassParams = {
        fragmentShader: firstFs, // we'll be using the lib default vertex shader
        uniforms: {
            scrollEffect: {
                name: "uScrollEffect",
                type: "1f",
                value: 0,
            },
        },
    };

    const firstShaderPass = new ShaderPass(curtains, firstShaderPassParams);
    firstShaderPass.onRender(() => {
        // update the uniform
        firstShaderPass.uniforms.scrollEffect.value = scrollEffect;
    });


    const secondFs = `
        #ifdef GL_ES
        precision mediump float;
        #endif
    
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        uniform sampler2D uRenderTexture;
    
        uniform float uScrollEffect;
    
        void main() {
            vec2 textureCoords = vTextureCoord;
            vec2 texCenter = vec2(0.5, 0.5);
    
            // distort around scene center
            textureCoords += vec2(texCenter - textureCoords).xy * sin(distance(texCenter, textureCoords)) * uScrollEffect / 175.0;
    
            gl_FragColor = texture2D(uRenderTexture, textureCoords);
        }
    `;

    const secondShaderPassParams = {
        fragmentShader: secondFs, // we'll be using the lib default vertex shader
        uniforms: {
            scrollEffect: {
                name: "uScrollEffect",
                type: "1f",
                value: 0,
            },
        },
    };

    const secondShaderPass = new ShaderPass(curtains, secondShaderPassParams);
    secondShaderPass.onRender(() => {
        // update the uniform
        secondShaderPass.uniforms.scrollEffect.value = scrollEffect;
    });
});
