var MinimalGLTFLoader = require('./minimal-gltf-loader.js');
import {mat4} from 'gl-matrix'
import * as twgl from 'twgl.js'

twgl.setAttributePrefix("a_");

function Cuboid(minX, maxX, minY, maxY, minZ, maxZ) {
    this.minX = minX;
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;
    this.minZ = minZ;
    this.maxZ = maxZ;
}

Cuboid.prototype = {
    constructor: Cuboid,
    CenterX: function () {
        return (this.minX + this.maxX) / 2.0;
    },
    CenterY: function () {
        return (this.minY + this.maxY) / 2.0;
    },
    CenterZ: function () {
        return (this.minZ + this.maxZ) / 2.0;
    },
    LengthX: function () {
        return (this.maxX - this.minX);
    },
    LengthY: function () {
        return (this.maxY - this.minY);
    }
}

function getAccessorAndWebGLBuffer(gl, gltf, accessorIndex) {
    const accessor = gltf.accessors[accessorIndex];
    const bufferView = gltf.bufferViews[accessor.bufferView];
    if (!bufferView.webglBuffer) {
        const buffer = gl.createBuffer();
        const target = bufferView.target || gl.ARRAY_BUFFER;
        const arrayBuffer = gltf.buffers[bufferView.buffer];
        const data = new Uint8Array(arrayBuffer, bufferView.byteOffset, bufferView.byteLength);
        gl.bindBuffer(target, buffer);
        gl.bufferData(target, data, gl.STATIC_DRAW);
        bufferView.webglBuffer = buffer;
    }
    return {
        accessor,
        buffer: bufferView.webglBuffer,
        stride: bufferView.stride || 0,
    };
}

function loadTexture(gl, glTF, index) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
 
    // Set the parameters so we don't need mips
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
 
    // Upload the image into the texture.
    var mipLevel = 0;               // the largest mip
    var internalFormat = gl.RGBA;   // format we want in the texture
    var srcFormat = gl.RGBA;        // format of data we are supplying
    var srcType = gl.UNSIGNED_BYTE; // type of data we are supplying
    gl.texImage2D(gl.TEXTURE_2D,
                  mipLevel,
                  internalFormat,
                  srcFormat,
                  srcType,
                  glTF.images[index]);
 
    // add the texture to the array of textures.
    return texture;
}

function loadTextures(gl, glTF) {
    var textures = [];
    
    var material = glTF.materials[0]
    var baseColorMap =  material.pbrMetallicRoughness.baseColorTexture.index;
    var metalRoughMap = material.pbrMetallicRoughness.metallicRoughnessTexture.index;
    var normalMap = material.normalTexture.index;
    //var occlusionColor = material.occlusionTexture.index;
    //var emissiveMap = material.emissiveTexture.index;
    if (!material) {
        return 0;
    }
    if (baseColorMap != null) {
        textures.push({texObj:loadTexture(gl, glTF, baseColorMap), name: 'uBaseColor'});
    }
    if (metalRoughMap != null) {
        textures.push({texObj: loadTexture(gl, glTF, metalRoughMap), name: 'uMetalRoughMap'});
    }
    if (normalMap != null) {
        textures.push({texObj: loadTexture(gl, glTF, normalMap), name: 'uNormalMap'})
    }
    var n = 0;
    textures.forEach(texture =>{
        var samplerLocation = gl.getUniformLocation(meshProgramInfo.program, texture.name);
        gl.uniform1i(samplerLocation, 0);
        gl.activeTexture(gl.TEXTURE0 + n);
        gl.bindTexture(gl.TEXTURE_2D, texture.texObj);
        n++;
        console.log(texture.name+' have loaded.');
    });

    return true;
}

var glJSON;


var url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf'


//mouse event handler
//Reference: 
var glTFLoader = new MinimalGLTFLoader.glTFLoader();
glTFLoader.loadGLTF(url, function (glTF) {
    console.log(glTF);
    let request = new XMLHttpRequest();
    request.open('GET', url);
    request.responseType = 'text';
    request.send();
    request.onload = function () {
        glJSON = JSON.parse(request.response);
        const baseURL = new URL(url, location.href);
        // console.log(glJSON);
        var binURL = new URL(glJSON.buffers[0].uri, baseURL.href).href;
        let binReq = new XMLHttpRequest();
        binReq.open('GET', binURL);
        binReq.responseType = 'arraybuffer';
        binReq.send();
        binReq.onload = function () {
            glJSON.buffers[0] = binReq.response;
            //console.log(glJSON);
            main(glTF);
        }
    };
});



function throwNoKey(key) {
    throw new Error(`no key: ${key}`);
  }
   
