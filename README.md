<h2>What is it ?</h2>
<p>
    Shaders are the next front-end web developpment big thing, with the ability to create very powerful 3D interactions and animations. A lot of very good javascript libraries already handle WebGL but with most of them it's kind of a headache to position your meshes relative to the DOM elements of your web page.
</p>
<p>
    curtains.js was created with just that issue in mind. It is a small vanilla WebGL javascript library that converts HTML elements containing images and videos into 3D WebGL textured planes, allowing you to animate them via shaders.<br />
    You can define each plane size and position via CSS, which makes it super easy to add WebGL responsive planes all over your pages.
</p>
<h2>Knowledge and technical requirements</h2>
<p>
    It is easy to use but you will of course have to possess good basics of HTML, CSS and javascript.
</p>
<p>
    If you've never heard about shaders, you may want to learn a bit more about them on <a href="https://thebookofshaders.com/" title="The Book of Shaders" >The Book of Shaders</a> for example. You will have to understand what are the vertex and fragment shaders, the use of uniforms as well as the GLSL syntax basics.
</p>
<h2>Examples</h2>
<h3>Images</h3>
<p>
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/examples/vertex-coords-helper/index.html" title="Vertex coordinates helper" target="_blank">Vertex coordinates helper</a><br />
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/examples/simple-plane/index.html" title="Simple plane" target="_blank">Simple plane</a><br />
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/examples/multiple-textures/index.html" title="Multiple textures" target="_blank">Multiple textures with a displacement shader</a><br />
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/examples/multiple-planes/index.html" title="Multiple planes" target="_blank">Multiple planes</a><br />
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/examples/asynchronous-textures/index.html" title="Asynchronous textures loading" target="_blank">Asynchronous textures loading</a><br />
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/examples/ajax-navigation/index.html" title="Asynchronous textures loading" target="_blank">AJAX navigation</a><br />
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/examples/canvas-height-performance/index.html" title="Canvas size, performance and perspective" target="_blank">Canvas size, performance and perspective</a>
</p>
<h3>Video</h3>
<p>
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/examples/simple-video-plane/index.html" title="Simple video plane" target="_blank">Simple video plane</a><br />
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/examples/multiple-video-textures/index.html" title="Multiple video textures" target="_blank">Multiple video textures with a displacement shader</a>
</p>
<h3>Canvas</h3>
<p>
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/examples/simple-canvas-plane/index.html" title="Simple canvas plane" target="_blank">Simple canvas plane</a><br />
</p>
<h2>Basic setup example</h2>
<p>
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/examples/basic-plane/index.html" title="See it live" target="_blank">See it live</a>
</p>
<h3>HTML</h3>
<p>
    The HTML set up is pretty easy. Just create a div that will hold your canvas and a div that will hold your image.
</p>
<p>
    <pre>
<code>
&lt;body&gt;
    &lt;!-- div that will hold our WebGL canvas --&gt;
    &lt;div id="canvas"&gt;&lt;/div&gt;
    &lt;!-- div used to create our plane --&gt;
    &lt;div class="plane"&gt;
        &lt;!-- image that will be used as texture by our plane --&gt;
        &lt;img src="path/to/my-image.jpg" /&gt;
    &lt;/div&gt;
&lt;/body&gt;
</code>
    </pre>
</p>
<h3>CSS</h3>
<p>
    The CSS is also very easy. Make sure the div that will wrap the canvas fits the document, and apply any size you want to your plane div element.
</p>
<p>
    <pre>
<code>
body {
    /* make the body fits our viewport */
    position: relative;
    width: 100%;
    height: 100vh;
    margin: 0;
    overflow: hidden;
}

#canvas {
    /* make the canvas wrapper fits the document */
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
}

.plane {
    /* define the size of your plane */
    width: 80%;
    height: 80vh;
    margin: 10vh auto;
}

.plane img {
    /* hide the img element */
    display: none;
}
</code>
    </pre>
</p>
<h3>Javascript</h3>
<p>
    There's a bit more work in the javascript part : we need to instanciate our WebGL context, create a plane with basic uniforms parameters and use it.
</p>
<p>
    <pre>
