/*
 * main.js - Setup for Quake 3 WebGL demo
 */

/*
 * Copyright (c) 2011 Brandon Jones
 *
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 *    1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 *
 *    2. Altered source versions must be plainly marked as such, and must not
 *    be misrepresented as being the original software.
 *
 *    3. This notice may not be removed or altered from any source
 *    distribution.
 */

let polyfill = new WebXRPolyfill();

// The bits that need to change to load different maps are right here!
// ===========================================

let mapName = 'q3tourney2';

// If you're running from your own copy of Quake 3, you'll want to use these shaders
/*let mapShaders = [
    'scripts/base.shader', 'scripts/base_button.shader', 'scripts/base_floor.shader',
    'scripts/base_light.shader', 'scripts/base_object.shader', 'scripts/base_support.shader',
    'scripts/base_trim.shader', 'scripts/base_wall.shader', 'scripts/common.shader',
    'scripts/ctf.shader', 'scripts/eerie.shader', 'scripts/gfx.shader',
    'scripts/gothic_block.shader', 'scripts/gothic_floor.shader', 'scripts/gothic_light.shader',
    'scripts/gothic_trim.shader', 'scripts/gothic_wall.shader', 'scripts/hell.shader',
    'scripts/liquid.shader', 'scripts/menu.shader', 'scripts/models.shader',
    'scripts/organics.shader', 'scripts/sfx.shader', 'scripts/shrine.shader',
    'scripts/skin.shader', 'scripts/sky.shader', 'scripts/test.shader'
];*/

// For my demo, I compiled only the shaders the map used into a single file for performance reasons
let mapShaders = ['scripts/common.shader'];

// ===========================================
// Everything below here is common to all maps
let leftViewMat, rightViewMat, projMat;
let leftViewport, rightViewport;
let activeShader;
let map, playerMover;
let mobileSite = false;

let zAngle = 3;
let xAngle = 0;
let cameraPosition = [0, 0, 0];
let onResize = null;

// WebXR Globals
let xrDevice = null;
let xrSession = null;
let xrReferenceSpace = null;
let xrPose = null;
let xrViews = [];

// These values are in meters
let playerHeight = 57; // Roughly where my eyes sit (1.78 meters off the ground)
let xrIPDScale = 32.0; // There are 32 units per meter in Quake 3

let xrDrawMode = 0;

let SKIP_FRAMES = 0;
let REPEAT_FRAMES = 1;

function isXRPresenting() {
    return !!xrSession;
}

function getQueryVariable(variable) {
    let query = window.location.search.substring(1);
    let vars = query.split("&");
    for (let i = 0; i < vars.length; i++) {
        let pair = vars[i].split("=");
        if (pair[0] == variable) {
            return unescape(pair[1]);
        }
    }
    return null;
}

// Set up basic GL State up front
function initGL(gl, canvas) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.enable(gl.CULL_FACE);

    leftViewMat = mat4.create();
    rightViewMat = mat4.create();
    projMat = mat4.create();

    leftViewport = { x: 0, y: 0, width: 0, height: 0 };
    rightViewport = { x: 0, y: 0, width: 0, height: 0 };

    initMap(gl);
}

// Load the map
function initMap(gl) {
    //let titleEl = document.getElementById("mapTitle");
    //titleEl.innerHtml = mapName.toUpperCase();

    let tesselation = getQueryVariable("tesselate");
    if (tesselation) {
        tesselation = parseInt(tesselation, 10);
    }

    let xrMode = getQueryVariable("vrDrawMode");
    if (xrMode) {
        xrDrawMode = parseInt(xrMode, 10);
    }

    map = new q3bsp(gl);
    map.onentitiesloaded = initMapEntities;
    map.onbsp = initPlayerMover;
    //map.onsurfaces = initSurfaces;
    map.loadShaders(mapShaders);
    map.load('maps/' + mapName + '.bsp', tesselation);
}

// Process entities loaded from the map
function initMapEntities(entities) {
    respawnPlayer(0);
}

function initPlayerMover(bsp) {
    playerMover = new q3movement(bsp);
    respawnPlayer(0);
    document.getElementById('viewport').style.display = 'block';
    onResize();
}

