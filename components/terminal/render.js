

/**
 * Captures a specific window of a WebGL frame buffer with custom scale and offsets.
 * @param {WebGLRenderingContext} gl - Active WebGL context.
 * @param {number} cols - Terminal target column layout length.
 * @param {number} rows - Terminal target row layout length.
 * @param {number} scale - Zoom factor (e.g. 1.0 = normal, 2.0 = twice as close).
 * @param {number} offsetX - Horizontal pixel offset shift from the left edge.
 * @param {number} offsetY - Vertical pixel offset shift from the bottom edge.
 */
function captureFrameToAnsiExtended(gl, cols, rows, scale = 1.0, offsetX = 0, offsetY = 0) {
    // 1. Get the GPU's true rendering dimensions
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    // 2. Size the buffer to fit the FULL canvas frame
    const pixelBuffer = new Uint8Array(width * height * 4);

    // 3. Read the complete frame out of the GPU
    gl.readPixels(
        0, 0,
        width, height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixelBuffer
    );

    let ansiOutput = "\x1b[H"; // Reset terminal cursor to top-left home position

    // 4. Calculate the size of the window frame we are sampling from the GPU
    // Higher scale means we sample a smaller window area (zooming in)
    const sampleWidth = width / scale;
    const sampleHeight = height / scale;

    // 5. Downsample across your terminal target columns/rows step layout
    for (let r = 0; r < rows; r++) {
        // Map terminal row down to our window sub-height
        // Invert rows mapping match because WebGL tracks (0,0) at the bottom-left
        const subY = ((rows - 1 - r) / rows) * sampleHeight;
        
        // Add the vertical pixel offset, clamped cleanly inside the buffer boundaries
        const srcY = Math.floor(Math.max(0, Math.min(height - 1, subY + offsetY)));
        const yOffset = srcY * width * 4;

        for (let c = 0; c < cols; c++) {
            // Map terminal column across to our window sub-width
            const subX = (c / cols) * sampleWidth;
            
            // Add the horizontal pixel offset, clamped cleanly inside the buffer boundaries
            const srcX = Math.floor(Math.max(0, Math.min(width - 1, subX + offsetX)));
            const pixelIdx = yOffset + (srcX * 4);

            // Extract RGBA channels
            const red = pixelBuffer[pixelIdx];
            const green = pixelBuffer[pixelIdx + 1];
            const blue = pixelBuffer[pixelIdx + 2];

            ansiOutput += `\x1b[48;2;${red};${green};${blue}m `;
        }
        ansiOutput += "\x1b[0m\n";
    }

    return ansiOutput;
}