<code>
window.onload = function() {
    // get our canvas wrapper
    var canvasContainer = document.getElementById("canvas");
    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains("canvas");
    // get our plane element
    var planeElement = document.getElementsByClassName("plane")[0];
    // set our initial parameters (basic uniforms)
    var params = {
        vertexShaderID: "plane-vs", // our vertex shader ID
        fragmentShaderID: "plane-fs", // our framgent shader ID
        uniforms: {
            time: {
                name: "uTime", // uniform name that will be passed to our shaders
                type: "1f", // this means our uniform is a float
                value: 0,
            },
        }
    }
    // create our plane mesh
    var plane = webGLCurtain.addPlane(planeElement, params);
    // use the onRender method of our plane fired at each requestAnimationFrame call
    plane.onRender(function() {
        plane.uniforms.time.value++; // update our time uniform value
    });
}
</code>
    </pre>
</p>
<h3>Shaders</h3>
<p>
    Here are some basic vertex and fragment shaders. Just put it inside your body tag, right before you include the library.
</p>
<p>
    <pre>
<code>
&lt;!-- vertex shader --&gt;
&lt;script id="plane-vs" type="x-shader/x-vertex"&gt;
    #ifdef GL_ES
    precision mediump float;
    #endif
    // those are the mandatory attributes that the lib sets
    attribute vec3 aVertexPosition;
    attribute vec2 aTextureCoord;
    // those are mandatory uniforms that the lib sets and that contain our model view and projection matrix
    uniform mat4 uMVMatrix;
    uniform mat4 uPMatrix;
    // if you want to pass your vertex and texture coords to the fragment shader
    varying vec3 vVertexPosition;
    varying vec2 vTextureCoord;
    void main() {
        vec3 vertexPosition = aVertexPosition;
        gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);
        // set the varyings
        vTextureCoord = aTextureCoord;
        vVertexPosition = vertexPosition;
    }
&lt;/script&gt;
&lt;!-- fragment shader --&gt;
&lt;script id="plane-fs" type="x-shader/x-fragment"&gt;
    #ifdef GL_ES
    precision mediump float;
    #endif
    // get our varyings
    varying vec3 vVertexPosition;
    varying vec2 vTextureCoord;
    // the uniform we declared inside our javascript
    uniform float uTime;
    // our texture sampler (default name, to use a different name please refer to the documentation)
    uniform sampler2D uSampler0;
    void main() {
        vec2 textureCoord = vec2(vTextureCoord.x, vTextureCoord.y);
        // displace our pixels along the X axis based on our time uniform
        // textures coords are ranging from 0.0 to 1.0 on both axis
        textureCoord.x += sin(textureCoord.y * 25.0) * cos(textureCoord.x * 25.0) * (cos(uTime / 50.0)) / 25.0;
        gl_FragColor = texture2D(uSampler0, textureCoord);
    }
&lt;/script&gt;
</code>
    </pre>
</p>
<p>
    Et voilà !
</p>
<h2>Images uniform sampler names</h2>
<p>
    Let's say you want to build a slideshow with 3 images and a displacement image to create a nice transition effect.<br />
    By default, the textures uniforms sampler will be named upon their indexes inside your plane element. If you got something like that :
</p>
<p>
    <pre>
<code>
&lt;!-- div used to create our plane --&gt;
&lt;div class="plane"&gt;
    &lt;!-- images that will be used as textures by our plane --&gt;
    &lt;img src="path/to/displacement.jpg" /&gt;
    &lt;img src="path/to/my-image-1.jpg" /&gt;
    &lt;img src="path/to/my-image-2.jpg" /&gt;
    &lt;img src="path/to/my-image-3.jpg" /&gt;
&lt;/div&gt;
</code>
</pre>
</p>
<p>
    Then, in your shaders, your textures samplers would have to be declared that way :
</p>
<p>
    <pre>
<code>
uniform sampler2D uSampler0 // bound to displacement.jpg
uniform sampler2D uSampler1 // bound to my-image-1.jpg
uniform sampler2D uSampler2 // bound to my-image-2.jpg
uniform sampler2D uSampler3 // bound to my-image-3.jpg
</code>
</pre>
</p>
<p>
    It is handy but you could also get easily confused.<br />
    By using a data-sampler attribute on the &lt;img /&gt; tag, you could specify a custom uniform sampler name to use in your shader. With the example above, this would become :
