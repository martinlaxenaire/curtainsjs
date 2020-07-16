import {Curtains, Plane} from '../../../src/index.mjs';

window.addEventListener("load", () => {

    // set up our WebGL context and append the canvas to our wrapper
    const curtains = new Curtains({
        container: "canvas",
        pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
    });

    curtains.onRender(() => {
        // update our planes deformation
        // increase/decrease the effect
        planesDeformations = curtains.lerp(planesDeformations, 0, 0.075);
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
        shareProgram: true, // share planes program to improve plane creation speed
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
        planes.push(new Plane(curtains, planeElements[i], params));

        handlePlanes(i);
    }

    // handle all the planes
    function handlePlanes(index) {
        const plane = planes[index];

        // check if our plane is defined and use it
        plane.onReady(() => {
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
    document.getElementById("add-more-planes").addEventListener("click", () => {

        const additionnalPlanes = '<div class="plane-wrapper"><span class="plane-title">Title ' + (planes.length + 1) + '</span><div class="plane-inner"><div class="landscape-wrapper"><div class="landscape-inner"><div class="plane"><img src="../medias/plane-small-texture-1.jpg" data-sampler="planeTexture" /></div></div></div></div></div><div class="plane-wrapper"><span class="plane-title">Title ' + (planes.length + 2) + '</span><div class="plane-inner"><div class="landscape-wrapper"><div class="landscape-inner"><div class="plane"><img src="../medias/plane-small-texture-2.jpg" data-sampler="planeTexture" /></div></div></div></div></div><div class="plane-wrapper"><span class="plane-title">Title ' + (planes.length + 3) + '</span><div class="plane-inner"><div class="landscape-wrapper"><div class="landscape-inner"><div class="plane"><img src="../medias/plane-small-texture-3.jpg" data-sampler="planeTexture" /></div></div></div></div></div><div class="plane-wrapper"><span class="plane-title">Title ' + (planes.length + 4) + '</span><div class="plane-inner"><div class="landscape-wrapper"><div class="landscape-inner"><div class="plane"><img src="../medias/plane-small-texture-4.jpg" data-sampler="planeTexture" /></div></div></div></div></div>';

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
});
