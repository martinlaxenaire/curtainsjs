function displayCurtains() {

    function lerp (start, end, amt){
        return (1 - amt) * start + amt * end;
    }

    var mousePosition = {
        x: 0,
        y: 0,
    };
    var mouseLastPosition = {
        x: 0,
        y: 0,
    };
    var deltas = {
        max: 0,
        applied: 0,
    };

    function handleMovement(e, plane) {

        if(mousePosition.x != -100000 && mousePosition.y != -100000) {

            mouseLastPosition.x = mousePosition.x;
            mouseLastPosition.y = mousePosition.y;
        }

        var mouse = {};

        if(e.targetTouches) {

            mouse.x = e.targetTouches[0].clientX;
            mouse.y = e.targetTouches[0].clientY;
        }
        else {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        }

        // lerp the mouse position a bit to smoothen the overall effect
        mousePosition.x = lerp(mousePosition.x, mouse.x, 0.3);
        mousePosition.y = lerp(mousePosition.y, mouse.y, 0.3);

        if(plane) {
            var mouseCoords = plane.mouseToPlaneCoords(mousePosition.x, mousePosition.y);

            // mouse must be not too much below the curtains to update the uniforms
            if(mouseCoords.y > -1.25) {
                plane.uniforms.mousePosition.value = [mouseCoords.x, mouseCoords.y];

                if(mouseLastPosition.x && mouseLastPosition.y) {
                    var delta = Math.sqrt(Math.pow(mousePosition.x - mouseLastPosition.x, 2) + Math.pow(mousePosition.y - mouseLastPosition.y, 2)) / 30;
                    delta = Math.min(4, delta);
                    if(delta >= deltas.max) {
                        deltas.max = delta;
                    }
                }
            }
        }
    }


    var webGLCurtain = new Curtains({
        container: "canvas"
    });

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

        var titleTopPosition = title.offsetTop * webGLCurtain.pixelRatio - plane.htmlElement.offsetTop * webGLCurtain.pixelRatio;
        // adjust small offset due to font interpretation?
        titleTopPosition += title.clientHeight * webGLCurtain.pixelRatio * 0.1;

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
        context.textBaseline = "top";
        context.fillText(title.innerText, htmlPlaneWidth / 2, titleTopPosition);

        if(curtainPlane.textures && curtainPlane.textures.length > 1) {
            curtainPlane.textures[1].resize();
            curtainPlane.textures[1].needUpdate();
        }
    }


    var planeElements = document.getElementsByClassName("curtain");

    if(planeElements.length > 0) {

        var curtainPlaneParams = {
            widthSegments: 50,
            heightSegments: 37,
            fov: 10,
            drawCheckMargins: {
                top: 0,
                right: 0,
                bottom: 100,
                left: 0,
            },
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

            canvas.setAttribute("data-sampler", "titleSampler");
            canvas.style.display = "none";

            curtainPlane.loadCanvas(canvas);

            curtainPlane.onReady(function() {
                var wrapper = document.getElementById("page-wrap");

                wrapper.addEventListener("mousemove", function(e) {
                    handleMovement(e, curtainPlane);
                });

                wrapper.addEventListener("touchmove", function(e) {
                    handleMovement(e, curtainPlane);
                }, {passive: true});

            }).onLoading(function(texture) {
                texture.shouldUpdate = false;
                if(curtainPlane.canvases && curtainPlane.canvases.length > 0) {
                    // title
                    if(document.fonts) {
                        document.fonts.ready.then(function () {
                            writeTitle(curtainPlane, canvas);
                        });
                    }
                    else {
                        setTimeout(function() {
                            writeTitle(curtainPlane, canvas);
                        }, 750);
                    }
                }

                if(curtainPlane.textures.length === 2) {
                    setTimeout(function() {
                        document.body.classList.add("curtain-ready");
                        deltas.max = 4;
                    }, 200);
                }
            }).onRender(function() {
                curtainPlane.uniforms.mouseTime.value++;

                // decrease the mouse move strenght with damping : if the user doesn't move the mouse, effect will fade away
                deltas.applied += (deltas.max - deltas.applied) * 0.02;
                deltas.max += (0 - deltas.max) * 0.01;

                // send the new mouse move strength value
                curtainPlane.uniforms.mouseMoveStrength.value = deltas.applied;

            }).onReEnterView(function() {
                // force title drawing if it was hidden on page load
                curtainPlane.textures[1].needUpdate();
            }).onAfterResize(function() {
                writeTitle(curtainPlane, canvas);
            });
        }

    }


    // examples
    var showcaseElements = document.getElementsByClassName("showcase-curtain");
    var showcasePlanes = [];

    for(var i = 0; i < showcaseElements.length; i++) {
        var showcaseParams = {
            vertexShaderID: "simple-shader-vs",
            fragmentShaderID: "simple-shader-fs",
            widthSegments: 10,
            heightSegments: 1,
            uniforms: {
                time: {
                    name: "uTime",
                    type: "1f",
                    value: 0,
                },
            },
        };

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
                // use damping
                if(plane.mouseOver) {
                    plane.uniforms.time.value += (45 - plane.uniforms.time.value) * 0.075;
                }
                else {
                    plane.uniforms.time.value += (0 - plane.uniforms.time.value) * 0.075;
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
            });
        }

    }

}

window.addEventListener("load", function() {
    displayCurtains();
});