const quakeEngineMenuData = {
    // --- CATEGORY 1: NETWORK & NETWORKING CVARS ---
    "network_config": {
        "type": "fieldset",
        "name": "Network & Replication Settings",
        "description": "Configure client-to-server synchronization, thresholds, and latency overrides.",
        "options": {
            "cl_timeout": {
                "name": "Connection Timeout",
                "type": "form",
                "value": "200",
                "description": "Duration (in seconds) of receiving nothing from the server before disconnecting."
            },
            "cl_timeNudge": {
                "name": "Fixed Time Nudge",
                "type": "form",
                "value": "0",
                "description": "Artificially adds/subtracts latency (-30 to 30) for smoother prediction or sharper responsiveness."
            },
            "cl_autoNudge": {
                "name": "Dynamic Auto-Nudge",
                "type": "form",
                "value": "0",
                "description": "0: Use fixed \\cl_timeNudge. (0..1]: Auto-adjust latencies as a factor of your median average ping."
            },
            "cl_shownet": {
                "name": "Network Monitor HUD",
                "type": "boolean",
                "value": false,
                "options": ["On", "Off"],
                "description": "Toggles the real-time layout display of incoming/outgoing data packet statistics."
            },
            "cl_showTimeDelta": {
                "name": "Packet Time Delta Logs",
                "type": "boolean",
                "value": false,
                "options": ["On", "Off"],
                "description": "Prints the timing interval variations between progressive server updates to console."
            },
            "cl_lanForcePackets": {
                "name": "LAN Packet Throttle Bypass",
                "type": "boolean",
                "value": true,
                "options": ["Bypass Active", "Obey cl_maxpackets"],
                "description": "Forces the engine to send client updates every single frame during LAN games."
            }
        }
    },

    // --- CATEGORY 2: USERINFO & CUSTOMIZATION ---
    "user_identity": {
        "type": "fieldset",
        "name": "Player Profile & Userinfo Matrix",
        "description": "Local identity parameters packaged and broadcasted to the host via CVAR_USERINFO fields.",
        "options": {
            "name": {
                "name": "Player Name",
                "type": "text",
                "value": "UnnamedPlayer",
                "description": "The active network handle displayed in text logs and server scoreboards."
            },
            "rate": {
                "name": "Data Rate Limit (Bytes/s)",
                "type": "text",
                "value": "25000",
                "description": "Maximum data bandwidth threshold allowed for active network replication streams."
            },
            "snaps": {
                "name": "Snapshot Snapshot Rates",
                "type": "text",
                "value": "40",
                "description": "The target quantity of full gamestate updates requested from the server per second."
            },
            "model": {
                "name": "Base Player Model",
                "type": "text",
                "value": "sarge",
                "description": "The primary model mesh rendered across remote client screens."
            },
            "handicap": {
                "name": "Player Combat Handicap",
                "type": "text",
                "value": "100",
                "description": "Voluntary maximum health value limitation caps (1-100) used to equalize matches."
            },
            "cg_predictItems": {
                "name": "Client Item Prediction",
                "type": "boolean",
                "value": true,
                "options": ["Predict", "Server Authoritative"],
                "description": "Predict item pickup triggers instantly client-side before server round-trip affirmation."
            }
        }
    },

    // --- CATEGORY 3: DEMO RECORDING & MEDIA EXPORTS ---
    "media_capture": {
        "type": "fieldset",
        "name": "Demo Recording & Video Encoding Pipelines",
        "description": "Configure localized capture tools, demo dumps, and system recording states.",
        "options": {
            "cl_autoRecordDemo": {
                "name": "Automatic Demo Recording",
                "type": "boolean",
                "value": false,
                "options": ["Record on Join", "Manual Toggles"],
                "description": "Instantly starts spinning up a local .dm_68 file tracking state upon joining nodes."
            },
            "cl_drawRecording": {
                "name": "Recording Indicator Toggle",
                "type": "boolean",
                "value": true,
                "options": ["Shortened HUD", "Hidden"],
                "description": "Toggles whether the red 'RECORDING' warning status draws on the screen viewport."
            },
            "cl_aviFrameRate": {
                "name": "Capture Frame Rate",
                "type": "text",
                "value": "25",
                "description": "The target framerate used during high-fidelity native video recording renders (1-1000)."
            },
            "cl_forceavidemo": {
                "name": "Raw TGA Screenshot Dump",
                "type": "boolean",
                "value": false,
                "options": ["Force Sequence", "Standard Codec Video"],
                "description": "Forces demo frame dumps to serialize directly into sequential raw TGA file streams."
            },
            "cl_aviPipeFormat": {
                "name": "FFmpeg Video Pipe Arguments",
                "type": "text",
                "value": "-preset medium -crf 23 -c:v libx264 -flags +cgop -pix_fmt yuvj420p -bf 2 -c:a aac -strict -2 -b:a 160k -movflags faststart",
                "description": "Encoder parameters and compression attributes piped directly to the video binary."
            }
        }
    },

    // --- CATEGORY 4: CONSOLE PIPELINE COMMAND ROUTER ---
    "engine_commands": {
        "type": "fieldset",
        "name": "Subsystem Engine Command Gateway",
        "description": "Executable actions bound to your client runtime. These run straight via your CLI command line wrapper.",
        "options": {
            "connect": {
                "name": "\\connect [ip:port]",
                "type": "info",
                "value": "Action Command",
                "description": "Disconnects from current loops and initiates an engine connection sequence to a remote network address."
            },
            "disconnect": {
                "name": "\\disconnect",
                "type": "info",
                "value": "Action Command",
                "description": "Gracefully tears down connection sockets and returns the engine buffer to the local disconnected space."
            },
            "rcon": {
                "name": "\\rcon [command]",
                "type": "info",
                "value": "Action Command",
                "description": "Forwards secure configuration directives directly to the active server using your \\rconPassword."
            },
            "serverstatus": {
                "name": "\\serverstatus",
                "type": "info",
                "value": "Query Command",
                "description": "Requests and prints the direct raw structural connection metrics of the current server node."
            },
            "serverinfo": {
                "name": "\\serverinfo",
                "type": "info",
                "value": "Query Command",
                "description": "Dumps the full list of setting rules, maps, and server constraints currently running on the host."
            },
            "vid_restart": {
                "name": "\\vid_restart",
                "type": "info",
                "value": "Subsystem Control",
                "description": "Reloads the entire WebGL canvas rendering subsystem, re-compiles shaders, and re-binds textures."
            },
            "snd_restart": {
                "name": "\\snd_restart",
                "type": "info",
                "value": "Subsystem Control",
                "description": "Flushes and initializes the audio hardware mixer context pipes from scratch."
            }
        }
    },

    // --- CATEGORY 5: CONTENT STREAMING & AUTODOWNLOADS ---
    "download_management": {
        "type": "fieldset",
        "name": "Content Streaming & Pack Distributions",
        "description": "Configure how your client fetches maps and PK3 assets missing from the local layout directories.",
        "options": {
            "cl_allowDownload": {
                "name": "Download Bitmask Allowed",
                "type": "text",
                "value": "1",
                "description": "Bitmask configurations: 1 = Enabled, 2 = Disable HTTP/FTP streams, 4 = Disable UDP raw bursts."
            },
            "cl_dlURL": {
                "name": "HTTP Content Delivery Server",
                "type": "text",
                "value": "http://ws.q3df.org/maps/download/%1",
                "description": "The base remote location URL used to download PK3 packs before parsing geometry."
            },
            "cl_dlDirectory": {
                "name": "Download Target Location",
                "type": "boolean",
                "value": false,
                "options": ["Save to basegame", "Save to current mod game folder"],
                "description": "Determines where to save maps acquired via dynamic download vectors."
            }
        }
    }
};