let lastIndex = 0;
// "Respawns" the player at a specific spawn point. Passing -1 will move the player to the next spawn point.
function respawnPlayer(index) {
    if (map.entities && playerMover) {
        if (index == -1) {
            index = (lastIndex + 1) % map.entities.info_player_deathmatch.length;
        }
        lastIndex = index;

        let spawnPoint = map.entities.info_player_deathmatch[index];
        playerMover.position = [
            spawnPoint.origin[0],
            spawnPoint.origin[1],
            spawnPoint.origin[2] + 30 // Start a little ways above the floor
        ];

        playerMover.velocity = [0, 0, 0];

        zAngle = -(spawnPoint.angle || 0) * (3.1415 / 180) + (3.1415 * 0.5); // Negative angle in radians + 90 degrees
        xAngle = 0;
    }
}

function eulerFromQuaternion(out, q, order) {
    function clamp(value, min, max) {
        return (value < min ? min : (value > max ? max : value));
    }
    // Borrowed from Three.JS :)
    // q is assumed to be normalized
    // http://www.mathworks.com/matlabcentral/fileexchange/20696-function-to-convert-between-dcm-euler-angles-quaternions-and-euler-vectors/content/SpinCalc.m
    let sqx = q[0] * q[0];
    let sqy = q[1] * q[1];
    let sqz = q[2] * q[2];
    let sqw = q[3] * q[3];

    if (order === 'XYZ') {
        out[0] = Math.atan2(2 * (q[0] * q[3] - q[1] * q[2]), (sqw - sqx - sqy + sqz));
        out[1] = Math.asin(clamp(2 * (q[0] * q[2] + q[1] * q[3]), -1, 1));
        out[2] = Math.atan2(2 * (q[2] * q[3] - q[0] * q[1]), (sqw + sqx - sqy - sqz));
    } else if (order === 'YXZ') {
        out[0] = Math.asin(clamp(2 * (q[0] * q[3] - q[1] * q[2]), -1, 1));
        out[1] = Math.atan2(2 * (q[0] * q[2] + q[1] * q[3]), (sqw - sqx - sqy + sqz));
        out[2] = Math.atan2(2 * (q[0] * q[1] + q[2] * q[3]), (sqw - sqx + sqy - sqz));
    } else if (order === 'ZXY') {
        out[0] = Math.asin(clamp(2 * (q[0] * q[3] + q[1] * q[2]), -1, 1));
        out[1] = Math.atan2(2 * (q[1] * q[3] - q[2] * q[0]), (sqw - sqx - sqy + sqz));
        out[2] = Math.atan2(2 * (q[2] * q[3] - q[0] * q[1]), (sqw - sqx + sqy - sqz));
    } else if (order === 'ZYX') {
        out[0] = Math.atan2(2 * (q[0] * q[3] + q[2] * q[1]), (sqw - sqx - sqy + sqz));
        out[1] = Math.asin(clamp(2 * (q[1] * q[3] - q[0] * q[2]), -1, 1));
        out[2] = Math.atan2(2 * (q[0] * q[1] + q[2] * q[3]), (sqw + sqx - sqy - sqz));
    } else if (order === 'YZX') {
        out[0] = Math.atan2(2 * (q[0] * q[3] - q[2] * q[1]), (sqw - sqx + sqy - sqz));
        out[1] = Math.atan2(2 * (q[1] * q[3] - q[0] * q[2]), (sqw + sqx - sqy - sqz));
        out[2] = Math.asin(clamp(2 * (q[0] * q[1] + q[2] * q[3]), -1, 1));
    } else if (order === 'XZY') {
        out[0] = Math.atan2(2 * (q[0] * q[3] + q[1] * q[2]), (sqw - sqx + sqy - sqz));
        out[1] = Math.atan2(2 * (q[0] * q[2] + q[1] * q[3]), (sqw + sqx - sqy - sqz));
        out[2] = Math.asin(clamp(2 * (q[2] * q[3] - q[0] * q[1]), -1, 1));
    } else {
        console.log('No order given for quaternion to euler conversion.');
        return;
    }
}

let lastMove = 0;

