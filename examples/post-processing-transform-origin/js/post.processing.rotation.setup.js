window.addEventListener("load", function() {

    function lerp (start, end, amt){
        return (1 - amt) * start + amt * end;
    }

    var rotationEffect = 0;
    // used for touch devices
    var touch = {
        y: 0,
        lastY: 0,
    };

    // handle wheel event
    window.addEventListener("wheel", function(e) {
        // normalize wheel event
        var delta = window.navigator.userAgent.indexOf("Firefox") !== -1 ? e.deltaY : e.deltaY / 40;

        rotationEffect += delta;
    });

    // handle touch
    window.addEventListener("touchstart", function(e) {
        // reset our values on touch start
        if(e.targetTouches) {
            touch.y = e.targetTouches[0].clientY;
        }
        else {
            touch.y = e.clientY;
        }
        touch.lastY = touch.y;
    });

    window.addEventListener("touchmove", function(e) {
        touch.lastY = touch.y;

        if(e.targetTouches) {
            touch.y = e.targetTouches[0].clientY;
        }
        else {
            touch.y = e.clientY;
        }

        rotationEffect += (touch.lastY - touch.y) / 10;
    });

    // set up our WebGL context and append the canvas to our wrapper
    var curtains = new Curtains({
        container: "canvas",
    });

    curtains.onRender(function() {
        rotationEffect = lerp(rotationEffect, 0, 0.05);
    }).onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
    });

    // we will keep track of all our planes in an array
    var planes = [];

    // get our planes elements
    var planeElements = document.getElementsByClassName("plane");

    // add our planes and handle them
    for(var i = 0; i < planeElements.length; i++) {
        var plane = curtains.addPlane(planeElements[i]); // we don't need any params here

        if(plane) {
            planes.push(plane);

            handlePlanes(i);
        }
    }

    function setPlaneTransformOrigin(plane) {
        var curtainsBoundingRect = curtains.getBoundingRect();
        // has to be set according to its css positions
        // (0, 0) means plane's top left corner
        // (1, 1) means plane's bottom right corner
        if(curtainsBoundingRect.width >= curtainsBoundingRect.height) {
            plane.setTransformOrigin(-0.4, 0.5);
        }
        else {
            // for portrait mode we deliberately set the transform origin outside the viewport to give space to the planes
            plane.setTransformOrigin(-0.5, 0.5);
        }
    }

    // handle all the planes
    function handlePlanes(index) {
        var plane = planes[index];

        // check if our plane is defined and use it
        if(plane) {
            setPlaneTransformOrigin(plane);

            plane.setRotation(0, 0, (index / planeElements.length) * Math.PI * 2);

            plane.onReady(function() {

            }).onRender(function() {
                // update rotation based on rotation effect
                plane.setRotation(0, 0, plane.rotation.z + rotationEffect / 100);
            }).onAfterResize(function() {
                setPlaneTransformOrigin(plane);
            });
        }
    }


    // post processing
    var shaderPassParams = {
        vertexShaderID: "rotation-vs",
        fragmentShaderID: "rotation-fs",
        uniforms: {
            rotationEffect: {
                name: "uRotationEffect",
                type: "1f",
                value: 0,
            },
        },
    };

    var shaderPass = curtains.addShaderPass(shaderPassParams);
    if(shaderPass) {
        shaderPass.onRender(function() {
            // update the uniform
            shaderPass.uniforms.rotationEffect.value = rotationEffect;
        });
    }
});
