window.onload = function() {
    // our canvas container
    var canvasContainer = document.getElementById("canvas");

    // here we will handle which texture is visible and the timer to transition between images
    var activeTexture = 1;
    var transitionTimer = 0;

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains("canvas");

    // handling errors
    webGLCurtain.onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains", "image-1");

        // handle simple slides here
        planeElements[0].addEventListener("click", function() {
            if(activeTexture == 1) {
                activeTexture = 2;
                document.body.classList.remove("image-1");
                document.body.classList.add("image-2");
            }
            else {
                activeTexture = 1;
                document.body.classList.remove("image-2");
                document.body.classList.add("image-1");
            }
        });
    });

    // get our plane element
    var planeElements = document.getElementsByClassName("multi-textures");

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

    // check if the plane exists and use it
    multiTexturesPlane && multiTexturesPlane.onReady(function() {
        // when our plane is ready we add a click event listener that will switch the active texture value
        planeElements[0].addEventListener("click", function() {
            if(activeTexture == 1) {
                activeTexture = 2;
            }
            else {
                activeTexture = 1;
            }
        });

        // on resize, update the resolution uniform
        window.onresize = function() {
            multiTexturesPlane.uniforms.resolution.value = [pixelRatio * planeElements[0].clientWidth, pixelRatio * planeElements[0].clientHeight];
        }

    }).onRender(function() {
        // increase or decrease our timer based on the active texture value
        if(activeTexture == 2) {
            transitionTimer = Math.min(120, transitionTimer + 1);
        }
        else {
            transitionTimer = Math.max(0, transitionTimer - 1);
        }
        // update our transition timer uniform
        multiTexturesPlane.uniforms.transitionTimer.value = transitionTimer;
    });
}
