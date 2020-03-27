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

    // flowmap shaders
    var flowmapVs = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
    
        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;
    
        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;
    
        // custom variables
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        void main() {
    
            vec3 vertexPosition = aVertexPosition;
    
            gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);
    
            // varyings
            vTextureCoord = aTextureCoord;
            vVertexPosition = vertexPosition;
        }
    `;

    var flowmapFs = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
    
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        uniform sampler2D uFlowMap;
    
        uniform vec2 uMousePosition;
        uniform float uFalloff;
        uniform float uAlpha;
        uniform float uDissipation;
        uniform float uCursorGrow;
    
        uniform vec2 uVelocity;
        uniform float uAspect;
    
        void main() {
            vec2 textCoords = vTextureCoord;
            
            
            /*** comment this whole block for a regular mouse flow effect ***/
            
            // convert to -1 -> 1
            textCoords = textCoords * 2.0 - 1.0;
            
            // make the cursor grow with time
            textCoords /= uCursorGrow;
            // adjust cursor position based on its growth
            textCoords += uCursorGrow * uMousePosition / (1.0 / (uCursorGrow - 1.0) * pow(uCursorGrow, 2.0));
    
            // convert back to 0 -> 1
            textCoords = (textCoords + 1.0) / 2.0;
            
            /*** end of whole block commenting for a regular mouse flow effect ***/
    
    
            vec4 color = texture2D(uFlowMap, textCoords) * uDissipation;
    
            vec2 mouseTexPos = (uMousePosition + 1.0) * 0.5;
            vec2 cursor = vTextureCoord - mouseTexPos;
            cursor.x *= uAspect;
    
            vec3 stamp = vec3(uVelocity * vec2(1.0, -1.0), 1.0 - pow(1.0 - min(1.0, length(uVelocity)), 3.0));
            float falloff = smoothstep(uFalloff, 0.0, length(cursor)) * uAlpha;
            color.rgb = mix(color.rgb, stamp, vec3(falloff));
    
            // handle premultiply alpha
            color.rgb = color.rgb * color.a;
    
            gl_FragColor = color;
        }
    `;


    // displacement shaders
    var displacementVs = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
    
        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;
    
        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;
    
        uniform mat4 planeTextureMatrix;
    
        // custom variables
        varying vec3 vVertexPosition;
        varying vec2 vPlaneTextureCoord;
        varying vec2 vTextureCoord;
    
        void main() {
    
            vec3 vertexPosition = aVertexPosition;
    
            gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);
    
            // varyings
            vTextureCoord = aTextureCoord;
            vPlaneTextureCoord = (planeTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
            vVertexPosition = vertexPosition;
        }
    `;

    var displacementFs = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
    
        varying vec3 vVertexPosition;
        varying vec2 vPlaneTextureCoord;
        varying vec2 vTextureCoord;
    
        uniform sampler2D planeTexture;
        uniform sampler2D uFlowTexture;
    
        void main() {
            // our flowmap
            vec4 flowTexture = texture2D(uFlowTexture, vTextureCoord);
    
            // distort our image texture based on the flowmap values
            vec2 distortedCoords = vPlaneTextureCoord;
            distortedCoords -= flowTexture.xy * 0.1;
    
            // get our final texture based on the displaced coords
            vec4 texture = texture2D(planeTexture, distortedCoords);
    
            // get a B&W version of our image texture
            vec4 textureBW = vec4(1.0);
            textureBW.rgb = vec3(texture.r * 0.3 + texture.g * 0.59 + texture.b * 0.11);
    
            // mix the BW image and the colored one based on our flowmap color values
            float mixValue = clamp((abs(flowTexture.r) + abs(flowTexture.g) + abs(flowTexture.b)) * 1.5, 0.0, 1.0);
            texture = mix(texture, textureBW, mixValue);
    
            // switch between this 2 lines to see what we have drawn onto our flowmap
            //gl_FragColor = flowTexture;
            gl_FragColor = texture;
        }
    `;


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
    });


    var flowMapParams = {
        vertexShader: flowmapVs,
        fragmentShader: flowmapFs,
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
        flowMapTex = flowMap.createTexture({
            sampler: "uFlowMap",
        });

        // create 2 render targets
        readPass = curtains.addRenderTarget({
            depth: false,
            clear: false,
        });
        writePass = curtains.addRenderTarget({
            depth: false,
            clear: false,
        });

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
            vertexShader: displacementVs,
            fragmentShader: displacementFs,
        };

        var plane = curtains.addPlane(planeElement, params);
        // if the plane has been created
        if(plane) {
            plane.onReady(function() {
                // create a texture that will hold our flowmap
                flowTexture = plane.createTexture({
                    sampler: "uFlowTexture",
                    fromTexture: flowMap.textures[0] // set it based on our flowmap plane's texture
                });

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
