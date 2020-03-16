window.addEventListener("load", function() {
    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains({
        container: "canvas"
    });

    webGLCurtain.onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
    });

    // we will keep track of all our planes in an array
    var planes = [];

    // get our planes elements
    var planeElements = document.getElementsByClassName("plane-title");

    var vs = `
        #ifdef GL_ES
        precision mediump float;
        #endif

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

    var fs = `
        #ifdef GL_ES
        precision mediump float;
        #endif

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
    var params = {
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
        var htmlPlane = plane.htmlElement;
        var htmlPlaneStyle = window.getComputedStyle(htmlPlane);

        var planeBoundingRect = plane.getBoundingRect();

        var htmlPlaneWidth = planeBoundingRect.width / webGLCurtain.pixelRatio;
        var htmlPlaneHeight = planeBoundingRect.height / webGLCurtain.pixelRatio;

        // set sizes
        canvas.width = htmlPlaneWidth;
        canvas.height = htmlPlaneHeight;
        var context = canvas.getContext("2d");

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
    for(var i = 0; i < planeElements.length; i++) {
        var plane = webGLCurtain.addPlane(planeElements[i], params);

        if(plane) {
            // create our text texture as soon as our plane has been created
            // first we need a canvas
            var canvas = document.createElement("canvas");
            // then we add a data sampler attribute to our canvas
            canvas.setAttribute("data-sampler", "planeTexture");
            // and load it into our plane
            plane.loadCanvas(canvas);

            planes.push(plane);

            handlePlanes(i);
        }
    }


    // handle all the planes
    function handlePlanes(index) {
        var plane = planes[index];

        plane.onLoading(function(texture) {
            // our canvas texture is ready
            texture.shouldUpdate = false;

            // we write our title in our canvas
            writeText(plane, texture.source);
        }).onRender(function() {
            // update the time uniform
            plane.uniforms.time.value++;
        }).onAfterResize(function() {
            // update our canvas sizes and rewrite our title
            writeText(plane, plane.textures[0].source);
        });
    }
});
