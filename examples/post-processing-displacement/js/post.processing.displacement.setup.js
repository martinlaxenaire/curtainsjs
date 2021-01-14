import {Curtains, Plane, ShaderPass} from '../../../src/index.mjs';

window.addEventListener("load", () => {
    // set up our WebGL context and append the canvas to our wrapper
    const curtains = new Curtains({
        container: "canvas",
        antialias: false, // render targets will disable default antialiasing anyway
        pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
    });

    curtains.onRender(() => {
        // update our planes deformation
        // increase/decrease the effect
        planesDeformations = curtains.lerp(planesDeformations, 0, 0.1);
    }).onScroll(() => {
        // get scroll deltas to apply the effect on scroll
        const delta = curtains.getScrollDeltas();

        // invert value for the effect
        delta.y = -delta.y;

        // threshold
        if(delta.y > 60) {
            delta.y = 60;
        }
        else if(delta.y < -60) {
            delta.y = -60;
        }

        if(Math.abs(delta.y) > Math.abs(planesDeformations)) {
            planesDeformations = curtains.lerp(planesDeformations, delta.y, 0.5);
        }
    }).onError(() => {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains", "planes-loaded");
    }).onContextLost(() => {
        // on context lost, try to restore the context
        curtains.restoreContext();
    });

    // we will keep track of all our planes in an array
    const planes = [];
    let planesDeformations = 0;

    // get our planes elements
    let planeElements = document.getElementsByClassName("plane");


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
    
        uniform float uPlaneDeformation;
    
        void main() {
    
            vec3 vertexPosition = aVertexPosition;
    
            // cool effect on scroll
            vertexPosition.y += sin(((vertexPosition.x + 1.0) / 2.0) * 3.141592) * (sin(uPlaneDeformation / 90.0));
    
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
    
        void main() {
            // just display our texture
            gl_FragColor = texture2D(planeTexture, vTextureCoord);
        }
    `;

    // all planes will have the same parameters
    const params = {
        vertexShader: vs,
        fragmentShader: fs,
        widthSegments: 10,
        heightSegments: 10,
        drawCheckMargins: {
            top: 100,
            right: 0,
            bottom: 100,
            left: 0,
        },
        uniforms: {
            planeDeformation: {
                name: "uPlaneDeformation",
                type: "1f",
                value: 0,
            },
        }
    };

    // add our planes and handle them
    for(let i = 0; i < planeElements.length; i++) {
        //planes.push(curtains.addPlane(planeElements[i], params));
        planes.push(new Plane(curtains, planeElements[i], params));

        handlePlanes(i);
    }


    // handle all the planes
    function handlePlanes(index) {
        const plane = planes[index];

        // check if our plane is defined and use it
        plane.onError(() => {
            console.log("plane error", plane);
        }).onReady(() => {
            // once everything is ready, display everything
            if(index === planes.length - 1) {
                document.body.classList.add("planes-loaded");
            }
        }).onRender(() => {
            // update the uniform
            plane.uniforms.planeDeformation.value = planesDeformations;
        });
    }

    // this will simulate an ajax lazy load call
    // additionnalPlanes string could be the response of our AJAX call
    document.getElementById("add-more-planes").addEventListener("click", function() {
        const additionnalPlanes = '<div class="plane-wrapper"><span class="plane-title">Title ' + (planes.length + 1) + '</span><div class="plane-inner"><div class="landscape-wrapper"><div class="landscape-inner"><div class="plane"><img src="../medias/plane-small-texture-1.jpg" crossorigin="" data-sampler="planeTexture" /></div></div></div></div></div><div class="plane-wrapper"><span class="plane-title">Title ' + (planes.length + 2) + '</span><div class="plane-inner"><div class="landscape-wrapper"><div class="landscape-inner"><div class="plane"><img src="../medias/plane-small-texture-2.jpg" crossorigin="" data-sampler="planeTexture" /></div></div></div></div></div><div class="plane-wrapper"><span class="plane-title">Title ' + (planes.length + 3) + '</span><div class="plane-inner"><div class="landscape-wrapper"><div class="landscape-inner"><div class="plane"><img src="../medias/plane-small-texture-3.jpg" crossorigin="" data-sampler="planeTexture" /></div></div></div></div></div><div class="plane-wrapper"><span class="plane-title">Title ' + (planes.length + 4) + '</span><div class="plane-inner"><div class="landscape-wrapper"><div class="landscape-inner"><div class="plane"><img src="../medias/plane-small-texture-4.jpg" crossorigin="" data-sampler="planeTexture" /></div></div></div></div></div>';

        // append the response
        document.getElementById("planes").insertAdjacentHTML("beforeend", additionnalPlanes);

        // reselect our plane elements
        planeElements = document.getElementsByClassName("plane");

        // we need a timeout because insertAdjacentHTML could take some time to append the content
        setTimeout(() => {
            // we will create the planes that don't already exist
            // basically the same thing as above
            for(let i = planes.length; i < planeElements.length; i++) {

                planes.push(new Plane(curtains, planeElements[i], params));

                handlePlanes(i);

                // 30 planes are enough, right ?
                if(planes.length >= 28) {
                    document.getElementById("add-more-planes").style.display = "none";
                }
            }
        }, 50);

    });


    // post processing
    const shaderPassFs = `
        precision mediump float;
    
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
    
        uniform sampler2D uRenderTexture;
        uniform sampler2D displacementTexture;
    
        uniform float uDisplacement;
    
        void main( void ) {
            vec2 textureCoords = vTextureCoord;
            vec4 displacement = texture2D(displacementTexture, textureCoords);
    
            // displace along Y axis
            textureCoords.y += (sin(displacement.r) / 5.0) * uDisplacement;
            
            gl_FragColor = texture2D(uRenderTexture, textureCoords);
        }
    `;


    const shaderPassParams = {
        fragmentShader: shaderPassFs, // we'll be using the lib default vertex shader
        uniforms: {
            displacement: {
                name: "uDisplacement",
                type: "1f",
                value: 0,
            },
        },

        texturesOptions: {
            anisotropy: 10,
        }
    };

    const shaderPass = new ShaderPass(curtains, shaderPassParams);

    // we will need to load a new image
    const image = new Image();
    image.src = "../medias/displacement.jpg";
    // set its data-sampler attribute to use in fragment shader
    image.setAttribute("data-sampler", "displacementTexture");

    // if our shader pass has been successfully created
    if(shaderPass) {
        // load our displacement image
        shaderPass.loader.loadImage(image);
        shaderPass.onLoading((texture) => {
            console.log("shader pass image has been loaded and texture has been created:", texture);
        }).onReady(() => {
            console.log("shader pass is ready");
        }).onRender(() => {
            // update the uniforms
            shaderPass.uniforms.displacement.value = planesDeformations / 60;
        }).onError(() => {
            console.log('shader pass error');
        });
    }
});