function onFrame(gl, event) {
    if (!map || !playerMover) { return; }

    // Update player movement @ 60hz
    // The while ensures that we update at a fixed rate even if the rendering bogs down
    while (event.elapsed - lastMove >= 16) {
        updateInput(16);
        lastMove += 16;
    }

    // For great laggage!
    for (let i = 0; i < REPEAT_FRAMES; ++i)
        drawFrame(gl);
}

let poseMatrix = mat4.create();
function getViewMatrix(out, pose, view) {
    mat4.identity(out);

    mat4.translate(out, out, playerMover.position);
    if (!pose)
        mat4.translate(out, out, [0, 0, playerHeight]);
    mat4.rotateZ(out, out, -zAngle);
    mat4.rotateX(out, out, Math.PI / 2);

    if (view) {
        /*let orientation = pose.orientation;
        let position = pose.position;
        if (!orientation) { orientation = [0, 0, 0, 1]; }
        if (!position) { position = [0, 0, 0]; }
    
        mat4.fromRotationTranslation(poseMatrix, orientation, [
          position[0] * vrIPDScale,
          position[1] * vrIPDScale,
          position[2] * vrIPDScale
        ]);*/
        /*if (vrDisplay.stageParameters) {
          mat4.multiply(poseMatrix, vrDisplay.stageParameters.sittingToStandingTransform, out);
        }*/

        /*if (eye) {
          mat4.translate(poseMatrix, poseMatrix, [eye.offset[0] * vrIPDScale, eye.offset[1] * vrIPDScale, eye.offset[2] * vrIPDScale]);
        }*/

        mat4.scale(poseMatrix, view.transform.inverse.matrix, [1 / xrIPDScale, 1 / xrIPDScale, 1 / xrIPDScale]);
        mat4.invert(poseMatrix, poseMatrix);
        mat4.multiply(out, out, poseMatrix);
    }

    mat4.rotateX(out, out, -xAngle);

    mat4.invert(out, out);
}

// Draw a single frame
function drawFrame(gl) {
    // Clear back buffer but not color buffer (we expect the entire scene to be overwritten)
    gl.depthMask(true);

    if (!map || !playerMover) { return; }

    if (!xrPose) {
        // Standard rendering path.

        // Matrix setup
        getViewMatrix(leftViewMat);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // Here's where all the magic happens...
        map.draw(leftViewMat, projMat);
    } else {
        // WebXR rendering path.

        // If the number of views has changed since the last frame the rebuild the
        // list.
        if (xrViews.length != xrPose.views.length) {
            xrViews = [];
        }

        for (let v = 0; v < xrPose.views.length; ++v) {
            if (xrViews.length <= v) {
                xrViews.push({
                    viewMat: mat4.create(),
                    projMat: null,
                    viewport: null,
                });
            }
            let view = xrViews[v];
            getViewMatrix(view.viewMat, xrPose, xrPose.views[v]);
            view.projMat = xrPose.views[v].projectionMatrix;
            view.viewport = xrSession.renderState.baseLayer.getViewport(xrPose.views[v]);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, xrSession.renderState.baseLayer.framebuffer);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        map.drawViews(xrViews);
    }
}

let pressed = new Array(128);
let cameraMat = mat4.create();

function moveLookLocked(xDelta, yDelta) {
    zAngle += xDelta * 0.0025;
    while (zAngle < 0)
        zAngle += Math.PI * 2;
    while (zAngle >= Math.PI * 2)
        zAngle -= Math.PI * 2;

    if (!isXRPresenting()) {
        xAngle += yDelta * 0.0025;
        while (xAngle < -Math.PI * 0.5)
            xAngle = -Math.PI * 0.5;
        while (xAngle > Math.PI * 0.5)
            xAngle = Math.PI * 0.5;
    }
}

function filterDeadzone(value) {
    return Math.abs(value) > 0.35 ? value : 0;
}

