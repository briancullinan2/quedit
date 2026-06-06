/* eslint-disable camelcase */

(function (THREE) {
    if (!THREE && typeof require !== 'undefined') {
        THREE = require('three');
    }
    if (!THREE) {
        console.error("Q3BSPLoader: 'THREE' global object not found. Ensure Three.js is loaded first.");
        return;
    }

    /**
     * Q3BSPLoader converts parsed Quake 3 BSP maps into native Three.js hierarchies.
     * Fully combined standalone implementation running compilation directly on the rendering thread.
     */
    THREE.Q3BSPLoader = class Q3BSPLoader extends THREE.Loader {
        constructor(manager) {
            super(manager !== undefined ? manager : THREE.DefaultLoadingManager);
            this.tesselationLevel = 5;
        }

        load(url, onLoad, onProgress, onError) {
            var scope = this;
            var loader = new THREE.FileLoader(scope.manager);
            loader.setPath(scope.path);
            loader.setResponseType("arraybuffer");

            loader.load(url, function (buffer) {
                onLoad(scope.parse(buffer));
            }, onProgress, onError);
        }

        setTesselationLevel(value) {
            this.tesselationLevel = value;
            return this;
        }

        parse(data) {
            var rootNode = new THREE.Group();
            rootNode.name = "Q3BSP_Map";

            rootNode.userData = {
                entities: {},
                planes: [],
                nodes: [],
                leaves: [],
                brushes: [],
                brushSides: [],
                leafBrushes: [],
                surfaces: [],
                visBuffer: null,
                visSize: 0
            };

            if (data.type === "geometry" || data.vertices) {
                return this._buildFromMeshData(data, rootNode);
            }

            return this._parseRawBinaryBuffer(data, rootNode);
        }

        _buildFromMeshData(meshData, rootNode) {
            var rawVertices = meshData.vertices;
            var rawIndices = meshData.indices;
            var surfaces = meshData.surfaces || [];
            var stride = 14;

            // Iterate over each surface group individually
            for (var s = 0; s < surfaces.length; s++) {
                var surface = surfaces[s];
                if (surface.elementCount === 0) continue;

                // Create a completely separate geometry and mesh instance for this surface
                var geometry = new THREE.BufferGeometry();

                // Track unique indices for this specific sub-mesh
                var subIndices = [];
                var subPositions = [];
                var subNormals = [];
                var subUvs = [];
                var subColors = [];

                // Map to track global vertex references to our new local arrays
                var vertMap = {};
                var localVertCount = 0;

                // Extract only the indices and vertices assigned to this specific group
                var indexStart = surface.indexOffset / 4;
                var indexEnd = indexStart + surface.elementCount;

                for (var i = indexStart; i < indexEnd; i++) {
                    var globalVertIdx = rawIndices[i];

                    if (vertMap[globalVertIdx] === undefined) {
                        vertMap[globalVertIdx] = localVertCount;
                        var idx = globalVertIdx * stride;

                        // Swizzle and push attributes locally
                        subPositions.push(rawVertices[idx], rawVertices[idx + 2], -rawVertices[idx + 1]);
                        subUvs.push(rawVertices[idx + 3], 1.0 - rawVertices[idx + 4]);
                        subNormals.push(rawVertices[idx + 7], rawVertices[idx + 9], -rawVertices[idx + 8]);
                        subColors.push(rawVertices[idx + 10], rawVertices[idx + 11], rawVertices[idx + 12], rawVertices[idx + 13]);

                        localVertCount++;
                    }
                    subIndices.push(vertMap[globalVertIdx]);
                }

                // Hydrate our independent sub-geometry
                geometry.setAttribute("position", new THREE.Float32BufferAttribute(subPositions, 3));
                geometry.setAttribute("normal", new THREE.Float32BufferAttribute(subNormals, 3));
                geometry.setAttribute("uv", new THREE.Float32BufferAttribute(subUvs, 2));
                geometry.setAttribute("color", new THREE.Float32BufferAttribute(subColors, 4));
                geometry.setIndex(subIndices.length > 65535 ? new THREE.BufferAttribute(new Uint32Array(subIndices), 1) : new THREE.BufferAttribute(new Uint16Array(subIndices), 1));

                geometry.computeVertexNormals();
                geometry.computeBoundingBox();
                geometry.computeBoundingSphere();

                var textureLoader = new THREE.TextureLoader();

                // Clean up the shader name string to get a relative image path
                // e.g., converts "textures/base_wall/concrete" to "textures/base_wall/concrete.jpg"
                var shaderPath = surface.shaderName;
                if (shaderPath && shaderPath !== "noshader") {
                    // If your assets are hosted on a static server, point to that folder base:
                    var assetUrl = "https://quake.games/demoq3/pak0.pk3dir/" + shaderPath + ".jpg";

                    // Load the texture asset
                    var texture = textureLoader.load(assetUrl, function (tex) {
                        // Optional: Trigger a scene repaint once the image finishes downloading asynchronously
                        if (window.getRendererConfig) { /* force context redraw if needed */ }
                    });

                    // CRUCIAL: Fix the Quake to WebGL orientation differences we talked about
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.flipY = false; // Prevents the image from loading upside down relative to your 1.0 - uv math
                }

                // Pass it to your material configuration
                var mat = new THREE.MeshPhongMaterial({
                    name: surface.shaderName || "default_bsp",
                    vertexColors: true,
                    side: THREE.DoubleSide,
                    map: texture || window.defaultTexture // Fall back to nunu's standard texture if the image fails to load
                });


                
                var surfaceMesh = new THREE.Mesh(geometry, mat);
                surfaceMesh.name = (surface.shaderName !== "noshader") ? surface.shaderName : "surface_" + s;

                // Expose attributes directly on userData for your ANTLR/background editor mutations
                surfaceMesh.userData = {
                    geomType: surface.geomType,
                    indexOffset: surface.indexOffset,
                    elementCount: surface.elementCount
                };

                // Add to tree as its own unique object entity
                rootNode.add(surfaceMesh);
            }

            if (meshData.entities) { rootNode.userData.entities = meshData.entities; }
            if (meshData.bsp) { rootNode.userData.bspTree = meshData.bsp; }

            return rootNode;
        }

        _parseRawBinaryBuffer(buffer, rootNode) {
            var view = new DataView(buffer);
            var ptr = 0;

            var magic = view.getUint32(ptr, true); ptr += 4;
            var version = view.getUint32(ptr, true); ptr += 4;

            if (magic !== 1347633737 || version !== 46) {
                console.error("Q3BSPLoader: Invalid BSP magic block or unexpected structural version.");
                return rootNode;
            }

            var lumps = [];
            for (var i = 0; i < 17; i++) {
                var offset = view.getInt32(ptr, true);
                var length = view.getInt32(ptr + 4, true); // Read 4 bytes ahead for length
                lumps.push({
                    offset: offset,
                    length: length
                });
                ptr += 8; // Advance past both Int32 fields
            }

            // Lump 0: Parse Entities
            var entLump = lumps[0];
            if (entLump.length > 0) {
                var fullBytes = new Uint8Array(buffer);
                var entBytes = fullBytes.subarray(entLump.offset, entLump.offset + entLump.length);
                var entString = (typeof TextDecoder !== "undefined") ? new TextDecoder().decode(entBytes) : "";
                if (!entString) {
                    for (var b = 0; b < entBytes.length; b++) { entString += String.fromCharCode(entBytes[b]); }
                }
                rootNode.userData.entities = this._parseEntityString(entString);
            }

            // Lump 1: Parse Shaders (Updated for safety)
            var shaderLump = lumps[1];
            var shaderCount = shaderLump.length / 72;
            var shaders = [];
            var sPtr = shaderLump.offset;

            // Create a safe, low-level shared byte view of the entire file
            var masterByteView = new Uint8Array(buffer);

            for (var i = 0; i < shaderCount; i++) {
                // Prevent reading past the end of the file if lump counts are malformed
                if (sPtr + 64 > buffer.byteLength) break;

                // FIX: Use subarray instead of constructor slicing to bypass alignment rules
                var nameBytes = masterByteView.subarray(sPtr, sPtr + 64);
                var endName = nameBytes.indexOf(0);
                var shaderName = new TextDecoder().decode(nameBytes.subarray(0, endName !== -1 ? endName : 64)).trim();

                if (shaderName) {
                    shaders.push({
                        shaderName: shaderName,
                        flags: view.getInt32(sPtr + 64, true),
                        contents: view.getInt32(sPtr + 68, true),
                        faces: [],
                        indexOffset: 0,
                        elementCount: 0,
                        visible: true
                    });
                }
                sPtr += 72;
            }

            // Always guarantee 'noshader' exists at index 1 as a baseline fallback
            if (!shaders[1]) {
                shaders[1] = { shaderName: 'noshader', flags: 0, contents: 1, faces: [], indexOffset: 0, elementCount: 0, visible: true };
            }

            // Lump 14: Parse Lightmaps
            var lmLump = lumps[14];
            var lightmapSize = 128 * 128;
            var lmCount = lmLump.length / (lightmapSize * 3);
            var gridSize = 2;
            while (gridSize * gridSize < lmCount) { gridSize *= 2; }
            var textureSize = gridSize * 128;
            var xOffset = 0, yOffset = 0;
            var lightmapRects = [];

            for (var i = 0; i < lmCount; i++) {
                lightmapRects.push({
                    x: xOffset / textureSize,
                    y: yOffset / textureSize,
                    xScale: 128 / textureSize,
                    yScale: 128 / textureSize
                });
                xOffset += 128;
                if (xOffset >= textureSize) {
                    yOffset += 128;
                    xOffset = 0;
                }
            }

            // Lump 10: Parse Vertices
            var vertLump = lumps[10];
            var vertCount = vertLump.length / 44;
            var verts = [];
            var vPtr = vertLump.offset;
            for (var i = 0; i < vertCount; i++) {
                var colorULong = view.getUint32(vPtr + 40, true);
                verts.push({
                    pos: [view.getFloat32(vPtr, true), view.getFloat32(vPtr + 4, true), view.getFloat32(vPtr + 8, true)],
                    texCoord: [view.getFloat32(vPtr + 12, true), view.getFloat32(vPtr + 16, true)],
                    lmCoord: [view.getFloat32(vPtr + 20, true), view.getFloat32(vPtr + 24, true)],
                    lmNewCoord: [0, 0],
                    normal: [view.getFloat32(vPtr + 28, true), view.getFloat32(vPtr + 32, true), view.getFloat32(vPtr + 36, true)],
                    color: [
                        (colorULong & 0xFF) / 0xFF * 4.0,
                        ((colorULong & 0xFF00) >> 8) / 0xFF * 4.0,
                        ((colorULong & 0xFF0000) >> 16) / 0xFF * 4.0,
                        1.0
                    ]
                });
                // Cap extreme color factors
                for (var c = 0; c < 3; c++) { if (verts[i].color[c] > 1.0) verts[i].color[c] = 1.0; }
                vPtr += 44;
            }

            // Lump 11: Parse Mesh Vertices (Indices Map) with buffer boundaries guard
            var meshVertLump = lumps[11];
            var meshVertCount = meshVertLump.length / 4;
            var meshVerts = [];
            var mvPtr = meshVertLump.offset;

            for (var i = 0; i < meshVertCount; i++) {
                // Safety check: break early if the lump size description overshoots the physical file length
                if (mvPtr + 4 > view.byteLength) {
                    console.warn(`Q3BSPLoader: Mesh vertex lump data truncated early at index ${i}/${meshVertCount} due to EOF boundary.`);
                    break;
                }
                meshVerts.push(view.getInt32(mvPtr, true));
                mvPtr += 4;
            }

            // Lump 13: Parse Faces
            var faceLump = lumps[13];
            var faceCount = faceLump.length / 104;
            var faces = [];
            var fPtr = faceLump.offset;
            for (var i = 0; i < faceCount; i++) {
                faces.push({
                    shader: view.getInt32(fPtr, true),
                    effect: view.getInt32(fPtr + 4, true),
                    type: view.getInt32(fPtr + 8, true),
                    vertex: view.getInt32(fPtr + 12, true),
                    vertCount: view.getInt32(fPtr + 16, true),
                    meshVert: view.getInt32(fPtr + 20, true),
                    meshVertCount: view.getInt32(fPtr + 24, true),
                    lightmap: view.getInt32(fPtr + 28, true),
                    lmStart: [view.getInt32(fPtr + 32, true), view.getInt32(fPtr + 36, true)],
                    lmSize: [view.getInt32(fPtr + 40, true), view.getInt32(fPtr + 44, true)],
                    lmOrigin: [view.getFloat32(fPtr + 48, true), view.getFloat32(fPtr + 52, true), view.getFloat32(fPtr + 56, true)],
                    lmVecs: [
                        [view.getFloat32(fPtr + 60, true), view.getFloat32(fPtr + 64, true), view.getFloat32(fPtr + 68, true)],
                        [view.getFloat32(fPtr + 72, true), view.getFloat32(fPtr + 76, true), view.getFloat32(fPtr + 80, true)]
                    ],
                    normal: [view.getFloat32(fPtr + 84, true), view.getFloat32(fPtr + 88, true), view.getFloat32(fPtr + 92, true)],
                    size: [view.getInt32(fPtr + 96, true), view.getInt32(fPtr + 100, true)],
                    indexOffset: -1
                });
                fPtr += 104;
            }

            // Heavy Lifting: Inline Map Geometry Compilation 
            for (var i = 0; i < faces.length; ++i) {
                var face = faces[i];
                if (face.type === 1 || face.type === 2 || face.type === 3) {

                    // FIX: Safe lookup with a automatic fallback to 'noshader' (index 1) if out of bounds
                    var shader = shaders[face.shader];
                    if (!shader) {
                        console.warn(`Q3BSPLoader: Face ${i} references invalid shader index ${face.shader}. Falling back to noshader.`);
                        face.shader = 1; // Remap index to 'noshader'
                        shader = shaders[1];
                    }

                    // Double-check guard just in case the shaders array is entirely empty or broken
                    if (shader && shader.faces) {
                        shader.faces.push(face);
                        var lightmap = lightmapRects[face.lightmap] || lightmapRects[0];

                        if (face.type === 1 || face.type === 3) {
                            shader.geomType = face.type;
                            for (var j = 0; j < face.meshVertCount; ++j) {
                                var vert = verts[face.vertex + meshVerts[face.meshVert + j]];
                                if (vert) {
                                    vert.lmNewCoord[0] = (vert.lmCoord[0] * lightmap.xScale) + lightmap.x;
                                    vert.lmNewCoord[1] = (vert.lmCoord[1] * lightmap.yScale) + lightmap.y;
                                }
                            }
                        } else if (face.type === 2) {
                            this._tesselateSurface(face, verts, meshVerts, this.tesselationLevel);
                            for (var j = 0; j < face.vertCount; ++j) {
                                var vert = verts[face.vertex + j];
                                if (vert) {
                                    vert.lmNewCoord[0] = (vert.lmCoord[0] * lightmap.xScale) + lightmap.x;
                                    vert.lmNewCoord[1] = (vert.lmCoord[1] * lightmap.yScale) + lightmap.y;
                                }
                            }
                        }
                    }
                }
            }

            // Linearly flatten spatial vertex data structures
            var vertices = new Float32Array(verts.length * 14);
            var offset = 0;
            for (var i = 0; i < verts.length; ++i) {
                var vert = verts[i];
                vertices[offset++] = vert.pos[0];
                vertices[offset++] = vert.pos[1];
                vertices[offset++] = vert.pos[2];
                vertices[offset++] = vert.texCoord[0];
                vertices[offset++] = vert.texCoord[1];
                vertices[offset++] = vert.lmNewCoord[0];
                vertices[offset++] = vert.lmNewCoord[1];
                vertices[offset++] = vert.normal[0];
                vertices[offset++] = vert.normal[1];
                vertices[offset++] = vert.normal[2];
                vertices[offset++] = vert.color[0];
                vertices[offset++] = vert.color[1];
                vertices[offset++] = vert.color[2];
                vertices[offset++] = vert.color[3];
            }

            var rawIndices = [];
            for (var i = 0; i < shaders.length; ++i) {
                var shader = shaders[i];
                if (shader.faces.length > 0) {
                    shader.indexOffset = rawIndices.length * 4;
                    for (var j = 0; j < shader.faces.length; ++j) {
                        var face = shader.faces[j];
                        face.indexOffset = rawIndices.length * 4;
                        for (var k = 0; k < face.meshVertCount; ++k) {
                            rawIndices.push(face.vertex + meshVerts[face.meshVert + k]);
                        }
                        shader.elementCount += face.meshVertCount;
                    }
                }
                shader.faces = null;
            }

            // Lump BSP Tree nodes into context memory for ray tracking operations
            var planeLump = lumps[2], nodeLump = lumps[3], leafLump = lumps[4];
            var leafFaceLump = lumps[5], leafBrushLump = lumps[6], brushLump = lumps[8], brushSideLump = lumps[9];

            rootNode.userData.planes = this._parseBlockElements(view, planeLump.offset, planeLump.length / 16, 16, (v, p) => ({ normal: [v.getFloat32(p, true), v.getFloat32(p + 4, true), v.getFloat32(p + 8, true)], distance: v.getFloat32(p + 12, true) }));
            rootNode.userData.nodes = this._parseBlockElements(view, nodeLump.offset, nodeLump.length / 36, 36, (v, p) => ({ plane: v.getInt32(p, true), children: [v.getInt32(p + 4, true), v.getInt32(p + 8, true)], min: [v.getInt32(p + 12, true), v.getInt32(p + 16, true), v.getInt32(p + 20, true)], max: [v.getInt32(p + 24, true), v.getInt32(p + 28, true), v.getInt32(p + 32, true)] }));
            rootNode.userData.leaves = this._parseBlockElements(view, leafLump.offset, leafLump.length / 48, 48, (v, p) => ({ cluster: v.getInt32(p, true), area: v.getInt32(p + 4, true), min: [v.getInt32(p + 8, true), v.getInt32(p + 12, true), v.getInt32(p + 16, true)], max: [v.getInt32(p + 20, true), v.getInt32(p + 24, true), v.getInt32(p + 28, true)], leafFace: v.getInt32(p + 32, true), leafFaceCount: v.getInt32(p + 36, true), leafBrush: v.getInt32(p + 40, true), leafBrushCount: v.getInt32(p + 44, true) }));
            rootNode.userData.leafFaces = this._parseBlockElements(view, leafFaceLump.offset, leafFaceLump.length / 4, 4, (v, p) => v.getInt32(p, true));
            rootNode.userData.leafBrushes = this._parseBlockElements(view, leafBrushLump.offset, leafBrushLump.length / 4, 4, (v, p) => v.getInt32(p, true));
            rootNode.userData.brushes = this._parseBlockElements(view, brushLump.offset, brushLump.length / 12, 12, (v, p) => ({ brushSide: v.getInt32(p, true), brushSideCount: v.getInt32(p + 4, true), shader: v.getInt32(p + 8, true) }));
            rootNode.userData.brushSides = this._parseBlockElements(view, brushSideLump.offset, brushSideLump.length / 8, 8, (v, p) => ({ plane: v.getInt32(p, true), shader: v.getInt32(p + 4, true) }));

            // FIX: Guarded Visibility Lump check to prevent reading past final physical EOF boundaries
            var visLump = lumps[16];
            if (visLump && visLump.length > 8 && (visLump.offset + 8) <= buffer.byteLength) {
                var nVecs = view.getInt32(visLump.offset, true);
                var size = view.getInt32(visLump.offset + 4, true);
                var byteCount = nVecs * size;

                // Absolute bounds double check against overall buffer allocation
                if (visLump.offset + 8 + byteCount <= buffer.byteLength) {
                    var visBuffer = new Uint8Array(buffer, visLump.offset + 8, byteCount);
                    rootNode.userData.visBuffer = Array.from(visBuffer);
                    rootNode.userData.visSize = size;
                }
            }

            // Complete the mesh generation channel passing views downstream
            return this._buildFromMeshData({
                vertices: vertices,          // Keep as Float32Array
                indices: new Uint32Array(rawIndices), // Keep as Uint32Array
                surfaces: shaders
            }, rootNode);
        }

        _parseBlockElements(view, start, count, stride, handler) {
            var elements = [];
            var pos = start;
            for (var i = 0; i < count; i++) {
                elements.push(handler(view, pos));
                pos += stride;
            }
            return elements;
        }

        _tesselateSurface(face, verts, meshVerts, level) {
            var off = face.vertex;
            var L1 = level + 1;

            face.vertex = verts.length;
            face.meshVert = meshVerts.length;
            face.vertCount = 0;
            face.meshVertCount = 0;

            for (var py = 0; py < face.size[1] - 2; py += 2) {
                for (var px = 0; px < face.size[0] - 2; px += 2) {
                    var rowOff = (py * face.size[0]);

                    var c0 = verts[off + rowOff + px], c1 = verts[off + rowOff + px + 1], c2 = verts[off + rowOff + px + 2];
                    rowOff += face.size[0];
                    var c3 = verts[off + rowOff + px], c4 = verts[off + rowOff + px + 1], c5 = verts[off + rowOff + px + 2];
                    rowOff += face.size[0];
                    var c6 = verts[off + rowOff + px], c7 = verts[off + rowOff + px + 1], c8 = verts[off + rowOff + px + 2];

                    var indexOff = face.vertCount;
                    face.vertCount += L1 * L1;

                    for (var i = 0; i < L1; ++i) {
                        var a = i / level;
                        verts.push({
                            pos: this._getCurvePt3(c0.pos, c3.pos, c6.pos, a),
                            texCoord: this._getCurvePt2(c0.texCoord, c3.texCoord, c6.texCoord, a),
                            lmCoord: this._getCurvePt2(c0.lmCoord, c3.lmCoord, c6.lmCoord, a),
                            color: [this._getCurvePt3(c0.color, c3.color, c6.color, a)[0], this._getCurvePt3(c0.color, c3.color, c6.color, a)[1], this._getCurvePt3(c0.color, c3.color, c6.color, a)[2], 1],
                            lmNewCoord: [0, 0], normal: [0, 0, 1]
                        });
                    }

                    for (var i = 1; i < L1; i++) {
                        var a = i / level;
                        var pc0 = this._getCurvePt3(c0.pos, c1.pos, c2.pos, a), pc1 = this._getCurvePt3(c3.pos, c4.pos, c5.pos, a), pc2 = this._getCurvePt3(c6.pos, c7.pos, c8.pos, a);
                        var tc0 = this._getCurvePt3(c0.texCoord, c1.texCoord, c2.texCoord, a), tc1 = this._getCurvePt3(c3.texCoord, c4.texCoord, c5.texCoord, a), tc2 = this._getCurvePt3(c6.texCoord, c7.texCoord, c8.texCoord, a);
                        var lc0 = this._getCurvePt3(c0.lmCoord, c1.lmCoord, c2.lmCoord, a), lc1 = this._getCurvePt3(c3.lmCoord, c4.lmCoord, c5.lmCoord, a), lc2 = this._getCurvePt3(c6.lmCoord, c7.lmCoord, c8.lmCoord, a);
                        var cc0 = this._getCurvePt3(c0.color, c1.color, c2.color, a), cc1 = this._getCurvePt3(c3.color, c4.color, c5.color, a), cc2 = this._getCurvePt3(c6.color, c7.color, c8.color, a);

                        for (var j = 0; j < L1; j++) {
                            var b = j / level;
                            var colorRes = this._getCurvePt3(cc0, cc1, cc2, b);
                            verts.push({
                                pos: this._getCurvePt3(pc0, pc1, pc2, b),
                                texCoord: this._getCurvePt2(tc0, tc1, tc2, b),
                                lmCoord: this._getCurvePt2(lc0, lc1, lc2, b),
                                color: [colorRes[0], colorRes[1], colorRes[2], 1],
                                lmNewCoord: [0, 0], normal: [0, 0, 1]
                            });
                        }
                    }

                    face.meshVertCount += level * level * 6;
                    for (var row = 0; row < level; ++row) {
                        for (var col = 0; col < level; ++col) {
                            meshVerts.push(indexOff + (row + 1) * L1 + col);
                            meshVerts.push(indexOff + row * L1 + col);
                            meshVerts.push(indexOff + row * L1 + (col + 1));
                            meshVerts.push(indexOff + (row + 1) * L1 + col);
                            meshVerts.push(indexOff + row * L1 + (col + 1));
                            meshVerts.push(indexOff + (row + 1) * L1 + (col + 1));
                        }
                    }
                }
            }
        }

        _getCurvePt3(c0, c1, c2, dist) {
            var b = 1.0 - dist;
            return [
                c0[0] * (b * b) + c1[0] * (2 * b * dist) + c2[0] * (dist * dist),
                c0[1] * (b * b) + c1[1] * (2 * b * dist) + c2[1] * (dist * dist),
                c0[2] * (b * b) + c1[2] * (2 * b * dist) + c2[2] * (dist * dist)
            ];
        }

        _getCurvePt2(c0, c1, c2, dist) {
            var b = 1.0 - dist;
            return [
                c0[0] * (b * b) + c1[0] * (2 * b * dist) + c2[0] * (dist * dist),
                c0[1] * (b * b) + c1[1] * (2 * b * dist) + c2[1] * (dist * dist)
            ];
        }

        _parseEntityString(str) {
            var entities = [];
            var currentEntity = null;
            var matches = str.match(/[^\r\n]+/g) || [];

            for (var i = 0; i < matches.length; i++) {
                var line = matches[i].trim();
                if (line === "{") {
                    currentEntity = {};
                } else if (line === "}") {
                    if (currentEntity) { entities.push(currentEntity); }
                    currentEntity = null;
                } else if (currentEntity) {
                    var propMatch = line.match(/"([^"]+)"\s+"([^"]+)"/);
                    if (propMatch) {
                        var key = propMatch[1], val = propMatch[2];
                        if (key === 'origin') {
                            var coords = val.split(' ');
                            currentEntity[key] = [parseFloat(coords[0]), parseFloat(coords[1]), parseFloat(coords[2])];
                        } else if (key === 'angle') {
                            currentEntity[key] = parseFloat(val);
                        } else {
                            currentEntity[key] = val;
                        }
                    }
                }
            }
            return entities;
        }
    };





})(typeof window !== "undefined" ? window.THREE : global.THREE);

