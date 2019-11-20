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