let xrOrientation = quat.create();
let xrEuler = vec3.create();
function moveViewOriented(dir, frameTime) {
    if (dir[0] !== 0 || dir[1] !== 0 || dir[2] !== 0) {
        mat4.identity(cameraMat);
        if (xrPose) {
            mat4.getRotation(xrOrientation, xrPose.transform.matrix);
            eulerFromQuaternion(xrEuler, xrOrientation, 'YXZ');
            mat4.rotateZ(cameraMat, cameraMat, zAngle - xrEuler[1]);
        } else {
            mat4.rotateZ(cameraMat, cameraMat, zAngle);
        }
        mat4.invert(cameraMat, cameraMat);

        vec3.transformMat4(dir, dir, cameraMat);
    }

    // Send desired movement direction to the player mover for collision detection against the map
    playerMover.move(dir, frameTime);
}

function updateInput(frameTime) {
    if (!playerMover) { return; }

    let dir = [0, 0, 0];

    // This is our first person movement code. It's not really pretty, but it works
    if (pressed['W'.charCodeAt(0)]) {
        dir[1] += 1;
    }
    if (pressed['S'.charCodeAt(0)]) {
        dir[1] -= 1;
    }
    if (pressed['A'.charCodeAt(0)]) {
        dir[0] -= 1;
    }
    if (pressed['D'.charCodeAt(0)]) {
        dir[0] += 1;
    }

    if (!xrSession) {
        let gamepads = [];
        if (navigator.getGamepads) {
            gamepads = navigator.getGamepads();
        } else if (navigator.webkitGetGamepads) {
            gamepads = navigator.webkitGetGamepads();
        }

        for (let i = 0; i < gamepads.length; ++i) {
            let pad = gamepads[i];
            if (pad) {
                dir[0] += filterDeadzone(pad.axes[0]);
                dir[1] -= filterDeadzone(pad.axes[1]);

                moveLookLocked(
                    filterDeadzone(pad.axes[2]) * 25.0,
                    filterDeadzone(pad.axes[3]) * 25.0
                );

                for (let j = 0; j < Math.min(pad.buttons.length, 4); ++j) {
                    let button = pad.buttons[j];
                    if (typeof (button) == "number" && button == 1.0) {
                        playerMover.jump();
                    } else if (button.pressed) {
                        playerMover.jump();
                    }
                }
            }
        }
    }

    moveViewOriented(dir, frameTime);
}

// Set up event handling
function initEvents() {
    let movingModel = false;
    let lastX = 0;
    let lastY = 0;
    let lastMoveX = 0;
    let lastMoveY = 0;
    let viewport = document.getElementById("viewport");
    let viewportFrame = document.getElementById("viewport-frame");

    viewportFrame.addEventListener('click', runTojiEngine)

    document.addEventListener("keydown", function (event) {
        if (event.keyCode == 32 && !pressed[32]) {
            playerMover.jump();
        }
        pressed[event.keyCode] = true;
        if ((event.keyCode == 'W'.charCodeAt(0) ||
            event.keyCode == 'S'.charCodeAt(0) ||
            event.keyCode == 'A'.charCodeAt(0) ||
            event.keyCode == 'D'.charCodeAt(0) ||
            event.keyCode == 32) && !event.ctrlKey) {
            event.preventDefault();
        }
    }, false);

    document.addEventListener("keypress", function (event) {
        if (event.charCode == 'R'.charCodeAt(0) || event.charCode == 'r'.charCodeAt(0)) {
            respawnPlayer(-1);
        }
    }, false);

    document.addEventListener("keyup", function (event) {
        pressed[event.keyCode] = false;
    }, false);

    function startLook(x, y) {
        movingModel = true;

        lastX = x;
        lastY = y;
    }

    function endLook() {
        movingModel = false;
    }

    function moveLook(x, y) {
        let xDelta = x - lastX;
        let yDelta = y - lastY;
        lastX = x;
        lastY = y;

        if (movingModel) {
            moveLookLocked(xDelta, yDelta);
        }
    }

    function startMove(x, y) {
        lastMoveX = x;
        lastMoveY = y;
    }

    function moveUpdate(x, y, frameTime) {
        let xDelta = x - lastMoveX;
        let yDelta = y - lastMoveY;
        lastMoveX = x;
        lastMoveY = y;

        let dir = [xDelta, yDelta * -1, 0];

        moveViewOriented(dir, frameTime * 2);
    }

    viewport.addEventListener("click", function (event) {
        viewport.requestPointerLock();
    }, false);

    // Mouse handling code
    // When the mouse is pressed it rotates the players view
    viewport.addEventListener("mousedown", function (event) {
        if (event.which == 1) {
            startLook(event.pageX, event.pageY);
        }
    }, false);
    viewport.addEventListener("mouseup", function (event) {
        endLook();
    }, false);
    viewportFrame.addEventListener("mousemove", function (event) {
        if (document.pointerLockElement) {
            moveLookLocked(event.movementX, event.movementY);
        } else {
            moveLook(event.pageX, event.pageY);
        }
    }, false);

    // Touch handling code
    viewport.addEventListener('touchstart', function (event) {
        let touches = event.touches;
        switch (touches.length) {
            case 1: // Single finger looks around
                startLook(touches[0].pageX, touches[0].pageY);
                break;
            case 2: // Two fingers moves
                startMove(touches[0].pageX, touches[0].pageY);
                break;
            case 3: // Three finger tap jumps
                playerMover.jump();
                break;
            default:
                return;
        }
        event.stopPropagation();
        event.preventDefault();
    }, false);
    viewport.addEventListener('touchend', function (event) {
        endLook();
        return false;
    }, false);
    viewport.addEventListener('touchmove', function (event) {
        let touches = event.touches;
        switch (touches.length) {
            case 1:
                moveLook(touches[0].pageX, touches[0].pageY);
                break;
            case 2:
                moveUpdate(touches[0].pageX, touches[0].pageY, 16);
                break;
            default:
                return;
        }
        event.stopPropagation();
        event.preventDefault();
    }, false);
}

