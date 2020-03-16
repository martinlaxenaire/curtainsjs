window.addEventListener("load", function() {
    // track the mouse positions to display them on screen
    var mousePosition = {
        x: 0,
        y: 0,
    };

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains({
        container: "canvas",
        watchScroll: false // no need to listen for the scroll in this example
    });

    // handling errors
    webGLCurtain.onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
    });

    // get our plane element
    var planeElements = document.getElementsByClassName("plane");

    var vs = `
        #ifdef GL_ES
        precision mediump float;
        #endif

        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;

        // custom variables
        varying vec3 vVertexPosition;

        void main() {
            gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

            // varying
            vVertexPosition = aVertexPosition;
        }
    `;

    var fs = `
        #ifdef GL_ES
        precision mediump float;
        #endif

        varying vec3 vVertexPosition;

        uniform vec2 uMousePosition;

        void main() {

            vec4 finalColor = vec4(0.0, 0.0, 0.0, 1.0);

            float distance = distance(vec2(vVertexPosition.x, vVertexPosition.y), uMousePosition);

            finalColor.r = distance / 1.15;
            finalColor.g = abs(0.5 - distance) / 1.25;
            finalColor.b = abs(0.75 - distance) / 2.5 + 0.3;

            gl_FragColor = finalColor;
        }
    `;

    // really basic parameters and uniforms
    var params = {
        vertexShader: vs,
        fragmentShader: fs,
        uniforms: {
            mousePosition: { // our mouse position
                name: "uMousePosition",
                type: "2f",
                value: [mousePosition.x, mousePosition.y],
            },
        }
    };

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
