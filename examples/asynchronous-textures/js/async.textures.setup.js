window.onload = function() {

    // our canvas container
    var canvasContainer = document.getElementById("canvas");

    // here we will handle which texture is visible and the timer to transition between images
    var activeTexture = 1;
    var transitionTimer = 0;

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains("canvas");

    webGLCurtain.onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
        // display an error message
        document.getElementById("load-images").innerHTML = "There has been an error while initiating the WebGL context.";
    });

    // get our plane element
    var planeElements = document.getElementsByClassName("async-textures");

    // really basic params
    var params = {
        widthSegments: 20,
        heightSegments: 20,
        uniforms: {
            transitionTimer: {
                name: "uTransitionTimer",
                type: "1f",
                value: 0,
            },
        },
    }

    // first we create en empty plane
    // it won't appear because it does not have any texture, but it will be there !
    var asyncTexturesPlane = webGLCurtain.addPlane(planeElements[0], params);

    // then we add images to it, could be after an event or an AJAX call
    document.getElementById("load-images").addEventListener("click", function() {
        document.getElementById("page-wrap").classList.add("load-images");

        // get our images in the HTML, but it could be inside an AJAX response
        var asyncImgElements = document.getElementById("async-textures-wrapper").getElementsByTagName("img");
        // if there has not been any error during init
        if(asyncTexturesPlane) {
            // load the images
            asyncTexturesPlane.loadImages(asyncImgElements)
            .onReady(function() {
                // if window has been resized between plane creation and image loading, we need to trigger a resize
                asyncTexturesPlane.planeResize();

                // images are loaded, we are ready to attach event listener and do stuff
                planeElements[0].addEventListener("click", function() {
                    // switch the active texture
                    if(activeTexture == 1) {
                        activeTexture = 2;

                        document.getElementById("async-textures-wrapper").classList.add("second-image-shown");
                    }
                    else {
                        activeTexture = 1;

                        document.getElementById("async-textures-wrapper").classList.remove("second-image-shown");
                    }
                });

            }).onRender(function() {
                // increase/decrease our timer based on active texture
                if(activeTexture == 2) {
                    transitionTimer = Math.min(60, transitionTimer + 1);
                }
                else {
                    transitionTimer = Math.max(0, transitionTimer - 1);
                }
                // update the uniform
                asyncTexturesPlane.uniforms.transitionTimer.value = transitionTimer;
            });
        }
    });
}
