function initCurtains() {
    // track the mouse positions to send it to the shaders
    var mousePosition = {
        x: 0,
        y: 0,
    };
    // we will keep track of the last position in order to calculate the movement strength/delta
    var mouseLastPosition = {
        x: 0,
        y: 0,
    };
    var mouseDelta = 0;

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains({
        container: "canvas",
        watchScroll: false // no need to listen for the scroll in this example
    });

    // get our plane element
    var planeElements = document.getElementsByClassName("curtain");


    // handling errors
    webGLCurtain.onError(function() {
        // we will add a class to the document body to display original canvas
        document.body.classList.add("no-curtains");

        // handle canvas here
        function animate() {
            // animate our texture canvas
            animateTextureCanvas();

            window.requestAnimationFrame(animate);
        }

        animate();
    });

    function animateTextureCanvas() {
        // here we will handle our canvas texture animation

        // clear scene
        simpleCanvasContext.clearRect(0, 0, simpleCanvas.width, simpleCanvas.height);

        // continuously rotate the canvas
        simpleCanvasContext.translate(simpleCanvas.width / 2, simpleCanvas.height / 2);
        simpleCanvasContext.rotate(Math.PI / 360);
        simpleCanvasContext.translate(-simpleCanvas.width / 2, -simpleCanvas.height / 2);

        // draw a red rectangle
        simpleCanvasContext.fillStyle = "#ff0000";
        simpleCanvasContext.fillRect(simpleCanvas.width / 2 - simpleCanvas.width / 8, simpleCanvas.height / 2 - simpleCanvas.height / 8, simpleCanvas.width / 4, simpleCanvas.height / 4);
    }


    // could be useful to get pixel ratio
    var pixelRatio = window.devicePixelRatio ? window.devicePixelRatio : 1.0;

    // some basic parameters
    // we don't need to specifiate vertexShaderID and fragmentShaderID because we already passed it via the data attributes of the plane HTML element
    var params = {
        widthSegments: 20,
        heightSegments: 20,
        uniforms: {
            resolution: { // resolution of our plane
                name: "uResolution",
                type: "2f", // notice this is an length 2 array of floats
                value: [pixelRatio * planeElements[0].clientWidth, pixelRatio * planeElements[0].clientHeight],
            },
            time: { // time uniform that will be updated at each draw call
                name: "uTime",
                type: "1f",
                value: 0,
            },
            mousePosition: { // our mouse position
                name: "uMousePosition",
                type: "2f", // again an array of floats
                value: [mousePosition.x, mousePosition.y],
            },
            mouseMoveStrength: { // the mouse move strength
                name: "uMouseMoveStrength",
                type: "1f",
                value: 0,
            }
        }
    };

    // create our plane
    var simplePlane = webGLCurtain.addPlane(planeElements[0], params);

    // i our plane has been successfully created
    if(simplePlane) {
        // our texture canvas
        var simpleCanvas = document.getElementById("canvas-texture");
        var simpleCanvasContext = simpleCanvas.getContext("2d");

        // get our plane dimensions
        var planeBoundingRect = simplePlane.getBoundingRect();

        // size our canvas
        // we are dividing it by the pixel ratio value to gain performance
        simpleCanvas.width = planeBoundingRect.width / webGLCurtain.pixelRatio;
        simpleCanvas.height = planeBoundingRect.height / webGLCurtain.pixelRatio;

        simplePlane.onReady(function() {
            // display the button
            document.body.classList.add("curtains-ready");

            // set a fov of 35 to exagerate perspective
            simplePlane.setPerspective(35);

            // now that our plane is ready we can listen to mouse move event
            var wrapper = document.getElementById("page-wrap");

            wrapper.addEventListener("mousemove", function(e) {
                handleMovement(e, simplePlane);
            });

            wrapper.addEventListener("touchmove", function(e) {
                handleMovement(e, simplePlane);
            });

        }).onRender(function() {
            // increment our time uniform
            simplePlane.uniforms.time.value++;

            // send the new mouse move strength value
            simplePlane.uniforms.mouseMoveStrength.value = mouseDelta;
            // decrease the mouse move strenght a bit : if the user doesn't move the mouse, effect will fade away
            mouseDelta = Math.max(0, mouseDelta * 0.995);

            // animate our texture canvas
            animateTextureCanvas();
        }).onAfterResize(function() {
            // get our plane dimensions
            var planeBoundingRect = simplePlane.getBoundingRect();

            simplePlane.uniforms.resolution.value = [planeBoundingRect.width * webGLCurtain.pixelRatio, planeBoundingRect.height * webGLCurtain.pixelRatio];

            // size our canvas
            // we are dividing it by the pixel ratio value to gain performance
            simpleCanvas.width = planeBoundingRect.width / webGLCurtain.pixelRatio;
            simpleCanvas.height = planeBoundingRect.height / webGLCurtain.pixelRatio;
        });
    }

    // handle the mouse move event
    function handleMovement(e, plane) {

        if(mousePosition.x != -100000 && mousePosition.y != -100000) {
            // if mouse position is defined, set mouse last position
            mouseLastPosition.x = mousePosition.x;
            mouseLastPosition.y = mousePosition.y;
        }

        // touch event
        if(e.targetTouches) {

            mousePosition.x = e.targetTouches[0].clientX;
            mousePosition.y = e.targetTouches[0].clientY;
        }
        // mouse event
        else {
            mousePosition.x = e.clientX;
            mousePosition.y = e.clientY;
        }

        // convert our mouse/touch position to coordinates relative to the vertices of the plane
        var mouseCoords = plane.mouseToPlaneCoords(mousePosition.x, mousePosition.y);
        // update our mouse position uniform
        plane.uniforms.mousePosition.value = [mouseCoords.x, mouseCoords.y];

        // calculate the mouse move strength
        if(mouseLastPosition.x && mouseLastPosition.y) {
            var delta = Math.sqrt(Math.pow(mousePosition.x - mouseLastPosition.x, 2) + Math.pow(mousePosition.y - mouseLastPosition.y, 2)) / 30;
            delta = Math.min(4, delta);
            // update mouseDelta only if it increased
            if(delta >= mouseDelta) {
                mouseDelta = delta;
                // reset our time uniform
                plane.uniforms.time.value = 0;
            }
        }
    }
}

window.addEventListener("load", function() {
    initCurtains();
});
