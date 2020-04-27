window.addEventListener("load", function() {

    function lerp (start, end, amt){
        return (1 - amt) * start + amt * end;
    }

    // keep track of the number of plane we're currently drawing
    var planeDrawn = 0;
    var debugElement = document.getElementById("debug-value");

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains({
        container: "canvas",
        antialias: false, // render targets will disable default antialiasing anyway
    });

    webGLCurtain.onRender(function() {
        // update our planes deformation
        // increase/decrease the effect
        scrollEffect = lerp(scrollEffect, 0, 0.05);

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
            scrollEffect = lerp(scrollEffect, delta.y, 0.5);
        }

        // update the plane positions during scroll
        for(var i = 0; i < planes.length; i++) {
            // apply additional translation, scale and rotation
            applyPlanesParallax(i);
        }

    }).onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains", "planes-loaded");
    }).onContextLost(function() {
        // on context lost, try to restore the context
        webGLCurtain.restoreContext();
    });

    // we will keep track of all our planes in an array
    var planes = [];
    var scrollEffect = 0;

    // get our planes elements
    var planeElements = document.getElementsByClassName("plane");

    var vs = `
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
    
        void main() { 
            gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
    
            // varyings
            vVertexPosition = aVertexPosition;
            vTextureCoord = (planeTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
        }
    `;

    var fs = `
        precision mediump float;
    
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        uniform sampler2D planeTexture;
    
        void main() {
            // just display our texture
            gl_FragColor = texture2D(planeTexture, vTextureCoord);
        }
    `;

    // add our planes and handle them
    for(var i = 0; i < planeElements.length; i++) {
        var plane = webGLCurtain.addPlane(planeElements[i], {
            vertexShader: vs,
            fragmentShader: fs,
        }); // we don't need any params here

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
            if(index === planes.length - 1) {
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
    var firstFs = `
        precision mediump float;
    
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        uniform sampler2D renderTexture;
    
        uniform float uScrollEffect;
    
        void main() {
            // invert colors
            vec4 scene = texture2D(renderTexture, vTextureCoord);
            vec4 invertedColors = texture2D(renderTexture, vTextureCoord);
    
            if(
                vTextureCoord.x > 0.625 && vTextureCoord.x < 0.875 && vTextureCoord.y > 0.625 && vTextureCoord.y < 0.875
                || vTextureCoord.x > 0.125 && vTextureCoord.x < 0.375 && vTextureCoord.y > 0.125 && vTextureCoord.y < 0.375
            ) {
                invertedColors.rgb = vec3(1.0 - invertedColors.rgb);
            }
    
            vec4 finalColor = mix(scene, invertedColors, abs(uScrollEffect) / 60.0);
    
            gl_FragColor = finalColor;
        }
    `;

    var firstShaderPassParams = {
        fragmentShader: firstFs, // we'll be using the lib default vertex shader
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


    var secondFs = `
        #ifdef GL_ES
        precision mediump float;
        #endif
    
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        uniform sampler2D renderTexture;
    
        uniform float uScrollEffect;
    
        void main() {
            vec2 textureCoords = vTextureCoord;
            vec2 texCenter = vec2(0.5, 0.5);
    
            // distort around scene center
            textureCoords += vec2(texCenter - textureCoords).xy * sin(distance(texCenter, textureCoords)) * uScrollEffect / 175.0;
    
            gl_FragColor = texture2D(renderTexture, textureCoords);
        }
    `;

    var secondShaderPassParams = {
        fragmentShader: secondFs, // we'll be using the lib default vertex shader
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
