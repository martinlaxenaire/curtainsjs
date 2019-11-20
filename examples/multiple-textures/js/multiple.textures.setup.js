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

    // could be useful to get pixel ratio
    var pixelRatio = window.devicePixelRatio ? window.devicePixelRatio : 1.0;

    // some basic parameters
    // we don't need to specifiate vertexShaderID and fragmentShaderID because we already passed it via the data attributes of the plane HTML element
    var params = {
        uniforms: {
            resolution: {
                name: "uResolution",
                type: "2f",
                value: [pixelRatio * planeElements[0].clientWidth, pixelRatio * planeElements[0].clientHeight],
            },
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
        var activeTex = multiTexturesPlane.createTexture("activeTex");
        var nextTex = multiTexturesPlane.createTexture("nextTex");

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
