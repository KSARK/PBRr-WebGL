import { mat4, vec3, quat } from 'gl-matrix'
import * as twgl from 'twgl.js'

twgl.setAttributePrefix("a_");

function getAccessorAndWebGLBuffer(gl, glTF, accessorIndex) {
    const accessor = glTF.accessors[accessorIndex];
    const bufferView = glTF.bufferViews[accessor.bufferView];
    var dataOUT;
    if (!bufferView.webglBuffer) {
        const buffer = gl.createBuffer();
        const target = bufferView.target || gl.ARRAY_BUFFER;
        const arrayBuffer = glTF.buffers[bufferView.buffer];
        console.log(arrayBuffer);
        const data = new Uint8Array(arrayBuffer, bufferView.byteOffset, bufferView.byteLength);
        gl.bindBuffer(target, buffer);
        gl.bufferData(target, data, gl.STATIC_DRAW);
        bufferView.webglBuffer = buffer;
        //hard code for position and vu data
        dataOUT = new Float32Array(glTF.buffers[0], bufferView.byteOffset, bufferView.byteLength / Float32Array.BYTES_PER_ELEMENT);
    }
    return {
        accessor,
        buffer: bufferView.webglBuffer,
        stride: bufferView.stride || 0,
        data: dataOUT,
    };
}

function initVertexBuffers(gl, glTF) {
    const attribs = {};
    let numElements;
    var primitive = glTF.meshes[0].primitives[0];
    for (const [attribName, index] of Object.entries(primitive.attributes)) {
        const { accessor, buffer, stride, data } = getAccessorAndWebGLBuffer(gl, glTF, index);
        numElements = accessor.count;
        attribs[`a_${attribName}`] = {
            buffer,
            type: accessor.componentType,
            numComponents: accessorTypeToNumComponents(accessor.type),
            stride,
            offset: accessor.byteOffset | 0,
            data, data
        };
    }
    const bufferInfo = {
        attribs,
        numElements,
    };
    //setupTangent(gl, attribs);

    if (primitive.indices !== undefined) {
        const { accessor, buffer } = getAccessorAndWebGLBuffer(gl, glTF, primitive.indices);
        bufferInfo.numElements = accessor.count;
        bufferInfo.indices = buffer;
        bufferInfo.elementType = accessor.componentType;
    }
    primitive.bufferInfo = bufferInfo;


    primitive.vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, primitive.bufferInfo);

    //console.log(gl.getActiveAttrib(meshProgramInfo.program, 0));
    // 存储图元的材质信息
    //primitive.material = glJSON.materials && glJSON.materials[primitive.material] || defaultMaterial;
    return true;
}

function loadTextures(gl, glTF) {
    var textures = {};

    var material = glTF.materials[0];
    var images = glTF.images;

    var baseColorMapIndex = material.pbrMetallicRoughness.baseColorTexture.index;
    var metalRoughMapIndex = material.pbrMetallicRoughness.metallicRoughnessTexture.index;
    var normalMapIndex = material.normalTexture.index;
    var occlusionColorIndex = material.occlusionTexture.index;
    var emissiveMapIndex = material.emissiveTexture.index;
    if (!material) {
        return 0;
    }
    if (baseColorMapIndex != null) {
        textures['uBaseColorMap'] = { src: uri2URL(images[baseColorMapIndex].uri) };

    }
    if (metalRoughMapIndex != null) {
        textures['uMetalRoughMap'] = { src: uri2URL(images[metalRoughMapIndex].uri) };
    }
    if (normalMapIndex != null) {
        textures['uNormalMap'] = { src: uri2URL(images[normalMapIndex].uri) };
    }
    if (occlusionColorIndex != null) {
         textures['uAOMAP'] = { src: uri2URL(images[occlusionColorIndex].uri) };
    }
    if (emissiveMapIndex != null) {
        textures['uEmissiveMap'] = { src: uri2URL(images[emissiveMapIndex].uri) };
    }

    var glTextures = twgl.createTextures(gl, textures);
    glTF.materials[0].uniforms = {};
    Object.keys(textures).forEach(uniformV => {
        glTF.materials[0].uniforms[uniformV] = glTextures[uniformV];
    })
    //console.log(glTF.materials[0].uniforms);
}