function drawQuakeConfigDashboard(xtermInstance) {
    const width = xtermInstance.cols || 80;
    
    // Clear screen cursor pointers
    xtermInstance.write("\x1b[H");

    // Generate the individual menu categories
    for (const [key, category] of Object.entries(quakeEngineMenuData)) {
        // Feed the fieldsets straight into your adapted boxes code loops!
        const renderedSectionBox = obThemeFormObject(key, category, width);
        
        xtermInstance.write(renderedSectionBox);
    }
}


async function captureRenderToTerminalCorner() {
    if (typeof getAvailableContext === 'undefined') {
        await DependencyLoader.loadModule('toji');
    }

    let viewport = document.getElementById("viewport");
    let gl = getAvailableContext(viewport, ['webgl2', 'webgl', 'experimental-webgl']);

    // 1. Constrain rows height to half the terminal real estate
    const rows = Math.floor(term.rows / 2);
    
    // 2. Calculate aspect ratio columns width
    const canvasAspect = viewport.clientWidth / viewport.clientHeight;
    const cols = Math.floor(rows * canvasAspect * 2);

    // 3. Define corner destination alignment parameters (Top-Right positioning math)
    const targetStartX = Math.max(0, term.cols - cols); // Slaps it cleanly against the right border edge
    const targetStartY = 0;                             // Fixed to the top row line of the terminal screen

    // 4. Extract localized window matrix string block
    const ansiStringFrame = captureFrameToCornerAnsi(
        gl, 
        cols, 
        rows, 
        targetStartX, 
        targetStartY,
        1.0, // Scale
        0,   // Offset X
        0    // Offset Y
    );

    // 5. Fire frame over the socket link stream
    term.write(ansiStringFrame);

    if (document.querySelector('#terminals a[href="#soft"].active') !== null)
        cliRenderFrameLimiter.requestFrameUpdate();
}

async function captureRenderToTerminal() {
    if (typeof getAvailableContext === 'undefined') {
        await DependencyLoader.loadModule('toji')
    }

    let viewport = document.getElementById("viewport");

    // Get the GL Context (try 'webgl2' first, then fallback)
    let gl = getAvailableContext(viewport, ['webgl2', 'webgl', 'experimental-webgl']);
    const cols = term.cols;
    const rows = term.rows - 2;

    // Run extraction algorithm
    const ansiStringFrame = captureFrameToAnsiExtended(gl, cols, rows);

    // 3. Nuke xterm view and stream frame straight to the terminal instance
    //term.reset();
    term.write("\x1b[H" + ansiStringFrame);
    if (document.querySelector('#terminals a[href="#soft"].active') !== null)
        cliRenderFrameLimiter.requestFrameUpdate()
}


/**
 * Captures a WebGL sub-frame and encodes it into a localized, floating block overlay matrix.
 */
function captureFrameToCornerAnsi(gl, cols, rows, targetStartX = 0, targetStartY = 0, scale = 1.0, offsetX = 0, offsetY = 0) {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixelBuffer = new Uint8Array(width * height * 4);

    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);

    // Save the active user typing cursor state globally before drawing the frame
    let ansiOutput = "\x1b[s"; 

    const sampleWidth = width / scale;
    const sampleHeight = height / scale;

    for (let r = 0; r < rows; r++) {
        // Compute terminal destination layout lines: targetStartY tracks row indices down the buffer
        const destinationLine = targetStartY + r + 1; // 1-based ANSI sequence positioning
        
        // Direct absolute hardware coordinate cursor jump command: \x1b[Row;ColumnH
        ansiOutput += `\x1b[${destinationLine};${targetStartX + 1}H`;

        // Map sampling coordinates down to the source WebGL texture
        const subY = ((rows - 1 - r) / rows) * sampleHeight;
        const srcY = Math.floor(Math.max(0, Math.min(height - 1, subY + offsetY)));
        const yOffset = srcY * width * 4;

        for (let c = 0; c < cols; c++) {
            const subX = (c / cols) * sampleWidth;
            const srcX = Math.floor(Math.max(0, Math.min(width - 1, subX + offsetX)));
            const pixelIdx = yOffset + (srcX * 4);

            const red = pixelBuffer[pixelIdx];
            const green = pixelBuffer[pixelIdx + 1];
            const blue = pixelBuffer[pixelIdx + 2];

            ansiOutput += `\x1b[48;2;${red};${green};${blue}m `;
        }
        // Safely wipe cell graphic attributes at the edge of the picture cell boundary block
        ansiOutput += "\x1b[0m"; 
    }

    // Instantly restore the typing cursor cleanly to its untouched location
    ansiOutput += "\x1b[u"; 
    return ansiOutput;
}

