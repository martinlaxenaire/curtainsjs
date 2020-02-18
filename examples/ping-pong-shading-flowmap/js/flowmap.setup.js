/**
 This example is a port of this pen: https://codepen.io/martinlaxenaire/pen/ROgEKj
 however it is using FBOs swapping aka ping pong shading instead of a canvas texture
 which is way more performant because it relies almost entirely on the GPU
 It is highly based on Nathan Gordon's OGL library flowmap example: https://oframe.github.io/ogl/examples/?src=mouse-flowmap.html

 It works with two planes and two render targets.
 Our first plane will use FBOs swapping to draw a mouse trail:
    - create a plane and a texture onto which we'll draw a circle following the mouse position
    - create two render targets (read and write)
    - before drawing our plane (onRender callback), apply the write pass as our plane render target
    - after drawing our plane (onAfterRender callback), swap the read and write pass and copy the read pass texture onto our plane

 Our second plane will grab our first plane final texture and will use it as a base to displace a regular texture:
    - create a second plane and a texture and apply our first plane texture to that texture
    - update the mouse position and velocity in the render callback of that plane
 ***/

window.addEventListener("load", function() {
    var ww = window.innerWidth;
    var wh = window.innerHeight;

    var mouse = {
        x: ww / 2,
        y: wh / 2,
    };
    var lastMouse = {
        x: ww / 2,
        y: wh / 2,
    };
    var velocity = {
        x: 0,
        y: 0,
    };

    function lerp (start, end, amt){
        return (1 - amt) * start + amt * end;
    }

    function onMouseMove(e) {
        // velocity is our mouse position minus our mouse last position
        lastMouse = mouse;

        // touch event
        if(e.targetTouches) {
            mouse = {
                x: e.targetTouches[0].clientX,
                y: e.targetTouches[0].clientY,
            };
        }
        // mouse event
        else {
            mouse = {
                x: e.clientX,
                y: e.clientY,
            };
        }

        // divided by a frame duration (roughly)
        velocity = {
            x: (mouse.x - lastMouse.x) / 16,
            y: (mouse.y - lastMouse.y) / 16
        };

        // we should update the velocity
        updateVelocity = true;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onMouseMove);

    // if we should update the velocity or not
    var updateVelocity = false;

    // our fbos and textures
    var readPass, writePass, flowMapTex, flowTexture;

    var curtains = new Curtains({
        container: "canvas",
    }).onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
    }).onContextLost(function() {
        // on context lost, try to restore the context
        curtains.restoreContext();
    }).onContextRestored(function() {
        // in case we lose the webgl context and then get it back
        // we need to reassign flowMapTex to flowTexture
        // no need to reassign readPass.textures[0] to flowMapTex as it is already done in our render loop
        flowTexture.setFromTexture(flowMapTex);
    });

    var flowMapParams = {
        vertexShaderID: "flowmap-vs",
        fragmentShaderID: "flowmap-fs",
        autoloadSources: false, // don't load the image for this plane, we'll just write the mouse position on it
        depthTest: false, // we need to disable the depth test in order for the ping pong shading to work
        uniforms: {
            mousePosition: {
                name: "uMousePosition",
                type: "2f",
                value: [mouse.x, mouse.y],
            },
            // size of the cursor
            fallOff: {
                name: "uFalloff",
                type: "1f",
                value: ww > wh ? ww / 30000 : wh / 20000,
            },
            // how much the cursor should grow with time
            cursorGrow: {
                name: "uCursorGrow",
                type: "1f",
                value: 1.15,
            },
            // alpha of the cursor
            alpha: {
                name: "uAlpha",
                type: "1f",
                value: 1,
            },
            // how much the cursor must dissipate over time (ie trail length)
            // closer to 1 = no dissipation
            dissipation: {
                name: "uDissipation",
                type: "1f",
                value: 0.925,
            },
            // our velocity
            velocity: {
                name: "uVelocity",
                type: "2f",
                value: [0, 0],
            },
            // window aspect ratio to draw a circle
            aspect: {
                name: "uAspect",
                type: "1f",
                value: ww / wh,
            },
        },
    };

    // we'll be using this html element to create 2 planes
    var planeElement = document.getElementById("flowmap");


    // create our first plane
    // we'll draw a circle based on our mouse position on a black background
    // then use render targets to get the ping pong shading
    var flowMap = curtains.addPlane(planeElement, flowMapParams);

    function swapPasses() {
        // swap read and write passes
        var tempFBO = readPass;
        readPass = writePass;
        writePass = tempFBO;

        // apply new texture
        flowMapTex.setFromTexture(readPass.textures[0]);
    }

    // if our flowmap has been created
    if(flowMap) {
        // create a texture where we'll draw our circle
        flowMapTex = flowMap.createTexture("uFlowMap");

        // create 2 render targets
        readPass = curtains.addRenderTarget({ depth: false });
        writePass = curtains.addRenderTarget({ depth: false });

        flowMap.onRender(function() {
            // update the render target
            writePass && flowMap.setRenderTarget(writePass);
        }).onAfterRender(function() {
            // swap FBOs and update texture
            if(readPass && writePass) {
                swapPasses();
            }

        }).onAfterResize(function() {
            // update our window aspect ratio uniform
            var boundingRect = flowMap.getBoundingRect();
            flowMap.uniforms.aspect.value = boundingRect.width / boundingRect.height;
            flowMap.uniforms.fallOff.value = boundingRect.width > boundingRect.height ? boundingRect.width / 30000 : boundingRect.height / 20000;
        });

        // next we will create the plane that will display our result
        var params = {
            vertexShaderID: "flowmap-displacement-vs",
            fragmentShaderID: "flowmap-displacement-fs",
        };

        var plane = curtains.addPlane(planeElement, params);
        // if the plane has been created
        if(plane) {
            plane.onReady(function() {
                // create a texture that will hold our flowmap
                flowTexture = plane.createTexture("uFlowTexture");

                // set it based on our flowmap plane's texture
                flowTexture.setFromTexture(flowMap.textures[0]);

            }).onRender(function() {
                // update mouse position
                var weblgMouseCoords = flowMap.mouseToPlaneCoords(mouse.x, mouse.y);
                flowMap.uniforms.mousePosition.value = [weblgMouseCoords.x, weblgMouseCoords.y];

                // update velocity
                if(!updateVelocity) {
                    velocity = {
                        x: lerp(velocity.x, 0, 0.5),
                        y: lerp(velocity.y, 0, 0.5)
                    };
                }
                updateVelocity = false;

                flowMap.uniforms.velocity.value = [lerp(velocity.x, 0, 0.1), lerp(velocity.y, 0, 0.1)];
            });
        }
    }
});
