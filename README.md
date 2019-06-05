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
<h2>Installation</h2>
<div>
    In a browser:
    <pre>
<code>
&lt;script src="curtains.min.js"&gt;&lt;/script&gt;
</code>
    </pre>
</div>
<div>
    Using npm:
    <pre>
<code>
npm i curtainsjs
</code>
    </pre>
</div>
<div>
    Load ES module:
    <pre>
<code>
import {Curtains} from 'curtainsjs';
</code>
    </pre>
</div>
<h2>Documentation</h2>
<a href="https://www.martin-laxenaire.fr/libs/curtainsjs/get-started.html" title="Getting started" target="_blank">Getting started</a><br />
<a href="https://www.martin-laxenaire.fr/libs/curtainsjs/documentation.html" title="API docs" target="_blank">API docs</a><br />
<p>
    <a href="https://www.martin-laxenaire.fr/libs/curtainsjs/index.html#examples">Examples</a>
</p>