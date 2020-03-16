window.addEventListener("load", function() {
    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains({
        container: "canvas",
        watchScroll: false // no need to listen for the scroll in this example
    });

    // get our plane element
    var planeElements = document.getElementsByClassName("multi-textures");

    // here we will handle which texture is visible and the timer to transition between images
    var slideshowState = {
        activeTextureIndex: 1,
        nextTextureIndex: 2, // does not care for now
        maxTextures: planeElements[0].querySelectorAll("img").length - 1, // -1 because displacement image does not count

        isChanging: false,
        transitionTimer: 0,
    };

    // handling errors
    webGLCurtain.onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains", "image-1");

        // handle simple slides management here
        planeElements[0].addEventListener("click", function() {
            if(slideshowState.activeTextureIndex < slideshowState.maxTextures) {
                slideshowState.nextTextureIndex = slideshowState.activeTextureIndex + 1;
            }
            else {
                slideshowState.nextTextureIndex = 1;
            }

            document.body.classList.remove("image-1", "image-2", "image-3", "image-4");
            document.body.classList.add("image-" + slideshowState.nextTextureIndex);

            slideshowState.activeTextureIndex = slideshowState.nextTextureIndex;

        });
    });

    // disable drawing for now
    webGLCurtain.disableDrawing();

    var vs = `
        #ifdef GL_ES
        precision mediump float;
        #endif

        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;

        // varyings : notice we've got 3 texture coords varyings
        // one for the displacement texture
        // one for our visible texture
        // and one for the upcoming texture
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
        varying vec2 vActiveTextureCoord;
        varying vec2 vNextTextureCoord;

        // textures matrices
        uniform mat4 activeTexMatrix;
        uniform mat4 nextTexMatrix;

        // custom uniforms
        uniform float uTransitionTimer;


        void main() {
            gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

            // varyings
            vTextureCoord = aTextureCoord;
            vActiveTextureCoord = (activeTexMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
            vNextTextureCoord = (nextTexMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;

            vVertexPosition = aVertexPosition;
        }
    `;

    var fs = `
        #ifdef GL_ES
        precision mediump float;
        #endif

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
        varying vec2 vActiveTextureCoord;
        varying vec2 vNextTextureCoord;

        // custom uniforms
        uniform float uTransitionTimer;

        // our textures samplers
        // notice how it matches the sampler attributes of the textures we created dynamically
        uniform sampler2D activeTex;
        uniform sampler2D nextTex;
        uniform sampler2D displacement;

        void main() {
            // our displacement texture
            vec4 displacementTexture = texture2D(displacement, vTextureCoord);

            // slides transitions based on displacement and transition timer
            vec2 firstDisplacementCoords = vActiveTextureCoord + displacementTexture.r * ((cos((uTransitionTimer + 90.0) / (90.0 / 3.141592)) + 1.0) / 1.25);
            vec4 firstDistortedColor = texture2D(activeTex, vec2(vActiveTextureCoord.x, firstDisplacementCoords.y));

            // same as above but we substract the effect
            vec2 secondDisplacementCoords = vNextTextureCoord - displacementTexture.r * ((cos(uTransitionTimer / (90.0 / 3.141592)) + 1.0) / 1.25);
            vec4 secondDistortedColor = texture2D(nextTex, vec2(vNextTextureCoord.x, secondDisplacementCoords.y));

            // mix both texture
            vec4 finalColor = mix(firstDistortedColor, secondDistortedColor, 1.0 - ((cos(uTransitionTimer / (90.0 / 3.141592)) + 1.0) / 2.0));

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
    }

    var multiTexturesPlane = webGLCurtain.addPlane(planeElements[0], params);

    if(multiTexturesPlane) {
        // the idea here is to create two additionnal textures
        // the first one will contain our visible image
        // the second one will contain our entering (next) image
        // that we will deal with only activeTex and nextTex samplers in the fragment shader
        // and the could work with more images in the slideshow...
        var activeTex = multiTexturesPlane.createTexture({
            sampler: "activeTex"
        });
        var nextTex = multiTexturesPlane.createTexture({
            sampler: "nextTex"
        });

        multiTexturesPlane.onReady(function() {
            // we need to render the first frame
            webGLCurtain.needRender();

            // we set our very first image as the active texture
            activeTex.setSource(multiTexturesPlane.images[slideshowState.activeTextureIndex]);
            // we set the second image as next texture but this is not mandatory
            // as we will reset the next texture on slide change
            nextTex.setSource(multiTexturesPlane.images[slideshowState.nextTextureIndex]);

            planeElements[0].addEventListener("click", function() {
                if(!slideshowState.isChanging) {
                    // enable drawing for now
                    webGLCurtain.enableDrawing();

                    slideshowState.isChanging = true;

                    // check what will be next image
                    if(slideshowState.activeTextureIndex < slideshowState.maxTextures) {
                        slideshowState.nextTextureIndex = slideshowState.activeTextureIndex + 1;
                    }
                    else {
                        slideshowState.nextTextureIndex = 1;
                    }
                    // apply it to our next texture
                    nextTex.setSource(multiTexturesPlane.images[slideshowState.nextTextureIndex]);

                    setTimeout(function() {
                        // disable drawing now that the transition is over
                        webGLCurtain.disableDrawing();

                        slideshowState.isChanging = false;
                        slideshowState.activeTextureIndex = slideshowState.nextTextureIndex;
                        // our next texture becomes our active texture
                        activeTex.setSource(multiTexturesPlane.images[slideshowState.activeTextureIndex]);
                        // reset timer
                        slideshowState.transitionTimer = 0;

                    }, 1700); // add a bit of margin to the timer
                }

            });

        }).onRender(function() {
            // increase or decrease our timer based on the active texture value
            if(slideshowState.isChanging) {
                // use damping to smoothen transition
                slideshowState.transitionTimer += (90 - slideshowState.transitionTimer) * 0.04;

                // force end of animation as damping is slower the closer we get from the end value
                if(slideshowState.transitionTimer >= 88.5 && slideshowState.transitionTimer !== 90) {
                    slideshowState.transitionTimer = 90;
                }
            }

            // update our transition timer uniform
            multiTexturesPlane.uniforms.transitionTimer.value = slideshowState.transitionTimer;
        });
    }
});
