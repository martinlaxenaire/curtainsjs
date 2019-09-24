window.addEventListener("load", function() {
    // we will keep track of all our planes in an array
    var planes = [];
    var scrollEffect = 0;

    // get our planes elements
    var planeElements = document.getElementsByClassName("plane");

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains({
        container: "canvas",
        watchScroll: false // we'll handle it by ourself
    });

    // handle smooth scroll and update planes positions
    var smoothScroll = new LocomotiveScroll({
        el: document.getElementById('page-content'),
        smooth: true,
        inertia: 0.5,
        passive: true,
    });

    webGLCurtain.onRender(function() {
        if(smoothScroll.isMobile) {
            // update our planes deformation
            // increase/decrease the effect
            if(scrollEffect >= 0) {
                scrollEffect = Math.max(0, scrollEffect - 2);
            }
            else {
                scrollEffect = Math.min(0, scrollEffect + 2);
            }
        }

        // update our number of planes drawn debug value
        debugElement.innerText = planeDrawn;
    }).onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains", "planes-loaded");
    });

    function updateScroll(xOffset, yOffset) {
        // update our scroll manager values
        webGLCurtain.updateScrollValues(xOffset, yOffset);

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

        if(smoothScroll.isMobile && Math.abs(delta.y) > Math.abs(scrollEffect)) {
            scrollEffect = delta.y * 1.5;
        }
        else {
            scrollEffect = delta.y * 1.5;
        }

        // manually update planes positions
        for(var i = 0; i < planes.length; i++) {
            planes[i].updateScrollPosition();

            // apply additional translation, scale and rotation
            applyPlanesParallax(i);

            // update the plane deformation uniform as well
            planes[i].uniforms.scrollEffect.value = scrollEffect;
        }

        // render scene
        webGLCurtain.needRender();
    }

    // custom scroll event
    if(!smoothScroll.isMobile) {
        // we'll render only while lerping the scroll
        webGLCurtain.disableDrawing();
        smoothScroll.on('scroll', function(obj) {
            updateScroll(obj.scroll.x, obj.scroll.y);
        });
    }
    else {
        window.addEventListener("scroll", function() {
            updateScroll(window.pageXOffset, window.pageYOffset);
        }, {passive: true});
    }

    // keep track of the number of plane we're currently drawing
    var debugElement = document.getElementById("debug-value");
    // we need to fill the counter with all our planes
    var planeDrawn = planeElements.length;

    // no need for shaders as they were already passed by data attributes
    var params = {
        widthSegments: 10,
        heightSegments: 10,
        uniforms: {
            scrollEffect: {
                name: "uScrollEffect",
                type: "1f",
                value: 0,
            },
        },
    };

    // add our planes and handle them
    for(var i = 0; i < planeElements.length; i++) {
        var plane = webGLCurtain.addPlane(planeElements[i], params);

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
            // apply the rotation
            plane.setRotation(0, 0, scrollEffect / 750);

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

        // get our window size
        var sceneBoundingRect = webGLCurtain.getBoundingRect();
        // get our plane center coordinate
        var planeBoundingRect = planes[index].getBoundingRect();
        var planeOffsetTop = planeBoundingRect.top + planeBoundingRect.height / 2;
        // get a float value based on window height (0 means the plane is centered)
        var parallaxEffect = (planeOffsetTop - sceneBoundingRect.height / 2) / sceneBoundingRect.height;

        // apply the parallax effect
        planes[index].setRelativePosition(0, parallaxEffect * (sceneBoundingRect.height / 4));
    }
});