// Utility function that tests a list of webgl contexts and returns when one can be created
// Hopefully this future-proofs us a bit
function getAvailableContext(canvas, contextList) {
    if (canvas.getContext) {
        for (let i = 0; i < contextList.length; ++i) {
            try {
                let context = canvas.getContext(contextList[i], {
                    antialias: false,
                    alpha: false,
                    xrCompatible: true
                });
                if (context !== null)
                    return context;
            } catch (ex) { }
        }
    }
    return null;
}

let rafCallback = null;


let startTime = new Date().getTime();
let lastTimestamp = startTime;
let lastFps = startTime;

let frameId = 0;

function onRequestedFrame(gl, stats, t, frame) {
    timestamp = new Date().getTime();

    //if (xrSession) {
    //    xrSession.requestAnimationFrame(onRequestedFrame);
    //} else {
    //    window.requestAnimationFrame(onRequestedFrame);
    //}

    if (xrSession && frame) {
        xrPose = frame.getViewerPose(xrReferenceSpace);
    } else {
        xrPose = null;
    }

    frameId++;
    if (SKIP_FRAMES != 0 && frameId % SKIP_FRAMES != 0)
        return;

    stats.begin();

    onFrame(gl, {
        timestamp: timestamp,
        elapsed: timestamp - startTime,
        frameTime: timestamp - lastTimestamp
    });

    stats.end();

    tojiFrameLimiter.requestFrameUpdate()
}


