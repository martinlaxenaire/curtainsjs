import { throwError } from "../utils/utils.js";

/***
 Geometry class handles attributes, VertexArrayObjects (if available) and vertices/UVs set up

 params:
 @renderer (Renderer class object): our renderer class object

 @program (object): our mesh's Program (see Program class object)
 @width (int): number of vertices along width
 @height (int): number of vertices along height
 @id (int): an integer based on geometry's width and height and used to avoid redundant buffer binding calls

 returns:
 @this: our newly created Geometry
 ***/
export class Geometry {
  constructor(renderer, { program = null, width = 1, height = 1 } = {}) {
    this.type = "Geometry";
    if (!renderer || renderer.type !== "Renderer") {
      throwError(
        this.type + ": Renderer not passed as first argument",
        renderer
      );
    } else if (!renderer.gl) {
      throwError(this.type + ": Renderer WebGL context is undefined", renderer);

      // return if no gl context
      return;
    }
    this.renderer = renderer;
    this.gl = this.renderer.gl;

    // unique plane buffers id based on width and height
    // used to get a geometry from cache
    this.definition = {
      id: width * height + width,
      width: width,
      height: height,
    };

    this.setDefaultAttributes();
    this.setVerticesUVs();
  }

  /*** CONTEXT RESTORATION ***/

  /***
     Used internally to handle context restoration after the program has been successfully compiled again
     Reset the default attributes, the vertices and UVs and the program
     ***/
  restoreContext(program) {
    this.program = null;
    this.setDefaultAttributes();
    this.setVerticesUVs();

    this.setProgram(program);
  }

  /*** SET DEFAULT ATTRIBUTES ***/

  /***
     Our geometry default attributes that will handle the buffers
     We're just using vertices positions and texture coordinates
     ***/
  setDefaultAttributes() {
    // our plane default attributes
    // if we'd want to introduce custom attributes we'd merge them with those
    this.attributes = {
      vertexPosition: {
        name: "aVertexPosition",
        size: 3,
        isActive: false,
      },
      textureCoord: {
        name: "aTextureCoord",
        size: 3,
        isActive: false,
      },
    };
  }

  /***
     Set our vertices and texture coordinates array
     Get them from the cache if possible
     ***/
  setVerticesUVs() {
    // we need to create our geometry and material objects
    const cachedGeometry = this.renderer.cache.getGeometryFromID(
      this.definition.id
    );

    if (cachedGeometry) {
      this.attributes.vertexPosition.array = cachedGeometry.vertices;
      this.attributes.textureCoord.array = cachedGeometry.uvs;
    } else {
      this.computeVerticesUVs();
      // TODO better caching? We could pass all attributes to cache and handle arrays in there
      this.renderer.cache.addGeometry(
        this.definition.id,
        this.attributes.vertexPosition.array,
        this.attributes.textureCoord.array
      );
    }
  }

  /***
     Called on init and on context restoration to set up the attribute buffers
     Use VertexArrayObjects whenever possible
     ***/
  setProgram(program) {
    this.program = program;
    this.initAttributes();

    // use vertex array objects if available
    if (this.renderer._isWebGL2) {
      this._vao = this.gl.createVertexArray();
      this.gl.bindVertexArray(this._vao);
    } else if (this.renderer.extensions["OES_vertex_array_object"]) {
      this._vao =
        this.renderer.extensions[
          "OES_vertex_array_object"
        ].createVertexArrayOES();
      this.renderer.extensions["OES_vertex_array_object"].bindVertexArrayOES(
        this._vao
      );
    }

    this.initializeBuffers();
  }

  /***
     This creates our mesh attributes and buffers by looping over it
     ***/
  initAttributes() {
    // loop through our attributes and create buffers and attributes locations
    for (const key in this.attributes) {
      // is this attribute active in our program?
      this.attributes[key].isActive = this.program.activeAttributes.includes(
        this.attributes[key].name
      );

      // if attribute is not active, no need to go further
      if (!this.attributes[key].isActive) {
        return;
      }

      this.attributes[key].location = this.gl.getAttribLocation(
        this.program.program,
        this.attributes[key].name
      );
      this.attributes[key].buffer = this.gl.createBuffer();
      this.attributes[key].numberOfItems =
        this.definition.width *
        this.definition.height *
        this.attributes[key].size *
        2;
    }
  }

