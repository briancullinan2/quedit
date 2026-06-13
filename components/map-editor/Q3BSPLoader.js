/* eslint-disable camelcase */

(function (THREE) {
    if (!THREE && typeof require !== 'undefined') {
        THREE = require('three');
    }
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
    // MAIN THREE.JS Q3BSPLOADER IMPLEMENTATION
    // =========================================================================

    THREE.Q3BSPLoader = class Q3BSPLoader extends THREE.Loader {
        constructor(manager) {
            super(manager !== undefined ? manager : THREE.DefaultLoadingManager);
            this.tesselationLevel = 5;
        }

        load(url, onLoad, onProgress, onError) {
            let scope = this;
            let loader = new THREE.FileLoader(scope.manager);
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

        /**
         * Optional: Call this directly to pre-hydrate the engine with parsed configuration strings
         */
        parseShaderFile(srcText, url) {
            return q3shader.parse(url || "inline://custom.shader", srcText);
        }

        parse(data) {
            let rootNode = new THREE.Group();
            rootNode.name = "Q3BSP_Map";

            rootNode.userData = {
                entities: {}, planes: [], nodes: [], leaves: [], brushes: [],
                brushSides: [], leafBrushes: [], surfaces: [], visBuffer: null, visSize: 0
            };

            if (data.type === "geometry" || data.vertices) {
                return this._buildFromMeshData(data, rootNode);
            }

            return this._parseRawBinaryBuffer(data, rootNode);
        }



        _buildFromMeshData(meshData, rootNode) {
            // --- CRITICAL FLUID RESOLUTION OF NUNUSTUDIO CUSTOM CLASSES ---
            // If the editor wraps constructors globally or inside its own namespace,
            // resolve them here. Fallback cleanly to THREE variants if not found.
            const NunuMesh = window.Mesh || (window.nunu ? window.nunu.Mesh : null) || THREE.Mesh;
            const NunuGroup = window.Group || (window.nunu ? window.nunu.Group : null) || THREE.Group;

            let rawVertices = meshData.vertices;
            let rawIndices = meshData.indices;
            let surfaces = meshData.surfaces || [];
            let stride = 14;

            for (let s = 0; s < surfaces.length; s++) {
                let surface = surfaces[s];
                if (surface.elementCount === 0) continue;

                let geometry = new THREE.BufferGeometry();
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

                geometry.setAttribute("position", new THREE.Float32BufferAttribute(subPositions, 3));
                geometry.setAttribute("normal", new THREE.Float32BufferAttribute(subNormals, 3));
                geometry.setAttribute("uv", new THREE.Float32BufferAttribute(subUvs, 2));
                geometry.setAttribute("color", new THREE.Float32BufferAttribute(subColors, 4));
                geometry.setIndex(subIndices.length > 65535 ? new THREE.BufferAttribute(new Uint32Array(subIndices), 1) : new THREE.BufferAttribute(new Uint16Array(subIndices), 1));

                geometry.computeVertexNormals();
                geometry.computeBoundingBox();
                geometry.computeBoundingSphere();

                let textureShaderPath = surface.shaderName;
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

                mat = new THREE.MeshPhongMaterial({
                    name: surface.shaderName || "default_bsp",
                    vertexColors: false,
                    side: THREE.DoubleSide,
                    map: texture || window.defaultTexture,
                    transparent: isTransparent,
                    opacity: 1.0,
                    shininess: 0
                });

                // --- INSTANTIATE VIA TARGET ARCHITECTURE CLASS ---
                let surfaceMesh = new NunuMesh(geometry, mat);

                surfaceMesh.name = (surface.shaderName !== "noshader") ? surface.shaderName : "surface_" + s;
                surfaceMesh.frustumCulled = false;
                surfaceMesh.matrixAutoUpdate = true;

                surfaceMesh.folded = false;
                surfaceMesh.locked = false;
                surfaceMesh.castShadow = true;
                surfaceMesh.receiveShadow = true;

                surfaceMesh.userData = {
                    geomType: surface.geomType,
                    indexOffset: surface.indexOffset,
                    elementCount: surface.elementCount
                };

                // Inject baseline fallback hooks safely directly onto instance
                surfaceMesh.isEmpty = function () { return true; };
                surfaceMesh.resize = function (x, y) {
                    if (this.children && this.children.length > 0) {
                        for (let i = 0; i < this.children.length; i++) {
                            if (typeof this.children[i].resize === 'function') {
                                this.children[i].resize(x, y);
                            }
                        }
                    }
                };

                surfaceMesh.toJSON = function (meta) {
                    const baseProto = Object.getPrototypeOf(this);
                    if (baseProto && typeof baseProto.toJSON === 'function') {
                        return baseProto.toJSON.call(this, meta);
                    }
                    return THREE.Object3D.prototype.toJSON.call(this, meta);
                };

                rootNode.add(surfaceMesh);
            }

            if (meshData.entities) { rootNode.userData.entities = meshData.entities; }
            if (meshData.bsp) { rootNode.userData.bspTree = meshData.bsp; }

            return rootNode;
        }

        _parseRawBinaryBuffer(buffer, rootNode) {
            let view = new DataView(buffer);
            let ptr = 0;

            let magic = view.getUint32(ptr, true); ptr += 4;
            let version = view.getUint32(ptr, true); ptr += 4;

            if (magic !== 1347633737 || version !== 46) {
                console.error("Q3BSPLoader: Invalid BSP magic block or unexpected structural version.");
                return rootNode;
            }

            let lumps = [];
            for (let i = 0; i < 17; i++) {
                let offset = view.getInt32(ptr, true);
                let length = view.getInt32(ptr + 4, true);
                lumps.push({ offset: offset, length: length });
                ptr += 8;
            }

            let entLump = lumps[0];
            if (entLump.length > 0) {
                let fullBytes = new Uint8Array(buffer);
                let entBytes = fullBytes.subarray(entLump.offset, entLump.offset + entLump.length);
                let entString = (typeof TextDecoder !== "undefined") ? new TextDecoder().decode(entBytes) : "";
                if (!entString) {
                    for (let b = 0; b < entBytes.length; b++) { entString += String.fromCharCode(entBytes[b]); }
                }
                rootNode.userData.entities = this._parseEntityString(entString);
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
                            this._tesselateSurface(face, verts, meshVerts, this.tesselationLevel);
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

            rootNode.userData.planes = this._parseBlockElements(view, planeLump.offset, planeLump.length / 16, 16, (v, p) => ({ normal: [v.getFloat32(p, true), v.getFloat32(p + 4, true), v.getFloat32(p + 8, true)], distance: v.getFloat32(p + 12, true) }));
            rootNode.userData.nodes = this._parseBlockElements(view, nodeLump.offset, nodeLump.length / 36, 36, (v, p) => ({ plane: v.getInt32(p, true), children: [v.getInt32(p + 4, true), v.getInt32(p + 8, true)], min: [v.getInt32(p + 12, true), v.getInt32(p + 16, true), v.getInt32(p + 20, true)], max: [v.getInt32(p + 24, true), v.getInt32(p + 28, true), v.getInt32(p + 32, true)] }));
            rootNode.userData.leaves = this._parseBlockElements(view, leafLump.offset, leafLump.length / 48, 48, (v, p) => ({ cluster: v.getInt32(p, true), area: v.getInt32(p + 4, true), min: [v.getInt32(p + 8, true), v.getInt32(p + 12, true), v.getInt32(p + 16, true)], max: [v.getInt32(p + 20, true), v.getInt32(p + 24, true), v.getInt32(p + 28, true)], leafFace: v.getInt32(p + 32, true), leafFaceCount: v.getInt32(p + 36, true), leafBrush: v.getInt32(p + 40, true), leafBrushCount: v.getInt32(p + 44, true) }));
            rootNode.userData.leafFaces = this._parseBlockElements(view, leafFaceLump.offset, leafFaceLump.length / 4, 4, (v, p) => v.getInt32(p, true));
            rootNode.userData.leafBrushes = this._parseBlockElements(view, leafBrushLump.offset, leafBrushLump.length / 4, 4, (v, p) => v.getInt32(p, true));
            rootNode.userData.brushes = this._parseBlockElements(view, brushLump.offset, brushLump.length / 12, 12, (v, p) => ({ brushSide: v.getInt32(p, true), brushSideCount: v.getInt32(p + 4, true), shader: v.getInt32(p + 8, true) }));
            rootNode.userData.brushSides = this._parseBlockElements(view, brushSideLump.offset, brushSideLump.length / 8, 8, (v, p) => ({ plane: v.getInt32(p, true), shader: v.getInt32(p + 4, true) }));

            let visLump = lumps[16];
            if (visLump && visLump.length > 8 && (visLump.offset + 8) <= buffer.byteLength) {
                let nVecs = view.getInt32(visLump.offset, true);
                let size = view.getInt32(visLump.offset + 4, true);
                let byteCount = nVecs * size;

                if (visLump.offset + 8 + byteCount <= buffer.byteLength) {
                    let visBuffer = new Uint8Array(buffer, visLump.offset + 8, byteCount);
                    rootNode.userData.visBuffer = Array.from(visBuffer);
                    rootNode.userData.visSize = size;
                }
            }

            return this._buildFromMeshData({
                vertices: vertices,
                indices: new Uint32Array(rawIndices),
                surfaces: shaders
            }, rootNode);
        }

        _parseBlockElements(view, start, count, stride, handler) {
            let elements = [];
            let pos = start;
            for (let i = 0; i < count; i++) {
                elements.push(handler(view, pos));
                pos += stride;
            }
            return elements;
        }

        _tesselateSurface(face, verts, meshVerts, level) {
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
                            pos: this._getCurvePt3(c0.pos, c3.pos, c6.pos, a),
                            texCoord: this._getCurvePt2(c0.texCoord, c3.texCoord, c6.texCoord, a),
                            lmCoord: this._getCurvePt2(c0.lmCoord, c3.lmCoord, c6.lmCoord, a),
                            color: [this._getCurvePt3(c0.color, c3.color, c6.color, a)[0], this._getCurvePt3(c0.color, c3.color, c6.color, a)[1], this._getCurvePt3(c0.color, c3.color, c6.color, a)[2], 1],
                            lmNewCoord: [0, 0], normal: [0, 0, 1]
                        });
                    }

                    for (let i = 1; i < L1; i++) {
                        let a = i / level;
                        let pc0 = this._getCurvePt3(c0.pos, c1.pos, c2.pos, a), pc1 = this._getCurvePt3(c3.pos, c4.pos, c5.pos, a), pc2 = this._getCurvePt3(c6.pos, c7.pos, c8.pos, a);
                        let tc0 = this._getCurvePt3(c0.texCoord, c1.texCoord, c2.texCoord, a), tc1 = this._getCurvePt3(c3.texCoord, c4.texCoord, c5.texCoord, a), tc2 = this._getCurvePt3(c6.texCoord, c7.texCoord, c8.texCoord, a);
                        let lc0 = this._getCurvePt3(c0.lmCoord, c1.lmCoord, c2.lmCoord, a), lc1 = this._getCurvePt3(c3.lmCoord, c4.lmCoord, c5.lmCoord, a), lc2 = this._getCurvePt3(c6.lmCoord, c7.lmCoord, c8.lmCoord, a);
                        let cc0 = this._getCurvePt3(c0.color, c1.color, c2.color, a), cc1 = this._getCurvePt3(c3.color, c4.color, c5.color, a), cc2 = this._getCurvePt3(c6.color, c7.color, c8.color, a);

                        for (let j = 0; j < L1; j++) {
                            let b = j / level;
                            let colorRes = this._getCurvePt3(cc0, cc1, cc2, b);
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

        _getCurvePt3(c0, c1, c2, dist) {
            let b = 1.0 - dist;
            return [
                c0[0] * (b * b) + c1[0] * (2 * b * dist) + c2[0] * (dist * dist),
                c0[1] * (b * b) + c1[1] * (2 * b * dist) + c2[1] * (dist * dist),
                c0[2] * (b * b) + c1[2] * (2 * b * dist) + c2[2] * (dist * dist)
            ];
        }

        _getCurvePt2(c0, c1, c2, dist) {
            let b = 1.0 - dist;
            return [
                c0[0] * (b * b) + c1[0] * (2 * b * dist) + c2[0] * (dist * dist),
                c0[1] * (b * b) + c1[1] * (2 * b * dist) + c2[1] * (dist * dist)
            ];
        }

        _parseEntityString(str) {
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
    };

    window.q3shader = q3shader
})(typeof window !== "undefined" ? window.THREE : global.THREE);

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



async function importBSP() {
    const THREE = require('three');
    let bspLoader = new THREE.Q3BSPLoader();
    let activeScene = window.nunu.getScene();

    const mapName = q3bsp_base_folder + "/maps/q3dm17.bsp";

    await q3shader.loadList(mapShaders, () => { });

    bspLoader.load(mapName, function (bspGroup) {
        bspGroup.name = "q3dm17_Map";
        bspGroup.type = "Group";
        bspGroup.folded = false;
        bspGroup.locked = false;

        // Add container tree first
        window.nunu.addObject(bspGroup, activeScene);

        const surfaceChildren = [];
        bspGroup.traverse(function (child) {
            if (child.isMesh && child !== bspGroup) {
                surfaceChildren.push(child);
            }
        });

        // Decouple original flat arrays so action transactions maintain context
        bspGroup.children = [];

        surfaceChildren.forEach((surfaceMesh) => {
            if (surfaceMesh.geometry) {
                surfaceMesh.geometry.computeBoundingBox();
                surfaceMesh.geometry.computeBoundingSphere();
            }

            // 1. Hand off to the engine framework workspace first
            window.nunu.addObject(surfaceMesh, bspGroup);
        });

        // 2. NOW safely query the framework's processed tree array and inject the methods 
        // directly onto the actual live wrapper items nunu created.
        bspGroup.traverse(function (liveChild) {
            // Guarantee isEmpty exists on EVERYTHING inside this map cluster
            if (typeof liveChild.isEmpty !== 'function') {
                if (liveChild.isMesh) {
                    liveChild.isEmpty = function () { return true; };
                } else {
                    liveChild.isEmpty = function () {
                        return this.children ? this.children.length === 0 : true;
                    };
                }
            }

            if (typeof liveChild.resize !== 'function') {
                liveChild.resize = function (x, y) {
                    if (this.children && this.children.length > 0) {
                        for (let i = 0; i < this.children.length; i++) {
                            if (typeof this.children[i].resize === 'function') {
                                this.children[i].resize(x, y);
                            }
                        }
                    }
                };
            }

            if (typeof liveChild.toJSON !== 'function') {
                liveChild.toJSON = function (meta) {
                    const baseProto = Object.getPrototypeOf(this);
                    if (baseProto && typeof baseProto.toJSON === 'function') {
                        return baseProto.toJSON.call(this, meta);
                    }
                    return THREE.Object3D.prototype.toJSON.call(this, meta);
                };
            }
        });

        // Ensure the root group itself also has its interface methods locked down
        bspGroup.isEmpty = function () {
            return this.children ? this.children.length === 0 : true;
        };

        // Highlight first room mesh element to activate inspector pane metrics instantly
        if (bspGroup.children.length > 0) {
            window.nunu.selectObject(bspGroup.children[0]);
        } else {
            window.nunu.selectObject(bspGroup);
        }

        window.nunu.gui.updateInterface();
    });
}

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