</p>
<p>
    <pre>
<code>
&lt;!-- div used to create our plane --&gt;
&lt;div class="plane"&gt;
    &lt;!-- images that will be used as textures by our plane --&gt;
    &lt;img src="path/to/displacement.jpg" data-sampler="uDisplacement" /&gt;
    &lt;img src="path/to/my-image-1.jpg" data-sampler="uSlide1" /&gt;
    &lt;img src="path/to/my-image-2.jpg" data-sampler="uSlide2" /&gt;
    &lt;img src="path/to/my-image-3.jpg" data-sampler="uLastSlide" /&gt;
&lt;/div&gt;
</code>
</pre>
</p>
<p>
    <pre>
<code>
uniform sampler2D uDisplacement // bound to displacement.jpg
uniform sampler2D uSlide1       // bound to my-image-1.jpg
uniform sampler2D uSlide2       // bound to my-image-2.jpg
uniform sampler2D uLastSlide    // bound to my-image-3.jpg
</code>
</pre>
<h2>Using videos as textures</h2>
<p>
    Yes, videos as textures are supported ! However there are a few downsides you need to know.<br />
    First, the videos will <strong>always fit the plane</strong> : your plane's size ratio would have to be the same as your videos so they won't appear distorted (you can handle that with CSS).<br />
    <strong>We can't autoplay videos without a user gesture on most mobile devices</strong>. Unless you don't care about mobile users, you will have to start the videos playback after a user interaction like a click event.<br />
    Besides that, videos are really easy to use (and can be mixed with images as well). Let's see how we can handle them :
</p>
<h3>HTML</h3>
<p>
    <pre>
<code>
&lt;!-- div used to create our plane --&gt;
&lt;div class="plane"&gt;
    &lt;!-- video that will be used as a texture by our plane --&gt;
    &lt;video src="path/to/my-video.mp4"&gt;&lt;/video&gt;
&lt;/div&gt;
</code>
</pre>
</p>
<p>
    Like with images, you can use a data-sampler attribute to set a uniform sampler name. You can use one or more videos, or mixed them with images if you want :
</p>
<p>
    <pre>
<code>
&lt;!-- div used to create our plane --&gt;
&lt;div class="plane"&gt;
    &lt;!-- elements that will be used as textures by our plane --&gt;
    &lt;img src="path/to/displacement.jpg" data-sampler="displacement" /&gt;
    &lt;video src="path/to/my-video-1.mp4" data-sampler="firstVideo"&gt;&lt;/video&gt;
    &lt;video src="path/to/my-video-2.mp4" data-sampler="secondVideo"&gt;&lt;/video&gt;
&lt;/div&gt;
</code>
</pre>
</p>
<h3>Javascript</h3>
<p>
    There's only one change inside our javascript : we need to tell our plane when to start playing the videos. We've got a playVideos() method that we will put inside an event listener in our onReady() method :
</p>
<p>
        <pre>
<code>
window.onload = function() {
    // get our canvas wrapper
    var canvasContainer = document.getElementById("canvas");
    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains("canvas");
    // get our plane element
    var planeElement = document.getElementsByClassName("plane")[0];
    // set our initial parameters (basic uniforms)
    var params = {
        vertexShaderID: "plane-vs", // our vertex shader ID
        fragmentShaderID: "plane-fs", // our framgent shader ID
        uniforms: {
            time: {
                name: "uTime", // uniform name that will be passed to our shaders
                type: "1f", // this means our uniform is a float
                value: 0,
            },
        }
    }
    // create our plane mesh
    var plane = webGLCurtain.addPlane(planeElement, params);
    plane.onReady(function() {
        // set an event listener to start our playback
        document.getElementbyId("start-playing").addEventListener("click", function() {
            plane.playVideos();
        });
    }).onRender(function() {
        // use the onRender method of our plane fired at each requestAnimationFrame call
        plane.uniforms.time.value++; // update our time uniform value
    });
}
</code>
</pre>
</p>
<p>
    And that's it. Check the video examples (and source codes) if you want to see what's possible.