  /***
     This method is used internally to create our vertices coordinates and texture UVs
     we first create our UVs on a grid from [0, 0, 0] to [1, 1, 0]
     then we use the UVs to create our vertices coords
     ***/
  computeVerticesUVs() {
    // geometry vertices and UVs
    this.attributes.vertexPosition.array = [];
    this.attributes.textureCoord.array = [];

    const vertices = this.attributes.vertexPosition.array;
    const uvs = this.attributes.textureCoord.array;

    for (let y = 0; y < this.definition.height; y++) {
      const v = y / this.definition.height;

      for (let x = 0; x < this.definition.width; x++) {
        const u = x / this.definition.width;

        // uvs and vertices
        // our uvs are ranging from 0 to 1, our vertices range from -1 to 1

        // first triangle
        uvs.push(u);
        uvs.push(v);
        uvs.push(0);

        vertices.push((u - 0.5) * 2);
        vertices.push((v - 0.5) * 2);
        vertices.push(0);

        uvs.push(u + 1 / this.definition.width);
        uvs.push(v);
        uvs.push(0);

        vertices.push((u + 1 / this.definition.width - 0.5) * 2);
        vertices.push((v - 0.5) * 2);
        vertices.push(0);

        uvs.push(u);
        uvs.push(v + 1 / this.definition.height);
        uvs.push(0);

        vertices.push((u - 0.5) * 2);
        vertices.push((v + 1 / this.definition.height - 0.5) * 2);
        vertices.push(0);

        // second triangle
        uvs.push(u);
        uvs.push(v + 1 / this.definition.height);
        uvs.push(0);

        vertices.push((u - 0.5) * 2);
        vertices.push((v + 1 / this.definition.height - 0.5) * 2);
        vertices.push(0);

        uvs.push(u + 1 / this.definition.width);
        uvs.push(v);
        uvs.push(0);

        vertices.push((u + 1 / this.definition.width - 0.5) * 2);
        vertices.push((v - 0.5) * 2);
        vertices.push(0);

        uvs.push(u + 1 / this.definition.width);
        uvs.push(v + 1 / this.definition.height);
        uvs.push(0);

        vertices.push((u + 1 / this.definition.width - 0.5) * 2);
        vertices.push((v + 1 / this.definition.height - 0.5) * 2);
        vertices.push(0);
      }
    }
  }

  /***
     This method enables and binds our attributes buffers
     ***/
  initializeBuffers() {
    if (!this.attributes) return;

    // loop through our attributes
    for (const key in this.attributes) {
      if (!this.attributes[key].isActive) continue;

      // bind attribute buffer
      this.gl.enableVertexAttribArray(this.attributes[key].location);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.attributes[key].buffer);
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        new Float32Array(this.attributes[key].array),
        this.gl.STATIC_DRAW
      );

      // set where the attribute gets its data
      this.gl.vertexAttribPointer(
        this.attributes[key].location,
        this.attributes[key].size,
        this.gl.FLOAT,
        false,
        0,
        0
      );
    }

    // bind indices if available
    if (this.indices) {
      this.indexBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      this.gl.bufferData(
        this.gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(this.indices),
        this.gl.STATIC_DRAW
      );
    }

    // update current buffers ID
    this.renderer.state.currentGeometryID = this.definition.id;
  }

  /***
     Used inside our draw call to set the correct plane buffers before drawing it
     ***/
  bindBuffers() {
    if (this._vao) {
      if (this.renderer._isWebGL2) {
        this.gl.bindVertexArray(this._vao);
      } else {
        this.renderer.extensions["OES_vertex_array_object"].bindVertexArrayOES(
          this._vao
        );
      }
    } else {
      // loop through our attributes to bind the buffers and set the attribute pointer
      for (const key in this.attributes) {
        if (!this.attributes[key].isActive) continue;

        this.gl.enableVertexAttribArray(this.attributes[key].location);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.attributes[key].buffer);
        this.gl.vertexAttribPointer(
          this.attributes[key].location,
          this.attributes[key].size,
          this.gl.FLOAT,
          false,
          0,
          0
        );
      }
    }

    // update current buffers ID
    this.renderer.state.currentGeometryID = this.definition.id;
  }

  /***
     Draw a geometry
     ***/
  draw() {
    if (this.indices) {
      this.gl.drawElements(
        this.gl.TRIANGLES,
        this.indices.length,
        this.gl.UNSIGNED_SHORT,
        0
      );
    } else {
      this.gl.drawArrays(
        this.gl.TRIANGLES,
        0,
        this.attributes.vertexPosition.numberOfItems
      );
    }
  }

  /***
     Dispose a geometry (ie delete its vertex array objects and buffers)
     ***/
  dispose() {
    // delete buffers
    // each time we check for existing properties to avoid errors
    if (this._vao) {
      if (this.renderer._isWebGL2) {
        this.gl.deleteVertexArray(this._vao);
      } else {
        this.renderer.extensions[
          "OES_vertex_array_object"
        ].deleteVertexArrayOES(this._vao);
      }
    }

    for (const key in this.attributes) {
      if (!this.attributes[key].isActive) return;

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.attributes[key].buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, 1, this.gl.STATIC_DRAW);
      this.gl.deleteBuffer(this.attributes[key].buffer);
    }

    this.attributes = null;

    // update current buffers ID
    this.renderer.state.currentGeometryID = null;
  }
}
