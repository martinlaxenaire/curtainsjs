# Changelog

## v8.0.1 (??/12/2020)

#### Bug Fixes:

###### core/Texture.js

- wait for original texture to be uploaded before copying it on init.
- only apply flipY and premultiplyAlpha when texture source is not empty anymore (avoid warnings).

###### extras/PingPongPlane.js

- fixed erratic behavior when sometimes the FBO swapping wasn't working [#67](https://github.com/martinlaxenaire/curtainsjs/issues/67).

###### loaders/TextureLoader.js

- fixed texture sampler name bug when media element has no data-sampler attribute

---

## v8.0.0 (10/12/2020)

#### Enhancements:

###### core/Plane.js

- refactored the whole matrix and screen space to world space calculations.
- implemented a raycasting (ray-plane intersection) algorithm so mouseToPlaneCoords() method now works with transformed planes.
- added onChange events to rotation, relativeTranslation and scale vectors to automatically update their properties via setters (see Vec2/Vec3).

###### core/Texture.js

- added onChange events to scale and offset vectors to automatically update their properties via setters (see Vec2/Vec3).
- improved texture matrix calculations performance.
- only set/get texture matrix uniform when used in the shaders.

###### math/Vec2.js

- added getters, setters and onChange event to the x and y components of the vector, allowing to execute a callback when one of this property changes.

###### math/Vec3.js

- added getters, setters and onChange event to the x, y and z components of the vector, allowing to execute a callback when one of this property changes.

###### camera/Camera.js

- changed default camera position
- updated CSSPerspective calculations
- added a getScreenRatiosFromFov() method

###### loaders/TextureLoader.js

- create a new Image() or video element each time an image or video is loaded, so we can set its crossOrigin property before its src (fix potential CORS issues).

###### core/Curtains.js

- added keep parameter to the nextRender() method so it can act both like setTimeout and setInterval.

###### extras/FXAAPass.js

- FXAAPASS now extends ShaderPass class.

###### examples

- updated the examples to reflect those changes.

#### Bug Fixes:

###### core/Plane.js

- fixed mouseToPlaneCoords() method with transformed planes.

###### extras/PingPongPlane.js

- should hopefully fix erratic behaviour/inconsistent results [#67](https://github.com/martinlaxenaire/curtainsjs/issues/67).
- fixed weird resize issue [#71](https://github.com/martinlaxenaire/curtainsjs/issues/71).

#### Deprecations:

###### core/Plane.js

- removed shareProgram parameter: it was unnecessarily complicating the codebase, adding a lot of extra GL calls for each plane (updating all the uniforms at every frame) and the performance boost wasn't obvious at all.
- removed deprecated setRelativePosition() method.
- removed deprecated moveToFront() method.

---

## v7.3.3 (02/12/2020)

#### Bug Fixes:

###### index.mjs

- fixed Quat class not being exported.

###### core/Scene.js

- fixed sharedProgram render order by program IDs

###### loaders/PlaneTextureLoader.js

- replaced isEqualNode() with isSameNode()

---

## v7.3.2 (11/13/2020)

#### Bug Fixes:

###### core/Curtains.js

- fixed premultipliedAlpha property that was not correctly passed to the Renderer.

###### core/Scene.js

- fixed setRenderOrder when context does not handle depth.

###### extras/PingPongPlane.js

- fixed remove() method.

---

## v7.3.1 (11/12/2020)

#### Bug Fixes:

###### core/Scene.js

- fixed setRenderOrder not working when no shader passes.

---

## v7.3.0 (11/12/2020)

#### Enhancements:

###### core/Scene.js

- refactored the draw stacks.

###### core/Curtains.js

- added isWebGL2(), clear(), clearColor() and clearDepth() methods.

###### core/Plane.js

- added renderOrder parameter, property and setRenderOrder() method.

###### core/Texture.js

- added offset property and setOffset() method.

###### framebuffers/ShaderPass.js

- added renderOrder parameter, property and setRenderOrder() method.

###### extras/PingPongPlane.js

- changed type property to "PingPongPlane" and updated stacking handling.

###### examples

- added a new example demonstrating the use of the new texture's setOffset() and plane's setRenderOrder() methods: [GSAP click to fullscreen gallery](https://www.curtainsjs.com/examples/gsap-click-to-fullscreen-gallery/index.html)

#### Bug Fixes:

###### core/Scene.js

- refactoring fixed [#64](https://github.com/martinlaxenaire/curtainsjs/issues/64), [#65](https://github.com/martinlaxenaire/curtainsjs/issues/65) and [#66](https://github.com/martinlaxenaire/curtainsjs/issues/66).

###### core/Texture.js

- fixed texture matrix update affecting all shared program planes.
- fixed onSourceLoaded() and onSourceUploaded() not fired when copying a texture
- fixed erratic PingPongPlane texture bug where sometimes the ping pong plane's texture's empty [#67](https://github.com/martinlaxenaire/curtainsjs/issues/67)

#### Deprecations:

###### core/Plane.js

- moveToFront() method is deprecated and will be removed soon. Use setRenderOrder() instead.

###### core/DOMMesh.js

- removed planeResize() method. Use resize() instead.

###### core/Texture.js

- removed setFromTexture() method. Use copy() instead.

---

## v7.2.1 (11/03/2020)

#### Enhancements:

###### documentation

- added changelog

###### umd files

- Removed "Curtains" namespace of the umd files to improve code consistency

---

## v7.2.0 (11/02/2020)

#### Enhancements:

###### core/Texture

- removed texture "flipY on non DOM elements" warning

###### math/Mat4

- added clone() method

###### math/Quat

- added clone() method

#### Bug Fixes:

###### core/Uniforms.js

- fixed uniforms setting and updating when using math classes for uniforms

---

## v7.1.4 (10/26/2020)

#### Enhancements:

###### core/Plane

- moveToFront() method does not affect depthTest anymore

#### Bug Fixes:

###### extras/PingPongPlane.js

- fixed PingPongPlane so the render targets textures are always available

---

## v7.1.3 (10/22/2020)

#### Bug Fixes:

###### core/Texture

- fixed undefined texture size issue

---

## v7.1.2 (10/21/2020)

#### Bug Fixes:

###### core/Texture

- fixed NaN values in texture matrix

###### framebuffers/ShaderPass

- allow to create a new ShaderPass without specifying parameters

---

## v7.1.1 (10/13/2020)

#### Enhancements:

###### core/Program

- use default lib shaders when input shaders fail to compile
- better warning message when program is not successfully linked

---

## v7.1.0 (09/07/2020)

#### Enhancements:

###### math/Mat4

- added getInverse() method

###### math/Vec2

- added multiply() and multiplyScalar() methods

###### math/Vec3

- added multiply(), multiplyScalar(), applyQuat(), project() and unproject() methods

###### camera/Camera

- added worldMatrix and viewMatrix properties

###### loaders/TextureLoader

- allow to load medias via their source url

###### core/Curtains

- removed deprecated addPlane(), removePlane(), addRenderTarget(), removeRenderTarget(), addShaderPass() and removeShaderPass() methods

###### core/Renderer

- removed deprecated addPlane(), addRenderTarget(), and addShaderPass(), removeShaderPass() methods

#### Bug Fixes:

###### core/Plane

- allow to create a new Plane without specifying parameters

---