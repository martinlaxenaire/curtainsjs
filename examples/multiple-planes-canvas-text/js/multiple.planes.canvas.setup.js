import {Curtains, Plane} from '../../../src/index.mjs';

window.addEventListener("load", () => {
    // set up our WebGL context and append the canvas to our wrapper
    const curtains = new Curtains({
        container: "canvas",
        premultipliedAlpha: true, // sharpen the rendering of the text canvas textures
        pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
    });

    curtains.onError(() => {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
    }).onContextLost(() => {
        // on context lost, try to restore the context
        curtains.restoreContext();
    });

    // we will keep track of all our planes in an array
    const planes = [];

    // get our planes elements
    const planeElements = document.getElementsByClassName("plane-title");

    const vs = `
        precision mediump float;

        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;

        uniform mat4 planeTextureMatrix;

        // custom varyings
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        void main() {
            gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

            // varyings
            vVertexPosition = aVertexPosition;
            vTextureCoord = (planeTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
        }
    `;

    const fs = `
        precision mediump float;

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
        
        uniform float uTime;

        uniform sampler2D planeTexture;

        void main() {
            // just distort the text a bit
            vec2 textureCoords = vTextureCoord;
            textureCoords.x += sin(uTime / 30.0) / 100.0 * cos(textureCoords.y * 20.0);

            gl_FragColor = texture2D(planeTexture, textureCoords);
        }
    `;

    // no need for shaders as they were already passed by data attributes
    const params = {
        vertexShader: vs,
        fragmentShader: fs,
        uniforms: {
            time: {
                name: "uTime",
                type: "1f",
                value: 0,
            },
        },
    };

    // here we will write our title inside our canvas
    function writeText(plane, canvas) {
        const htmlPlane = plane.htmlElement;
        const htmlPlaneStyle = window.getComputedStyle(htmlPlane);

        const planeBoundingRect = plane.getBoundingRect();

        const htmlPlaneWidth = planeBoundingRect.width / curtains.pixelRatio;
        const htmlPlaneHeight = planeBoundingRect.height / curtains.pixelRatio;

        // set sizes
        canvas.width = htmlPlaneWidth;
        canvas.height = htmlPlaneHeight;
        const context = canvas.getContext("2d");

        context.width = htmlPlaneWidth;
        context.height = htmlPlaneHeight;

        // draw our title with the original style
        context.fillStyle = htmlPlaneStyle.color;
        context.font = htmlPlaneStyle.fontSize + " " + htmlPlaneStyle.fontFamily;
        context.fontStyle = htmlPlaneStyle.fontStyle;
        context.textAlign = htmlPlaneStyle.textAlign;

        // vertical alignment is a bit hacky
        context.textBaseline = "middle";
        context.fillText(htmlPlane.innerText, 0, htmlPlaneHeight / 1.8);

        // update our canvas texture once on next draw call
        if(plane.textures.length > 0) {
            // we just changed the texture source sizes, we need to update its texture matrix
            plane.textures[0].resize();
            // update the webgl texture on next draw call
            plane.textures[0].needUpdate();
        }
    }

    // add our planes and handle them
    for(let i = 0; i < planeElements.length; i++) {
        const plane = new Plane(curtains, planeElements[i], params);

        // create our text texture as soon as our plane has been created
        // first we need a canvas
        const canvas = document.createElement("canvas");
        // then we add a data sampler attribute to our canvas
        canvas.setAttribute("data-sampler", "planeTexture");
        // and load it into our plane
        plane.loadCanvas(canvas);

        planes.push(plane);

        handlePlanes(i);
    }


    // handle all the planes
    function handlePlanes(index) {
        const plane = planes[index];

        plane.onLoading((texture) => {
            // our canvas texture is ready
            texture.shouldUpdate = false;

            // we write our title in our canvas
            writeText(plane, texture.source);
        }).onRender(() => {
            // update the time uniform
            plane.uniforms.time.value++;
        }).onAfterResize(() => {
            // update our canvas sizes and rewrite our title
            writeText(plane, plane.textures[0].source);
        });
    }
});
