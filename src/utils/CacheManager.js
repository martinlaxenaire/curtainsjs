/***
 Here we create a CacheManager class object
 This will store geometries attributes arrays, textures and WebGL programs in arrays
 This helps speed up slow synchronous CPU operations such as WebGL shaders compilations, images decoding, etc.

 returns :
 @this: our CacheManager class object
 ***/
export class CacheManager {
    constructor() {
        // never clear cached geometries
        this.geometries = [];

        this.clear();
    }

    /***
     Clear WebGL context depending cache arrays (used on init and context restoration)
     ***/
    clear() {
        // only cache images textures for now
        this.textures = [];

        // cached programs
        this.programs = [];
    }


    /*** GEOMETRIES ***/

    /***
     Check if this geometry is already in our cached geometries array

     params:
     @definitionID (integer): the geometry ID
     ***/
    getGeometryFromID(definitionID) {
        return this.geometries.find(element => element.id === definitionID);
    }

    /***
     Add a geometry to our cache if not already in it

     params:
     @definitionID  (integer): the geometry ID to add to our cache
     @vertices (array): vertices coordinates array to add to our cache
     @uvs (array): uvs coordinates array to add to our cache
     ***/
    addGeometry(definitionID, vertices, uvs) {
        this.geometries.push({
            id: definitionID,
            vertices: vertices,
            uvs: uvs
        });
    }


    /*** PROGRAMS ***/

    /***
     Compare two shaders strings to detect whether they are equal or not

     params:
     @firstShader (string): shader code
     @secondShader (string): shader code

     returns:
     @isSameShader (bool): whether both shaders are equal or not
     ***/
    isSameShader(firstShader, secondShader) {
        return firstShader.localeCompare(secondShader) === 0;
    }

    /***
     Returns a program from our cache if this program's vertex and fragment shaders code are the same as the one provided

     params:
     @vsCode (string): vertex shader code
     @fsCode (string): fragment shader code

     returns:
     @program (Program class object or null): our program if it has been found
     ***/
    getProgramFromShaders(vsCode, fsCode) {
        return this.programs.find((element) => {
            return this.isSameShader(element.vsCode, vsCode) && this.isSameShader(element.fsCode, fsCode);
        });
    }

    /***
     Add a program to our cache

     params :
     @program (Program class object) : program to add to our cache
     ***/
    addProgram(program) {
        this.programs.push(program);
    }


    /*** TEXTURES ***/

    /***
     Check if this source is already in our cached textures array

     params :
     @source (HTML element) : html image, video or canvas element (only images for now)
     ***/
    getTextureFromSource(source) {
        // return the texture if the source is the same and if it's not the same texture
        return this.textures.find(element => element.source && element.source.src === source.src && element.uuid !== element.uuid);
    }

    /***
     Add a texture to our cache if not already in it

     params :
     @texture (Texture class object) : texture to add to our cache
     ***/
    addTexture(texture) {
        const cachedTexture = this.getTextureFromSource(texture.source);

        if(!cachedTexture) {
            this.textures.push(texture);
        }
    }
}