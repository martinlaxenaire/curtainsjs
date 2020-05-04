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
        antialias: false, // render targets will disable default antialiasing anyway
        premultipliedAlpha: true, // improves shader pass rendering
    });

    curtains.onRender(function() {
        rotationEffect = lerp(rotationEffect, 0, 0.05);
    }).onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
    }).onContextLost(function() {
        // on context lost, try to restore the context
        curtains.restoreContext();
    });

    // we will keep track of all our planes in an array
    var planes = [];

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
        varying vec2 vTextureMatrixCoord;
    
        void main() {
    
            vec3 vertexPosition = aVertexPosition;
    
            gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);
    
            // varyings
            vVertexPosition = vertexPosition;
            vTextureMatrixCoord = (planeTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
        }
    `;

    var fs = `
        precision mediump float;
    
        varying vec3 vVertexPosition;
        varying vec2 vTextureMatrixCoord;
    
        uniform sampler2D planeTexture;
    
        void main() {
            // just display our texture
            gl_FragColor = texture2D(planeTexture, vTextureMatrixCoord);
        }
    `;

    // add our planes and handle them
    for(var i = 0; i < planeElements.length; i++) {
        var plane = curtains.addPlane(planeElements[i], {
            vertexShader: vs,
            fragmentShader: fs,
        });

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
    var rotationFs = `
        precision mediump float;
    
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        uniform sampler2D uRenderTexture;
    
        uniform float uRotationEffect;
    
        void main() {
            vec2 textCoords = vTextureCoord;
    
            // calculate an effect that spreads from the left-center point
            float rgbEffect = uRotationEffect * distance(textCoords, vec2(0.0, 0.5));
    
            // apply a simple rgb shift based on that effect
            vec4 red = texture2D(uRenderTexture, textCoords + rgbEffect * 0.005);
            vec4 green = texture2D(uRenderTexture, vTextureCoord);
            vec4 blue = texture2D(uRenderTexture, vTextureCoord + rgbEffect * -0.005);
    
            // use green channel alpha as this one does not have any displacement
            gl_FragColor = vec4(red.r, green.g, blue.b, green.a);
        }
    `;

    var shaderPassParams = {
        fragmentShader: rotationFs, // we'll be using the lib default vertex shader
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

    // FXAA pass to add antialiasing
    // taken from https://github.com/spite/Wagner/blob/master/fragment-shaders/fxaa-fs.glsl
    var fxaaFs = `
        precision mediump float;
        
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        uniform sampler2D uRenderTexture;
        
        uniform vec2 uResolution;
        
        #define FXAA_REDUCE_MIN   (1.0/128.0)
        #define FXAA_REDUCE_MUL   (1.0/8.0)
        #define FXAA_SPAN_MAX     8.0
        
        void main() {
            vec2 res = 1.0 / uResolution;
        
            vec3 rgbNW = texture2D(uRenderTexture, (vTextureCoord.xy + vec2(-1.0, -1.0) * res)).xyz;
            vec3 rgbNE = texture2D(uRenderTexture, (vTextureCoord.xy + vec2(1.0, -1.0) * res)).xyz;
            vec3 rgbSW = texture2D(uRenderTexture, (vTextureCoord.xy + vec2(-1.0, 1.0) * res)).xyz;
            vec3 rgbSE = texture2D(uRenderTexture, (vTextureCoord.xy + vec2(1.0, 1.0) * res)).xyz;
            vec4 rgbaM = texture2D(uRenderTexture, vTextureCoord.xy * res);
            vec3 rgbM = rgbaM.xyz;
            vec3 luma = vec3(0.299, 0.587, 0.114);
        
            float lumaNW = dot(rgbNW, luma);
            float lumaNE = dot(rgbNE, luma);
            float lumaSW = dot(rgbSW, luma);
            float lumaSE = dot(rgbSE, luma);
            float lumaM  = dot(rgbM,  luma);
            float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
            float lumaMax = max(lumaM, max(max(lumaNW, lumaNE) , max(lumaSW, lumaSE)));
        
            vec2 dir;
            dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
            dir.y = ((lumaNW + lumaSW) - (lumaNE + lumaSE));
        
            float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);
        
            float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
            dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX),
                  max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),
                        dir * rcpDirMin)) * res;
            vec4 rgbA = (1.0/2.0) * (
            texture2D(uRenderTexture, vTextureCoord.xy + dir * (1.0/3.0 - 0.5)) +
            texture2D(uRenderTexture, vTextureCoord.xy + dir * (2.0/3.0 - 0.5)));
            vec4 rgbB = rgbA * (1.0/2.0) + (1.0/4.0) * (
            texture2D(uRenderTexture, vTextureCoord.xy + dir * (0.0/3.0 - 0.5)) +
            texture2D(uRenderTexture, vTextureCoord.xy + dir * (3.0/3.0 - 0.5)));
            float lumaB = dot(rgbB, vec4(luma, 0.0));
        
            if ((lumaB < lumaMin) || (lumaB > lumaMax)) {
                gl_FragColor = rgbA;
            } else {
                gl_FragColor = rgbB;
            }
        }
    `;

    // get our canvas size to pass it as a resolution uniform
    var curtainsBoundingRect = curtains.getBoundingRect();

    var fxaaPassParams = {
        fragmentShader: fxaaFs, // we'll be using the lib default vertex shader
        uniforms: {
            resolution: {
                name: "uResolution",
                type: "2f",
                value: [curtainsBoundingRect.width, curtainsBoundingRect.height],
            },
        },
    };

    var fxaaPass = curtains.addShaderPass(fxaaPassParams);
    if(fxaaPass) {
        fxaaPass.onAfterResize(function() {
            // update the resolution uniform
            curtainsBoundingRect = curtains.getBoundingRect();
            fxaaPass.uniforms.resolution.value = [curtainsBoundingRect.width, curtainsBoundingRect.height];
        });
    }
});
