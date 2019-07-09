function displayCurtains() {
    var mousePosition = {
        x: 0,
        y: 0,
    };
    var mouseLastPosition = {
        x: 0,
        y: 0,
    };
    var mouseDelta = 0;


    function handleMovement(e, plane) {

        if(mousePosition.x != -100000 && mousePosition.y != -100000) {

            mouseLastPosition.x = mousePosition.x;
            mouseLastPosition.y = mousePosition.y;
        }

        if(e.targetTouches) {

            mousePosition.x = e.targetTouches[0].clientX;
            mousePosition.y = e.targetTouches[0].clientY;
        }
        else {
            mousePosition.x = e.clientX;
            mousePosition.y = e.clientY;
        }

        if(plane) {
            var mouseCoords = plane.mouseToPlaneCoords(mousePosition.x, mousePosition.y);

            // mouse must be not too much below the curtains to update the uniforms
            if(mouseCoords.y > -1.25) {
                plane.uniforms.mousePosition.value = [mouseCoords.x, mouseCoords.y];

                if(mouseLastPosition.x && mouseLastPosition.y) {
                    var delta = Math.sqrt(Math.pow(mousePosition.x - mouseLastPosition.x, 2) + Math.pow(mousePosition.y - mouseLastPosition.y, 2)) / 30;
                    delta = Math.min(4, delta);
                    if(delta >= mouseDelta) {
                        mouseDelta = delta;
                        plane.uniforms.mouseTime.value = 0;
                    }
                }
            }
        }
    }


    var webGLCurtain = new Curtains("canvas");

    // handling errors
    webGLCurtain.onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
    });

    // home curtain
    // here we will write our title inside our canvas
    function writeTitle(plane, canvas) {
        var title = document.getElementById("site-title");
        var titleStyle = window.getComputedStyle(title);

        var subtitle = document.getElementById("site-subtitle");
        var subtitleHeight = subtitle.clientHeight;

        var planeBoundinRect = plane.getBoundingRect();

        var htmlPlaneWidth = planeBoundinRect.width;
        var htmlPlaneHeight = planeBoundinRect.height;

        // set sizes
        canvas.width = htmlPlaneWidth;
        canvas.height = htmlPlaneHeight;
        var context = canvas.getContext("2d");

        context.width = htmlPlaneWidth;
        context.height = htmlPlaneHeight;

        // draw our title with the original style
        context.fillStyle = titleStyle.color;
        context.font = parseFloat(titleStyle.fontSize) * webGLCurtain.pixelRatio + "px " + titleStyle.fontFamily;
        context.fontStyle = titleStyle.fontStyle;
        context.textAlign = "center";

        // vertical alignment
        context.textBaseline = "middle";
        context.fillText("curtains.js", htmlPlaneWidth / 2, htmlPlaneHeight / 2 - subtitleHeight / 2);

        context.imageSmoothingEnabled = true;

        if(curtainPlane.textures && curtainPlane.textures.length > 1) {
            setTimeout(function() {
                curtainPlane.textures[1].shouldUpdate = false;
            }, 50);
        }
    }


    var planeElements = document.getElementsByClassName("curtain");

    if(planeElements.length > 0) {

        var curtainPlaneParams = {
            widthSegments: 50,
            heightSegments: 37,
            //fov: 15,
            alwaysDraw: true, // set to true because the webgl part is overflowing the original plane
            uniforms: {
                mouseTime: {
                    name: "uMouseTime",
                    type: "1f",
                    value: 0,
                },
                mousePosition: {
                    name: "uMousePosition",
                    type: "2f",
                    value: [mousePosition.x, mousePosition.y],
                },
                mouseMoveStrength: {
                    name: "uMouseMoveStrength",
                    type: "1f",
                    value: 0,
                },
            },
        };

        var curtainPlane = webGLCurtain.addPlane(planeElements[0], curtainPlaneParams);

        // if there has been an error during init, curtainPlane will be null
        if(curtainPlane) {
            var canvas = document.createElement("canvas");
            writeTitle(curtainPlane, canvas);

            canvas.setAttribute("data-sampler", "titleSampler");
            canvas.style.display = "none";

            curtainPlane.loadCanvas(canvas);

            curtainPlane.onLoading(function() {
                if(curtainPlane._loadingManager.sourcesLoaded == 2) {
                    setTimeout(function() {
                        curtainPlane.textures[1].shouldUpdate = false;
                        mouseDelta = 1;
                        document.body.classList.add("curtain-ready");
                    }, 50);
                }
            }).onReady(function() {
                curtainPlane.setPerspective(10);

                var wrapper = document.getElementById("page-wrap");

                wrapper.addEventListener("mousemove", function(e) {
                    handleMovement(e, curtainPlane);
                });

                wrapper.addEventListener("touchmove", function(e) {
                    handleMovement(e, curtainPlane);
                });

                window.addEventListener("resize", function() {
                    // update title texture
                    curtainPlane.textures[1].shouldUpdate = true;
                    writeTitle(curtainPlane, curtainPlane.textures[1].source);
                });
            }).onRender(function() {
                curtainPlane.uniforms.mouseTime.value++;

                curtainPlane.uniforms.mouseMoveStrength.value = mouseDelta;
                mouseDelta = Math.max(0, mouseDelta * 0.995);

                curtainPlane.updatePosition();
            });
        }

    }


    // examples
    var showcaseElements = document.getElementsByClassName("showcase-curtain");
    var showcasePlanes = [];

    var showcaseParams = {
        vertexShaderID: "simple-shader-vs",
        fragmentShaderID: "simple-shader-fs",
        widthSegments: 10,
        heightSegments: 1,
        //alwaysDraw: true, // firefox bug ?!
        uniforms: {
            time: {
                name: "uTime",
                type: "1f",
                value: 0,
            },
        },
    };

    for(var i = 0; i < showcaseElements.length; i++) {
        var plane = webGLCurtain.addPlane(showcaseElements[i], showcaseParams);

        if(plane) {
            showcasePlanes.push(plane);

            handleExamples(i);
        }
    }

    function handleExamples(index) {
        var plane = showcasePlanes[index];

        // if there has been an error during init, plane will be null
        if(plane) {
            plane.onReady(function() {

                plane.mouseOver = false;

                showcaseElements[index].addEventListener("mouseenter", function(e) {
                    plane.mouseOver = true;
                });

                showcaseElements[index].addEventListener("mouseleave", function(e) {
                    plane.mouseOver = false;
                });

            }).onRender(function() {
                if(plane.mouseOver) {
                    plane.uniforms.time.value = Math.min(45, plane.uniforms.time.value + 1);
                }
                else {
                    plane.uniforms.time.value = Math.max(0, plane.uniforms.time.value - 1);
                }

                plane.updatePosition();
            }).onLeaveView(function() {
                //console.log("leaving view", plane.index);
            }).onReEnterView(function() {
                //console.log("entering view", plane.index);
            });
        }

    }


    // basic example
    var basicElement = document.getElementById("basic-example");

    if(basicElement) {

        var basicPlaneParams = {
            vertexShaderID: "basic-plane-vs", // our vertex shader ID
            fragmentShaderID: "basic-plane-fs", // our framgent shader ID
            uniforms: {
                time: {
                    name: "uTime",
                    type: "1f",
                    value: 0,
                },
            },
        };

        var basicPlane = webGLCurtain.addPlane(basicElement, basicPlaneParams);

        // if there has been an error during init, curtainPlane will be null
        if(basicPlane) {
            basicPlane.onRender(function() {
                basicPlane.uniforms.time.value++;

                basicPlane.updatePosition();
            });
        }

    }


    // about
    var aboutElements = document.getElementsByClassName("about-curtain");

    if(aboutElements.length > 0) {

        var aboutPlaneParams = {
            widthSegments: 10,
            heightSegments: 10,
            fov: 35,
            uniforms: {
                time: {
                    name: "uTime",
                    type: "1f",
                    value: 0,
                },
            },
        };

        var aboutPlane = webGLCurtain.addPlane(aboutElements[0], aboutPlaneParams);

        // if there has been an error during init, curtainPlane will be null
        if(aboutPlane) {
            aboutPlane.onRender(function() {
                aboutPlane.uniforms.time.value++;

                aboutPlane.updatePosition();
            });
        }

    }

}

window.addEventListener("DOMContentLoaded", function() {
    displayCurtains();
});