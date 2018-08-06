window.onload = function(){

    var canvasContainer = document.getElementById("canvas");

    var planes = [];

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


    var webGLCurtain = new Curtains("canvas");

    var planeElements = document.getElementsByClassName("curtain");
    var examplePlanes = [];
    var planesInitialOffset = [];


    var exampleParams = {
        vertexShaderID: "simple-shader-vs",
        fragmentShaderID: "simple-shader-fs",
        widthSegments: 10,
        heightSegments: 1,
        imageCover: false,
        uniforms: {
            time: {
                name: "uTime",
                type: "1f",
                value: 0,
            },
        },
    };


    for(var i = 0; i < planeElements.length; i++) {
        if(i > 0) {
            examplePlanes.push(webGLCurtain.addPlane(planeElements[i], exampleParams));

            handleExamples(i);
        }

        // store planes top positions
        planesInitialOffset.push(planeElements[i].getBoundingClientRect().top + window.pageYOffset);
    }

    if(planeElements.length > 0) {

        var curtainPlaneParams = {
            widthSegments: 50,
            heightSegments: 37,
            //fov: 15,
            imageCover: false,
            uniforms: {
                resolution: {
                    name: "uResolution",
                    type: "2f",
                    value: [planeElements[0].offsetWidth, planeElements[0].offsetHeight],
                },
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

        curtainPlane.onReady(function() {
            planeElements[0].classList.add("curtain-ready");
            curtainPlane.setPerspective(10);

            var wrapper = document.getElementById("page-wrap");

            wrapper.addEventListener("mousemove", function(e) {
                handleMovement(e, curtainPlane);
            });

            wrapper.addEventListener("touchmove", function(e) {
                handleMovement(e, curtainPlane);
            });

            window.onresize = function() {
                curtainPlane.uniforms.resolution.value = [curtainPlane.htmlElement.offsetWidth, curtainPlane.htmlElement.offsetHeight];

                for(var i = 0; i < planeElements.length; i++) {
                    planesInitialOffset[i] = planeElements[i].getBoundingClientRect().top + window.pageYOffset;
                }
            }

        }).onRender(function() {
            curtainPlane.uniforms.mouseTime.value++;

            curtainPlane.uniforms.mouseMoveStrength.value = mouseDelta;
            mouseDelta = Math.max(0, mouseDelta * 0.995);

            curtainPlane.setRelativePosition(curtainPlane.relativeTranslation.x, planesInitialOffset[0] - window.pageYOffset, curtainPlane.relativeTranslation.z);
        });

    }



    function handleExamples(index) {
        var plane = examplePlanes[index - 1];

        plane.onReady(function() {

            plane.mouseOver = false;

            planeElements[index].addEventListener("mouseenter", function(e) {
                plane.mouseOver = true;
            });

            planeElements[index].addEventListener("mouseleave", function(e) {
                plane.mouseOver = false;
            });

        }).onRender(function() {
            //plane.uniforms.time.value++;
            //if(index == 2) console.log(plane.uniforms.time.value);
            if(plane.mouseOver) {
                plane.uniforms.time.value = Math.min(45, plane.uniforms.time.value + 1);
            }
            else {
                plane.uniforms.time.value = Math.max(0, plane.uniforms.time.value - 1);
            }

            plane.setRelativePosition(plane.relativeTranslation.x, planesInitialOffset[index] - window.pageYOffset, plane.relativeTranslation.z);
        });

    }

}
