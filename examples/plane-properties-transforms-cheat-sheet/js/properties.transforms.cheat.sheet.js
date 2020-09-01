import {Curtains, Plane, Vec2, Vec3} from '../../../src/index.mjs';

window.addEventListener("load", () => {

    // set up our WebGL context and append the canvas to our wrapper
    const curtains = new Curtains({
        container: "canvas",
        watchScroll: false, // no need to listen for the scroll in this example
        pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
    });

    // handling errors
    curtains.onError(() => {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains");
    }).onContextLost(() => {
        // on context lost, try to restore the context
        curtains.restoreContext();
    });

    // get our plane element
    const planeElement = document.getElementsByClassName("plane");


    const vs = `
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

    const fs = `
        precision mediump float;

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        uniform sampler2D planeTexture;

        void main() {
            // draw our texture
            gl_FragColor = texture2D(planeTexture, vTextureCoord);
        }
    `;

    // plane parameters
    const params = {
        vertexShader: vs,
        fragmentShader: fs,
        texturesOptions: {
            anisotropy: 16, // set anisotropy to a max so the texture isn't blurred when the plane's rotated
        }
    };

    // create our plane
    const plane = new Plane(curtains, planeElement[0], params);

    const planeBBoxEl = document.getElementById("plane-bounding-rect");
    const isPlaneDrawn = document.getElementById("is-plane-drawn");


    function updatePlaneBBoxViewer() {
        // wait for next render to update the bounding rect sizes
        curtains.nextRender(() => {
            // update of bounding box size and position
            const planeBBox = plane.getWebGLBoundingRect();

            planeBBoxEl.style.width = (planeBBox.width / curtains.pixelRatio) + (plane.drawCheckMargins.right + plane.drawCheckMargins.left) + "px";
            planeBBoxEl.style.height = (planeBBox.height / curtains.pixelRatio) + (plane.drawCheckMargins.top + plane.drawCheckMargins.bottom) + "px";
            planeBBoxEl.style.top = (planeBBox.top / curtains.pixelRatio) - plane.drawCheckMargins.top + "px";
            planeBBoxEl.style.left = (planeBBox.left / curtains.pixelRatio) - plane.drawCheckMargins.left + "px";

            isPlaneDrawn.innerText = plane.isDrawn();
        });
    }

    // when our plane is ready, add the GUI and update its BBox viewer
    plane.onReady(() => {
        // add the GUI
        addGUI();

        updatePlaneBBoxViewer();
    }).onAfterResize(() => {
        updatePlaneBBoxViewer();
    });

    // once everything is ready, stop drawing the scene
    curtains.disableDrawing();

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
                    "fov": plane.camera.fov,
                    "near": plane.camera.near,
                    "far": plane.camera.far,
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
                        onChange: (value) => {
                            plane.setTransformOrigin(new Vec3(value, plane.transformOrigin.y, plane.transformOrigin.z));
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        },
                    },
                    "Y": {
                        min: -1,
                        max: 2,
                        step: 0.05,
                        onChange: (value) => {
                            plane.setTransformOrigin(new Vec3(plane.transformOrigin.x, value, plane.transformOrigin.z));
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                    "Z": {
                        min: -1,
                        max: 2,
                        step: 0.05,
                        onChange: (value) => {
                            plane.setTransformOrigin(new Vec3(plane.transformOrigin.x, plane.transformOrigin.y, value));
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                },

                "Translation": {
                    "X": {
                        min: -1 * curtains.getBoundingRect().width,
                        max: curtains.getBoundingRect().width,
                        step: 20,
                        onChange: (value) => {
                            plane.setRelativeTranslation(new Vec3(value, plane.relativeTranslation.y, plane.relativeTranslation.z));
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                    "Y": {
                        min: -1 * curtains.getBoundingRect().height,
                        max: curtains.getBoundingRect().height,
                        step: 20,
                        onChange: (value) => {
                            plane.setRelativeTranslation(new Vec3(plane.relativeTranslation.x, value, plane.relativeTranslation.z));
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                    "Z": {
                        min: -1000,
                        max: 1000,
                        step: 20,
                        onChange: (value) => {
                            plane.setRelativeTranslation(new Vec3(plane.relativeTranslation.x, plane.relativeTranslation.y, value));
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                },

                "Rotation": {
                    "X": {
                        min: -Math.PI,
                        max: Math.PI,
                        step: 0.05,
                        onChange: (value) => {
                            plane.setRotation(new Vec3(value, plane.rotation.y, plane.rotation.z));
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                    "Y": {
                        min: -Math.PI,
                        max: Math.PI,
                        step: 0.05,
                        onChange: (value) => {
                            plane.setRotation(new Vec3(plane.rotation.x, value, plane.rotation.z));
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                    "Z": {
                        min: -Math.PI,
                        max: Math.PI,
                        step: 0.05,
                        onChange: (value) => {
                            plane.setRotation(new Vec3(plane.rotation.x, plane.rotation.y, value));
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                },

                "Scale": {
                    "X": {
                        min: 0.25,
                        max: 2,
                        step: 0.05,
                        onChange: (value) => {
                            plane.setScale(new Vec2(value, plane.scale.y));
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                    "Y": {
                        min: 0.25,
                        max: 2,
                        step: 0.05,
                        onChange: (value) => {
                            plane.setScale(new Vec2(plane.scale.x, value));
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                },

                "Perspective": {
                    "fov": {
                        min: 1,
                        max: 179,
                        step: 1,
                        onChange: (value) => {
                            plane.setPerspective(value, plane.camera.near, plane.camera.far);
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                    "near": {
                        min: 0.01,
                        max: 0.1,
                        step: 0.001,
                        onChange: (value) => {
                            plane.setPerspective(plane.camera.fov, value, plane.camera.far);
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                    "far": {
                        min: 50,
                        max: 300,
                        step: 10,
                        onChange: (value) => {
                            plane.setPerspective(plane.camera.fov, plane.camera.near, value);
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },
                },

                "Highlight area used for culling": {
                    "show": {
                        onChange: (value) => {
                            planeBBoxEl.style.display = value ? "block" : "none";
                        }
                    }
                },

                "Drawing properties": {

                    cullFace: {
                        options: ["back", "front", "none"],
                        onChange: (value) => {
                            plane.cullFace = value;
                            curtains.needRender();
                        }
                    },

                    alwaysDraw: {
                        onChange: (value) => {
                            plane.alwaysDraw = value;
                            curtains.needRender();
                            updatePlaneBBoxViewer();
                        }
                    },

                    visible: {
                        onChange: (value) => {
                            plane.visible = value;
                            curtains.needRender();
                        }
                    },
                },

                "drawCheckMargins": {
                    "top": {
                        min: 0,
                        max: 200,
                        step: 10,
                        onChange: (value) => {
                            plane.drawCheckMargins.top = value;
                            updatePlaneBBoxViewer();
                        }
                    },
                    "right": {
                        min: 0,
                        max: 200,
                        step: 10,
                        onChange: (value) => {
                            plane.drawCheckMargins.right = value;
                            updatePlaneBBoxViewer();
                        }
                    },
                    "bottom": {
                        min: 0,
                        max: 200,
                        step: 10,
                        onChange: (value) => {
                            plane.drawCheckMargins.bottom = value;
                            updatePlaneBBoxViewer();
                        }
                    },
                    "left": {
                        min: 0,
                        max: 200,
                        step: 10,
                        onChange: (value) => {
                            plane.drawCheckMargins.left = value;
                            updatePlaneBBoxViewer();
                        }
                    },
                },
            },
        };
    }

    let gui;
    const guiEvents = [];
    function addGUI() {
        const guiParams = initGUIParams();

        gui = new dat.GUI();
        gui.open();

        // iterate through our values
        for(const key in guiParams["values"]) {
            gui.addFolder(key);

            // iterate through our params and pass them to the GUI
            for(const paramKey in guiParams["values"][key]) {
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
