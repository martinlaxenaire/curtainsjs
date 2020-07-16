import {Curtains, Plane, Vec2} from '../../../src/index.mjs';

window.addEventListener("load", () => {
    // track the mouse positions to send it to the shaders
    const mousePosition = new Vec2();
    // we will keep track of the last position in order to calculate the movement strength/delta
    const mouseLastPosition = new Vec2();

    const deltas = {
        max: 0,
        applied: 0,
    };

    // set up our WebGL context and append the canvas to our wrapper
    const curtains = new Curtains({
        container: "canvas",
        watchScroll: false, // no need to listen for the scroll in this example
        pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
    });

    // get our plane element
    const planeElements = document.getElementsByClassName("curtain");

    // handling errors
    curtains.onError(() => {
        // we will add a class to the document body to display original canvas
        document.body.classList.add("no-curtains");

        // handle canvas here
        function animate() {
            // animate our texture canvas
            animateTextureCanvas();

            window.requestAnimationFrame(animate);
        }

        animate();
    }).onContextLost(() => {
        // on context lost, try to restore the context
        curtains.restoreContext();
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

        uniform float uTime;
        uniform vec2 uMousePosition;
        uniform float uMouseMoveStrength;


        void main() {

            vec3 vertexPosition = aVertexPosition;

            // get the distance between our vertex and the mouse position
            float distanceFromMouse = distance(uMousePosition, vec2(vertexPosition.x, vertexPosition.y));

            // calculate our wave effect
            float waveSinusoid = cos(5.0 * (distanceFromMouse - (uTime / 75.0)));

            // attenuate the effect based on mouse distance
            float distanceStrength = (0.4 / (distanceFromMouse + 0.4));

            // calculate our distortion effect
            float distortionEffect = distanceStrength * waveSinusoid * uMouseMoveStrength;

            // apply it to our vertex position
            vertexPosition.z +=  distortionEffect / 15.0;
            vertexPosition.x +=  (distortionEffect / 15.0 * (uMousePosition.x - vertexPosition.x));
            vertexPosition.y +=  distortionEffect / 15.0 * (uMousePosition.y - vertexPosition.y);

            gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);

            // varyings
            vTextureCoord = aTextureCoord;
            vVertexPosition = vertexPosition;
        }
    `;

    const fs = `
        precision mediump float;

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        uniform sampler2D simplePlaneCanvasTexture;

        void main() {
            // apply our texture
            vec4 finalColor = texture2D(simplePlaneCanvasTexture, vTextureCoord);

            // fake shadows based on vertex position along Z axis
            finalColor.rgb -= clamp(-vVertexPosition.z, 0.0, 1.0);
            // fake lights based on vertex position along Z axis
            finalColor.rgb += clamp(vVertexPosition.z, 0.0, 1.0);

            gl_FragColor = finalColor;
        }
    `;

    // some basic parameters
    const params = {
        vertexShader: vs,
        fragmentShader: fs,
        widthSegments: 20,
        heightSegments: 20,
        uniforms: {
            time: { // time uniform that will be updated at each draw call
                name: "uTime",
                type: "1f",
                value: 0,
            },
            mousePosition: { // our mouse position
                name: "uMousePosition",
                type: "2f", // again an array of floats
                value: mousePosition,
            },
            mouseMoveStrength: { // the mouse move strength
                name: "uMouseMoveStrength",
                type: "1f",
                value: 0,
            }
        }
    };


    // our texture canvas
    const simpleCanvas = document.getElementById("canvas-texture");
    const simpleCanvasContext = simpleCanvas.getContext("2d");

    // create our plane
    const simplePlane = new Plane(curtains.renderer, planeElements[0], params);

    // i our plane has been successfully created
    if(simplePlane) {
        // get our plane dimensions
        const planeBoundingRect = simplePlane.getBoundingRect();

        // size our canvas
        // we are dividing it by the pixel ratio value to gain performance
        simpleCanvas.width = planeBoundingRect.width / curtains.pixelRatio;
        simpleCanvas.height = planeBoundingRect.height / curtains.pixelRatio;

        simplePlane.onReady(function() {
            // display the button
            document.body.classList.add("curtains-ready");

            // set a fov of 40 to reduce perspective
            simplePlane.setPerspective(40);

            // apply a little effect once everything is ready
            deltas.max = 4;

            // now that our plane is ready we can listen to mouse move event
            const wrapper = document.getElementById("page-wrap");

            wrapper.addEventListener("mousemove", (e) => {
                handleMovement(e, simplePlane);
            });

            wrapper.addEventListener("touchmove", (e) => {
                handleMovement(e, simplePlane);
            });

        }).onRender(() => {
            // increment our time uniform
            simplePlane.uniforms.time.value++;

            // decrease both deltas by damping : if the user doesn't move the mouse, effect will fade away
            deltas.applied += (deltas.max - deltas.applied) * 0.02;
            deltas.max += (0 - deltas.max) * 0.01;

            // send the new mouse move strength value
            simplePlane.uniforms.mouseMoveStrength.value = deltas.applied;

            // animate our texture canvas
            animateTextureCanvas();
        }).onAfterResize(() => {
            // get our plane dimensions
            const planeBoundingRect = simplePlane.getBoundingRect();

            // size our canvas
            // we are dividing it by the pixel ratio value to gain performance
            simpleCanvas.width = planeBoundingRect.width / curtains.pixelRatio;
            simpleCanvas.height = planeBoundingRect.height / curtains.pixelRatio;
        });
    }

    // handle the mouse move event
    function handleMovement(e, plane) {
    // update mouse last pos
        mouseLastPosition.copy(mousePosition);

        const mouse = new Vec2();

        // touch event
        if(e.targetTouches) {
            mouse.set(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
        }
        // mouse event
        else {
            mouse.set(e.clientX, e.clientY);
        }

        // lerp the mouse position a bit to smoothen the overall effect
        mousePosition.x = curtains.lerp(mousePosition.x, mouse.x, 0.3);
        mousePosition.y = curtains.lerp(mousePosition.y, mouse.y, 0.3);

        // convert our mouse/touch position to coordinates relative to the vertices of the plane and update our uniform
        plane.uniforms.mousePosition.value = plane.mouseToPlaneCoords(mousePosition.x, mousePosition.y);

        // calculate the mouse move strength
        if(mouseLastPosition.x && mouseLastPosition.y) {
            let delta = Math.sqrt(Math.pow(mousePosition.x - mouseLastPosition.x, 2) + Math.pow(mousePosition.y - mouseLastPosition.y, 2)) / 30;
            delta = Math.min(4, delta);
            // update max delta only if it increased
            if(delta >= deltas.max) {
                deltas.max = delta;
            }
        }
    }
});
