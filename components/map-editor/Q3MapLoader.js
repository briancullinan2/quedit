/* eslint-disable camelcase */

(function (THREE) {
    if (!THREE && typeof require !== 'undefined') {
        THREE = require('three');
    }
    if (!THREE) {
        console.error("Q3MapLoader: 'THREE' global object not found. Ensure Three.js is loaded first.");
        return;
    }

    // =========================================================================
    // INTERNAL SHADER PIPELINE INTEGRATION (Procedural Quake 3 -> GLSL)
    // =========================================================================

    const shaderTokenizer = function (src) {
        src = src.replace(/\/\/.*$/mg, ''); // Strip C++ style comments
        src = src.replace(/\/\*[^*\/]*\*\//mg, ''); // Strip C style comments
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
        registry: {}
    };

    q3shader.loadList = async function (sources, onload) {
        let promises = [];
        for (let i = 0; i < sources.length; ++i) {
            promises.push(q3shader.load(sources[i], onload));
        }
        return await Promise.all(promises);
    };

    q3shader.load = async function (url, onload) {
        try {
            const response = await fetch(url, {
                mode: 'cors',
                credentials: 'omit'
            });
            if (!response.ok) {
                throw new Error(`HTTP network error! Status: ${response.status}`);
            }
            const shaderText = await response.text();
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
            name: name, cull: 'back', sky: false, blend: false, opaque: false, sort: 0, vertexDeforms: [], stages: []
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
                            tcMod.angle = parseFloat(tokens.next()) * (Math.PI / 180);
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
        shader.addAttribs({});
        shader.addVaryings({ vTexCoord: 'vec2', vColor: 'vec4' });
        shader.addUniforms({ time: 'float' });

        if (stage.isLightmap) {
            shader.addAttribs({ lightCoord: 'vec2' });
        } else {
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

        shader.addLines(['vec4 worldPosition = modelViewMatrix * vec4(defPosition, 1.0);']);
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

        shader.addLines(['gl_Position = projectionMatrix * worldPosition;']);
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
        let src = '#ifdef GL_ES\nprecision highp float;\n#endif\n\n';
        for (let i in this.attrib) { src += this.attrib[i] + '\n'; } src += '\n';
        for (let i in this.varying) { src += this.varying[i] + '\n'; } src += '\n';
        for (let i in this.uniform) { src += this.uniform[i] + '\n'; } src += '\n';
        for (let i in this.functions) { src += this.functions[i] + '\n'; } src += '\n';
        src += 'void main(void) {\n\t' + this.statements.join('\n\t') + '\n}\n';
        return src;
    };

    shaderBuilder.prototype.addWaveform = function (name, wf, timeVar) {
        if (!wf) { this.statements.push('float ' + name + ' = 0.0;'); return; }
        let timelet = timeVar || 'time';
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
            default: this.statements.push('float ' + name + ' = 0.0;'); return;
        }
        this.statements.push('float ' + name + ' = ' + wf.base.toFixed(4) + ' + ' + funcName + '(' + wf.phase + ' + ' + timelet + ' * ' + wf.freq.toFixed(4) + ') * ' + wf.amp.toFixed(4) + ';');
    };

    shaderBuilder.prototype.addSquareFunc = function () {
        this.addFunction('square', ['float square(float val) {', '   return (mod(floor(val*2.0)+1.0, 2.0) * 2.0) - 1.0;', '}']);
    };

    shaderBuilder.prototype.addTriangleFunc = function () {
        this.addFunction('triangle', ['float triangle(float val) {', '   return abs(2.0 * fract(val) - 1.0);', '}']);
    };

    THREE.q3ShaderRegistry = q3shader.registry;

    // =========================================================================
    // OVERHAULED TEXT-BASED Q3 MAP GEOMETRY LOADER (CSG PLANE INTERSECTION)
    // =========================================================================

    THREE.Q3MapLoader = class Q3MapLoader extends THREE.Loader {
        constructor(manager) {
            super(manager !== undefined ? manager : THREE.DefaultLoadingManager);
        }

        load(url, onLoad, onProgress, onError) {
            let scope = this;
            let loader = new THREE.FileLoader(scope.manager);
            loader.setPath(scope.path);
            loader.setResponseType("text"); // Explicit text capture profile

            loader.load(url, function (text) {
                onLoad(scope.parse(text));
            }, onProgress, onError);
        }

        parse(mapText) {
            let rootNode = new THREE.Group();
            rootNode.name = "Q3Map_WorldMesh";
            rootNode.userData = { entities: [] };

            let tokens = new shaderTokenizer(mapText);
            let entities = [];

            // 1. Structural Lexer Loop parsing Entity blocks and nested Brushes
            while (!tokens.EOF()) {
                let token = tokens.next();
                if (token === '{') {
                    let entity = { brushes: [] };
                    while (!tokens.EOF()) {
                        let key = tokens.next();
                        if (key === '}') break;

                        if (key === '{') {
                            let brush = { sides: [] };
                            while (!tokens.EOF()) {
                                let bToken = tokens.next();
                                if (bToken === '}') break;

                                if (bToken === '(') {
                                    // Plane Definition Point Triplets
                                    let p1 = [parseFloat(tokens.next()), parseFloat(tokens.next()), parseFloat(tokens.next())]; tokens.next(); tokens.next();
                                    let p2 = [parseFloat(tokens.next()), parseFloat(tokens.next()), parseFloat(tokens.next())]; tokens.next(); tokens.next();
                                    let p3 = [parseFloat(tokens.next()), parseFloat(tokens.next()), parseFloat(tokens.next())]; tokens.next();

                                    let textureName = tokens.next();
                                    
                                    // Texture projection metrics configuration fields
                                    let shiftS = parseFloat(tokens.next());
                                    let shiftT = parseFloat(tokens.next());
                                    let rotation = parseFloat(tokens.next());
                                    let scaleS = parseFloat(tokens.next());
                                    let scaleT = parseFloat(tokens.next());

                                    brush.sides.push({
                                        points: [p1, p2, p3],
                                        texture: textureName,
                                        uvParams: { shiftS, shiftT, rotation, scaleS, scaleT }
                                    });
                                }
                            }
                            entity.brushes.push(brush);
                        } else {
                            let val = tokens.next();
                            if (key === 'origin') {
                                let coords = val.split(' ');
                                entity[key] = [parseFloat(coords[0]), parseFloat(coords[1]), parseFloat(coords[2])];
                            } else if (key === 'angle') {
                                entity[key] = parseFloat(val);
                            } else {
                                entity[key] = val;
                            }
                        }
                    }
                    entities.push(entity);
                }
            }

            rootNode.userData.entities = entities;
            return this._buildGeometryFromBrushes(entities, rootNode);
        }

        // 2. Construct Convex Hulls out of Text Definitions via Constructive Solid Geometry
        _buildGeometryFromBrushes(entities, rootNode) {
            let masterVertices = [];
            let masterIndices = [];
            let parsedSurfaces = [];

            for (let ent of entities) {
                for (let brush of ent.brushes) {
                    let activePlanes = [];

                    // Derive mathematical representation equations out of point matrices
                    for (let side of brush.sides) {
                        // Coordinate conversions mapping standard id Tech coordinate alignments to Three.js layout targets
                        let v0 = new THREE.Vector3(side.points[0][0], side.points[0][2], -side.points[0][1]);
                        let v1 = new THREE.Vector3(side.points[1][0], side.points[1][2], -side.points[1][1]);
                        let v2 = new THREE.Vector3(side.points[2][0], side.points[2][2], -side.points[2][1]);

                        let plane = new THREE.Plane();
                        plane.setFromCoplanarPoints(v0, v1, v2);

                        if (plane.normal.lengthSq() > 0) {
                            activePlanes.push({ geoPlane: plane, metaSide: side });
                        }
                    }

                    // Cut initially infinite geometric plane hulls sequentially by every coplanar neighbor bounds
                    for (let i = 0; i < activePlanes.length; i++) {
                        let target = activePlanes[i];
                        let facePolygon = this._createInfinitePlanePolygon(target.geoPlane);

                        for (let j = 0; j < activePlanes.length; j++) {
                            if (i === j) continue;
                            facePolygon = this._clipPolygonByPlane(facePolygon, activePlanes[j].geoPlane);
                        }

                        // Discard broken/non-existent faces that have completely collapsed under clipping
                        if (facePolygon.length < 3) continue;

                        let surfaceIndexOffset = masterIndices.length * 4;
                        let vertexBaseOffset = masterVertices.length / 14;

                        // Calculate standard point matrices 
                        for (let k = 0; k < facePolygon.length; k++) {
                            let vertexPosition = facePolygon[k];

                            // Vertex positions assignment
                            masterVertices.push(vertexPosition.x, vertexPosition.y, vertexPosition.z);

                            // Project UV mappings procedurally relative to plane orientations
                            let u = vertexPosition.dot(new THREE.Vector3(1, 0, 0)) * 0.015625;
                            let v = vertexPosition.dot(new THREE.Vector3(0, 1, 0)) * 0.015625;
                            masterVertices.push(u, v);

                            // Zero fallback lightmap layout space variables
                            masterVertices.push(0, 0);

                            // Surface Normals attributes tracking active plane configurations
                            masterVertices.push(target.geoPlane.normal.x, target.geoPlane.normal.y, target.geoPlane.normal.z);

                            // Solid baseline diffuse vertex weight variables
                            masterVertices.push(1.0, 1.0, 1.0, 1.0);
                        }

                        // Generate explicit Triangle Fan indices matching geometry layouts winding sequences
                        for (let k = 1; k < facePolygon.length - 1; k++) {
                            masterIndices.push(vertexBaseOffset);
                            masterIndices.push(vertexBaseOffset + k);
                            masterIndices.push(vertexBaseOffset + k + 1);
                        }

                        parsedSurfaces.push({
                            shaderName: target.metaSide.texture,
                            elementCount: (facePolygon.length - 2) * 3,
                            indexOffset: surfaceIndexOffset,
                            geomType: 1
                        });
                    }
                }
            }

            return this._assembleMeshHierarchy({
                vertices: new Float32Array(masterVertices),
                indices: new Uint32Array(masterIndices),
                surfaces: parsedSurfaces
            }, rootNode);
        }

        _createInfinitePlanePolygon(plane) {
            let binormal = new THREE.Vector3();
            if (Math.abs(plane.normal.x) > 0.9) {
                binormal.set(0, 1, 0).cross(plane.normal).normalize();
            } else {
                binormal.set(1, 0, 0).cross(plane.normal).normalize();
            }
            let tangent = new THREE.Vector3().crossVectors(plane.normal, binormal).normalize();
            let origin = new THREE.Vector3().copy(plane.normal).multiplyScalar(-plane.constant);

            let maxRadius = 16384; // Bounds check max absolute threshold sizing matching classic limits
            return [
                new THREE.Vector3().copy(origin).addScaledVector(tangent, -maxRadius).addScaledVector(binormal, -maxRadius),
                new THREE.Vector3().copy(origin).addScaledVector(tangent, maxRadius).addScaledVector(binormal, -maxRadius),
                new THREE.Vector3().copy(origin).addScaledVector(tangent, maxRadius).addScaledVector(binormal, maxRadius),
                new THREE.Vector3().copy(origin).addScaledVector(tangent, -maxRadius).addScaledVector(binormal, maxRadius)
            ];
        }

        _clipPolygonByPlane(vertices, plane) {
            let clippedPolygon = [];
            if (vertices.length === 0) return clippedPolygon;

            for (let i = 0; i < vertices.length; i++) {
                let currentPoint = vertices[i];
                let nextPoint = vertices[(i + 1) % vertices.length];

                let currentDistance = plane.distanceToPoint(currentPoint);
                let nextDistance = plane.distanceToPoint(nextPoint);

                if (currentDistance >= -0.005) {
                    clippedPolygon.push(currentPoint);
                }

                if ((currentDistance > 0.005 && nextDistance < -0.005) || (currentDistance < -0.005 && nextDistance > 0.005)) {
                    let interpolationFactor = currentDistance / (currentDistance - nextDistance);
                    let splittingIntersectionPoint = new THREE.Vector3().lerpVectors(currentPoint, nextPoint, interpolationFactor);
                    clippedPolygon.push(splittingIntersectionPoint);
                }
            }
            return clippedPolygon;
        }

        _assembleMeshHierarchy(meshData, rootNode) {
            let rawVertices = meshData.vertices;
            let rawIndices = meshData.indices;
            let surfaces = meshData.surfaces || [];
            let stride = 14;

            for (let s = 0; s < surfaces.length; s++) {
                let surface = surfaces[s];
                if (surface.elementCount === 0) continue;

                let geometry = new THREE.BufferGeometry();
                let subIndices = [], subPositions = [], subNormals = [], subUvs = [], subColors = [];
                let vertMap = {}, localVertCount = 0;

                let indexStart = surface.indexOffset / 4;
                let indexEnd = indexStart + surface.elementCount;

                for (let i = indexStart; i < indexEnd; i++) {
                    let globalVertIdx = rawIndices[i];
                    if (vertMap[globalVertIdx] === undefined) {
                        vertMap[globalVertIdx] = localVertCount;
                        let idx = globalVertIdx * stride;

                        subPositions.push(rawVertices[idx], rawVertices[idx + 1], rawVertices[idx + 2]);
                        subUvs.push(rawVertices[idx + 3], 1.0 - rawVertices[idx + 4]);
                        subNormals.push(rawVertices[idx + 7], rawVertices[idx + 8], rawVertices[idx + 9]);
                        subColors.push(rawVertices[idx + 10], rawVertices[idx + 11], rawVertices[idx + 12], rawVertices[idx + 13]);

                        localVertCount++;
                    }
                    subIndices.push(vertMap[globalVertIdx]);
                }

                geometry.setAttribute("position", new THREE.Float32BufferAttribute(subPositions, 3));
                geometry.setAttribute("normal", new THREE.Float32BufferAttribute(subNormals, 3));
                geometry.setAttribute("uv", new THREE.Float32BufferAttribute(subUvs, 2));
                geometry.setAttribute("color", new THREE.Float32BufferAttribute(subColors, 4));
                geometry.setIndex(subIndices.length > 65535 ? new THREE.BufferAttribute(new Uint32Array(subIndices), 1) : new THREE.BufferAttribute(new Uint16Array(subIndices), 1));

                geometry.computeVertexNormals();
                geometry.computeBoundingBox();
                geometry.computeBoundingSphere();

                let shaderPath = surface.shaderName;
                let mat;
                let texture = null;
                let isTransparent = false;

                if (shaderPath && shaderPath !== "noshader") {
                    let finalImagePath = shaderPath + ".png";
                    let lookupName = shaderPath.toLowerCase();
                    let cachedShader = q3shader.registry[lookupName];

                    if (cachedShader) {
                        isTransparent = cachedShader.sky || cachedShader.blend || false;
                        if (cachedShader.stages && cachedShader.stages.length > 0) {
                            let firstStage = cachedShader.stages[0];
                            if (firstStage.map && !firstStage.map.includes('$') && firstStage.map !== 'anim') {
                                finalImagePath = firstStage.map;
                            }
                        }
                    }

                    if (!finalImagePath.includes('$') && finalImagePath !== 'anim') {
                        let basePath = finalImagePath.replace(/\.[^/.]+$/, "");
                        let extensions = ['.png', '.jpg', '.tga', '.webp'];
                        let baseUrl = "https://quake.games/demoq3/pak0.pk3dir/" + basePath;

                        texture = new THREE.Texture();
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.flipY = false;

                        (async function probeExtensions() {
                            let count = 0;
                            for (let ext of extensions) {
                                let candidateUrl = baseUrl + ext;
                                if (count >= 4) { candidateUrl = candidateUrl.toLocaleLowerCase(); }
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
                                    texture.needsUpdate = true;
                                    if (window.nunu && window.nunu.gui) { window.nunu.gui.updateInterface(); }
                                    break;
                                } catch (e) {}
                            }
                        })();
                    }
                }

                mat = new THREE.MeshPhongMaterial({
                    name: surface.shaderName || "map_brush_primitive",
                    vertexColors: false,
                    side: THREE.DoubleSide,
                    map: texture || window.defaultTexture,
                    transparent: isTransparent,
                    opacity: 1.0,
                    shininess: 0
                });

                let surfaceMesh = new THREE.Mesh(geometry, mat);
                surfaceMesh.name = (surface.shaderName !== "noshader") ? surface.shaderName : "surface_" + s;
                surfaceMesh.castShadow = true;
                surfaceMesh.receiveShadow = true;

                surfaceMesh.isEmpty = function () { return true; };
                surfaceMesh.toJSON = function (meta) { return THREE.Object3D.prototype.toJSON.call(this, meta); };

                rootNode.add(surfaceMesh);
            }

            return rootNode;
        }
    };

    window.q3shader = q3shader;
})(typeof window !== "undefined" ? window.THREE : global.THREE);

// =============================================================================
// RUNTIME TEXT-MAP SCENE INGESTION HOOKS
// =============================================================================
async function importMap() {
    const { Q3MapLoader } = THREE;
    let mapLoader = new Q3MapLoader();
    let activeScene = window.nunu.getScene();
    
    const q3bsp_base_folder = 'https://quake.games/demoq3/pak0.pk3dir';
    const mapName = q3bsp_base_folder + "/maps/q3dm17.map"; // Corrected text configuration path targeting target format

    let mapShaders = ['scripts/base.shader', 'scripts/sky.shader'].map(s => q3bsp_base_folder + '/' + s);
    await window.q3shader.loadList(mapShaders, () => {});

    mapLoader.load(mapName, function (mapGroup) {
        mapGroup.name = "q3dm17_MapTextGroup";

        mapGroup.traverse(function (child) {
            if (child.isMesh) {
                child.frustumCulled = false;
                child.matrixAutoUpdate = true;
                child.type = "Mesh";
            }
            if (typeof child.isEmpty !== 'function') {
                child.isEmpty = function () { return this.children ? this.children.length === 0 : true; };
            }
            if (typeof child.resize !== 'function') {
                child.resize = function () {};
            }
        });

        if (typeof mapGroup.isEmpty !== 'function') { mapGroup.isEmpty = function () { return false; }; }

        window.nunu.addObject(mapGroup, activeScene);
        window.nunu.selectObject(mapGroup);
        window.nunu.gui.updateInterface();
    });
}

// Runtime TextureLoader Fallback Extensions Hook Integration
(function (THREE) {
    const OriginalTextureLoader = THREE.TextureLoader;
    THREE.TextureLoader = class ExtendedTextureLoader extends OriginalTextureLoader {
        load(url, onLoad, onProgress, onError) {
            let scope = this;
            let basePath = url.replace(/\.[^/.]+$/, "");
            let extensions = ['.png', '.jpg', '.tga'];

            function tryNextExtension(index) {
                if (index >= extensions.length) {
                    if (typeof onError === 'function') onError(new Error("All asset extensions failed."));
                    return;
                }
                let testUrl = basePath + extensions[index];
                OriginalTextureLoader.prototype.load.call(scope, testUrl,
                    function (texture) { if (typeof onLoad === 'function') onLoad(texture); },
                    onProgress,
                    function () { tryNextExtension(index + 1); }
                );
            }
            tryNextExtension(0);
        }
    };
})(window.THREE || window.require('three'));