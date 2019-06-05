window.onload = function(){
    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains("canvas");

    webGLCurtain.onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
    });

    // we will keep track of all our planes in an array
    var planes = [];

    // get our planes elements
    var planeElements = document.getElementsByClassName("plane-title");

    // no need for shaders as they were already passed by data attributes
    var params = {
        vertexShaderID: "text-vs",
        fragmentShaderID: "text-fs",
        widthSegments: 10,
        heightSegments: 10,
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
        var htmlPlaneWidth = plane._boundingRect.document.width;
        var htmlPlaneHeight = plane._boundingRect.document.height;

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
    }

    // add our planes and handle them
    for(var i = 0; i < planeElements.length; i++) {
        var plane = webGLCurtain.addPlane(planeElements[i], params);

        if(plane) {
            // create our text texture as soon as our plane has been created
            // first we need a canvas
            var canvas = document.createElement("canvas");
            // we write our title in our canvas
            writeText(plane, canvas);
            // then we add a data sampler attribute to our canvas
            canvas.setAttribute("data-sampler", "planeTexture");
            // and load it into our plane
            plane.loadCanvas(canvas);

            planes.push(plane);

            handlePlanes(i);
        }
    }

    // update planes position on scroll
    window.addEventListener("scroll", function() {
        for(var i = 0; i < planes.length; i++) {
            var plane = planes[i];
            plane.updatePosition();
        }
    });

    // on resize rewrite the title in the canvas
    window.addEventListener("resize", function() {
        for(var i = 0; i < planes.length; i++) {
            var plane = planes[i];
            // we will update our canvas so we should update the texture as well
            plane.textures[0].shouldUpdate = true;
            // write the title with the new dimensions
            writeText(plane, plane.textures[0].source);
            // our canvas has been updated, we can stop updating our texture
            plane.textures[0].shouldUpdate = false;
        }
    });


    // handle all the planes
    function handlePlanes(index) {
        var plane = planes[index];

        plane.onLoading(function() {
            // our canvas texture is ready
            // wait a little time and then prevent it from updating each frame
            setTimeout(function() {
                plane.textures[0].shouldUpdate = false;
            }, 50);
        }).onRender(function() {
            // update the time uniform
            plane.uniforms.time.value++;
        });
    }
}
