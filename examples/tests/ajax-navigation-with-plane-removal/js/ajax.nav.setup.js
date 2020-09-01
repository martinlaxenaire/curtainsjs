import {Curtains, Plane, TextureLoader} from '../../../../src/index.mjs';

// set up our WebGL context and append the canvas to our wrapper
const curtains = new Curtains({
    container: "canvas",
    pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
});

let textures = [];

curtains.onError(() => {
    // we will add a class to the document body to display original images
    document.body.classList.add("no-curtains", "planes-loaded");
}).onContextLost(() => {
    // on context lost, try to restore the context
    curtains.restoreContext();

}).onContextRestored(() => {
    // since we have some textures that do not have any parent
    // they won't be automatically restored
    // so restore them after everything else has been restored
    for(let i = 0; i < textures.length; i++) {
        if(!textures[i].hasParent()) {
            textures[i]._restoreContext();
        }
    }
});

function preloadTextures() {
    let percentLoaded = 0;
    let images = [
        "../../medias/plane-small-texture-1.jpg",
        "../../medias/plane-small-texture-2.jpg",
        "../../medias/plane-small-texture-3.jpg",
        "../../medias/plane-small-texture-4.jpg",
    ];

    const loader = new TextureLoader(curtains);
    for(let i = 0; i < images.length; i++) {
        const image = new Image();
        image.src = images[i];

        loader.loadImage(image, {
            wrapS: curtains.gl.REPEAT,
            wrapT: curtains.gl.REPEAT,
            anisotropy: 16,
        }, (texture) => {

            textures.push(texture);


            texture.onSourceLoaded(() => {
                //console.log("source loaded!")
            }).onSourceUploaded(() => {
                //console.log("texture uploaded here");

                percentLoaded++;
                console.log("percent loaded", percentLoaded / images.length);
            });

            /*if(texture.uuid.indexOf("A") !== -1) {
                console.log("set anisotropy");
                texture.setAnisotropy(16);
            }*/

            //texture.setWrapS(curtains.gl.REPEAT);
            //texture.setWrapT(curtains.gl.REPEAT);

            //console.log(texture.uuid, texture);

            /*texture.onSourceUploaded(() => {
                console.log("texture uploaded");
                //texture.setWrapS(curtains.gl.REPEAT);
                //texture.setWrapT(curtains.gl.REPEAT);
            })*/
        }, (image, error) => {
            console.warn("there has been an error", error, " while loading this image", image);
        });
    }
}

preloadTextures();