let tojiEngineRunning = false
let tojiRendererRunning = false
let notRunningFrameCount = 0
function runTojiEngine() {

    let viewportFrame = document.getElementById("viewport-frame");
    if (!viewportFrame.classList.contains('not-hidden')
    && (!document.body.classList.contains('previous-viewport-frame') || window.innerWidth < 1200))
        return

    if (tojiEngineRunning) {
        // restart renderer
        if (!tojiRendererRunning) {
            notRunningFrameCount = 0
            tojiFrameLimiter.requestFrameUpdate()
        }
        return
    }

    tojiEngineRunning = true

    let stats = new Stats();
    viewportFrame.appendChild(stats.domElement);

    let viewport = document.getElementById("viewport");

    // Get the GL Context (try 'webgl2' first, then fallback)
    let gl = getAvailableContext(viewport, ['webgl2', 'webgl', 'experimental-webgl']);

    onResize = function () {
        if (!isXRPresenting()) {
            let devicePixelRatio = window.devicePixelRatio || 1;

            if (document.fullscreenElement) {
                viewport.width = screen.width * devicePixelRatio;
                viewport.height = screen.height * devicePixelRatio;
            } else {
                viewport.width = viewport.clientWidth * devicePixelRatio;
                viewport.height = viewport.clientHeight * devicePixelRatio;
            }

            gl.viewport(0, 0, viewport.width, viewport.height);
            mat4.perspective(projMat, 45.0, viewport.width / viewport.height, 1.0, 4096.0);
        }
    }

    if (!gl) {
        document.getElementById('viewport-frame').style.display = 'none';
        document.getElementById('webgl-error').style.display = 'block';
    } else {
        //document.getElementById('viewport-info').style.display = 'block';
        initEvents();
        initGL(gl, viewport);
        startTime = new Date().getTime()
        frameId = 0
        lastTimestamp = startTime;
        lastFps = startTime;

        window.tojiFrameLimiter = createFrameRater(25, (e, t, frame) => {
            if (!viewportFrame.classList.contains('not-hidden')) {
                notRunningFrameCount++
                if (notRunningFrameCount > 25) {
                    tojiRendererRunning = false;
                    return
                }
            }
            tojiRendererRunning = true
            onRequestedFrame(gl, stats, t, frame);
        });

        tojiFrameLimiter.requestFrameUpdate()
        // TODO: make this lazy with a seperate function
        rafCallback = onRequestedFrame.bind(null, gl, stats);
    }

    onResize();
    window.addEventListener("resize", onResize, false);

    //let showFPS = document.getElementById("showFPS");
    //showFPS.addEventListener("change", function() {
    //    stats.domElement.style.display = showFPS.checked ? "block" : "none";
    //});

    /*let playMusic = document.getElementById("playMusic");
    playMusic.addEventListener("change", function() {
        if(map) {
            map.playMusic(playMusic.checked);
        }
    });*/

    // Handle fullscreen transition
    document.addEventListener("fullscreenchange", function () {
        if (document.fullscreenElement) {
            viewport.requestPointerLock(); // Attempt to lock the mouse automatically on fullscreen
        }
        onResize();
    }, false);

    // Fullscreen
    function goFullscreen() {
        viewportFrame.requestFullScreen();
    }
    //let fullscreenButton = document.getElementById('fullscreenBtn');
    //let mobileFullscreenBtn = document.getElementById("mobileFullscreenBtn");
    //fullscreenButton.addEventListener('click', goFullscreen, false);
    //mobileFullscreenBtn.addEventListener('click', goFullscreen, false);

    // XR
    function presentXR() {
        if (xrSession) {
            xrSession.end();
        } else {
            xAngle = 0.0;
            navigator.xr.requestSession('immersive-vr', {
                optionalFeatures: ['local-floor']
            }).then(function (session) {
                session.addEventListener('end', function () {
                    xrSession = null;
                    xrPose = null;
                    onResize();
                });

                session.addEventListener('select', function (evt) {
                    // ?
                });

                session.addEventListener('selectstart', function (evt) {
                    pressed['W'.charCodeAt(0)] = true;
                });

                session.addEventListener('selectend', function (evt) {
                    pressed['W'.charCodeAt(0)] = false;
                });

                session.requestReferenceSpace('local-floor').then(function (refSpace) {
                    xrReferenceSpace = refSpace;

                    session.updateRenderState({
                        depthNear: 1.0,
                        depthFar: 4096.0,
                        baseLayer: new XRWebGLLayer(session, gl)
                    });
                    xrSession = session;
                    xrSession.requestAnimationFrame(rafCallback);
                });
            });
        }
    }


    // TODO: VR??
    //let vrBtn = document.getElementById("vrBtn");
    //let mobileVrBtn = document.getElementById("mobileVrBtn");
    //vrBtn.addEventListener("click", presentXR, false);
    //mobileVrBtn.addEventListener("click", presentXR, false);

}

// Fire this once the page is loaded up
window.addEventListener("load", function () {
    function OnVRSupported(supported) {
        if (!supported) { return; }
        let vrToggle = document.getElementById("vrToggle");
        vrToggle.style.display = "block";
        let mobileVrBtn = document.getElementById("mobileVrBtn");
        mobileVrBtn.style.display = "block";
    }

    if (navigator.xr) {
        navigator.xr.isSessionSupported('immersive-vr').then(OnVRSupported);
    }

    //main();
}); 