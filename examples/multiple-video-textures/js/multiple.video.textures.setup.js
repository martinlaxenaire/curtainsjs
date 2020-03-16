window.addEventListener("load", function() {
    // here we will handle which texture is visible and the timer to transition between images
    var activeTexture = 1;
    var transitionTimer = 0;

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains({
        container: "canvas",
        watchScroll: false // no need to listen for the scroll in this example
    });

    // handling errors
    webGLCurtain.onError(function() {
        // we will add a class to the document body
        document.body.classList.add("no-curtains", "curtains-ready");

        // display an error message
        document.getElementById("enter-site").innerHTML = "There has been an error while initiating the WebGL context.";
    });

    // get our plane element
    var planeElements = document.getElementsByClassName("multi-textures");

    var vs = `
        #ifdef GL_ES
        precision mediump float;
        #endif

        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;

        // our texture matrices
        // displacement texture does not need to use them
        uniform mat4 firstTextureMatrix;
        uniform mat4 secondTextureMatrix;

        // custom variables
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
        varying vec2 vFirstTextureCoord;
        varying vec2 vSecondTextureCoord;

        // custom uniforms
        uniform float uTransitionTimer;

        void main() {
            gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

            // varyings
            // use original texture coords for our displacement
            vTextureCoord = aTextureCoord;
            // use texture matrices for our videos
            vFirstTextureCoord = (firstTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
            vSecondTextureCoord = (secondTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
            vVertexPosition = aVertexPosition;
        }
    `;

    var fs = `
        #ifdef GL_ES
        precision mediump float;
        #endif

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
        varying vec2 vFirstTextureCoord;
        varying vec2 vSecondTextureCoord;

        // custom uniforms
        uniform float uTransitionTimer;

        // our textures samplers
        // notice how it matches our data-sampler attributes
        uniform sampler2D firstTexture;
        uniform sampler2D secondTexture;
        uniform sampler2D displacement;

        void main() {
            // our displacement texture
            // i'll be using the fragment shader seen here : https://tympanus.net/codrops/2018/04/10/webgl-distortion-hover-effects/
            vec4 displacementTexture = texture2D(displacement, vTextureCoord);

            float displacementFactor = (cos(uTransitionTimer / (60.0 / 3.141592)) + 1.0) / 2.0;
            float effectFactor = 1.0;

            vec2 firstDisplacementCoords = vec2(vFirstTextureCoord.x + displacementFactor * (displacementTexture.r * effectFactor), vFirstTextureCoord.y);
            vec2 secondDisplacementCoords = vec2(vSecondTextureCoord.x - (1.0 - displacementFactor) * (displacementTexture.r * effectFactor), vSecondTextureCoord.y);

            vec4 firstDistortedColor = texture2D(firstTexture, firstDisplacementCoords);
            vec4 secondDistortedColor = texture2D(secondTexture, secondDisplacementCoords);

            vec4 finalColor = mix(firstDistortedColor, secondDistortedColor, displacementFactor);

            // handling premultiplied alpha
            finalColor = vec4(finalColor.rgb * finalColor.a, finalColor.a);

            gl_FragColor = finalColor;
        }
    `;

    // some basic parameters
    var params = {
        vertexShader: vs,
        fragmentShader: fs,
        uniforms: {
            transitionTimer: {
                name: "uTransitionTimer",
                type: "1f",
                value: 0,
            },
        },
    };

    var multiTexturesPlane = webGLCurtain.addPlane(planeElements[0], params);

    // create our plane
    multiTexturesPlane && multiTexturesPlane.onReady(function() {
        // display the button
        document.body.classList.add("curtains-ready");

        // when our plane is ready we add a click event listener that will switch the active texture value
        planeElements[0].addEventListener("click", function() {
            if(activeTexture === 1) {
                activeTexture = 2;
                // play next video
                multiTexturesPlane.videos[0].play();
            }
            else {
                activeTexture = 1;
                // play next video
                multiTexturesPlane.videos[1].play();
            }
        });

        // on resize, update the resolution uniform
        window.addEventListener("resize", function() {
            multiTexturesPlane.uniforms.resolution.value = [pixelRatio * planeElements[0].clientWidth, pixelRatio * planeElements[0].clientHeight];
        });

        // click to play the videos
        document.getElementById("enter-site").addEventListener("click", function() {
            // display canvas and hide the button
            document.body.classList.add("video-started");

            // play all videos to force uploading the first frame of each texture
            multiTexturesPlane.playVideos();
            // now pause the first video (the one that is hidden)
            setTimeout(function() {
                multiTexturesPlane.videos[0].pause();
            }, 100);
        }, false);

    }).onRender(function() {
        // increase or decrease our timer based on the active texture value
        if(activeTexture === 2) {
            // lerp values to smoothen animation
            transitionTimer = (1 - 0.05) * transitionTimer + 0.05 * 60;

            // transition is over, pause previous video
            if(transitionTimer >= 59 && transitionTimer !== 60) {
                transitionTimer = 60;
                multiTexturesPlane.videos[1].pause();
            }
        }
        else {
            // lerp values to smoothen animation
            transitionTimer = (1 - 0.05) * transitionTimer;

            // transition is over, pause previous video
            if(transitionTimer <= 1 && transitionTimer !== 0) {
                transitionTimer = 0;
                multiTexturesPlane.videos[0].pause();
            }
        }
        // update our transition timer uniform
        multiTexturesPlane.uniforms.transitionTimer.value = transitionTimer;
    });
});
