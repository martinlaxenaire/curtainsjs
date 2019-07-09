window.addEventListener("DOMContentLoaded", function() {
    // track the mouse positions to display them on screen
    var mousePosition = {
        x: 0,
        y: 0,
    };

    // really basic params and uniforms
    var params = {
        vertexShaderID: "coord-helper-vs",
        fragmentShaderID: "coord-helper-fs",
        imageCover: false, // even if we won't use our black pixel, that way it would cover the whole plane
        uniforms: {
            mousePosition: { // our mouse position
                name: "uMousePosition",
                type: "2f",
                value: [mousePosition.x, mousePosition.y],
            },
        }
    }

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains("canvas");

    // handling errors
    webGLCurtain.onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
    });

    // get our plane element
    var planeElements = document.getElementsByClassName("plane");
    // add the plane
    var helperPlane = webGLCurtain.addPlane(planeElements[0], params);

    // when the plane is set up, listen to the mouse move event
    // we also check if helperPlane is defined (it won't be if there's any error during init)
    helperPlane && helperPlane.onReady(function() {

        var wrapper = document.getElementById("page-wrap");

        wrapper.addEventListener("mousemove", function(e) {
            handleMovement(e, helperPlane);
        });

        wrapper.addEventListener("touchmove", function(e) {
            handleMovement(e, helperPlane);
        });

    });

    // handle the mouse move event
    function handleMovement(e, plane) {
        // get our mouse/touch position
        if(e.targetTouches) {

            mousePosition.x = e.targetTouches[0].clientX;
            mousePosition.y = e.targetTouches[0].clientY;
        }
        else {
            mousePosition.x = e.clientX;
            mousePosition.y = e.clientY;
        }

        // convert our mouse/touch position to coordinates relative to the vertices of the plane
        var mouseCoords = plane.mouseToPlaneCoords(mousePosition.x, mousePosition.y);

        // update our mouse position uniform
        plane.uniforms.mousePosition.value = [mouseCoords.x, mouseCoords.y];

        // and display them
        document.getElementById("mouse-coords-helper-x").textContent = mouseCoords.x;
        document.getElementById("mouse-coords-helper-y").textContent = mouseCoords.y;
    }
});