window.addEventListener("load", () => {
    console.log("load event");

    // resize our curtainsjs container because we instanced it before any dom load event
    curtains.resize();


    setTimeout(() => {
        curtains.renderer.extensions["WEBGL_lose_context"].loseContext();
    }, 3000);


    // we will keep track of all our planes in an array
    let planes = [];
    let planeElements = [];

    const vs = `
        precision mediump float;

        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;

        // texture matrix
        uniform mat4 uTextureMatrix0;

        // custom variables
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        uniform float uTime;

        void main() {
            vec3 vertexPosition = aVertexPosition;

            float distanceFromCenter = distance(vec2(vertexPosition.x, vertexPosition.y), vec2(0.5, vertexPosition.x));
            vertexPosition.z += 0.05 * cos(5.0 * (distanceFromCenter - (uTime / 100.0)));

            // set positions
            gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);

            // varyings
            //vTextureCoord = (uTextureMatrix0 * vec4(aTextureCoord, 0.0, 1.0)).xy;
            vTextureCoord = aTextureCoord;
            vVertexPosition = vertexPosition;
        }
    `;

    const failFs = `
        precision mediump float;

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        uniform sampler2D uSampler0;
        uniform vec2 uScale;

        void main( void ) {
            vec2 texCoords = vTextureCoord * uScale;
            // our texture
            vec4 finalColor = texture2D(uSampler0, texCoords)

            gl_FragColor = finalColor;
        }
    `;

    const fs = `
        precision mediump float;

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        uniform sampler2D uSampler0;
        uniform vec2 uScale;

        void main( void ) {
            vec2 texCoords = vTextureCoord * uScale;
            // our texture
            vec4 finalColor = texture2D(uSampler0, texCoords);

            gl_FragColor = finalColor;
        }
    `;

    // all planes will have the same parameters
    const params = {
        vertexShader: vs, // our vertex shader
        fragmentShader: fs, // our framgent shader
        widthSegments: 30,
        heightSegments: 20,

        autoloadSources: false, // TODO test

        fov: 35,
        uniforms: {
            time: {
                name: "uTime", // uniform name that will be passed to our shaders
                type: "1f", // this means our uniform is a float
                value: 0,
            },

            scale: {
                name: "uScale", // uniform name that will be passed to our shaders
                type: "2f", // this means our uniform is a float
                value: [2, 2],
            }
        }
    };


    // handle all the planes
    function handlePlanes(index) {
        const plane = planes[index];

        // set the right texture
        const planeImage = plane.htmlElement.querySelector("img");
        const planeTexture = textures.find((element) => element.source && element.source.src === planeImage.src);

        if(planeTexture) {
            plane.addTexture(planeTexture);
        }

        plane.onReady(() => {

            if(index === planeElements.length - 1) {
                console.log("all planes are ready");
            }

        }).onRender(() => {
            // increment our time uniform
            plane.uniforms.time.value++;
        }).onError(() => {
            console.log("plane error");
            plane.htmlElement.classList.add("no-plane");
        });
    }


    function addPlanes() {
        planeElements = document.getElementsByClassName("plane");

        // if we got planes to add
        if(planeElements.length > 0) {

            for(let i = 0; i < planeElements.length; i++) {
                /*if(i === 3) {
                    params.fragmentShader = failFs;
                    //params.widthSegments = 20;
                    //params.alwaysDraw = true;
                }
                else {
                    params.fragmentShader = fs;
                    //params.widthSegments = 30;
                    //params.alwaysDraw = false;
                }*/

                // add the plane to our array
                //var plane = curtains.addPlane(planeElements[i], params);
                const plane = new Plane(curtains, planeElements[i], params);
                // only push the plane if it exists
                planes.push(plane);

                handlePlanes(i);
            }
        }
    }

    function removePlanes() {
        // remove all planes
        for(let i = 0; i < planes.length; i++) {
            //curtains.removePlane(planes[i]);
            planes[i].remove();
        }

        // reset our arrays
        planes = [];
    }

    addPlanes();


    // a flag to know if we are currently in a transition between pages
    let isTransitioning = false;

    // handle all the navigation process
    function handleNavigation() {

        // button navigation
        const navButtons = document.getElementsByClassName("navigation-button");

        function buttonNavigation(e) {
            // get button index
            let index;
            for(let i = 0; i < navButtons.length; i++) {
                navButtons[i].classList.remove("active");
                if(this === navButtons[i]) {
                    index = i;
                    navButtons[i].classList.add("active");
                }
            }

            // ajax call
            handleAjaxCall(navButtons[index].getAttribute("href"), appendContent);

            // prevent link default behaviour
            e.preventDefault();
        }

        // listen to the navigation buttons click event
        for(let i = 0; i < navButtons.length; i++) {
            navButtons[i].addEventListener("click", buttonNavigation, false);
        }



        // this function will execute our AJAX call and run a callback function
        function handleAjaxCall(href, callback) {
            // set our transition flag
            isTransitioning = true;

            // handling ajax
            const xhr = new XMLHttpRequest();

            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 0)) {

                    const response = xhr.response;
                    callback(href, response);
                }
            };

            xhr.open("GET", href, true);
            xhr.setRequestHeader("Accept", "text/html");
            xhr.send(null);

            // start page transition
            document.getElementById("page-wrap").classList.add("page-transition");
        }

        function appendContent(href, response) {
            // append our response to a div
            const tempHtml = document.createElement('div');
            tempHtml.insertAdjacentHTML("beforeend", response);

            // let the css animation run
            setTimeout(function() {

                removePlanes();

                let content;
                // manual filtering to get our content
                for(let i = 0; i < tempHtml.children.length; i++) {
                    if(tempHtml.children[i].getAttribute("id") === "page-wrap") {

                        for(let j = 0; j < tempHtml.children[i].children.length; j++) {
                            if(tempHtml.children[i].children[j].getAttribute("id") === "content") {
                                content = tempHtml.children[i].children[j];
                            }
                        }
                    }
                }

                // empty our content div and append our new content
                document.getElementById("content").innerHTML = "";
                document.getElementById("content").appendChild(content.children[0]);

                document.getElementById("page-wrap").classList.remove("page-transition");

                addPlanes();

                // reset our transition flag
                isTransitioning = false;

                history.pushState(null, "", href);
            }, 750);
        }
    }

    handleNavigation();
});
