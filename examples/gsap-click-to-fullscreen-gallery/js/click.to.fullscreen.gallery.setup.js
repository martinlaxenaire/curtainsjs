import {Curtains, Plane, Vec2, Vec3, PingPongPlane, ShaderPass, FXAAPass} from '../../../src/index.mjs';

window.addEventListener("load", () => {
    // set up our WebGL context and append the canvas to our wrapper
    const curtains = new Curtains({
        container: "canvas",
        pixelRatio: Math.min(1.5, window.devicePixelRatio), // limit pixel ratio for performance
        autoRender: false, // use gsap ticker to render our scene
    });

    curtains.onScroll(() => {
        // update the plane texture offset during scroll
        planes.forEach((plane) => {
            applyPlanesParallax(plane);
        })

    }).onError(() => {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains", "planes-loaded");
    }).onContextLost(() => {
        // on context lost, try to restore the context
        curtains.restoreContext();
    });

    const mouse = new Vec2();
    const lastMouse = mouse.clone();
    const velocity = new Vec2();


    // use gsap ticker to render our scene
    // gsap ticker handles different monitor refresh rates
    // besides for performance we'll want to have only one request animation frame loop running
    gsap.ticker.add(curtains.render.bind(curtains));

    // we will keep track of all our planes in an array
    const planes = [];

    // get our planes elements
    const planeElements = document.getElementsByClassName("plane");

    const vs = `
        precision mediump float;

        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;

        uniform mat4 planeTextureMatrix;

        // custom variables
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
        
        uniform vec2 uMousePosition;
        uniform float uTime;
        uniform float uTransition;

        void main() {
            vec3 vertexPosition = aVertexPosition;
            
            // convert uTransition from [0,1] to [0,1,0]
            float transition = 1.0 - abs((uTransition * 2.0) - 1.0);
            
            //vertexPosition.x *= (1 + transition * 2.25);
            
            // get the distance between our vertex and the mouse position
            float distanceFromMouse = distance(uMousePosition, vec2(vertexPosition.x, vertexPosition.y));

            // calculate our wave effect
            float waveSinusoid = cos(5.0 * (distanceFromMouse - (uTime / 30.0)));

            // attenuate the effect based on mouse distance
            float distanceStrength = (0.4 / (distanceFromMouse + 0.4));

            // calculate our distortion effect
            float distortionEffect = distanceStrength * waveSinusoid * 0.33;

            // apply it to our vertex position
            vertexPosition.z +=  distortionEffect * -transition;
            vertexPosition.x +=  (distortionEffect * transition * (uMousePosition.x - vertexPosition.x));
            vertexPosition.y +=  distortionEffect * transition * (uMousePosition.y - vertexPosition.y);

            gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);

            // varyings
            vVertexPosition = vertexPosition;
            vTextureCoord = (planeTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
        }
    `;

    const fs = `
        precision mediump float;

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        uniform sampler2D planeTexture;

        void main( void ) {
            // apply our texture
            vec4 finalColor = texture2D(planeTexture, vTextureCoord);
            
            // fake shadows based on vertex position along Z axis
            finalColor.rgb += clamp(vVertexPosition.z, -1.0, 0.0) * 0.75;
            // fake lights based on vertex position along Z axis
            finalColor.rgb += clamp(vVertexPosition.z, 0.0, 1.0) * 0.75;
        
            // just display our texture
            gl_FragColor = finalColor;
        }
    `;

    const params = {
        vertexShader: vs,
        fragmentShader: fs,
        widthSegments: 10,
        heightSegments: 10,
        uniforms: {
            time: {
                name: "uTime",
                type: "1f",
                value: 0,
            },
            fullscreenTransition: {
                name: "uTransition",
                type: "1f",
                value: 0,
            },
            mousePosition: {
                name: "uMousePosition",
                type: "2f",
                value: mouse,
            }
        }
    };

    // add our planes and handle them
    for(let i = 0; i < planeElements.length; i++) {
        const plane = new Plane(curtains, planeElements[i], params);

        planes.push(plane);

        handlePlanes(i);
    }

    // handle all the planes
    function handlePlanes(index) {
        const plane = planes[index];

        plane.onReady(() => {
            plane.textures[0].setScale(new Vec2(1.5, 1.5));

            // apply parallax on load
            applyPlanesParallax(plane);

            // once everything is ready, display everything
            if(index === planes.length - 1) {
                document.body.classList.add("planes-loaded");
            }

            plane.htmlElement.addEventListener("click", (e) => {
                onPlaneClick(e, plane);
            });

        }).onAfterResize(() => {
            // if plane is displayed fullscreen, update its scale and translations
            if(plane.userData.isFullscreen) {
                const planeBoundingRect = plane.getBoundingRect();
                const curtainBoundingRect = curtains.getBoundingRect();

                plane.setScale(new Vec2(
                    curtainBoundingRect.width / planeBoundingRect.width,
                    curtainBoundingRect.height / planeBoundingRect.height
                ));

                plane.setRelativeTranslation(new Vec3(
                    -1 * planeBoundingRect.left / curtains.pixelRatio,
                    -1 * planeBoundingRect.top / curtains.pixelRatio,
                    0
                ));
            }

            // apply new parallax values after resize
            applyPlanesParallax(plane);
        }).onRender(() => {
            plane.uniforms.time.value++;
        });
    }

    function applyPlanesParallax(plane) {
        // calculate the parallax effect
        // get our window size
        const sceneBoundingRect = curtains.getBoundingRect();
        // get our plane center coordinate
        const planeBoundingRect = plane.getBoundingRect();
        const planeOffsetTop = planeBoundingRect.top + planeBoundingRect.height / 2;
        // get a float value based on window height (0 means the plane is centered)
        const parallaxEffect = (planeOffsetTop - sceneBoundingRect.height / 2) / sceneBoundingRect.height;

        // set texture offset
        const texture = plane.textures[0];
        texture.setOffset(new Vec2(0, (1 - texture.scale.y) * 0.5 * parallaxEffect));
    }

    /*** GALLERY ***/


    const galleryState = {
        fullscreenThumb: false, // is actually displaying a fullscreen image
        closeButtonEl: document.getElementById("close-button"), // close button element
        openTween: null, // opening tween
        closeTween: null, // closing tween
    };

    // on closing a fullscreen image
    galleryState.closeButtonEl.addEventListener("click", () => {
        const fullScreenPlane = curtains.planes.find(plane => plane.userData.isFullscreen);

        // if there's a plane actually displayed fullscreen, we'll be shrinking it back to normal
        if(fullScreenPlane && galleryState.fullscreenThumb) {
            // reset fullscreen state
            galleryState.fullscreenThumb = false;
            document.body.classList.remove("is-fullscreen");

            fullScreenPlane.userData.isFullscreen = false;

            // hide close button again
            galleryState.closeButtonEl.style.display = "none";

            // force mouse position to be at the center of the plane
            fullScreenPlane.uniforms.mousePosition.value.set(0, 0);
            // reset timer for the animation
            fullScreenPlane.uniforms.time.value = 0;

            // draw all other planes again
            const allOtherPlanes = curtains.planes.filter(el => el.uuid !== fullScreenPlane.uuid && el.type !== "PingPongPlane");
            allOtherPlanes.forEach(el => {
                el.visible = true;
            });

            // object that will be tweened
            let animation = {
                // current scale and translation values
                scaleX: fullScreenPlane.scale.x,
                scaleY: fullScreenPlane.scale.y,
                translationX: fullScreenPlane.relativeTranslation.x,
                translationY: fullScreenPlane.relativeTranslation.y,
                // transition effect back 0 from to 1
                transition: 1,
                // texture scale back from 1 to 1.5
                textureScale: 1,
            };

            // create vectors only once and use them later on during tween onUpdate callback
            const newScale = new Vec2();
            const newTranslation = new Vec3();

            // kill tween
            if(galleryState.closeTween) {
                galleryState.closeTween.kill();
            }

            galleryState.closeTween = gsap.to(animation, 2, {
                scaleX: 1,
                scaleY: 1,
                translationX: 0,
                translationY: 0,
                transition: 0,
                textureScale: 1.5,
                ease: Power3.easeInOut,
                onUpdate: function() {
                    // plane scale
                    newScale.set(animation.scaleX, animation.scaleY);
                    fullScreenPlane.setScale(newScale);

                    // plane translation
                    newTranslation.set(animation.translationX, animation.translationY, 0);
                    fullScreenPlane.setRelativeTranslation(newTranslation);

                    // texture scale
                    newScale.set(animation.textureScale, animation.textureScale);
                    fullScreenPlane.textures[0].setScale(newScale);

                    // transition
                    fullScreenPlane.uniforms.fullscreenTransition.value = animation.transition;

                    // apply parallax to change texture offset
                    applyPlanesParallax(fullScreenPlane);
                },
                onComplete: function() {
                    // reset the plane renderOrder to 0 (we could have ommit the parameter)
                    fullScreenPlane.setRenderOrder(0);

                    // clear tween
                    galleryState.closeTween = null;
                }
            });
        }
    });

    function onPlaneClick(event, plane) {
        // if no planes are already displayed fullscreen
        if(!galleryState.fullscreenThumb) {
            // set fullscreen state
            galleryState.fullscreenThumb = true;
            document.body.classList.add("is-fullscreen");

            // flag this plane
            plane.userData.isFullscreen = true;

            // put plane in front
            plane.setRenderOrder(1);

            // start ripple effect from mouse position, and tween it to center
            const startMousePostion = plane.mouseToPlaneCoords(mouse);
            plane.uniforms.mousePosition.value.copy(startMousePostion);
            plane.uniforms.time.value = 0;

            // we'll be using bounding rect values to tween scale and translation values
            const planeBoundingRect = plane.getBoundingRect();
            const curtainBoundingRect = curtains.getBoundingRect();

            // starting values
            let animation = {
                scaleX: 1,
                scaleY: 1,
                translationX: 0,
                translationY: 0,
                transition: 0,
                textureScale: 1.5,
                mouseX: startMousePostion.x,
                mouseY: startMousePostion.y,
            };


            // create vectors only once and use them later on during tween onUpdate callback
            const newScale = new Vec2();
            const newTranslation = new Vec3();

            // kill tween
            if(galleryState.openTween) {
                galleryState.openTween.kill();
            }

            // we want to take top left corner as our plane transform origin
            plane.setTransformOrigin(newTranslation);

            galleryState.openTween = gsap.to(animation, 2, {
                scaleX: curtainBoundingRect.width / planeBoundingRect.width,
                scaleY: curtainBoundingRect.height / planeBoundingRect.height,
                translationX: -1 * planeBoundingRect.left / curtains.pixelRatio,
                translationY: -1 * planeBoundingRect.top / curtains.pixelRatio,
                transition: 1,
                textureScale: 1,
                mouseX: 0,
                mouseY: 0,
                ease: Power3.easeInOut,
                onUpdate: function() {
                    // plane scale
                    newScale.set(animation.scaleX, animation.scaleY);
                    plane.setScale(newScale);

                    // plane translation
                    newTranslation.set(animation.translationX, animation.translationY, 0);
                    plane.setRelativeTranslation(newTranslation);

                    // texture scale
                    newScale.set(animation.textureScale, animation.textureScale);
                    plane.textures[0].setScale(newScale);

                    // transition value
                    plane.uniforms.fullscreenTransition.value = animation.transition;

                    // apply parallax to change texture offset
                    applyPlanesParallax(plane);

                    // tween mouse position back to center
                    plane.uniforms.mousePosition.value.set(animation.mouseX, animation.mouseY);
                },
                onComplete: function() {
                    // do not draw all other planes since animation is complete and they are hidden
                    const nonClickedPlanes = curtains.planes.filter(el => el.uuid !== plane.uuid && el.type !== "PingPongPlane");

                    nonClickedPlanes.forEach(el => {
                        el.visible = false;
                    });

                    // display close button
                    galleryState.closeButtonEl.style.display = "inline-block";

                    // clear tween
                    galleryState.openTween = null;
                }
            });
        }
    }




    /*** POST PROCESSING ***/
    // we'll be adding a flowmap rgb shift effect and fxaapass

    // mouse/touch move
    function onMouseMove(e) {
        // velocity is our mouse position minus our mouse last position
        lastMouse.copy(mouse);

        // touch event
        if(e.targetTouches) {
            mouse.set(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
        }
        // mouse event
        else {
            mouse.set(e.clientX, e.clientY);
        }

        // divided by a frame duration (roughly)
        velocity.set((mouse.x - lastMouse.x) / 16, (mouse.y - lastMouse.y) / 16);

        // we should update the velocity
        updateVelocity = true;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onMouseMove, {
        passive: true
    });

    // if we should update the velocity or not
    let updateVelocity = false;


    // creating our PingPongPlane flowmap plane
    // flowmap shaders
    const flowmapVs = `
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

    const flowmapFs = `
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
            //vec4 color = vec4(0.0, 0.0, 0.0, 1.0) * uDissipation;
    
            vec2 mouseTexPos = (uMousePosition + 1.0) * 0.5;
            vec2 cursor = vTextureCoord - mouseTexPos;
            cursor.x *= uAspect;
    
            vec3 stamp = vec3(uVelocity * vec2(1.0, -1.0), 1.0 - pow(1.0 - min(1.0, length(uVelocity)), 3.0));
            float falloff = smoothstep(uFalloff, 0.0, length(cursor)) * uAlpha;
            color.rgb = mix(color.rgb, stamp, vec3(falloff));
            
            //color.rgb = stamp;
    
            // handle premultiply alpha
            color.rgb = color.rgb * color.a;
    
            gl_FragColor = color;
        }
    `;


    const bbox = curtains.getBoundingRect();

    // note the use of half float texture and the custom sampler name used in our fragment shader
    const flowMapParams = {
        sampler: "uFlowMap",
        vertexShader: flowmapVs,
        fragmentShader: flowmapFs,
        watchScroll: false, // position is fixed
        texturesOptions: {
            floatingPoint: "half-float" // use half float texture when possible
        },
        uniforms: {
            mousePosition: {
                name: "uMousePosition",
                type: "2f",
                value: mouse,
            },
            // size of the cursor
            fallOff: {
                name: "uFalloff",
                type: "1f",
                value: bbox.width > bbox.height ? bbox.width / 15000 : bbox.height / 15000,
            },
            // how much the cursor should grow with time
            cursorGrow: {
                name: "uCursorGrow",
                type: "1f",
                value: 1,
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
                value: 0.975,
            },
            // our velocity
            velocity: {
                name: "uVelocity",
                type: "2f",
                value: velocity,
            },
            // window aspect ratio to draw a circle
            aspect: {
                name: "uAspect",
                type: "1f",
                value: bbox.width / bbox.height,
            },
        },
    };



    // our ping pong plane
    const flowMap = new PingPongPlane(curtains, curtains.container, flowMapParams);

    flowMap.onRender(() => {
        // update mouse position
        flowMap.uniforms.mousePosition.value = flowMap.mouseToPlaneCoords(mouse);

        // update velocity
        if(!updateVelocity) {
            velocity.set(curtains.lerp(velocity.x, 0, 0.5), curtains.lerp(velocity.y, 0, 0.5));
        }
        updateVelocity = false;

        flowMap.uniforms.velocity.value = new Vec2(curtains.lerp(velocity.x, 0, 0.1), curtains.lerp(velocity.y, 0, 0.1));
    }).onAfterResize(() => {
        // update our window aspect ratio uniform
        const boundingRect = flowMap.getBoundingRect();
        flowMap.uniforms.aspect.value = boundingRect.width / boundingRect.height;
        flowMap.uniforms.fallOff.value = boundingRect.width > boundingRect.height ? boundingRect.width / 15000 : boundingRect.height / 15000;
    });



    // now use the texture of our ping pong plane in the plane that will actually be displayed
    // displacement shaders
    const displacementVs = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
    
        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;
    
        // custom variables
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        void main() {
    
            gl_Position = vec4(aVertexPosition, 1.0);

          // set the varyings
          vTextureCoord = aTextureCoord;
          vVertexPosition = aVertexPosition;
        }
    `;

    const displacementFs = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
    
        // get our varyings
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        // our render texture
        uniform sampler2D uRenderTexture;
        uniform sampler2D uFlowTexture;
    
        void main() {
            // our flowmap
            vec4 flowTexture = texture2D(uFlowTexture, vTextureCoord);
    
            // distort our image texture based on the flowmap values
            vec2 distortedCoords = vTextureCoord;
            distortedCoords -= flowTexture.xy * 0.1;
    
            // get our final texture based on the displaced coords
            vec4 texture = texture2D(uRenderTexture, distortedCoords);
            
            vec4 rTexture = texture2D(uRenderTexture, distortedCoords + flowTexture.xy * 0.0125);
            vec4 gTexture = texture2D(uRenderTexture, distortedCoords);
            vec4 bTexture = texture2D(uRenderTexture, distortedCoords - flowTexture.xy * 0.0125);
    
            // mix the BW image and the colored one based on our flowmap color values
            float mixValue = clamp((abs(flowTexture.r) + abs(flowTexture.g) + abs(flowTexture.b)) * 1.5, 0.0, 1.0);

            texture = mix(texture, vec4(rTexture.r, gTexture.g, bTexture.b, texture.a), mixValue);
    
            gl_FragColor = texture;
        }
    `;

    const passParams = {
        vertexShader: displacementVs,
        fragmentShader: displacementFs,
        depth: false, // explicitly disable depth for the ripple effect to work
    };


    const shaderPass = new ShaderPass(curtains, passParams);

    // create a texture that will hold our flowmap
    const flowTexture = shaderPass.createTexture({
        sampler: "uFlowTexture",
        floatingPoint: "half-float",
        fromTexture: flowMap.getTexture() // set it based on our PingPongPlane flowmap plane's texture
    });

    // wait for our first pass and the flowmap to be ready
    flowTexture.onSourceUploaded(() => {
        const fxaaPass = new FXAAPass(curtains);
    });
});
