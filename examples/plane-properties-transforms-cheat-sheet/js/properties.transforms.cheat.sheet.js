window.addEventListener("load", function() {

    // set up our WebGL context and append the canvas to our wrapper
    var curtains = new Curtains({
        container: "canvas",
        watchScroll: false, // no need to listen for the scroll in this example
    });

    // handling errors
    curtains.onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
    }).onContextLost(function() {
        // on context lost, try to restore the context
        curtains.restoreContext();
    });

    // get our plane element
    var planeElement = document.getElementsByClassName("plane");


    var vs = `
        precision mediump float;

        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;
        
        // our texture matrix uniform
        uniform mat4 planeTextureMatrix;

        // custom variables
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        void main() {
            gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

            // varyings
            vTextureCoord = (planeTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
            vVertexPosition = aVertexPosition;
        }
    `;

    var fs = `
        precision mediump float;

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        uniform sampler2D planeTexture;

        void main() {
            // draw our texture
            gl_FragColor = texture2D(planeTexture, vTextureCoord);
        }
    `;

    // some basic parameters
    var params = {
        vertexShader: vs,
        fragmentShader: fs,
    };

    // create our plane
    var plane = curtains.addPlane(planeElement[0], params);

    var planeBBoxEl = document.getElementById("plane-bounding-rect");
    var isPlaneDrawn = document.getElementById("is-plane-drawn");

    // if there has been an error during init, simplePlane will be null
    plane && plane.onReady(function() {
        // add the GUI
        addGUI();

    }).onRender(function() {
        // update bounding box size and position
        var planeBBox = plane.getWebGLBoundingRect();

        planeBBoxEl.style.width = (planeBBox.width / curtains.pixelRatio) + (plane.drawCheckMargins.right + plane.drawCheckMargins.left) + "px";
        planeBBoxEl.style.height = (planeBBox.height / curtains.pixelRatio) + (plane.drawCheckMargins.top + plane.drawCheckMargins.bottom) + "px";
        planeBBoxEl.style.top = (planeBBox.top / curtains.pixelRatio) - plane.drawCheckMargins.top + "px";
        planeBBoxEl.style.left = (planeBBox.left / curtains.pixelRatio) - plane.drawCheckMargins.left + "px";

        isPlaneDrawn.innerText = plane.isDrawn();

    });


    function initGUIParams() {
        return {
            values: {
                "Transform origin": {
                    "X": plane.transformOrigin.x,
                    "Y": plane.transformOrigin.y,
                    "Z": plane.transformOrigin.z,
                },

                "Translation": {
                    "X": plane.relativeTranslation.x,
                    "Y": plane.relativeTranslation.y,
                    "Z": plane.relativeTranslation.z,
                },

                "Rotation": {
                    "X": plane.rotation.x,
                    "Y": plane.rotation.y,
                    "Z": plane.rotation.z,
                },

                "Scale": {
                    "X": plane.scale.x,
                    "Y": plane.scale.y,
                },

                "Perspective": {
                    "fov": plane._fov,
                    "near": plane._nearPlane,
                    "far": plane._farPlane,
                },

                "Highlight area used for culling": {
                    "show": true,
                },

                "Drawing properties": {
                    cullFace: plane.cullFace,
                    alwaysDraw: plane.alwaysDraw,
                    visible: plane.visible,
                },

                "drawCheckMargins": {
                    "top": plane.drawCheckMargins.top,
                    "right": plane.drawCheckMargins.right,
                    "bottom": plane.drawCheckMargins.bottom,
                    "left": plane.drawCheckMargins.left,
                },
            },
            params: {
                "Transform origin": {
                    "X": {
                        min: -1,
                        max: 2,
                        step: 0.05,
                        onChange: function(value) {
                            plane.setTransformOrigin(value, plane.transformOrigin.y, plane.transformOrigin.z);
                        },
                    },
                    "Y": {
                        min: -1,
                        max: 2,
                        step: 0.05,
                        onChange: function(value) {
                            plane.setTransformOrigin(plane.transformOrigin.x, value, plane.transformOrigin.z);
                        }
                    },
                    "Z": {
                        min: -1,
                        max: 2,
                        step: 0.05,
                        onChange: function(value) {
                            plane.setTransformOrigin(plane.transformOrigin.x, plane.transformOrigin.y, value);
                        }
                    },
                },

                "Translation": {
                    "X": {
                        min: -1 * curtains.getBoundingRect().width,
                        max: curtains.getBoundingRect().width,
                        step: 20,
                        onChange: function(value) {
                            plane.setRelativePosition(value, plane.relativeTranslation.y, plane.relativeTranslation.z);
                        }
                    },
                    "Y": {
                        min: -1 * curtains.getBoundingRect().height,
                        max: curtains.getBoundingRect().height,
                        step: 20,
                        onChange: function(value) {
                            plane.setRelativePosition(plane.relativeTranslation.x, value, plane.relativeTranslation.z);
                        }
                    },
                    "Z": {
                        min: -1000,
                        max: 1000,
                        step: 20,
                        onChange: function(value) {
                            plane.setRelativePosition(plane.relativeTranslation.x, plane.relativeTranslation.y, value);
                        }
                    },
                },

                "Rotation": {
                    "X": {
                        min: -Math.PI,
                        max: Math.PI,
                        step: 0.05,
                        onChange: function(value) {
                            plane.setRotation(value, plane.rotation.y, plane.rotation.z);
                        }
                    },
                    "Y": {
                        min: -Math.PI,
                        max: Math.PI,
                        step: 0.05,
                        onChange: function(value) {
                            plane.setRotation(plane.rotation.x, value, plane.rotation.z);
                        }
                    },
                    "Z": {
                        min: -Math.PI,
                        max: Math.PI,
                        step: 0.05,
                        onChange: function(value) {
                            plane.setRotation(plane.rotation.x, plane.rotation.y, value);
                        }
                    },
                },

                "Scale": {
                    "X": {
                        min: 0.25,
                        max: 2,
                        step: 0.05,
                        onChange: function(value) {
                            plane.setScale(value, plane.scale.y);
                        }
                    },
                    "Y": {
                        min: 0.25,
                        max: 2,
                        step: 0.05,
                        onChange: function(value) {
                            plane.setScale(plane.scale.x, value);
                        }
                    },
                },

                "Perspective": {
                    "fov": {
                        min: 1,
                        max: 179,
                        step: 1,
                        onChange: function (value) {
                            plane.setPerspective(value, plane._nearPlane, plane._farPlane);
                        }
                    },
                    "near": {
                        min: 0.01,
                        max: 0.1,
                        step: 0.001,
                        onChange: function (value) {
                            plane.setPerspective(plane._fov, value, plane._farPlane);
                        }
                    },
                    "far": {
                        min: 50,
                        max: 300,
                        step: 10,
                        onChange: function (value) {
                            plane.setPerspective(plane._fov, plane._nearPlane, value);
                        }
                    },
                },

                "Highlight area used for culling": {
                    "show": {
                        onChange: function (value) {
                            planeBBoxEl.style.display = value ? "block" : "none";
                        }
                    }
                },

                "Drawing properties": {

                    cullFace: {
                        options: ["back", "front", "none"],
                        onChange: function(value) {
                            plane.cullFace = value;
                        }
                    },

                    alwaysDraw: {
                        onChange: function(value) {
                            plane.alwaysDraw = value;
                        }
                    },

                    visible: {
                        onChange: function(value) {
                            plane.visible = value;
                        }
                    },
                },

                "drawCheckMargins": {
                    "top": {
                        min: 0,
                        max: 200,
                        step: 10,
                        onChange: function(value) {
                            plane.drawCheckMargins.top = value;
                        }
                    },
                    "right": {
                        min: 0,
                        max: 200,
                        step: 10,
                        onChange: function(value) {
                            plane.drawCheckMargins.right = value;
                        }
                    },
                    "bottom": {
                        min: 0,
                        max: 200,
                        step: 10,
                        onChange: function(value) {
                            plane.drawCheckMargins.bottom = value;
                        }
                    },
                    "left": {
                        min: 0,
                        max: 200,
                        step: 10,
                        onChange: function(value) {
                            plane.drawCheckMargins.left = value;
                        }
                    },
                },
            },
        };
    }

    var gui;
    var guiEvents = [];
    function addGUI() {
        var guiParams = initGUIParams();

        gui = new dat.GUI();
        gui.open();

        // iterate through our values
        for(var key in guiParams["values"]) {
            gui.addFolder(key);

            // iterate through our params and pass them to the GUI
            for(var paramKey in guiParams["values"][key]) {
                // use corresponding values and params objects keys
                if(guiParams["params"][key][paramKey].step) {
                    // add min, max and step
                    guiEvents[key + paramKey] = gui.add(guiParams["values"][key], paramKey, guiParams["params"][key][paramKey].min , guiParams["params"][key][paramKey].max).step(guiParams["params"][key][paramKey].step);
                }
                else if(guiParams["params"][key][paramKey].options) {
                    // add select options
                    guiEvents[key + paramKey] = gui.add(guiParams["values"][key], paramKey, guiParams["params"][key][paramKey].options);
                }
                else {
                    // checkboxes
                    guiEvents[key + paramKey] = gui.add(guiParams["values"][key], paramKey);
                }

                // add onchange event
                guiEvents[key + paramKey].onChange(guiParams["params"][key][paramKey].onChange);
            }
        }
    }
});
