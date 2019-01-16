function portfolioNavigation() {
    // our canvas container
    var canvasContainer = document.getElementById("canvas");

    // track the mouse positions to send it to the shaders
    var mousePosition = {
        x: -10000,
        y: -10000,
    };

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains("canvas");

    // we will keep track of all our planes in an array
    var planes = [];

    // get our planes elements
    var planeElements = document.getElementsByClassName("plane");

    // all planes will have the same parameters
    // we don't need to specifiate vertexShaderID and fragmentShaderID because we already passed it via the data attributes of the plane HTML element
    var params = {
        widthSegments: 2,
        heightSegments: 10,
        uniforms: {
            time: { // time uniform that will be updated at each draw call
                name: "uTime",
                type: "1f",
                value: 0,
            },
            mouseMoveStrength: { // attenuate the effect when the mouse is not moving
                name: "uMouseMoveStrength",
                type: "1f",
                value: 0,
            },
            mousePosition: { // our mouse position
                name: "uMousePosition",
                type: "2f", // again an array of floats
                value: [mousePosition.x, mousePosition.y],
            },
        }
    }

    // we will handle a loader
    var imagesLoaded = 0;

    // add our planes and handle them
    for(var i = 0; i < planeElements.length; i++) {
        planes.push(webGLCurtain.addPlane(planeElements[i], params));

        // update loader
        planes[i].onLoading(function() {
            imagesLoaded++;
            document.getElementById("loading").textContent = parseInt((imagesLoaded / planeElements.length) * 100) + "%";
        });

        // handle each plane
        handlePlanes(i);
    }


    // handle all the planes
    function handlePlanes(index) {
        var plane = planes[index];
        plane.onReady(function() {
            // to update the plane position during css translate animation
            plane.shouldUpdatePos = false;

            // once everything is ready, display everything
            if(index == planes.length - 1) {
                handleNavigation();
            }

            // now that our plane is ready we can listen to mouse move event
            var wrapper = document.getElementById("page-wrap");

            wrapper.addEventListener("mousemove", function(e) {
                handleMovement(e, plane);
            });

            wrapper.addEventListener("touchmove", function(e) {
                handleMovement(e, plane);
            });
        }).onRender(function() {
            // increment our time uniform
            plane.uniforms.time.value++;
            // decrease our mouse timer uniform
            plane.uniforms.mouseMoveStrength.value = Math.max(plane.uniforms.mouseMoveStrength.value - 0.01, 0);

            // update position if we should
            if(plane.shouldUpdatePos) {
                plane.updatePosition();
            }
        });
    }

    // a flag to know if we are currently in a transition between pages
    // useful to attenuate our mouse effect
    var isTransitioning = false;

    // handle the mouse move event
    function handleMovement(e, plane) {

        // touch event
        if(e.targetTouches) {

            mousePosition.x = e.targetTouches[0].clientX;
            mousePosition.y = e.targetTouches[0].clientY;
        }
        // mouse event
        else {
            mousePosition.x = e.clientX;
            mousePosition.y = e.clientY;
        }

        // since we are using css transforms for our slideshow, we have to adapt the mouse positions values based on canvas translation
        var pageWrapClass = document.getElementById("page-wrap").getAttribute("class");

        if(pageWrapClass && pageWrapClass.indexOf("slide-1") !== -1) {
            mousePosition.x -= window.innerWidth;
        }
        else if(pageWrapClass && pageWrapClass.indexOf("slide-2") !== -1) {
            mousePosition.x -= (window.innerWidth * 2);
        }

        // convert our mouse/touch position to coordinates relative to the vertices of the plane
        var mouseCoords = plane.mouseToPlaneCoords(mousePosition.x, mousePosition.y);

        // update our mouse position uniform
        plane.uniforms.mousePosition.value = [mouseCoords.x, mouseCoords.y];
        // increment our mouse timer only if we are not transition
        if(!isTransitioning) {
            plane.uniforms.mouseMoveStrength.value = Math.min(plane.uniforms.mouseMoveStrength.value + 0.05, 1);
        }
    }

    // handle all the navigation process
    function handleNavigation() {
        // add a class to the body that will display everything
        document.body.classList.add("planes-loaded");
        // set the first slide as active
        document.getElementById("page-wrap").classList.add("slide-0");

        // button navigation
        var navButtons = document.getElementsByClassName("navigation-button");

        function buttonNavigation() {
            // get button index
            var index;
            for(var i = 0; i < navButtons.length; i++) {
                navButtons[i].classList.remove("active");
                if(this === navButtons[i]) {
                    index = i;
                    navButtons[i].classList.add("active");
                }
            }

            // change our page-wrap class and so trigger css animations
            document.getElementById("page-wrap").className = "";
            document.getElementById("page-wrap").classList.add("slide-" + index);

            // tell our plane to update their positions during css animation
            for(var i = 0; i < planes.length; i++) {
                planes[i].shouldUpdatePos = true;
            }

            // animation is done
            setTimeout(function() {
                for(var i = 0; i < planes.length; i++) {
                    planes[i].shouldUpdatePos = false;
                }
            }, 900);
        }

        // listen to the navigation buttons click event
        for(var i = 0; i < navButtons.length; i++) {
            navButtons[i].addEventListener("click", buttonNavigation, false);
        }

        // handle the home slideshow click events
        function handleHomeSlideshowClick() {
            for(var i = 0; i < planeElements.length; i++) {
                planeElements[i].addEventListener("click", goToProject, false);
            }
        }

        handleHomeSlideshowClick();

        // callback of our ajax call where we will append the content of a project page
        function appendSingleProject(response) {
            // append our response to a div
            var tempHtml = document.createElement('div');
            tempHtml.insertAdjacentHTML("beforeend", response);

            // let the css animation run
            setTimeout(function() {
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

                // managing class toggling to trigger CSS animations
                document.body.classList.remove("go-to-project");
                document.body.classList.add("single-project-shown");

                // reset our transition flag
                isTransitioning = false;

                // click event to go back to home
                document.getElementById("close-project").addEventListener("click", goToHome, false);
            }, 1000);
        }

        // callback of our ajax call where we will append the content of the home page
        function appendHome(response) {
            // append our response to a div
            var tempHtml = document.createElement('div');
            tempHtml.insertAdjacentHTML("beforeend", response);

            // let the css animation run
            setTimeout(function() {
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

                // managing class toggling to trigger CSS animations
                document.body.classList.remove("go-to-home");
                document.body.classList.remove("single-project-shown");

                // reset our transition flag
                isTransitioning = false;

                // since the planes HTML elements were removed from our content by the previous AJAX call we need to reset their sizes
                for(var i = 0; i < planes.length; i++) {
                    planes[i].planeResize();
                }

                // handle the home slideshow click again
                handleHomeSlideshowClick();
            }, 1000);
        }

        // this function will execute our AJAX call and run a callback function
        function handleAjaxCall(href, callback) {
            // set our transition flag
            isTransitioning = true;

            // handling ajax
            var xhr = new XMLHttpRequest();

            xhr.onreadystatechange = function() {
                //console.log(xhr.status, xhr);
                if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 0)) {

                    var response = xhr.response;
                    callback(response);
                }
            };

            xhr.open("GET", href, true);
            xhr.send(null);
        }


        // trigger the ajax navigation
        function goToProject(e) {
            e.preventDefault();
            // class to trigger our CSS animations
            document.body.classList.add("go-to-project");

            const BASE_PATH = "https://www.martin-laxenaire.fr/libs/curtainsjs/examples/ajax-navigation/";
            var hrefToLoad = BASE_PATH + this.getAttribute("href");

            handleAjaxCall(hrefToLoad, appendSingleProject);
        }

        function goToHome(e) {
            e.preventDefault();
            // class to trigger our CSS animations
            document.body.classList.add("go-to-home");

            const BASE_PATH = "https://www.martin-laxenaire.fr/libs/curtainsjs/examples/ajax-navigation/";
            var hrefToLoad = BASE_PATH + this.getAttribute("href");

            handleAjaxCall(hrefToLoad, appendHome);
        }
    }
}

portfolioNavigation();
