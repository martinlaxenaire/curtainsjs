window.addEventListener("load", function() {
    // keep track of the number of plane we're currently drawing
    var planeDrawn = 0;
    var debugElement = document.getElementById("debug-value");

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains({
        container: "canvas"
    });

    webGLCurtain.onRender(function() {
        // update our planes deformation
        // increase/decrease the effect
        if(scrollEffect >= 0) {
            scrollEffect = Math.max(0, scrollEffect - 2);
        }
        else {
            scrollEffect = Math.min(0, scrollEffect + 2);
        }

        // update our number of planes drawn debug value
        debugElement.innerText = planeDrawn;
    }).onScroll(function() {
        // get scroll deltas to apply the effect on scroll
        var delta = webGLCurtain.getScrollDeltas();

        // invert value for the effect
        delta.y = -delta.y;

        // threshold
        if(delta.y > 60) {
            delta.y = 60;
        }
        else if(delta.y < -60) {
            delta.y = -60;
        }

        if(Math.abs(delta.y) > Math.abs(scrollEffect)) {
            scrollEffect = delta.y;
        }

        // update the plane positions during scroll
        for(var i = 0; i < planes.length; i++) {
            // apply additional translation, scale and rotation
            applyPlanesParallax(i);
        }

    }).onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains", "planes-loaded");
    });

    // we will keep track of all our planes in an array
    var planes = [];
    var scrollEffect = 0;

    // get our planes elements
    var planeElements = document.getElementsByClassName("plane");

    // add our planes and handle them
    for(var i = 0; i < planeElements.length; i++) {
        var plane = webGLCurtain.addPlane(planeElements[i]); // we don't need any params here

        if(plane) {
            planes.push(plane);

            handlePlanes(i);
        }
    }


    // handle all the planes
    function handlePlanes(index) {
        var plane = planes[index];

        // check if our plane is defined and use it
        plane && plane.onReady(function() {
            // we need to fill the counter with all our planes
            // not that onLeaveView will be called before onReady
            planeDrawn++;

            // apply parallax on load
            applyPlanesParallax(index);

            // once everything is ready, display everything
            if(index == planes.length - 1) {
                document.body.classList.add("planes-loaded");
            }
        }).onAfterResize(function() {
            // apply new parallax values after resize
            applyPlanesParallax(index);
        }).onRender(function() {

            // scale plane and its texture
            plane.setScale(1, 1 + Math.abs(scrollEffect) / 300);
            plane.textures[0].setScale(1, 1 + Math.abs(scrollEffect) / 150);
        }).onReEnterView(function() {
            // plane is drawn again
            planeDrawn++;
        }).onLeaveView(function() {
            // plane is not drawn anymore
            planeDrawn--;
        });
    }

    function applyPlanesParallax(index) {
        // calculate the parallax effect

        // get our window height: remember our canvas is a bit taller
        var windowHeight = webGLCurtain.getBoundingRect().height / 1.2;
        // get our plane center coordinate
        var planeBoundingRect = planes[index].getBoundingRect();
        var planeOffsetTop = planeBoundingRect.top + planeBoundingRect.height / 2;
        // get a float value based on window height (0 means the plane is centered)
        var parallaxEffect = (planeOffsetTop - windowHeight / 2) / windowHeight;

        // apply the parallax effect
        planes[index].setRelativePosition(0, parallaxEffect * (windowHeight / 4));
    }


    // post processing
    var firstShaderPassParams = {
        vertexShaderID: "inverted-rect-vs",
        fragmentShaderID: "inverted-rect-fs",
        uniforms: {
            scrollEffect: {
                name: "uScrollEffect",
                type: "1f",
                value: 0,
            },
        },
    };

    var firstShaderPass = webGLCurtain.addShaderPass(firstShaderPassParams);
    if(firstShaderPass) {
        firstShaderPass.onRender(function() {
            // update the uniform
            firstShaderPass.uniforms.scrollEffect.value = scrollEffect;
        });
    }

    var secondShaderPassParams = {
        vertexShaderID: "distortion-vs",
        fragmentShaderID: "distortion-fs",
        uniforms: {
            scrollEffect: {
                name: "uScrollEffect",
                type: "1f",
                value: 0,
            },
        },
    };

    var secondShaderPass = webGLCurtain.addShaderPass(secondShaderPassParams);
    if(secondShaderPass) {
        secondShaderPass.onRender(function() {
            // update the uniform
            secondShaderPass.uniforms.scrollEffect.value = scrollEffect;
        });
    }
});
