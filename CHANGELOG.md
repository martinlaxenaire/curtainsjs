# Changelog

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