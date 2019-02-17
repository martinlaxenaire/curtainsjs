window.onload = function(){
    // our canvas container
    var canvasContainer = document.getElementById("canvas");

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains("canvas");

    webGLCurtain.onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains", "planes-loaded");
    });

    // we will keep track of all our planes in an array
    var planes = [];
    // whether the canvas will cover the whole document or just the window size
    var perfOptimised = false;

    // get our planes elements
    var planeElements = document.getElementsByClassName("plane");

    // all planes will have the same parameters
    // we don't need to specifiate vertexShaderID and fragmentShaderID because we already passed it via the data attributes of the plane HTML element
    var params = {
        widthSegments: 20,
        heightSegments: 20,
        imageCover: true,
        uniforms: {
            time: { // time uniform that will be updated at each draw call
                name: "uTime",
                type: "1f",
                value: 0,
            },
        }
    }

    // add our planes and handle them
    for(var i = 0; i < planeElements.length; i++) {
        var plane = webGLCurtain.addPlane(planeElements[i], params);
        // push the plane only if it is defined
        if(plane) planes.push(plane);

        handlePlanes(i);
    }

    // listen to scroll
    window.addEventListener("scroll", function(e) {
        // if the canvas does not cover the whole document, we have to update the plane positions during scroll
        if(perfOptimised) {
            for(var i = 0; i < planes.length; i++) {
                if(planes[i]) planes[i].updatePosition();
            }
        }
    });


    // handle all the planes
    function handlePlanes(index) {
        var plane = planes[index];
        plane && plane.onReady(function() {
            // once everything is ready, display everything
            if(index == planes.length - 1) {
                document.body.classList.add("planes-loaded");

                // show canvas height
                document.getElementById("canvas-height").innerHTML = "canvas height: " + document.getElementById("canvas").clientHeight + "px";

                window.onresize = function() {
                    // show canvas height
                    document.getElementById("canvas-height").innerHTML = "canvas height: " + document.getElementById("canvas").clientHeight + "px";
                }

                // toggle perspective and perf optimisation
                document.getElementById("toggle-perf-optimisation").addEventListener("click", function() {
                    // toggle canvas size
                    if(perfOptimised) {
                        document.body.classList.remove("perf-optimised");
                    }
                    else {
                        document.body.classList.add("perf-optimised");
                    }

                    // show canvas height
                    document.getElementById("canvas-height").innerHTML = "canvas height: " + document.getElementById("canvas").clientHeight + "px";

                    perfOptimised = !perfOptimised;
                });
            }

        }).onRender(function() {
            // update the uniform
            plane.uniforms.time.value++;
        });
    }
}
