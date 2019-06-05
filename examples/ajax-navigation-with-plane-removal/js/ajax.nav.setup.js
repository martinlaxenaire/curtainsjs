function archiveNavigation() {
    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains("canvas");

    webGLCurtain.onError(function() {
        // we will add a class to the document body to display original images
        document.body.classList.add("no-curtains", "planes-loaded");
    });

    // we will keep track of all our planes in an array
    var planes = [];
    var planeElements = [];

    // all planes will have the same parameters
    var params = {
        vertexShaderID: "plane-vs", // our vertex shader ID
        fragmentShaderID: "plane-fs", // our framgent shader ID
        widthSegments: 15,
        heightSegments: 10,
        uniforms: {
            time: {
                name: "uTime", // uniform name that will be passed to our shaders
                type: "1f", // this means our uniform is a float
                value: 0,
            },
        }
    };


    // handle all the planes
    function handlePlanes(index) {
        var plane = planes[index];
        plane && plane.onReady(function() {

            if(index == planeElements.length - 1) {
                console.log("all planes are ready");
            }

        }).onRender(function() {
            // increment our time uniform
            plane.uniforms.time.value++;
        });
    }


    function addPlanes() {
        planeElements = document.getElementsByClassName("plane");

        // if we got planes to add
        if(planeElements.length > 0) {

            for(var i = 0; i < planeElements.length; i++) {
                // add the plane to our array
                var plane = webGLCurtain.addPlane(planeElements[i], params)
                // only push the plane if it exists
                if(plane) planes.push(plane);

                handlePlanes(i);
            }
        }
    }

    function removePlanes() {
        // remove all planes
        for(var i = 0; i < planes.length; i++) {
            webGLCurtain.removePlane(planes[i]);
        }

        // reset our arrays
        planes = [];
    }

    addPlanes();


    // a flag to know if we are currently in a transition between pages
    var isTransitioning = false;

    // handle all the navigation process
    function handleNavigation() {

        // button navigation
        var navButtons = document.getElementsByClassName("navigation-button");

        function buttonNavigation(e) {
            // get button index
            var index;
            for(var i = 0; i < navButtons.length; i++) {
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
        for(var i = 0; i < navButtons.length; i++) {
            navButtons[i].addEventListener("click", buttonNavigation, false);
        }



        // this function will execute our AJAX call and run a callback function
        function handleAjaxCall(href, callback) {
            // set our transition flag
            isTransitioning = true;

            // handling ajax
            var xhr = new XMLHttpRequest();

            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 0)) {

                    var response = xhr.response;
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
            var tempHtml = document.createElement('div');
            tempHtml.insertAdjacentHTML("beforeend", response);

            // let the css animation run
            setTimeout(function() {

                removePlanes();

                var content;
                // manual filtering to get our content
                for(var i = 0; i < tempHtml.children.length; i++) {
                    if(tempHtml.children[i].getAttribute("id") == "page-wrap") {

                        for(var j = 0; j < tempHtml.children[i].children.length; j++) {
                            if(tempHtml.children[i].children[j].getAttribute("id") == "content") {
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

    // update planes positions during scroll
    window.addEventListener("scroll", function(e) {
        for(var i = 0; i < planes.length; i++) {
            if(planes[i]) planes[i].updatePosition();
        }
    });

    handleNavigation();
}

archiveNavigation();