const url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf'
const baseURL = new URL(url, location.href);
function uri2URL(uri) {
    var _url = new URL(uri, baseURL.href).href;
    // console.log(_url);
    return _url;
}

let request = new XMLHttpRequest();
request.open('GET', url);
request.responseType = 'text';
request.send();
request.onload = function () {
    var glTF;
    glTF = JSON.parse(request.response);
    // console.log(glJSON);
    var binURL = uri2URL(glTF.buffers[0].uri);
    let binReq = new XMLHttpRequest();
    binReq.open('GET', binURL);
    binReq.responseType = 'arraybuffer';
    binReq.send();
    binReq.onload = function () {
        glTF.buffers[0] = binReq.response;
        main(glTF);
        console.log(glTF);
    }
};

function spArray(n, arr) {
    var res = [], i;
    for (i = 0; i < arr.length;) {
        res.push(arr.slice(i, i += n));
    }
    return res;
}

function setupTangent(gl, glTF) {
    var attribs = glTF.meshes[0].primitives[0].bufferInfo.attribs;
    var normal = spArray(3, attribs.a_NORMAL.data);
    //var vu = spArray(2, attribs.a_TEXCOORD_0.data);


    var tangents = [];
    let i = 0;
    normal.forEach(e => {
        var c1 = vec3.create();
        vec3.cross(c1, e, [0.0, 0.0, 1.0]);
        var c2 = vec3.create();
        vec3.cross(c2, e, [0.0, 1.0, 0.0]);
        var tangent = vec3.create();
        if (vec3.length(c1) > vec3.length(c2)) {
            tangent = c1;
        }
        else {
            tangent = c2;
        }
        vec3.normalize(tangent, tangent);
        tangents[i++] = tangent[0];
        tangents[i++] = tangent[1];
        tangents[i++] = tangent[2];
    });
    glTF.meshes[0].primitives[0].bufferInfo.attribs
    var bufferInfo = twgl.createBufferInfoFromArrays(gl, { Tangent: tangents });
    twgl.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
    console.log(tangents);
}

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



function accessorTypeToNumComponents(type) {
    return accessorTypeToNumComponentsMap[type] || throwNoKey(type);
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

    loadTextures(gl, glTF);
    
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

        mat4.perspective(projectionMatrix,
            fieldOfView,
            aspect,
            zNear,
            zFar);
        cubeRotation = cubeRotation + deltaTime;

        var camPos = [0.0, 0.0, -7.0];
        var viewMatrix = mat4.create();
        mat4.lookAt(viewMatrix, camPos, [0, 0, 0], [0, 1, 0]);
        //mat4.invert(viewMatrix, viewMatrix);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        var primitive = glTF.meshes[0].primitives[0];

        gl.bindVertexArray(primitive.vao);
        //console.log(primitive.vao);
        var rotateMatrix = mat4.create();
        mat4.fromQuat(rotateMatrix, glTF.nodes[0].rotation);
        //mat4.invert(rotateMatrix, rotateMatrix);
        mat4.rotate(rotateMatrix,
            rotateMatrix,
            cubeRotation,
            //0,
            [0, 0, 1]
        );
        gl.useProgram(meshProgramInfo.program);
        twgl.setBuffersAndAttributes(gl, meshProgramInfo, primitive.bufferInfo);
        twgl.setUniforms(meshProgramInfo, {
            u_projectionM: projectionMatrix,
            u_viewM: viewMatrix,
            u_rotateM: rotateMatrix,
        });

        var material = glTF.materials[0];
        twgl.setUniforms(meshProgramInfo, material.uniforms);
        

        var lightPosition = vec3.create();
        lightPosition = [1, 3, -6];
        //vec3.rotateY(lightPosition, lightPosition, [0, 0, 0], cubeRotation);
        //console.log(lightPosition);
        twgl.setUniforms(meshProgramInfo, {
            uLightPosition: lightPosition,
            uCamPosition: camPos,
            uLightRadius: 3,
            uLightColor: [50, 50, 50],
        });

        //twgl.setUniforms(meshProgramInfo, sharedUniforms);
        twgl.drawBufferInfo(gl, primitive.bufferInfo);

        requestAnimationFrame(render);

    };
    requestAnimationFrame(render);

    render();



    //TODO: setupCubeMap


}




