import {Curtains, Plane} from '../../../src/index.mjs';

window.addEventListener("load", () => {
    // here we will handle which texture is visible and the timer to transition between images
    let activeTexture = 1;
    let transitionTimer = 0;

    // set up our WebGL context and append the canvas to our wrapper
    const curtains = new Curtains({
        container: "canvas",
        watchScroll: false, // no need to listen for the scroll in this example
        pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
    });

    // disable drawing for now
    curtains.disableDrawing();

    curtains.onError(() => {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
        // display an error message
        document.getElementById("load-images").innerHTML = "There has been an error while initiating the WebGL context.";
    }).onContextLost(() => {
        // on context lost, try to restore the context
        curtains.restoreContext();
    });

    // get our plane element
    const planeElements = document.getElementsByClassName("async-textures");

    const vs = `
        precision mediump float;

        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;

        // varyings
        // note how our texture matrices variable name matches the samplers variable names
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
        varying vec2 vFirstTextureCoord;
        varying vec2 vSecondTextureCoord;

        // textures matrices
        uniform mat4 firstTextureMatrix;
        uniform mat4 secondTextureMatrix;

        uniform float uTransitionTimer;

        void main() {
            vec3 vertexPosition = aVertexPosition;

            // a float varying from -1.5 to 1.5
            float waveCoords = ((uTransitionTimer / 60.0) * 3.5) - 1.75;

            // distance from the waveCoords to the vertex coordinates
            float distanceToWave = distance(vec2(vertexPosition.x, 0.0), vec2(waveCoords, 0.0));

            // nice little wave animation from left to right or right to left depending on the timer
            vertexPosition.z = (cos(clamp(distanceToWave, 0.0, 0.75) * 3.141592) - cos(0.75 * 3.141592)) * 0.05;

            gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);

            // varyings
            vTextureCoord = aTextureCoord;
            vFirstTextureCoord = (firstTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
            vSecondTextureCoord = (secondTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
            vVertexPosition = vertexPosition;
        }
    `;

    const fs = `
        precision mediump float;

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
        varying vec2 vFirstTextureCoord;
        varying vec2 vSecondTextureCoord;

        uniform float uTransitionTimer;

        uniform sampler2D firstTexture;
        uniform sampler2D secondTexture;

        void main() {
            // set our textures
            vec4 firstTextureColor = texture2D(firstTexture, vFirstTextureCoord);
            vec4 secondTextureColor = texture2D(secondTexture, vSecondTextureCoord);

            // mix our textures based on our transition timer
            vec4 finalColor = mix(firstTextureColor, secondTextureColor, clamp((2.0 - vTextureCoord.x) * (uTransitionTimer / 60.0), 0.0, 1.0));

            // handling premultiplied alpha
            finalColor = vec4(finalColor.rgb * finalColor.a, finalColor.a);

            gl_FragColor = finalColor;
        }
    `;

    // really basic params
    const params = {
        vertexShader: vs,
        fragmentShader: fs,
        widthSegments: 20,
        heightSegments: 1,
        visible: false, // hide the plane while its empty
        uniforms: {
            transitionTimer: {
                name: "uTransitionTimer",
                type: "1f",
                value: 0,
            },
        },
    };

    // first we create en empty plane
    // it won't appear because it does not have any texture, but it will be there !
    const asyncTexturesPlane = new Plane(curtains, planeElements[0], params);

    asyncTexturesPlane.onReady(() => {
        // images are loaded, we are ready to attach event listener and do stuff
        planeElements[0].addEventListener("click", function() {
            // enable drawing to display transitions
            curtains.enableDrawing();

            // switch the active texture
            if(activeTexture === 1) {
                activeTexture = 2;

                document.getElementById("async-textures-wrapper").classList.add("second-image-shown");
            }
            else {
                activeTexture = 1;

                document.getElementById("async-textures-wrapper").classList.remove("second-image-shown");
            }
        });
    }).onRender(() => {
        // increase/decrease our timer based on active texture
        if(activeTexture === 2) {
            // use damping to smoothen transition
            transitionTimer += (60 - transitionTimer) * 0.05;
        }
        else {
            // use damping to smoothen transition
            transitionTimer += (0 - transitionTimer) * 0.05;
        }
        // update the uniform
        asyncTexturesPlane.uniforms.transitionTimer.value = transitionTimer;
    }).onError(() => {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
        // display an error message
        document.getElementById("load-images").innerHTML = "There has been an error while initiating the WebGL context.";
    });

    // then we add images to it, could be after an event or an AJAX call
    document.getElementById("load-images").addEventListener("click", function() {
        document.getElementById("page-wrap").classList.add("load-images");

        // get our images in the HTML, but it could be inside an AJAX response
        const asyncImgElements = document.getElementById("async-textures-wrapper").getElementsByTagName("img");

        // track image loading
        let imagesLoaded = 0;
        const imagesToLoad = asyncImgElements.length;

        // load the images
        asyncTexturesPlane.loadImages(asyncImgElements, {
            // textures options
            // improve texture rendering on small screens with LINEAR_MIPMAP_NEAREST minFilter
            minFilter: curtains.gl.LINEAR_MIPMAP_NEAREST
        });

        asyncTexturesPlane.onLoading(() => {
            imagesLoaded++;
            if(imagesLoaded === imagesToLoad) {
                // everything is ready, we need to render at least one frame
                curtains.needRender();

                // if window has been resized between plane creation and image loading, we need to trigger a resize
                asyncTexturesPlane.resize();
                // show our plane now
                asyncTexturesPlane.visible = true;
            }
        });

    });
});
