import {Curtains, Plane, Vec2} from '../../../src/index.mjs';

window.addEventListener("load", () => {
    // track the mouse positions to display them on screen
    let mousePosition = new Vec2();

    // set up our WebGL context and append the canvas to our wrapper
    const curtains = new Curtains({
        container: "canvas",
        watchScroll: false, // no need to listen for the scroll in this example
        pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
    });

    // handling errors
    curtains.onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
    }).onContextLost(function() {
        // on context lost, try to restore the context
        curtains.restoreContext();
    });

    // get our plane element
    const planeElements = document.getElementsByClassName("plane");

    const vs = `
        precision mediump float;

        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;

        // custom variables
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        void main() {
            gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

            // varying
            vVertexPosition = aVertexPosition;
            vTextureCoord = aTextureCoord;
        }
    `;

    const fs = `
        precision mediump float;

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

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
    const params = {
        vertexShader: vs,
        fragmentShader: fs,
        uniforms: {
            mousePosition: { // our mouse position
                name: "uMousePosition",
                type: "2f",
                value: mousePosition,
            },
        }
    };

    // add the plane
    const helperPlane = new Plane(curtains, planeElements[0], params);

    // when the plane is set up, listen to the mouse move event
    // we also check if helperPlane is defined (it won't be if there's any error during init)
    helperPlane.onReady(() => {

        const wrapper = document.getElementById("page-wrap");

        wrapper.addEventListener("mousemove", (e) => handleMovement(e, helperPlane));
        wrapper.addEventListener("touchmove", (e) => handleMovement(e, helperPlane));

    });

    // handle the mouse move event
    function handleMovement(e, plane) {
        // get our mouse/touch position
        if(e.targetTouches) {
            mousePosition.set(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
        }
        else {
            mousePosition.set(e.clientX, e.clientY);
        }

        // convert our mouse/touch position to coordinates relative to the vertices of the plane
        const mouseCoords = plane.mouseToPlaneCoords(mousePosition);

        // update our mouse position uniform
        plane.uniforms.mousePosition.value = mouseCoords;

        // and display them
        document.getElementById("mouse-coords-helper-x").textContent = mouseCoords.x;
        document.getElementById("mouse-coords-helper-y").textContent = mouseCoords.y;
    }
});
