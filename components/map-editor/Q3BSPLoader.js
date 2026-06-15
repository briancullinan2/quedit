/* eslint-disable camelcase */

(function () {
    // =========================================================================
    // DUAL-PURPOSE MODULE (front-end + worker)
    // -------------------------------------------------------------------------
    // The CPU-heavy part of loading a Q3 BSP -- binary lump parsing, bezier
    // patch tessellation and the per-surface vertex de-duplication -- used to
    // run synchronously on the main thread inside parse(), which froze the
    // editor for the whole duration of a map load.
    //
    // That work is pure number crunching with no DOM/THREE dependency, so this
    // exact file is loaded a second time as a Web Worker. When it detects a
    // worker context (no `window`, but `self`/`importScripts` present) it only
    // installs an onmessage handler that parses the buffer and streams each
    // finished surface back to the page. On the main thread THREE.Q3BSPLoader
    // spawns that worker and, for every surface message, runs processBatch()
    // which builds the (nunuStudio-compatible) mesh and performs the real
    // rootNode.add(surfaceMesh).
    // =========================================================================
    const hasWindow = (typeof window !== 'undefined');
    const isWorker = !hasWindow
        && (typeof self !== 'undefined')
        && (typeof importScripts === 'function');

    // -------------------------------------------------------------------------
    // SHARED PURE PARSING (no THREE / no DOM -- safe in either context)
    // -------------------------------------------------------------------------

    function getCurvePt3(c0, c1, c2, dist) {
        let b = 1.0 - dist;
        return [
            c0[0] * (b * b) + c1[0] * (2 * b * dist) + c2[0] * (dist * dist),
            c0[1] * (b * b) + c1[1] * (2 * b * dist) + c2[1] * (dist * dist),
            c0[2] * (b * b) + c1[2] * (2 * b * dist) + c2[2] * (dist * dist)
        ];
    }

    function getCurvePt2(c0, c1, c2, dist) {
        let b = 1.0 - dist;
        return [
            c0[0] * (b * b) + c1[0] * (2 * b * dist) + c2[0] * (dist * dist),
            c0[1] * (b * b) + c1[1] * (2 * b * dist) + c2[1] * (dist * dist)
        ];
    }

    function tesselateSurface(face, verts, meshVerts, level) {
        let off = face.vertex;
        let L1 = level + 1;

        face.vertex = verts.length;
        face.meshVert = meshVerts.length;
        face.vertCount = 0;
        face.meshVertCount = 0;

        for (let py = 0; py < face.size[1] - 2; py += 2) {
            for (let px = 0; px < face.size[0] - 2; px += 2) {
                let rowOff = (py * face.size[0]);

                let c0 = verts[off + rowOff + px], c1 = verts[off + rowOff + px + 1], c2 = verts[off + rowOff + px + 2];
                rowOff += face.size[0];
                let c3 = verts[off + rowOff + px], c4 = verts[off + rowOff + px + 1], c5 = verts[off + rowOff + px + 2];
                rowOff += face.size[0];
                let c6 = verts[off + rowOff + px], c7 = verts[off + rowOff + px + 1], c8 = verts[off + rowOff + px + 2];

                let indexOff = face.vertCount;
                face.vertCount += L1 * L1;

                for (let i = 0; i < L1; ++i) {
                    let a = i / level;
                    verts.push({
                        pos: getCurvePt3(c0.pos, c3.pos, c6.pos, a),
                        texCoord: getCurvePt2(c0.texCoord, c3.texCoord, c6.texCoord, a),
                        lmCoord: getCurvePt2(c0.lmCoord, c3.lmCoord, c6.lmCoord, a),
                        color: [getCurvePt3(c0.color, c3.color, c6.color, a)[0], getCurvePt3(c0.color, c3.color, c6.color, a)[1], getCurvePt3(c0.color, c3.color, c6.color, a)[2], 1],
                        lmNewCoord: [0, 0], normal: [0, 0, 1]
                    });
                }

                for (let i = 1; i < L1; i++) {
                    let a = i / level;
                    let pc0 = getCurvePt3(c0.pos, c1.pos, c2.pos, a), pc1 = getCurvePt3(c3.pos, c4.pos, c5.pos, a), pc2 = getCurvePt3(c6.pos, c7.pos, c8.pos, a);
                    let tc0 = getCurvePt3(c0.texCoord, c1.texCoord, c2.texCoord, a), tc1 = getCurvePt3(c3.texCoord, c4.texCoord, c5.texCoord, a), tc2 = getCurvePt3(c6.texCoord, c7.texCoord, c8.texCoord, a);
                    let lc0 = getCurvePt3(c0.lmCoord, c1.lmCoord, c2.lmCoord, a), lc1 = getCurvePt3(c3.lmCoord, c4.lmCoord, c5.lmCoord, a), lc2 = getCurvePt3(c6.lmCoord, c7.lmCoord, c8.lmCoord, a);
                    let cc0 = getCurvePt3(c0.color, c1.color, c2.color, a), cc1 = getCurvePt3(c3.color, c4.color, c5.color, a), cc2 = getCurvePt3(c6.color, c7.color, c8.color, a);

                    for (let j = 0; j < L1; j++) {
                        let b = j / level;
                        let colorRes = getCurvePt3(cc0, cc1, cc2, b);
                        verts.push({
                            pos: getCurvePt3(pc0, pc1, pc2, b),
                            texCoord: getCurvePt2(tc0, tc1, tc2, b),
                            lmCoord: getCurvePt2(lc0, lc1, lc2, b),
                            color: [colorRes[0], colorRes[1], colorRes[2], 1],
                            lmNewCoord: [0, 0], normal: [0, 0, 1]
                        });
                    }
                }

                face.meshVertCount += level * level * 6;
                for (let row = 0; row < level; ++row) {
                    for (let col = 0; col < level; ++col) {
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

    function parseBlockElements(view, start, count, stride, handler) {
        let elements = [];
        let pos = start;
        for (let i = 0; i < count; i++) {
            elements.push(handler(view, pos));
            pos += stride;
        }
        return elements;
    }

    function parseEntityString(str) {
        let entities = [];
        let currentEntity = null;
        let matches = str.match(/[^\r\n]+/g) || [];

        for (let i = 0; i < matches.length; i++) {
            let line = matches[i].trim();
            if (line === "{") {
                currentEntity = {};
            } else if (line === "}") {
                if (currentEntity) { entities.push(currentEntity); }
                currentEntity = null;
            } else if (currentEntity) {
                let propMatch = line.match(/"([^"]+)"\s+"([^"]+)"/);
                if (propMatch) {
                    let key = propMatch[1], val = propMatch[2];
                    if (key === 'origin') {
                        let coords = val.split(' ');
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

    // Parse a raw BSP ArrayBuffer into transferable mesh data. Returns
    // { vertices: Float32Array(stride 14), indices: Uint32Array, surfaces: [],
    //   entities: [], userData: {} }. No THREE objects are created here so it
    // can run inside the worker.
    function parseRawBSP(buffer, tesselationLevel) {
        const userData = {
            entities: [], planes: [], nodes: [], leaves: [], leafFaces: [],
            leafBrushes: [], brushes: [], brushSides: [], visBuffer: null, visSize: 0
        };

        let view = new DataView(buffer);
        let ptr = 0;

        let magic = view.getUint32(ptr, true); ptr += 4;
        let version = view.getUint32(ptr, true); ptr += 4;

        if (magic !== 1347633737 || version !== 46) {
            console.error("Q3BSPLoader: Invalid BSP magic block or unexpected structural version.");
            return { vertices: new Float32Array(0), indices: new Uint32Array(0), surfaces: [], entities: [], userData: userData, error: true };
        }

        let lumps = [];
        for (let i = 0; i < 17; i++) {
            let offset = view.getInt32(ptr, true);
            let length = view.getInt32(ptr + 4, true);
            lumps.push({ offset: offset, length: length });
            ptr += 8;
        }

        let entities = [];
        let entLump = lumps[0];
        if (entLump.length > 0) {
            let fullBytes = new Uint8Array(buffer);
            let entBytes = fullBytes.subarray(entLump.offset, entLump.offset + entLump.length);
            let entString = (typeof TextDecoder !== "undefined") ? new TextDecoder().decode(entBytes) : "";
            if (!entString) {
                for (let b = 0; b < entBytes.length; b++) { entString += String.fromCharCode(entBytes[b]); }
            }
            entities = parseEntityString(entString);
            userData.entities = entities;
        }

        let shaderLump = lumps[1];
        let shaderCount = shaderLump.length / 72;
        let shaders = [];
        let sPtr = shaderLump.offset;
        let masterByteView = new Uint8Array(buffer);

        for (let i = 0; i < shaderCount; i++) {
            if (sPtr + 64 > buffer.byteLength) break;

            let nameBytes = masterByteView.subarray(sPtr, sPtr + 64);
            let endName = nameBytes.indexOf(0);
            let shaderName = new TextDecoder().decode(nameBytes.subarray(0, endName !== -1 ? endName : 64)).trim();

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

        if (!shaders[1]) {
            shaders[1] = { shaderName: 'noshader', flags: 0, contents: 1, faces: [], indexOffset: 0, elementCount: 0, visible: true };
        }

        let lmLump = lumps[14];
        let lightmapSize = 128 * 128;
        let lmCount = lmLump.length / (lightmapSize * 3);
        let gridSize = 2;
        while (gridSize * gridSize < lmCount) { gridSize *= 2; }
        let textureSize = gridSize * 128;
        let xOffset = 0, yOffset = 0;
        let lightmapRects = [];

        for (let i = 0; i < lmCount; i++) {
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

        let vertLump = lumps[10];
        let vertCount = vertLump.length / 44;
        let verts = [];
        let vPtr = vertLump.offset;
        for (let i = 0; i < vertCount; i++) {
            let colorULong = view.getUint32(vPtr + 40, true);
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
            for (let c = 0; c < 3; c++) { if (verts[i].color[c] > 1.0) verts[i].color[c] = 1.0; }
            vPtr += 44;
        }

        let meshVertLump = lumps[11];
        let meshVertCount = meshVertLump.length / 4;
        let meshVerts = [];
        let mvPtr = meshVertLump.offset;

        for (let i = 0; i < meshVertCount; i++) {
            if (mvPtr + 4 > view.byteLength) { break; }
            meshVerts.push(view.getInt32(mvPtr, true));
            mvPtr += 4;
        }

        let faceLump = lumps[13];
        let faceCount = faceLump.length / 104;
        let faces = [];
        let fPtr = faceLump.offset;
        for (let i = 0; i < faceCount; i++) {
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

        for (let i = 0; i < faces.length; ++i) {
            let face = faces[i];
            if (face.type === 1 || face.type === 2 || face.type === 3) {
                let shader = shaders[face.shader];
                if (!shader) {
                    face.shader = 1;
                    shader = shaders[1];
                }

                if (shader && shader.faces) {
                    shader.faces.push(face);
                    let lightmap = lightmapRects[face.lightmap] || lightmapRects[0];

                    if (face.type === 1 || face.type === 3) {
                        shader.geomType = face.type;
                        for (let j = 0; j < face.meshVertCount; ++j) {
                            let vert = verts[face.vertex + meshVerts[face.meshVert + j]];
                            if (vert) {
                                vert.lmNewCoord[0] = (vert.lmCoord[0] * lightmap.xScale) + lightmap.x;
                                vert.lmNewCoord[1] = (vert.lmCoord[1] * lightmap.yScale) + lightmap.y;
                            }
                        }
                    } else if (face.type === 2) {
                        tesselateSurface(face, verts, meshVerts, tesselationLevel);
                        for (let j = 0; j < face.vertCount; ++j) {
                            let vert = verts[face.vertex + j];
                            if (vert) {
                                vert.lmNewCoord[0] = (vert.lmCoord[0] * lightmap.xScale) + lightmap.x;
                                vert.lmNewCoord[1] = (vert.lmCoord[1] * lightmap.yScale) + lightmap.y;
                            }
                        }
                    }
                }
            }
        }

        let vertices = new Float32Array(verts.length * 14);
        let offset = 0;
        for (let i = 0; i < verts.length; ++i) {
            let vert = verts[i];
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

        let rawIndices = [];
        for (let i = 0; i < shaders.length; ++i) {
            let shader = shaders[i];
            if (shader.faces.length > 0) {
                shader.indexOffset = rawIndices.length * 4;
                for (let j = 0; j < shader.faces.length; ++j) {
                    let face = shader.faces[j];
                    face.indexOffset = rawIndices.length * 4;
                    for (let k = 0; k < face.meshVertCount; ++k) {
                        rawIndices.push(face.vertex + meshVerts[face.meshVert + k]);
                    }
                    shader.elementCount += face.meshVertCount;
                }
            }
            shader.faces = null;
        }

        let planeLump = lumps[2], nodeLump = lumps[3], leafLump = lumps[4];
        let leafFaceLump = lumps[5], leafBrushLump = lumps[6], brushLump = lumps[8], brushSideLump = lumps[9];

        userData.planes = parseBlockElements(view, planeLump.offset, planeLump.length / 16, 16, (v, p) => ({ normal: [v.getFloat32(p, true), v.getFloat32(p + 4, true), v.getFloat32(p + 8, true)], distance: v.getFloat32(p + 12, true) }));
        userData.nodes = parseBlockElements(view, nodeLump.offset, nodeLump.length / 36, 36, (v, p) => ({ plane: v.getInt32(p, true), children: [v.getInt32(p + 4, true), v.getInt32(p + 8, true)], min: [v.getInt32(p + 12, true), v.getInt32(p + 16, true), v.getInt32(p + 20, true)], max: [v.getInt32(p + 24, true), v.getInt32(p + 28, true), v.getInt32(p + 32, true)] }));
        userData.leaves = parseBlockElements(view, leafLump.offset, leafLump.length / 48, 48, (v, p) => ({ cluster: v.getInt32(p, true), area: v.getInt32(p + 4, true), min: [v.getInt32(p + 8, true), v.getInt32(p + 12, true), v.getInt32(p + 16, true)], max: [v.getInt32(p + 20, true), v.getInt32(p + 24, true), v.getInt32(p + 28, true)], leafFace: v.getInt32(p + 32, true), leafFaceCount: v.getInt32(p + 36, true), leafBrush: v.getInt32(p + 40, true), leafBrushCount: v.getInt32(p + 44, true) }));
        userData.leafFaces = parseBlockElements(view, leafFaceLump.offset, leafFaceLump.length / 4, 4, (v, p) => v.getInt32(p, true));
        userData.leafBrushes = parseBlockElements(view, leafBrushLump.offset, leafBrushLump.length / 4, 4, (v, p) => v.getInt32(p, true));
        userData.brushes = parseBlockElements(view, brushLump.offset, brushLump.length / 12, 12, (v, p) => ({ brushSide: v.getInt32(p, true), brushSideCount: v.getInt32(p + 4, true), shader: v.getInt32(p + 8, true) }));
        userData.brushSides = parseBlockElements(view, brushSideLump.offset, brushSideLump.length / 8, 8, (v, p) => ({ plane: v.getInt32(p, true), shader: v.getInt32(p + 4, true) }));

        let visLump = lumps[16];
        if (visLump && visLump.length > 8 && (visLump.offset + 8) <= buffer.byteLength) {
            let nVecs = view.getInt32(visLump.offset, true);
            let size = view.getInt32(visLump.offset + 4, true);
            let byteCount = nVecs * size;

            if (visLump.offset + 8 + byteCount <= buffer.byteLength) {
                let visBuffer = new Uint8Array(buffer, visLump.offset + 8, byteCount);
                userData.visBuffer = Array.from(visBuffer);
                userData.visSize = size;
            }
        }

        return {
            vertices: vertices,
            indices: new Uint32Array(rawIndices),
            surfaces: shaders,
            entities: entities,
            userData: userData
        };
    }

    // De-duplicate one surface's vertices into compact, transferable attribute
    // arrays. `indices` is returned as a plain Array so THREE.setIndex() picks
    // the right Uint16/Uint32 attribute, exactly as the original code did.
    function extractSurfaceGeometry(meshData, s) {
        const surfaces = meshData.surfaces || [];
        const surface = surfaces[s];
        if (!surface || surface.elementCount === 0) return null;

        const rawVertices = meshData.vertices;
        const rawIndices = meshData.indices;
        const stride = 14;

        let subIndices = [];
        let subPositions = [];
        let subNormals = [];
        let subUvs = [];
        let subColors = [];

        let vertMap = {};
        let localVertCount = 0;

        let indexStart = surface.indexOffset / 4;
        let indexEnd = indexStart + surface.elementCount;

        for (let i = indexStart; i < indexEnd; i++) {
            let globalVertIdx = rawIndices[i];

            if (vertMap[globalVertIdx] === undefined) {
                vertMap[globalVertIdx] = localVertCount;
                let idx = globalVertIdx * stride;

                subPositions.push(rawVertices[idx], rawVertices[idx + 2], -rawVertices[idx + 1]);
                subUvs.push(rawVertices[idx + 3], 1.0 - rawVertices[idx + 4]);
                subNormals.push(rawVertices[idx + 7], rawVertices[idx + 9], -rawVertices[idx + 8]);
                subColors.push(rawVertices[idx + 10], rawVertices[idx + 11], rawVertices[idx + 12], rawVertices[idx + 13]);

                localVertCount++;
            }
            subIndices.push(vertMap[globalVertIdx]);
        }

        return {
            index: s,
            shaderName: surface.shaderName,
            geomType: surface.geomType,
            indexOffset: surface.indexOffset,
            elementCount: surface.elementCount,
            positions: new Float32Array(subPositions),
            normals: new Float32Array(subNormals),
            uvs: new Float32Array(subUvs),
            colors: new Float32Array(subColors),
            indices: subIndices
        };
    }

    // -------------------------------------------------------------------------
    // WORKER CONTEXT: parse the buffer, stream each surface back, then stop.
    // -------------------------------------------------------------------------
    if (isWorker) {
        self.onmessage = function (e) {
            const msg = e.data || {};
            if (msg.cmd !== 'parse') return;

            let meshData;
            try {
                meshData = parseRawBSP(msg.buffer, msg.tesselationLevel || 5);
            } catch (err) {
                self.postMessage({ type: 'error', message: String((err && err.message) || err) });
                return;
            }

            const surfaces = meshData.surfaces || [];
            let emitted = 0;
            for (let s = 0; s < surfaces.length; s++) {
                const surf = extractSurfaceGeometry(meshData, s);
                if (!surf) continue;
                emitted++;
                // Hand the attribute buffers off without copying. (indices stays
                // a plain Array so it is structured-cloned instead.)
                self.postMessage(
                    { type: 'surface', surface: surf },
                    [surf.positions.buffer, surf.normals.buffer, surf.uvs.buffer, surf.colors.buffer]
                );
            }

            self.postMessage({ type: 'done', count: emitted, entities: meshData.entities, userData: meshData.userData });
        };
        return;
    }

    // -------------------------------------------------------------------------
    // MAIN-THREAD CONTEXT: THREE is required from here down.
    // -------------------------------------------------------------------------
    const SELF_SCRIPT_URL = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src)
        || '/components/map-editor/Q3BSPLoader.js';

    let THREE = (hasWindow && window.THREE) ? window.THREE : (typeof require !== 'undefined' ? require('three') : null);
    if (!THREE) {
        console.error("Q3BSPLoader: 'THREE' global object not found. Ensure Three.js is loaded first.");
        return;
    }

    // =========================================================================
    // INTERNAL SHADER PIPELINE INTEGRATION (Procedural Quake 3 -> GLSL)
    // =========================================================================

    const shaderTokenizer = function (src) {
        // Strip out comments
        src = src.replace(/\/\/.*$/mg, ''); // C++ style (//...)
        src = src.replace(/\/\*[^*\/]*\*\//mg, ''); // C style (/*...*/)
        this.tokens = src.match(/[^\s\n\r\"]+/mg);
        this.offset = 0;
    };

    shaderTokenizer.prototype.EOF = function () {
        if (this.tokens === null) { return true; }
        let token = this.tokens[this.offset];
        while (token === '' && this.offset < this.tokens.length) {
            this.offset++;
            token = this.tokens[this.offset];
        }
        return this.offset >= this.tokens.length;
    };

    shaderTokenizer.prototype.next = function () {
        if (this.tokens === null) { return; }
        let token = '';
        while (token === '' && this.offset < this.tokens.length) {
            token = this.tokens[this.offset++];
        }
        return token;
    };

    shaderTokenizer.prototype.prev = function () {
        if (this.tokens === null) { return; }
        let token = '';
        while (token === '' && this.offset >= 0) {
            token = this.tokens[this.offset--];
        }
        return token;
    };

    const q3shader = {
        registry: {} // Centralized repository caching lookups matching active textures
    };


    q3shader.loadList = async function (sources, onload) {
        let promises = []
        for (let i = 0; i < sources.length; ++i) {
            promises.push(q3shader.load(sources[i], onload));
        }
        return await Promise.all(promises)
    };

    q3shader.load = async function (url, onload) {
        try {
            // Match the high-fidelity CORS profile used by your other asset streams
            const response = await fetch(url, {
                mode: 'cors',
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error(`HTTP network error! Status: ${response.status}`);
            }

            const shaderText = await response.text();

            // Execute the legacy callback handler seamlessly
            if (typeof onload === 'function') {
                q3shader.parse(url, shaderText, onload);
            }
        } catch (error) {
            console.error(`[Shader Fetch Failure] Unable to load resource from: ${url}`, error);
        }
    };


    q3shader.parse = function (url, src) {
        let shaders = [];
        let tokens = new shaderTokenizer(src);

        while (!tokens.EOF()) {
            let name = tokens.next();
            let shader = q3shader.parseShader(name, tokens);
            if (shader) {
                shader.url = url;
                if (shader.stages) {
                    for (let i = 0; i < shader.stages.length; ++i) {
                        shader.stages[i].shaderSrc = q3shader.buildShaderSource(shader, shader.stages[i]);
                    }
                }
                // Cache locally inside the wrapper frame for fast geometric mapping
                q3shader.registry[name.toLowerCase()] = shader;
            }
            shaders.push(shader);
        }
        return shaders;
    };

    q3shader.parseShader = function (name, tokens) {
        let brace = tokens.next();
        if (brace != '{') { return null; }

        let shader = {
            name: name,
            cull: 'back',
            sky: false,
            blend: false,
            opaque: false,
            sort: 0,
            vertexDeforms: [],
            stages: []
        };

        while (!tokens.EOF()) {
            let token = tokens.next().toLowerCase();
            if (token == '}') { break; }

            switch (token) {
                case '{': {
                    let stage = q3shader.parseStage(tokens);
                    if (stage.isLightmap && (stage.hasBlendFunc)) {
                        stage.blendSrc = 'GL_DST_COLOR';
                        stage.blendDest = 'GL_ZERO';
                    }
                    if (stage.alphaGen == 'lightingspecular') {
                        stage.blendSrc = 'GL_ONE';
                        stage.blendDest = 'GL_ZERO';
                        stage.hasBlendFunc = false;
                        stage.depthWrite = true;
                        shader.stages = [];
                    }
                    if (stage.hasBlendFunc) { shader.blend = true; } else { shader.opaque = true; }
                    shader.stages.push(stage);
                } break;

                case 'cull':
                    shader.cull = tokens.next();
                    break;
                case 'deformvertexes':
                    let deform = { type: tokens.next().toLowerCase() };
                    switch (deform.type) {
                        case 'wave':
                            deform.spread = 1.0 / parseFloat(tokens.next());
                            deform.waveform = q3shader.parseWaveform(tokens);
                            break;
                        default: deform = null; break;
                    }
                    if (deform) { shader.vertexDeforms.push(deform); }
                    break;
                case 'sort':
                    let sort = tokens.next().toLowerCase();
                    switch (sort) {
                        case 'portal': shader.sort = 1; break;
                        case 'sky': shader.sort = 2; break;
                        case 'opaque': shader.sort = 3; break;
                        case 'banner': shader.sort = 6; break;
                        case 'underwater': shader.sort = 8; break;
                        case 'additive': shader.sort = 9; break;
                        case 'nearest': shader.sort = 16; break;
                        default: shader.sort = parseInt(sort); break;
                    }
                    break;
                case 'surfaceparm':
                    let param = tokens.next().toLowerCase();
                    if (param === 'sky') { shader.sky = true; }
                    break;
                default: break;
            }
        }
        if (!shader.sort) { shader.sort = (shader.opaque ? 3 : 9); }
        return shader;
    };

    q3shader.parseStage = function (tokens) {
        let stage = {
            map: null, clamp: false, tcGen: 'base', rgbGen: 'identity', rgbWaveform: null,
            alphaGen: '1.0', alphaFunc: null, alphaWaveform: null, blendSrc: 'GL_ONE',
            blendDest: 'GL_ZERO', hasBlendFunc: false, tcMods: [], animMaps: [],
            animFreq: 0, depthFunc: 'lequal', depthWrite: true
        };

        while (!tokens.EOF()) {
            let token = tokens.next();
            if (token == '}') { break; }

            switch (token.toLowerCase()) {
                case 'clampmap':
                    stage.clamp = true;
                case 'map':
                    stage.map = tokens.next().replace(/(\.jpg|\.tga)/, '.png');
                    break;
                case 'animmap':
                    stage.map = 'anim';
                    stage.animFreq = parseFloat(tokens.next());
                    let nextMap = tokens.next();
                    while (nextMap.match(/(\.jpg|\.tga)/)) {
                        stage.animMaps.push(nextMap.replace(/(\.jpg|\.tga)/, '.png'));
                        nextMap = tokens.next();
                    }
                    tokens.prev();
                    break;
                case 'rgbgen':
                    stage.rgbGen = tokens.next().toLowerCase();
                    if (stage.rgbGen === 'wave') {
                        stage.rgbWaveform = q3shader.parseWaveform(tokens);
                        if (!stage.rgbWaveform) { stage.rgbGen = 'identity'; }
                    }
                    break;
                case 'alphagen':
                    stage.alphaGen = tokens.next().toLowerCase();
                    if (stage.alphaGen === 'wave') {
                        stage.alphaWaveform = q3shader.parseWaveform(tokens);
                        if (!stage.alphaWaveform) { stage.alphaGen = '1.0'; }
                    }
                    break;
                case 'alphafunc':
                    stage.alphaFunc = tokens.next().toUpperCase();
                    break;
                case 'blendfunc':
                    stage.blendSrc = tokens.next();
                    stage.hasBlendFunc = true;
                    if (!stage.depthWriteOverride) { stage.depthWrite = false; }
                    switch (stage.blendSrc) {
                        case 'add':
                            stage.blendSrc = 'GL_ONE'; stage.blendDest = 'GL_ONE';
                            break;
                        case 'blend':
                            stage.blendSrc = 'GL_SRC_ALPHA'; stage.blendDest = 'GL_ONE_MINUS_SRC_ALPHA';
                            break;
                        case 'filter':
                            stage.blendSrc = 'GL_DST_COLOR'; stage.blendDest = 'GL_ZERO';
                            break;
                        default:
                            stage.blendDest = tokens.next();
                            break;
                    }
                    break;
                case 'depthfunc':
                    stage.depthFunc = tokens.next().toLowerCase();
                    break;
                case 'depthwrite':
                    stage.depthWrite = true;
                    stage.depthWriteOverride = true;
                    break;
                case 'tcmod':
                    let tcMod = { type: tokens.next().toLowerCase() };
                    switch (tcMod.type) {
                        case 'rotate':
                            tcMod.angle = parseFloat(tokens.next()) * (3.1415 / 180);
                            break;
                        case 'scale':
                            tcMod.scaleX = parseFloat(tokens.next());
                            tcMod.scaleY = parseFloat(tokens.next());
                            break;
                        case 'scroll':
                            tcMod.sSpeed = parseFloat(tokens.next());
                            tcMod.tSpeed = parseFloat(tokens.next());
                            break;
                        case 'stretch':
                            tcMod.waveform = q3shader.parseWaveform(tokens);
                            if (!tcMod.waveform) { tcMod.type = null; }
                            break;
                        case 'turb':
                            tcMod.turbulance = {
                                base: parseFloat(tokens.next()), amp: parseFloat(tokens.next()),
                                phase: parseFloat(tokens.next()), freq: parseFloat(tokens.next())
                            };
                            break;
                        default: tcMod.type = null; break;
                    }
                    if (tcMod.type) { stage.tcMods.push(tcMod); }
                    break;
                case 'tcgen':
                    stage.tcGen = tokens.next();
                    break;
                default: break;
            }
        }
        if (stage.blendSrc == 'GL_ONE' && stage.blendDest == 'GL_ZERO') {
            stage.hasBlendFunc = false;
            stage.depthWrite = true;
        }
        stage.isLightmap = (stage.map == '$lightmap');
        return stage;
    };

    q3shader.parseWaveform = function (tokens) {
        return {
            funcName: tokens.next().toLowerCase(),
            base: parseFloat(tokens.next()),
            amp: parseFloat(tokens.next()),
            phase: parseFloat(tokens.next()),
            freq: parseFloat(tokens.next())
        };
    };

    q3shader.buildShaderSource = function (shader, stage) {
        return {
            vertex: q3shader.buildVertexShader(shader, stage),
            fragment: q3shader.buildFragmentShader(shader, stage)
        };
    };

    q3shader.buildVertexShader = function (stageShader, stage) {
        let shader = new shaderBuilder();

        // REMOVED manual 'position', 'normal', and 'color' to prevent redefinition errors.
        // Three.js automatically injects these attributes under the hood.
        shader.addAttribs({
            // Only keep layout definitions not standard to Three.js if needed
        });

        shader.addVaryings({
            vTexCoord: 'vec2',
            vColor: 'vec4',
        });

        // REMOVED 'modelViewMat', 'projectionMat', and 'time' from manual uniforms 
        // if Three.js supplies them (Three uses modelViewMatrix and projectionMatrix).
        shader.addUniforms({
            time: 'float',
        });

        if (stage.isLightmap) {
            shader.addAttribs({ lightCoord: 'vec2' });
        } else {
            // Three.js natively includes 'uv', but Q3 layout maps to 'texCoord'
            shader.addAttribs({ texCoord: 'vec2' });
        }

        shader.addLines(['vec3 defPosition = position;']);

        for (let i = 0; i < stageShader.vertexDeforms.length; ++i) {
            let deform = stageShader.vertexDeforms[i];
            if (deform.type === 'wave') {
                let name = 'deform' + i;
                let offName = 'deformOff' + i;
                shader.addLines(['float ' + offName + ' = (position.x + position.y + position.z) * ' + deform.spread.toFixed(4) + ';']);
                let phase = deform.waveform.phase;
                deform.waveform.phase = phase.toFixed(4) + ' + ' + offName;
                shader.addWaveform(name, deform.waveform);
                deform.waveform.phase = phase;
                shader.addLines(['defPosition += normal * ' + name + ';']);
            }
        }

        shader.addLines(['vec4 worldPosition = modelViewMat * vec4(defPosition, 1.0);']);
        shader.addLines(['vColor = color;']);

        if (stage.tcGen == 'environment') {
            shader.addLines([
                'vec3 viewer = normalize(-worldPosition.xyz);',
                'float d = dot(normal, viewer);',
                'vec3 reflected = normal*2.0*d - viewer;',
                'vTexCoord = vec2(0.5, 0.5) + reflected.xy * 0.5;'
            ]);
        } else {
            if (stage.isLightmap) {
                shader.addLines(['vTexCoord = lightCoord;']);
            } else {
                shader.addLines(['vTexCoord = texCoord;']);
            }
        }

        for (let i = 0; i < stage.tcMods.length; ++i) {
            let tcMod = stage.tcMods[i];
            switch (tcMod.type) {
                case 'rotate':
                    shader.addLines([
                        'float r = ' + tcMod.angle.toFixed(4) + ' * time;',
                        'vTexCoord -= vec2(0.5, 0.5);',
                        'vTexCoord = vec2(vTexCoord.s * cos(r) - vTexCoord.t * sin(r), vTexCoord.t * cos(r) + vTexCoord.s * sin(r));',
                        'vTexCoord += vec2(0.5, 0.5);',
                    ]);
                    break;
                case 'scroll':
                    shader.addLines(['vTexCoord += vec2(' + tcMod.sSpeed.toFixed(4) + ' * time, ' + tcMod.tSpeed.toFixed(4) + ' * time);']);
                    break;
                case 'scale':
                    shader.addLines(['vTexCoord *= vec2(' + tcMod.scaleX.toFixed(4) + ', ' + tcMod.scaleY.toFixed(4) + ');']);
                    break;
                case 'stretch':
                    shader.addWaveform('stretchWave', tcMod.waveform);
                    shader.addLines([
                        'stretchWave = 1.0 / stretchWave;',
                        'vTexCoord *= stretchWave;',
                        'vTexCoord += vec2(0.5 - (0.5 * stretchWave), 0.5 - (0.5 * stretchWave));',
                    ]);
                    break;
                case 'turb':
                    let tName = 'turbTime' + i;
                    shader.addLines([
                        'float ' + tName + ' = ' + tcMod.turbulance.phase.toFixed(4) + ' + time * ' + tcMod.turbulance.freq.toFixed(4) + ';',
                        'vTexCoord.s += sin( ( ( position.x + position.z )* 1.0/128.0 * 0.125 + ' + tName + ' ) * 6.283) * ' + tcMod.turbulance.amp.toFixed(4) + ';',
                        'vTexCoord.t += sin( ( position.y * 1.0/128.0 * 0.125 + ' + tName + ' ) * 6.283) * ' + tcMod.turbulance.amp.toFixed(4) + ';'
                    ]);
                    break;
            }
        }

        if (stage.alphaGen === 'lightingspecular') {
            shader.addAttribs({ lightCoord: 'vec2' });
            shader.addVaryings({ vLightCoord: 'vec2' });
            shader.addLines(['vLightCoord = lightCoord;']);
        }

        shader.addLines(['gl_Position = projectionMat * worldPosition;']);
        return shader.getSource();
    };

    q3shader.buildFragmentShader = function (stageShader, stage) {
        let shader = new shaderBuilder();
        shader.addVaryings({ vTexCoord: 'vec2', vColor: 'vec4' });
        shader.addUniforms({ texture: 'sampler2D', time: 'float' });
        shader.addLines(['vec4 texColor = texture2D(texture, vTexCoord.st);']);

        switch (stage.rgbGen) {
            case 'vertex':
                shader.addLines(['vec3 rgb = texColor.rgb * vColor.rgb;']);
                break;
            case 'wave':
                shader.addWaveform('rgbWave', stage.rgbWaveform);
                shader.addLines(['vec3 rgb = texColor.rgb * rgbWave;']);
                break;
            default:
                shader.addLines(['vec3 rgb = texColor.rgb;']);
                break;
        }

        switch (stage.alphaGen) {
            case 'wave':
                shader.addWaveform('alpha', stage.alphaWaveform);
                break;
            case 'lightingspecular':
                shader.addUniforms({ lightmap: 'sampler2D' });
                shader.addVaryings({ vLightCoord: 'vec2', vLight: 'float' });
                shader.addLines([
                    'vec4 light = texture2D(lightmap, vLightCoord.st);',
                    'rgb *= light.rgb;',
                    'rgb += light.rgb * texColor.a * 0.6;',
                    'float alpha = 1.0;'
                ]);
                break;
            default:
                shader.addLines(['float alpha = texColor.a;']);
                break;
        }

        if (stage.alphaFunc) {
            switch (stage.alphaFunc) {
                case 'GT0': shader.addLines(['if(alpha == 0.0) { discard; }']); break;
                case 'LT128': shader.addLines(['if(alpha >= 0.5) { discard; }']); break;
                case 'GE128': shader.addLines(['if(alpha < 0.5) { discard; }']); break;
            }
        }

        shader.addLines(['gl_FragColor = vec4(rgb, alpha);']);
        return shader.getSource();
    };

    const shaderBuilder = function () {
        this.attrib = {}; this.varying = {}; this.uniform = {}; this.functions = {}; this.statements = [];
    };

    shaderBuilder.prototype.addAttribs = function (attribs) {
        for (let name in attribs) { this.attrib[name] = 'attribute ' + attribs[name] + ' ' + name + ';'; }
    };
    shaderBuilder.prototype.addVaryings = function (varyings) {
        for (let name in varyings) { this.varying[name] = 'varying ' + varyings[name] + ' ' + name + ';'; }
    };
    shaderBuilder.prototype.addUniforms = function (uniforms) {
        for (let name in uniforms) { this.uniform[name] = 'uniform ' + uniforms[name] + ' ' + name + ';'; }
    };
    shaderBuilder.prototype.addFunction = function (name, lines) { this.functions[name] = lines.join('\n'); };
    shaderBuilder.prototype.addLines = function (statements) {
        for (let i = 0; i < statements.length; ++i) { this.statements.push(statements[i]); }
    };
    shaderBuilder.prototype.getSource = function () {
        // Ensure the precision qualifier is cleanly isolated on its own lines
        let src = '#ifdef GL_ES\n' +
            'precision highp float;\n' +
            '#endif\n\n';

        // Inject structural definitions cleanly separated by clean returns
        for (let i in this.attrib) {
            src += this.attrib[i] + '\n';
        }
        src += '\n';

        for (let i in this.varying) {
            src += this.varying[i] + '\n';
        }
        src += '\n';

        for (let i in this.uniform) {
            src += this.uniform[i] + '\n';
        }
        src += '\n';

        for (let i in this.functions) {
            src += this.functions[i] + '\n';
        }
        src += '\n';

        // Format the initialization block explicitly
        src += 'void main(void) {\n\t';
        src += this.statements.join('\n\t');
        src += '\n}\n';

        return src;
    };

    shaderBuilder.prototype.addWaveform = function (name, wf, timeVar) {
        if (!wf) {
            this.statements.push('float ' + name + ' = 0.0;');
            return;
        }
        if (!timeVar) { timelet = 'time'; }
        if (typeof (wf.phase) == "number") { wf.phase = wf.phase.toFixed(4); }

        let funcName = '';
        switch (wf.funcName) {
            case 'sin':
                this.statements.push('float ' + name + ' = ' + wf.base.toFixed(4) + ' + sin((' + wf.phase + ' + ' + timelet + ' * ' + wf.freq.toFixed(4) + ') * 6.283) * ' + wf.amp.toFixed(4) + ';');
                return;
            case 'square': funcName = 'square'; this.addSquareFunc(); break;
            case 'triangle': funcName = 'triangle'; this.addTriangleFunc(); break;
            case 'sawtooth': funcName = 'fract'; break;
            case 'inversesawtooth': funcName = '1.0 - fract'; break;
            default:
                this.statements.push('float ' + name + ' = 0.0;');
                return;
        }
        this.statements.push('float ' + name + ' = ' + wf.base.toFixed(4) + ' + ' + funcName + '(' + wf.phase + ' + ' + timelet + ' * ' + wf.freq.toFixed(4) + ') * ' + wf.amp.toFixed(4) + ';');
    };

    shaderBuilder.prototype.addSquareFunc = function () {
        this.addFunction('square', [
            'float square(float val) {',
            '   return (mod(floor(val*2.0)+1.0, 2.0) * 2.0) - 1.0;',
            '}',
        ]);
    };

    shaderBuilder.prototype.addTriangleFunc = function () {
        this.addFunction('triangle', [
            'float triangle(float val) {',
            '   return abs(2.0 * fract(val) - 1.0);',
            '}',
        ]);
    };

    // Expose registry utility publicly on the loader instance if access is needed by editors
    THREE.q3ShaderRegistry = q3shader.registry;

    // =========================================================================
    // NUNUSTUDIO CLASS RESOLUTION
    // -------------------------------------------------------------------------
    // nunuStudio (bundle.js) ships its own bundled copy of three.js that is a
    // *different* module instance than the one require('three') returns here.
    // Objects built with require('three') therefore fail the editor's
    // `instanceof` checks, so the selection helper (yellow BoxHelper) is never
    // created and the Inspector cannot resolve a panel for them.
    //
    // To integrate, geometry/material/texture/mesh must be built from the
    // editor's copy. We harvest those constructors from the live editor: the
    // default resources (defaultGeometry/Material/Texture) and an existing
    // scene object give us the exact classes the editor uses. Plain numeric
    // constants (wrap modes, sides, formats) are identical across copies, so
    // the local THREE values are reused for those.
    // =========================================================================
    function resolveNunuClasses() {
        const classes = {
            Mesh: THREE.Mesh,
            Object3D: THREE.Object3D,
            BufferGeometry: THREE.BufferGeometry,
            Float32BufferAttribute: THREE.Float32BufferAttribute,
            Material: THREE.MeshStandardMaterial,
            Texture: THREE.Texture
        };

        const K = (typeof window !== "undefined") ? window.nunu : null;
        if (!K) return classes;

        if (K.defaultGeometry) {
            classes.BufferGeometry = K.defaultGeometry.constructor;
            const posAttr = K.defaultGeometry.attributes && K.defaultGeometry.attributes.position;
            if (posAttr) classes.Float32BufferAttribute = posAttr.constructor;
        }
        if (K.defaultMaterial) classes.Material = K.defaultMaterial.constructor;
        if (K.defaultTexture) classes.Texture = K.defaultTexture.constructor;

        // Harvest the editor's Mesh wrapper from an existing scene object.
        let scene = null;
        try { scene = K.getScene ? K.getScene() : null; } catch (e) { scene = null; }
        const root = K.program || scene;
        if (root && typeof root.traverse === "function") {
            let mesh = null;
            root.traverse(function (o) { if (!mesh && o.isMesh) mesh = o.constructor; });
            if (mesh) classes.Mesh = mesh;
        }

        // Resolve the editor's Object3D by walking a live instance's prototype
        // chain to the level that owns `isObject3D`.
        const anchor = scene || root;
        if (anchor) {
            let proto = Object.getPrototypeOf(anchor);
            while (proto && !Object.prototype.hasOwnProperty.call(proto, "isObject3D")) {
                proto = Object.getPrototypeOf(proto);
            }
            if (proto && proto.constructor) classes.Object3D = proto.constructor;
        }

        return classes;
    }

    // =========================================================================
    // MAIN THREE.JS Q3BSPLOADER IMPLEMENTATION
    // =========================================================================

    THREE.Q3BSPLoader = class Q3BSPLoader extends THREE.Loader {
        constructor(manager) {
            super(manager !== undefined ? manager : THREE.DefaultLoadingManager);
            this.tesselationLevel = 5;
        }

        load(url, onLoad, onProgress, onError) {
            let scope = this;
            if (url instanceof ArrayBuffer) {
                scope._loadFromWorker(url, onLoad, onError);
                return;
            }
            let loader = new THREE.FileLoader(scope.manager);
            loader.setPath(scope.path);
            loader.setResponseType("arraybuffer");

            loader.load(url, function (buffer) {
                scope._loadFromWorker(buffer, onLoad, onError);
            }, onProgress, onError);
        }

        setTesselationLevel(value) {
            this.tesselationLevel = value;
            return this;
        }

        /**
         * Optional: Call this directly to pre-hydrate the engine with parsed configuration strings
         */
        parseShaderFile(srcText, url) {
            return q3shader.parse(url || "inline://custom.shader", srcText);
        }

        _makeRootNode() {
            let rootNode = new THREE.Group();
            rootNode.name = "Q3BSP_Map";
            rootNode.userData = {
                entities: {}, planes: [], nodes: [], leaves: [], brushes: [],
                brushSides: [], leafBrushes: [], surfaces: [], visBuffer: null, visSize: 0
            };
            return rootNode;
        }

        // Merge the worker's (or sync parser's) BSP metadata onto the root node.
        _applyMapData(rootNode, meshData) {
            if (!meshData) return;
            if (meshData.userData) {
                for (let key in meshData.userData) {
                    if (Object.prototype.hasOwnProperty.call(meshData.userData, key)) {
                        rootNode.userData[key] = meshData.userData[key];
                    }
                }
            }
            if (meshData.entities) { rootNode.userData.entities = meshData.entities; }
            if (meshData.bsp) { rootNode.userData.bspTree = meshData.bsp; }
        }

        // Synchronous parse (no worker). Used as the fallback path and for
        // pre-built mesh data passed in directly.
        parse(data) {
            let rootNode = this._makeRootNode();
            let meshData = (data && (data.type === "geometry" || data.vertices))
                ? data
                : parseRawBSP(data, this.tesselationLevel);
            return this._buildFromMeshData(meshData, rootNode);
        }

        // Worker-driven load: the heavy parse runs off the main thread and each
        // finished surface arrives via postMessage, where processBatch() turns it
        // into a mesh and performs the real rootNode.add(surfaceMesh). Falls back
        // to a synchronous main-thread parse if Workers are unavailable or fail.
        _loadFromWorker(buffer, onLoad, onError) {
            let scope = this;
            let rootNode = scope._makeRootNode();

            const runOnMainThread = function () {
                try {
                    if (typeof onLoad === 'function') onLoad(scope.parse(buffer));
                } catch (err) {
                    if (typeof onError === 'function') onError(err);
                    else console.error('Q3BSPLoader: parse failed', err);
                }
            };

            if (typeof Worker === 'undefined') {
                runOnMainThread();
                return rootNode;
            }

            let worker;
            try {
                worker = new Worker(SELF_SCRIPT_URL);
            } catch (err) {
                console.warn('Q3BSPLoader: Web Worker unavailable, parsing on the main thread.', err);
                runOnMainThread();
                return rootNode;
            }

            let settled = false;
            worker.onmessage = function (e) {
                const msg = e.data || {};
                if (msg.type === 'surface') {
                    scope.processBatch(msg.surface, rootNode);
                } else if (msg.type === 'done') {
                    settled = true;
                    scope._applyMapData(rootNode, { userData: msg.userData, entities: msg.entities });
                    try { worker.terminate(); } catch (ignored) { /* noop */ }
                    if (typeof onLoad === 'function') onLoad(rootNode);
                } else if (msg.type === 'error') {
                    settled = true;
                    console.error('Q3BSPLoader: worker reported a parse error, retrying on the main thread.', msg.message);
                    try { worker.terminate(); } catch (ignored) { /* noop */ }
                    runOnMainThread();
                }
            };
            worker.onerror = function (err) {
                if (settled) return;
                settled = true;
                console.error('Q3BSPLoader: worker crashed, retrying on the main thread.', err && err.message ? err.message : err);
                try { worker.terminate(); } catch (ignored) { /* noop */ }
                runOnMainThread();
            };

            // The buffer is cloned (not transferred) so the main-thread fallback
            // can still read it if the worker fails.
            worker.postMessage({ cmd: 'parse', buffer: buffer, tesselationLevel: scope.tesselationLevel });
            return rootNode;
        }



        _buildFromMeshData(meshData, rootNode) {
            this._applyMapData(rootNode, meshData);
            let surfaces = meshData.surfaces || [];
            for (let s = 0; s < surfaces.length; s++) {
                let surf = extractSurfaceGeometry(meshData, s);
                if (!surf) continue;
                this.processBatch(surf, rootNode);
            }
            return rootNode;
        }

        // Turn one (worker-produced) surface payload into a nunuStudio-compatible
        // mesh and attach it. This is the only part that must run on the main
        // thread: it touches the editor's bundled THREE classes, Image/Texture
        // loading and nunuStudio globals. Every surface message the worker posts
        // back lands here, so this *is* the spot where rootNode.add(surfaceMesh)
        // finally happens.
        processBatch(surf, rootNode) {
            // Resolve the editor's bundled three.js classes so the meshes we
            // create satisfy nunuStudio's instanceof checks (selection helper +
            // Inspector). Falls back to the local THREE classes when the editor
            // is not present (e.g. headless/standalone usage).
            const nunu = resolveNunuClasses();
            const NunuMesh = nunu.Mesh;

            let geometry = new nunu.BufferGeometry();
            geometry.setAttribute("position", new nunu.Float32BufferAttribute(surf.positions, 3));
            geometry.setAttribute("normal", new nunu.Float32BufferAttribute(surf.normals, 3));
            geometry.setAttribute("uv", new nunu.Float32BufferAttribute(surf.uvs, 2));
            geometry.setAttribute("color", new nunu.Float32BufferAttribute(surf.colors, 4));
            geometry.setIndex(surf.indices);

            geometry.computeVertexNormals();
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();

            let textureShaderPath = surf.shaderName;
            let mat;

            let texture = null;
            let isTransparent = false;

            if (textureShaderPath && textureShaderPath !== "noshader") {
                let finalImagePath = textureShaderPath + ".jpg";

                let lookupName = textureShaderPath.toLowerCase();
                let cachedShader = window.q3shader && window.q3shader.registry ? window.q3shader.registry[lookupName] : null;

                if (cachedShader) {
                    isTransparent = cachedShader.sky || cachedShader.blend || false;

                    if (cachedShader.stages && cachedShader.stages.length > 0) {
                        let firstStage = cachedShader.stages[0];

                        if (firstStage.map && !firstStage.map.includes('$') && firstStage.map !== 'anim') {
                            finalImagePath = firstStage.map;
                        }
                        else if (cachedShader.stages[1] && cachedShader.stages[1].map && !cachedShader.stages[1].map.includes('$')) {
                            finalImagePath = cachedShader.stages[1].map;
                        }
                    }
                } else if (textureShaderPath.toLowerCase().includes('sky')) {
                    isTransparent = true;
                }

                if (!finalImagePath.includes('$') && finalImagePath !== 'anim') {
                    let basePath = finalImagePath.replace(/\.[^/.]+$/, "");
                    let extensions = ['.tga', '.jpg', '.png', '.webp', '.tga', '.jpg', '.png', '.webp'];
                    let baseUrl = "https://quake.games/demoq3/pak0.pk3dir/" + basePath;

                    texture = new THREE.Texture();
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.flipY = false;

                    (async function probeExtensions() {
                        let count = 0;
                        for (let ext of extensions) {
                            let candidateUrl = baseUrl + ext;
                            if (count >= 4) {
                                candidateUrl = candidateUrl.toLocaleLowerCase();
                            }
                            count++;
                            try {
                                let imageElement = await new Promise((resolve, reject) => {
                                    let img = new Image();
                                    img.crossOrigin = 'anonymous';
                                    img.onload = () => resolve(img);
                                    img.onerror = () => reject();
                                    img.src = candidateUrl;
                                });

                                texture.image = imageElement;
                                let isJpeg = candidateUrl.search(/\.jpe?g($|\?)/i) > 0;
                                texture.format = isJpeg ? (THREE.RGBFormat || 1022) : (THREE.RGBAFormat || 1023);
                                texture.needsUpdate = true;

                                if (window.nunu && window.nunu.gui) {
                                    window.nunu.gui.updateInterface();
                                }
                                break;
                            } catch (e) { }
                        }
                    })();
                }
            }

            mat = new nunu.Material({
                name: surf.shaderName || "default_bsp",
                side: THREE.DoubleSide,
                map: texture || (window.nunu ? window.nunu.defaultTexture : null) || window.defaultTexture,
                transparent: isTransparent,
                opacity: 1.0
            });
            if ("roughness" in mat) mat.roughness = 1.0;
            if ("metalness" in mat) mat.metalness = 0.0;

            // --- INSTANTIATE VIA TARGET ARCHITECTURE CLASS ---
            let surfaceMesh = new NunuMesh(geometry, mat);

            surfaceMesh.name = (surf.shaderName !== "noshader") ? surf.shaderName : "surface_" + surf.index;
            surfaceMesh.frustumCulled = false;
            surfaceMesh.matrixAutoUpdate = true;

            surfaceMesh.folded = false;
            surfaceMesh.locked = false;
            surfaceMesh.castShadow = true;
            surfaceMesh.receiveShadow = true;

            surfaceMesh.userData = {
                geomType: surf.geomType,
                indexOffset: surf.indexOffset,
                elementCount: surf.elementCount
            };

            // No need for fallback isEmpty/resize/toJSON shims: meshes built
            // from the editor's Object3D inherit nunuStudio's versions.

            rootNode.add(surfaceMesh);
            return surfaceMesh;
        }
    };

    window.q3shader = q3shader;

    // -------------------------------------------------------------------------
    // MAIN-THREAD GLOBALS / EDITOR HOOKS (still inside the outer closure so the
    // worker context never reaches them).
    // -------------------------------------------------------------------------

window.capturedScenes = [];
window.addEventListener('observe', function (e) {
    if (e.detail && (e.detail.type === "Scene" || e.detail.isScene)) {
        window.capturedScenes.push(e.detail);
        window.scene = e.detail;
        console.log("🎯 Caught active scene target context! Accessible via window.scene");
    }
}, true);



const q3bsp_base_folder = 'https://quake.games/demoq3/pak0.pk3dir';
const mapShaders = [
    'scripts/base.shader', 'scripts/base_button.shader', 'scripts/base_floor.shader',
    'scripts/base_light.shader', 'scripts/base_object.shader', 'scripts/base_support.shader',
    'scripts/base_trim.shader', 'scripts/base_wall.shader', 'scripts/common.shader',
    'scripts/ctf.shader', 'scripts/eerie.shader', 'scripts/gfx.shader',
    'scripts/gothic_block.shader', 'scripts/gothic_floor.shader', 'scripts/gothic_light.shader',
    'scripts/gothic_trim.shader', 'scripts/gothic_wall.shader', 'scripts/hell.shader',
    'scripts/liquid.shader', 'scripts/menu.shader', 'scripts/models.shader',
    'scripts/organics.shader', 'scripts/sfx.shader', 'scripts/shrine.shader',
    'scripts/skin.shader', 'scripts/sky.shader', 'scripts/test.shader'
].map(s => q3bsp_base_folder + '/' + s);


async function importBSP(mapFile, content) {
    const THREE = require('three');
    let bspLoader = new THREE.Q3BSPLoader();
    let activeScene = window.nunu.getScene();

    window.isLoadingBSP = true
    const mapName = q3bsp_base_folder + (mapFile.startsWith('/') ? '' : '/') + mapFile;

    await q3shader.loadList(mapShaders, () => { });

    bspLoader.load(content || mapName, function (bspGroup) {
        bspGroup.name = mapFile.split('/').pop();
        bspGroup.type = "Group";
        bspGroup.folded = false;
        bspGroup.locked = false;

        const surfaceChildren = [];
        bspGroup.traverse(function (child) {
            if (child.isMesh && child !== bspGroup) {
                surfaceChildren.push(child);
            }
        });

        // Decouple original flat arrays so action transactions maintain context
        bspGroup.children = [];

        // 1. Immediately register the parent container so it appears in the Project Explorer tree
        window.nunu.addObject(bspGroup, activeScene);

        // 2. Set up the time-sliced queue configuration
        let index = 0;
        const FRAME_BUDGET_MS = 12; // Yield back to the browser if a batch takes longer than 12ms (leaves ~4ms for browser rendering layout)

        function processBatch() {
            const startTime = performance.now();

            // Run until we exhaust the surface list OR exceed our maximum safe frame budget
            while (index < surfaceChildren.length) {
                const surfaceMesh = surfaceChildren[index];

                // Add the individual map piece directly into its parent group context
                window.nunu.addObject(surfaceMesh, bspGroup);
                index++;

                // Break execution block if we're hitting frame budgeting thresholds
                //if (performance.now() - startTime > FRAME_BUDGET_MS) 
                {
                    // Update interface incrementally so the user can watch the map load block by block
                    window.nunu.gui.updateInterface();

                    // Request the next animation tick frame to resume loading without locking up the UI
                    requestAnimationFrame(processBatch);
                    return;
                }
            }

            // 3. Post-processing cleanup loop runs once all nodes have successfully streamed in
            if (bspGroup.children.length > 0) {
                window.nunu.selectObject(bspGroup.children[0]);
            } else {
                window.nunu.selectObject(bspGroup);
            }

            window.nunu.gui.updateInterface();
            console.log(`Successfully streamed ${surfaceChildren.length} BSP surfaces incrementally.`);
            window.isLoadingBSP = false
        }

        // Kick off the non-blocking loop
        requestAnimationFrame(processBatch);
    });
}

window.importBSP = importBSP;

// Run this initialization right inside the wrapper closure frame:
(function (THREE) {
    // Intercept standard TextureLoader initialization routines
    const OriginalTextureLoader = THREE.TextureLoader;


    // --- GLOBAL PROTOTYPE FALLBACK INJECTIONS FOR NUNUSTUDIO WORKSPACE ---
    if (typeof THREE.Object3D.prototype.isEmpty !== 'function') {
        THREE.Object3D.prototype.isEmpty = function () {
            if (this.isMesh) return true;
            return this.children ? this.children.length === 0 : true;
        };
    }

    if (typeof THREE.Object3D.prototype.resize !== 'function') {
        THREE.Object3D.prototype.resize = function (x, y) {
            if (this.children && this.children.length > 0) {
                for (let i = 0; i < this.children.length; i++) {
                    if (typeof this.children[i].resize === 'function') {
                        this.children[i].resize(x, y);
                    }
                }
            }
        };
    }

    THREE.TextureLoader = class ExtendedTextureLoader extends OriginalTextureLoader {
        load(url, onLoad, onProgress, onError) {
            let scope = this;
            let basePath = url.replace(/\.[^/.]+$/, "");
            let extensions = ['.tga', '.jpg', '.png', '.tga', '.jpg', '.png'];

            // Re-map the asset target downward through standard fallback paths
            function tryNextExtension(index) {
                if (index >= extensions.length) {
                    if (typeof onError === 'function') onError(new Error("All texture formats failed to load."));
                    return;
                }

                let testUrl = basePath + extensions[index];
                if (index >= 3)
                    testUrl = testUrl.toLocaleLowerCase()

                // Call standard super.load but catch errors to fall back to the next file signature
                OriginalTextureLoader.prototype.load.call(scope, testUrl,
                    function (texture) {
                        if (typeof onLoad === 'function') onLoad(texture);
                    },
                    onProgress,
                    function () {
                        // Drop to next extension pass if file asset returns empty/broken response profiles
                        tryNextExtension(index + 1);
                    }
                );
            }

            // Fire off the resolution chain starting at step 0 (.tga)
            tryNextExtension(0);
        }
    };
})(window.require('three'));

})();