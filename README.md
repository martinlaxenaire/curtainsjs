<h2>What is it ?</h2>
<p>
    Shaders are the next front-end web developpment big thing, with the ability to create very powerful 3D interactions and animations. A lot of very good javascript libraries already handle WebGL but with most of them it's kind of a headache to position your meshes relative to the DOM elements of your web page.
</p>
<p>
    curtains.js was created with just that issue in mind. It is a small vanilla WebGL javascript library that converts HTML elements containing images and videos into 3D WebGL textured planes, allowing you to animate them via shaders.<br />
    You can define each plane size and position via CSS, which makes it super easy to add WebGL responsive planes all over your pages.
</p>
<p style="text-align: center;">
    <img src="https://github.com/martinlaxenaire/curtainsjs/blob/master/images/promo.gif" alt="curtains.js demo gif" width="300" height="225" />
</p>
<h2>Knowledge and technical requirements</h2>
<p>
    It is easy to use but you will of course have to possess good basics of HTML, CSS and javascript.
</p>
<p>
    If you've never heard about shaders, you may want to learn a bit more about them on <a href="https://thebookofshaders.com/" title="The Book of Shaders" >The Book of Shaders</a> for example. You will have to understand what are the vertex and fragment shaders, the use of uniforms as well as the GLSL syntax basics.
</p>
<h2>Installation</h2>
<div>
    In a browser:
    
```html
<script src="curtains.min.js"></script>
```

</div>
<div>
    Using npm:

```
npm i curtainsjs
```

</div>
<div>
    Load ES module:

```javascript
import {Curtains} from 'curtainsjs';
```

</div>
<h2>Documentation</h2>
<a href="https://www.martin-laxenaire.fr/libs/curtainsjs/get-started.html" title="Getting started" target="_blank">Getting started</a><br />
<a href="https://www.martin-laxenaire.fr/libs/curtainsjs/documentation.html" title="API docs" target="_blank">API docs</a><br />
<p>
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/index.html#examples">Examples</a>
</p>

<h2>Basic example</h2>

<h3>HTML</h3>

```html
<body>
    <!-- div that will hold our WebGL canvas -->
    <div id="canvas"></div>
    
    <!-- div used to create our plane -->
    <div class="plane">
    
        <!-- image that will be used as texture by our plane -->
        <img src="path/to/my-image.jpg" />
    </div>
    
</body>
```

<h3>CSS</h3>

```css
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
```

<h3>Javascript</h3>

```javascript
window.addEventListener("load", function() {
    // set up our WebGL context and append the canvas to our wrapper
    var curtains = new Curtains({
        container: "canvas"
    });
    
    // get our plane element
    var planeElement = document.getElementsByClassName("plane")[0];
    
    // set our initial parameters (basic uniforms)
    var params = {
        vertexShaderID: "plane-vs", // our vertex shader ID
        fragmentShaderID: "plane-fs", // our fragment shader ID
        uniforms: {
            time: {
                name: "uTime", // uniform name that will be passed to our shaders
                type: "1f", // this means our uniform is a float
                value: 0,
            },
        },
    };
    
    // create our plane
    var plane = curtains.addPlane(planeElement, params);
    
    // if our plane has been successfully created
    if(plane) {
        plane.onRender(function() {
            // use the onRender method of our plane fired at each requestAnimationFrame call
            plane.uniforms.time.value++; // update our time uniform value
        });
    }
    
});
```

<h3>Shaders</h3>

<h4>Vertex shader</h4>

```glsl
<script id="plane-vs" type="x-shader/x-vertex">
    #ifdef GL_ES
    precision mediump float;
    #endif
    
    // those are the mandatory attributes that the lib sets
    attribute vec3 aVertexPosition;
    attribute vec2 aTextureCoord;
    
    // those are mandatory uniforms that the lib sets and that contain our model view and projection matrix
    uniform mat4 uMVMatrix;
    uniform mat4 uPMatrix;
    
    // our texture matrix that will handle image cover
    uniform mat4 uTextureMatrix0;
    
    // pass your vertex and texture coords to the fragment shader
    varying vec3 vVertexPosition;
    varying vec2 vTextureCoord;
    
    void main() {
        vec3 vertexPosition = aVertexPosition;
        
        gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);
        
        // set the varyings
        // here we use our texture matrix to calculate the accurate texture coords
        vTextureCoord = (uTextureMatrix0 * vec4(aTextureCoord, 0.0, 1.0)).xy;
        vVertexPosition = vertexPosition;
    }
</script> 
```

<h4>Fragment shader</h4>

```glsl
<script id="plane-fs" type="x-shader/x-fragment">
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
        // get our texture coords from our varying
        vec2 textureCoord = vTextureCoord;
        
        // displace our pixels along the X axis based on our time uniform
        // textures coords are ranging from 0.0 to 1.0 on both axis
        textureCoord.x += sin(textureCoord.y * 25.0) * cos(textureCoord.x * 25.0) * (cos(uTime / 50.0)) / 25.0;
        
        // map our texture with the texture matrix coords
        gl_FragColor = texture2D(uSampler0, textureCoord);
    }
</script> 
```