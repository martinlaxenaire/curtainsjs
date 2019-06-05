window.onload = function(){
    // we will keep track of the scroll
    var scrollValue = 0;
    var lastScrollValue = 0;

    // keep track of the number of plane we're currently drawing
    var planeDrawn = 0;
    var debugElement = document.getElementById("debug-value");

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains("canvas");

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
    }).onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains", "planes-loaded");
    });

    // we will keep track of all our planes in an array
    var planes = [];
    var scrollEffect = 0;

    // get our planes elements
    var planeElements = document.getElementsByClassName("plane");

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

    // listen to scroll
    window.addEventListener("scroll", function(e) {
        lastScrollValue = scrollValue;
        scrollValue = window.pageYOffset;

        var delta = scrollValue - lastScrollValue;
        // threshold
        if(delta > 60) {
            delta = 60;
        }
        else if(delta < -60) {
            delta = -60;
        }

        if(Math.abs(delta) > Math.abs(scrollEffect)) {
            scrollEffect = delta;
        }

        // update the plane positions during scroll
        for(var i = 0; i < planes.length; i++) {
            // update plane position on scroll
            planes[i].updatePosition();

            // apply additional translation, scale and rotation
            applyPlanesParallax(i);
        }
    });

    window.addEventListener("resize", function() {
        // wait for everything to be resized before applying parallax again
        setTimeout(function() {
            for(var i = 0; i < planes.length; i++) {
                // apply additional translation, scale and rotation
                applyPlanesParallax(i);
            }
        }, 10);
    });


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
        }).onRender(function() {
            // apply the rotation
            plane.setRotation(0, 0, scrollEffect / 750);

            // scale plane and its texture
            plane.setScale(1, 1 + Math.abs(scrollEffect) / 300);
            plane.textures[0].setScale(1, 1 + Math.abs(scrollEffect) / 150);

            // update the uniform
            plane.uniforms.scrollEffect.value = scrollEffect;
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
        // get our plane center coordinate
        var planeOffsetTop = planes[index]._boundingRect.document.top + planes[index]._boundingRect.document.height / 2;
        // get a float value based on window height (0 means the plane is centered)
        var parallaxEffect = (planeOffsetTop - window.innerHeight / 2) / window.innerHeight;

        // apply the parallax effect
        planes[index].setRelativePosition(0, parallaxEffect * (window.innerHeight / 4));
    }
}