window.capturedScenes = [];
window.addEventListener('observe', function (e) {
    if (e.detail && (e.detail.type === "Scene" || e.detail.isScene)) {
        window.capturedScenes.push(e.detail);
        window.scene = e.detail;
        console.log("🎯 Caught active scene target context! Accessible via window.scene");
    }
}, true);

function importBSP() {
    const { Q3BSPLoader, Scene } = require('three')
    var bspLoader = new Q3BSPLoader();
    var activeScene = window.nunu.getScene();

    bspLoader.load("https://quake.games/demoq3/pak0.pk3dir/maps/q3dm17.bsp", function (bspGroup) {
        bspGroup.name = "q3dm17_Map";

        bspGroup.traverse(function (child) {
            // 1. Core WebGL rendering flags
            if (child.isMesh) {
                child.frustumCulled = false;
                child.matrixAutoUpdate = true;
            }

            // 2. GUI Tree Hydration: Stub out missing nunuStudio requirements
            // This prevents 'isEmpty is not a function' type errors in bundle.js
            if (typeof child.isEmpty !== 'function') {
                child.isEmpty = function () {
                    return this.children ? this.children.length === 0 : true;
                };
            }

            if (typeof child.toJSON !== 'function') {
                child.toJSON = function (meta) {
                    // Fallback to basic standard Object3D serialization if called by the editor saver
                    return THREE.Object3D.prototype.toJSON.call(this, meta);
                };
            }
        });

        // Also secure the top-level group container itself
        if (typeof bspGroup.isEmpty !== 'function') {
            bspGroup.isEmpty = function () { return false; };
        }

        // Add the safe, wrapped asset straight into the editor environment
        window.nunu.addObject(bspGroup, activeScene);
        console.log("BSP successfully injected with UI stubs!");
    });
}
