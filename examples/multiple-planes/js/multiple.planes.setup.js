window.onload = function(){
    // our canvas container
    var canvasContainer = document.getElementById("canvas");

    // we will keep track of the scroll
    var scrollValue = 0;
    var lastScrollValue = 0;

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains("canvas");

    // we will keep track of all our planes in an array
    var planes = [];
    var planesDeformations = [];

    // get our planes elements
    var planeElements = document.getElementsByClassName("plane");

    // all planes will have the same parameters
    // we don't need to specifiate vertexShaderID and fragmentShaderID because we already passed it via the data attributes of the plane HTML element
    var params = {
        widthSegments: 10,
        heightSegments: 10,
        imageCover: false, // we are using the padding-bottom hack to set our plane HTML element size so it will fit our images aspect ratio
        uniforms: {
            planeDeformation: {
                name: "uPlaneDeformation",
                type: "1f",
                value: 0,
            },
        }
    }

    // add our planes and handle them
    for(var i = 0; i < planeElements.length; i++) {
        planes.push(webGLCurtain.addPlane(planeElements[i], params));
        planesDeformations.push(0);

        handlePlanes(i);
    }

    // listen to scroll
    window.addEventListener("scroll", function(e) {
        lastScrollValue = scrollValue;
        scrollValue = window.pageYOffset;
    });


    // handle all the planes
    function handlePlanes(index) {
        var plane = planes[index];
        plane.onReady(function() {
            // once everything is ready, display everything
            if(index == planes.length - 1) {
                document.body.classList.add("planes-loaded");
            }

            // listen to scroll to update our planeDeformations values
            // we don't really need an array of planeDeformations because they will always be the same here
            // but you may want to have different values for each plane
            window.addEventListener("scroll", function(e) {
                var delta = scrollValue - lastScrollValue;
                // threshold
                if(delta > 60) {
                    delta = 60;
                }
                else if(delta < -60) {
                    delta = -60;
                }
                // if delta is bigger, update
                if(Math.abs(delta) > Math.abs(planesDeformations[index])) {
                    planesDeformations[index] = delta;
                }
            });
        }).onRender(function() {
            // increase/decrease our scroll effect
            if(planesDeformations[index] >= 0) {
                planesDeformations[index] = Math.max(0, planesDeformations[index] - 1);
            }
            else {
                planesDeformations[index] = Math.min(0, planesDeformations[index] + 1);
            }
            // update the uniform
            plane.uniforms.planeDeformation.value = planesDeformations[index];
        });
    }


    // this will simulate an ajax lazy load call
    // additionnalPlanes string could be the response of our AJAX call
    document.getElementById("add-more-planes").addEventListener("click", function() {
        var additionnalPlanes = '<div class="plane-wrapper"><span class="plane-title">Title ' + (planes.length + 1) + '</span><div class="plane-inner"><div class="landscape-wrapper"><div class="landscape-inner"><div class="plane" data-vs-id="multiple-planes-vs" data-fs-id="multiple-planes-fs"><img src="images/plane-texture-1.jpg" data-sampler="planeTexture" /></div></div></div></div></div><div class="plane-wrapper"><span class="plane-title">Title ' + (planes.length + 2) + '</span><div class="plane-inner"><div class="landscape-wrapper"><div class="landscape-inner"><div class="plane" data-vs-id="multiple-planes-vs" data-fs-id="multiple-planes-fs"><img src="images/plane-texture-2.jpg" data-sampler="planeTexture" /></div></div></div></div></div><div class="plane-wrapper"><span class="plane-title">Title ' + (planes.length + 3) + '</span><div class="plane-inner"><div class="landscape-wrapper"><div class="landscape-inner"><div class="plane" data-vs-id="multiple-planes-vs" data-fs-id="multiple-planes-fs"><img src="images/plane-texture-3.jpg" data-sampler="planeTexture" /></div></div></div></div></div><div class="plane-wrapper"><span class="plane-title">Title ' + (planes.length + 4) + '</span><div class="plane-inner"><div class="landscape-wrapper"><div class="landscape-inner"><div class="plane" data-vs-id="multiple-planes-vs" data-fs-id="multiple-planes-fs"><img src="images/plane-texture-4.jpg" data-sampler="planeTexture" /></div></div></div></div></div>';

        // append the response
        document.getElementById("planes").insertAdjacentHTML("beforeend", additionnalPlanes);

        // reselect our plane elements
        planeElements = document.getElementsByClassName("plane");

        // we need a timeout because insertAdjacentHTML could take some time to append the content
        setTimeout(function() {
            // we will create the planes that don't already exist
            // basically the same thing as above
            for(var i = planes.length; i < planeElements.length; i++) {

                planes.push(webGLCurtain.addPlane(planeElements[i], params));
                planesDeformations.push(0);

                handlePlanes(i);

                // 30 planes are enough, right ?
                if(planes.length >= 28) {
                    document.getElementById("add-more-planes").style.display = "none";
                }
            }
        }, 50);

    });
}