</p>
<h2>Using canvas as texture</h2>
<p>
    Last but not least, you can use a canvas as a texture. It is once again really easy to use. You just have to insert a canvas tag inside your HTML, or eventually create it in your javascript and load it using the loadCanvases() method.
</p>
<h3>HTML</h3>
<p>
        <pre>
<code>
&lt;!-- div used to create our plane --&gt;
&lt;div class="plane"&gt;

    &lt;!-- canvas that will be used as a texture by our plane --&gt;
    &lt;canvas id="canvas-texture"&gt;&lt;/canvas&gt;

&lt;/div&gt;
</code>
</pre>
</p>
<p>
    You can use multiple canvases and data-sampler attributes as well, like you'd do with images or videos.
</p>
<h3>Javascript</h3>
<p>
    The javascript code remains almost the same. We just set the size of our canvas, get its context and draw a simple rotating red rectangle inside our animation loop.
</p>
<p>
        <pre>
<code>
window.onload = function() {
    // get our canvas wrapper
    var canvasContainer = document.getElementById("canvas");

    // set up our WebGL context and append the canvas to our wrapper
    var webGLCurtain = new Curtains("canvas");

    // get our plane element
    var planeElement = document.getElementsByClassName("plane")[0];

    // set our initial parameters (basic uniforms)
    var params = {
        vertexShaderID: "plane-vs", // our vertex shader ID
        fragmentShaderID: "plane-fs", // our framgent shader ID
        uniforms: {
            time: {
                name: "uTime", // uniform name that will be passed to our shaders
                type: "1f", // this means our uniform is a float
                value: 0,
            },
        }
    }

    // create our plane mesh
    var plane = webGLCurtain.addPlane(planeElement, params);

    // our texture canvas
    var textureCanvas = document.getElementById("canvas-texture");
    var textureCanvasContext = textureCanvas.getContext("2d");

    // set the size of our canvas
    textureCanvas.width = planeElements[0].clientWidth;
    textureCanvas.height = planeElements[0].clientHeight;

    // use the onRender method of our plane fired at each requestAnimationFrame call
    plane.onRender(function() {
        plane.uniforms.time.value++; // update our time uniform value

        // here we will handle our canvas texture animation
        // clear scene
        textureCanvasContext.clearRect(0, 0, textureCanvas.width, textureCanvas.height);

        // continuously rotate the canvas
        textureCanvasContext.translate(textureCanvas.width / 2, textureCanvas.height / 2);
        textureCanvasContext.rotate(Math.PI / 360);
        textureCanvasContext.translate(-textureCanvas.width / 2, -textureCanvas.height / 2);

        // draw a red rectangle
        textureCanvasContext.fillStyle = "#ff0000";
        textureCanvasContext.fillRect(textureCanvas.width / 2 - textureCanvas.width / 8, textureCanvas.height / 2 - textureCanvas.height / 8, textureCanvas.width / 4, textureCanvas.height / 4);
    });

}
</code>
</pre>
</p>

<h2>Documentation</h2>
<h3>Curtains object</h3>
<h4>Instanciate</h4>
<p>
    You will have to create a Curtains object first that will handle the scene containing all your planes. It will also create the WebGL context, append the canvas and handle the requestAnimationFrame loop. You just have to pass the ID of the HTML element that will wrap the canvas :
</p>
<p>
<pre>
<code>
var curtains = new Curtains("canvas"); // "canvas" is the ID of our HTML element
</code>
</pre>
</p>
<h4>Methods</h4>
<ul>
    <li>
        <p>
            <strong>addPlane</strong>(planeElement, params) :<br />
            <em>planeElement</em> (HTML element) : a HTML element<br />
            <em>params</em> (object) : an object containing the plane parameters (see the Plane object).
        </p>
        <p>
            This function will add a plane to our Curtains wrapper.
        </p>
    </li>
    <li>
        <p>
            <strong>dispose</strong>() :
        </p>
        <p>
            This function will cancel the requestAnimationFrame loop and delete the WebGL context.
        </p>
    </li>
</ul>
<h3>Plane object</h3>
<p>
    Those are the planes we will be manipulating. They are instanciate internally each time you call the addPlane method on the parent Curtains object.