const accessorTypeToNumComponentsMap = {
    'SCALAR': 1,
    'VEC2': 2,
    'VEC3': 3,
    'VEC4': 4,
    'MAT2': 4,
    'MAT3': 9,
    'MAT4': 16,
};

const defaultMaterial = {
    uniform: {
        u_diffuse:[.5, .8, 1, 1],
    },
};

function accessorTypeToNumComponents(type) {
    return accessorTypeToNumComponentsMap[type] || throwNoKey(type);
}



function initVertexBuffers(gl) {
    const attribs = {};
    let numElements;
    var primitive = glJSON.meshes[0].primitives[0];
    for (const [attribName, index] of Object.entries(primitive.attributes)) {
      const {accessor, buffer, stride} = getAccessorAndWebGLBuffer(gl, glJSON, index);
      numElements = accessor.count;
      attribs[`a_${attribName}`] = {
        buffer,
        type: accessor.componentType,
        numComponents: accessorTypeToNumComponents(accessor.type),
        stride,
        offset: accessor.byteOffset | 0,
      };
    }
    const bufferInfo = {
        attribs,
        numElements,
    };

    if (primitive.indices !== undefined) {
        const { accessor, buffer } = getAccessorAndWebGLBuffer(gl, glJSON, primitive.indices);
        bufferInfo.numElements = accessor.count;
        bufferInfo.indices = buffer;
        bufferInfo.elementType = accessor.componentType;
    }

    primitive.bufferInfo = bufferInfo;
    primitive.vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, primitive.bufferInfo);
    // 存储图元的材质信息
    //primitive.material = glJSON.materials && glJSON.materials[primitive.material] || defaultMaterial;
    return 1;
}

var cubeRotation = 0.0;
var canvas = document.querySelector('#pbr-test');
var gl = canvas.getContext('webgl2');
const meshProgramInfo = twgl.createProgramInfo(gl, ["vs", "fs"]);
console.log(meshProgramInfo);

function main(glTF) {
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(.1, .1, .1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    
    var n = initVertexBuffers(gl, glTF)
    //console.log(gl.program);
    if (n <= 0) {
        console.log('Failed to set the vertex buffer');
        return;
    }

    if (!loadTextures(gl, glTF)) {
        console.log('Failed to set the Texture!');
    }

    //TODO: setupPBRMaterial

    //TODO: setupCubeMap
    
    var then = 0.0;
    var render = function (time) {
        if (isNaN(time)) {
            time = 0;
        }
        time *= 0.001;  // convert to seconds
        var deltaTime = time - then;
        then = time;
        const fieldOfView = 45 * Math.PI / 180;   // in radians
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        const zNear = 0.1;
        const zFar = 1000.0;
        const projectionMatrix = mat4.create();

        // note: glmatrix.js always has the first argument
        // as the destination to receive the result.
        mat4.perspective(projectionMatrix,
            fieldOfView,
            aspect,
            zNear,
            zFar);

        // Set the drawing position to the "identity" point, which is
        // the center of the scene.
        const modelViewMatrix = mat4.create();

        // Now move the drawing position a bit to where we want to
        // start drawing the square.
        cubeRotation = cubeRotation + deltaTime;
        //console.log(cubeRotation);
        mat4.translate(modelViewMatrix,     
            modelViewMatrix,
            [0.0, 0.0, -5.0]);  
        mat4.rotate(modelViewMatrix,  // destination matrix
            modelViewMatrix,  // matrix to rotate
            cubeRotation,     // amount to rotate in radians
            [0, 1, 0]);       // axis to rotate around (Y)
        mat4.rotate(modelViewMatrix,  // destination matrix
            modelViewMatrix,  // matrix to rotate
            90,// amount to rotate in radians
            [1, 0, 0]);       // axis to rotate around (X)

        const normalMatrix = mat4.create();
        mat4.invert(normalMatrix, modelViewMatrix);
        mat4.transpose(normalMatrix, normalMatrix);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        var primitive = glJSON.meshes[0].primitives[0];
        //gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0);
        gl.useProgram(meshProgramInfo.program);
        gl.bindVertexArray(primitive.vao);
        //console.log(primitive.vao);
        twgl.setBuffersAndAttributes(gl, meshProgramInfo, primitive.bufferInfo);
        twgl.setUniforms(meshProgramInfo, {
            u_projectionM: projectionMatrix,
            u_modelViewM: modelViewMatrix,
            u_normalM: normalMatrix,
        });
        twgl.setUniforms(meshProgramInfo, primitive.material.uniforms);
        //twgl.setUniforms(meshProgramInfo, sharedUniforms);
        twgl.drawBufferInfo(gl, primitive.bufferInfo);

        requestAnimationFrame(render);
        
    };
    requestAnimationFrame(render);
    
    render();
}