</p>

<h4>Properties</h4>
<ul>
    <li>
        <strong>vertexShader</strong> (string) : Your vertex shader as a string. Be careful with the line-breaks as it may throw javascript errors. Will look for vertexShaderID param if not specified.
    </li>
    <li>
        <strong>vertexShaderID</strong> (string) : the vertex shader ID. If ommited, will look for a data attribute data-vs-id on the plane HTML element. Will use a default vertex shader and throw a warning if nothing specified.
    </li>
    <li>
        <strong>fragmentShader</strong> (string) : Your fragment shader as a string. Be careful with the line-breaks as it may throw javascript errors. Will look for fragmentShaderID param if not specified.
    </li>
    <li>
        <strong>fragmentShaderID</strong> (string) : the fragment shader ID. If ommited, will look for a data attribute data-fs-id on the plane HTML element. Will use a default fragment shader that draws only black pixels and throw a warning if nothing specified.
    </li>
    <li>
        <strong>widthSegments</strong> (integer, optionnal) : plane definition along the X axis (1 by default).
    </li>
    <li>
        <strong>heightSegments</strong> (integer, optionnal) : plane definition along the Y axis (1 by default).
    </li>
    <li>
        <strong>mimicCSS</strong> (bool, optionnal) : define if the plane should copy it's HTML element position (true by default).
    </li>
    <li>
        <strong>imageCover</strong> (bool, optionnal) : define if the images must imitate css background-cover or just fit the plane (true by default).
    </li>
    <li>
        <strong>crossOrigin</strong> (string, optionnal) : define the cross origin process to load images if any.
    </li>
    <li>
        <strong>fov</strong> (integer, optionnal) : define the perspective field of view (default to 75).
    </li>
    <li>
        <strong>uniforms</strong> (object, otpionnal): the uniforms that will be passed to the shaders (if no uniforms specified there won't be any interaction with the plane). Each uniform should have three properties : a name (string), a type (string, see <a href="https://webglfundamentals.org/webgl/lessons/webgl-shaders-and-glsl.html" title="all uniforms types" target="_blank">here</a>) and a value.
    </li>
</ul>
<h3>Parameters basic example</h3>
<p>
<pre>
<code>
var params = {
    vertexShaderID: "plane-vs", // our vertex shader ID
    fragmentShaderID: "plane-fs", // our framgent shader ID
    uniforms: {
        time: {
            name: "uTime", // uniform name that will be passed to our shaders
            type: "1f", // this means our uniform is a float
            value: 0,
        },
    }
}
</code>
</pre>
</p>

<h4>Methods</h4>
<ul>
    <li>
        <p>
            <strong>loadImages</strong>(imgElements) :<br />
            <em>imgElements</em> (HTML image elements) : a collection of HTML image elements to load into your plane.
        </p>
        <p>
            This function is automatically called internally on a new Plane instanciation, but you can use it if you want to create an empty plane and then assign it some textures later. See  <a href="examples/asynchronous-textures/index.html" title="Asynchronous textures loading" target="_blank">asynchronous textures loading</a> example.
        </p>
    </li>
    <li>
        <p>
            <strong>loadVideos</strong>(videoElements) :<br />
            <em>videoElements</em> (HTML video elements) : a collection of HTML video elements to load into your plane.
        </p>
        <p>
            This function is automatically called internally on a new Plane instanciation. It works exactly the same as the loadImages() method.
        </p>
    </li>
    <li>
        <p>
            <strong>loadCanvases</strong>(canvasElements) :<br />
            <em>canvasElements</em> (HTML canvas elements) : a collection of HTML canvas elements to load into your plane.
        </p>
        <p>
            This function is automatically called internally on a new Plane instanciation. It works exactly the same as the loadImages() method.
        </p>
    </li>
    <li>
        <p>
            <strong>onLoading</strong>() :
        </p>
        <p>
            This function will be fired each time an image of the plane has been loaded. Useful to handle a loader.
        </p>
    </li>
    <li>
        <p>
            <strong>onReady</strong>() :
        </p>
        <p>
            This function will be called once our plane is all set up and ready to be drawn. This is where you may want to add event listener to interact with it or update its uniforms.
        </p>
    </li>
    <li>
        <p>
            <strong>onRender</strong>() :
        </p>
        <p>
            This function will be triggered at each requestAnimationFrame call. Useful to update a time uniform, change plane rotation, scale, etc.
        </p>
    </li>
    <li>
        <p>
            <strong>playVideos</strong>() :<br />
        </p>
        <p>
            This function will automatically start all of your plane videos playback. If you are not calling it after a user action it might not work on mobile.
        </p>
    </li>
    <li>
        <p>
            <strong>planeResize</strong>() :
        </p>
        <p>
            This method is called internally each time the WebGL canvas is resized, but if you remove the plane HTML element and append it again later (typically with an AJAX navigation, see the <a href="examples/ajax-navigation/index.html" title="AJAX navigation" target="_blank">AJAX navigation</a> example), you would have to manually reset the plane size by calling it.
        </p>
    </li>
    <li>
        <p>
            <strong>setPerspective</strong>(fieldOfView, nearPlane, farPlane) :<br />
            <em>fieldOfView</em> (integer) : the perspective field of view. Should be greater than 0 and lower than 180. Default to 75.<br />
            <em>nearPlane</em> (float, optionnal) : closest point where a mesh vertex is displayed. Default to 0.1.<br />
            <em>farPlane</em> (float, optionnal) : farthest point where a mesh vertex is displayed. Default to 150 (two times the field of view).
        </p>
        <p>
            Reset the perspective. The smaller the field of view, the more perspective.
        </p>
    </li>
    <li>
        <p>
            <strong>setScale</strong>(scaleX, scaleY) :<br />
            <em>scaleX</em> (float) : the scale to set along the X axis.<br />
            <em>scaleY</em> (float) : the scale to set along the Y axis.
        </p>
        <p>
            Set the plane new scale.
        </p>
    </li>
    <li>
        <p>
            <strong>setRotation</strong>(angleX, angleY, angleZ) :<br />
            <em>angleX</em> (float) : the angle in radians to rotate around the X axis.<br />
            <em>angleY</em> (float) : the angle in radians to rotate around the Y axis.<br />
            <em>angleZ</em> (float) : the angle in radians to rotate around the Z axis.
        </p>
        <p>
            Set the plane rotation.
        </p>
    </li>
    <li>
        <p>
            <strong>setRelativePosition</strong>(translationX, translationY) :<br />
            <em>translationX</em> (float) : the translation value to apply on the X axis in pixel.<br />
            <em>translationY</em> (float) : the translation value to apply on the Y axis in pixel.
        </p>
        <p>
            Set the plane translation based on pixel units.
        </p>
    </li>
    <li>
        <p>
            <strong>mouseToPlaneCoords</strong>(xMousePosition, yMousePosition) :<br />
            <em>xMousePosition</em> (float) : mouse event clientX value.<br />
            <em>yMousePosition</em> (float) : mouse event clientY value.
        </p>
        <p>
            Get the mouse coordinates relative to the plane clip space values. Use it to send to a uniform and interact with your plane. A plane coordinates ranges from (-1, 1) in the top left corner to (1, -1) in the bottom right corner, which means the values along the Y axis are inverted.
        </p>
    </li>
    <li>
        <p>
            <strong>enableDepthTest</strong>(shouldEnableDepthTest) :<br />
            <em>shouldEnableDepthTest</em> (bool) : enable or disable the depth test for that plane.
        </p>
        <p>
            Switches on/off the depth test for that plane. You might want to disable the depth test if you got transparency issues.
        </p>
    </li>
    <li>
        <p>
            <strong>moveToFront</strong>() :<br />
        </p>
        <p>
            Let the plane overlay all other planes. Be careful as it is silently disabling depth test for that plane, you might want to switch it back on later.
        </p>
    </li>
</ul>
<h2>Canvas height, perspective and performance</h2>
<p>
    The canvas size will directly impact the global perspective and performance.
</p>
<p>
    The perspective is calculated based on each plane position inside the canvas as well as the canvas width and height. The center of the field of view will be located at the center of your canvas, which means that with tall or wide canvas you might end with exagerated perspectives.<br />
    Also keep in mind that a wide or tall canvas will pretty much impact performance (thanks to <a href="https://github.com/ColinPeyrat" title="Colin Peyrat on GitHub" target="_blank">Colin Peyrat</a> for pointing that out).
</p>
<p>
    There's a way to avoid these annoyances: set your canvas to fit the window size instead of the document size, and set the position of each plane based on the scroll inside your render loop. Check the <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/examples/canvas-height-performance/index.html" title="Canvas size, performance and perspective" target="_blank">canvas size, performance and perspective</a> example if you want to see the differences.
</p>
<h2>Other performance tips</h2>
<ul>
    <li>
        Be careful with each plane definition. A lot of vertices implies a big impact on performance. If you plan to use more than one plane, try to reduce the number of vertices.
    </li>
    <li>
        Large images have a bigger impact on performance. Try to scale your images so they will fit your plane maximum size. It goes the same for videos of course : try to keep them as light as possible.
    </li>
    <li>
        Try to use as less javascript as possible in the onRender() planes methods as this get executed at each draw call. Try not to use too many uniforms as they are updated at every draw call as well.
    </li>
    <li>
        If you use multiple planes with multiple textures, you should set the dimensions of your plane to fit the aspect ratio of your images in CSS (you could use the padding-bottom hack, see the <a href="examples/multiple-planes/index.html" title="Multiple planes" target="_blank">multiple planes</a> example HTML & CSS) and set the imageCover plane property to false when adding it.
    </li>
</ul>
<h2>Changelog</h2>
<h3>Version 1.4</h3>
<ul>
    <li>
        Added support for canvases as textures.
    </li>
    <li>
        Improved pixel ratio handling.
    </li>
</ul>
<h3>Version 1.3</h3>
<ul>
    <li>
        Added the possibility to set/unset depth test for each plane via a enableDepthTest() method. This might be useful to handle transparency problems.
    </li>
    <li>
        Added a plane moveToFront() method so that a plane could overlay all other planes.
    </li>
</ul>
<h3>Version 1.2</h3>
<ul>
    <li>
        Added support for videos as textures.
    </li>
    <li>
        Sort planes by their vertices length in order to avoid redundant buffer binding calls during draw loop.
    </li>
    <li>
        Refactored and cleaned code.
    </li>
</ul>
<h3>Version 1.1</h3>
<ul>
    <li>
        WebGL context viewport size now based on drawingBufferWidth and drawingBufferHeight.
    </li>
    <li>
        Cleaned and refactored code in order to add support for lost and restored context events.
    </li>
</ul>
<h2>About</h2>
<p>
    This library is released under the MIT license which means it is free to use for personnal and commercial projects.
</p>
<p>
    All images used in the examples were taken by <a href="https://marionbornaz.com/" title="Marion Bornaz" target="_blank">Marion Bornaz</a> during the <a href="https://www.miragefestival.com/" title="Mirage Festival" target="_blank">Mirage Festival</a>.
</p>
<p>
    All examples video footages were shot by <a href="http://analogueprod.com/" title="Analogue Production" target="_blank">Analogue Production</a>.
</p>
<p>
    Many thanks to <a href="https://webglfundamentals.org/" title="webglfundamentals.org" target="_blank">webglfundamentals.org</a> tutorials which helped me a lot.
</p>
<p>
    Author of this library is <a href="https://www.martin-laxenaire.fr/" title="Martin Laxenaire" target="_blank">Martin Laxenaire</a>, a french creative front-end developper based in Lyon.<br />
    Found a bug ? Have questions ? Do not hesitate to <a href="mailto:martin.laxenaire@gmail.com" title="contact me">email me</a> or send me a tweet : <a href="https://twitter.com/webdesign_ml" target="_blank" title="My twitter">@webdesign_ml</a>.
</p>

<h2>Showcase</h2>

<p>
    Here's a list of websites that use curtains.js with their own custom shaders:
</p>
<p>
    <a href="https://nordik.org/" title="Nördik Impakt 2018" target="_blank">
        Nördik Impakt 2018
    </a><br />
    <a href="http://lookbook-olaian.fr/" title="Olaian Lookbook" target="_blank">
        Olaian Lookbook
    </a>
</p>
