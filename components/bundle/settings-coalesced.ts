
import { SettingConfig } from "./settings";

// Automatically compiled workspace settings cache pass

export const IMPORT_SETTINGS: Record<string, Record<string, SettingConfig>> = {
    "github": {
        "githubToken": {
            "key": "github_token",
            "default": "",
            "description": "Personal GitHub Access Token used to authenticate API requests, bypass rate limits, and securely fetch repository source files or assets."
        },
        "ownersList": {
            "key": "owners",
            "default": [
                "briancullinan2",
                "ec-"
            ],
            "type": "csv",
            "description": "A list of authorized GitHub organization names or usernames hosting the source code and forks relevant to this project environment."
        },
        "repositoriesList": {
            "key": "repositories",
            "default": [
                "Quake3e",
                "baseq3a"
            ],
            "type": "csv",
            "description": "Comma/semicolon-separated list of target GitHub repository names available for compilation selection."
        },
        "defaultRepository": {
            "key": "default_repository",
            "default": "briancullinan2/Quake3e",
            "description": "The fallback or preferred primary repository string formatted as \"owner/repo\" used when loading the workspace workspace initial state."
        },
        "engineRepository": {
            "key": "engine_repository",
            "default": "briancullinan2/Quake3e",
            "description": "The specific Git repository designated for compiling the core Quake 3 WebAssembly engine architecture."
        },
        "gameRepository": {
            "key": "game_repository",
            "default": "briancullinan2/baseq3a",
            "description": "The repository source housing the game logic mod components, including cgame, game, and ui modules."
        },
        "assetRepository": {
            "key": "asset_repository",
            "default": "briancullinan2/multigame-assets",
            "description": "Optional storage repository dedicated to static game assets, maps, texturing bundles, or audio assets required to run the game."
        },
        "toolsRepository": {
            "key": "tools_repository",
            "default": "briancullinan2/q3lcc",
            "description": "Primary compiler tooling repository containing components such as q3lcc (the Quake 3 ANSI C compiler targeting virtual machine bytecode)."
        },
        "tools2Repository": {
            "key": "tools_repository",
            "default": "ec-/q3asm",
            "description": "Secondary toolchain repository hosting utilities like q3asm to assemble the intermediate bytecode files into final .qvm files."
        },
        "rendererRepository": {
            "key": "renderer_repository",
            "default": "briancullinan2/Quake3e",
            "description": "Repository handling the graphical subsystems and pipeline routines tasked with translating engine calculations to browser contexts."
        },
        "environmentRepository": {
            "key": "environment_repository",
            "default": "briancullinan2/quedit",
            "description": "Repository for this workspace, the entire IDE, code editor and engine runner, for editing the environment inside the workspace."
        },
        "environmentVersion": {
            "key": "environment_version",
            "description": "The last commit date for the environment repository set automatically."
        }
    },
    "core": {
        "workspaceDefault": {
            "key": "workspace_default",
            "default": "editor",
            "description": "Specifies the default active panel or system layout view presented to users upon launching the application interface."
        },
        "environmentVersion": {
            "key": "environment_version",
            "description": "The last commit date for the environment repository set automatically."
        },
        "savedTheme": {
            "key": "theme",
            "default": "ace/theme/monokai",
            "elementId": "theme",
            "description": "The visual theme layout package used to style the interactive Ace code editor window background and syntax colors."
        },
        "layoutState": {
            "key": "layout",
            "type": "json",
            "default": "{\"panels\":\"left-hand-files\",\"order\":\"normal-order\",\"terminal\":\"terminal\",\"mode\":\"full-mode\"}",
            "description": "The layout order for opening new panels and resizing the window, snaps back to this state when the environment changes."
        },
        "layoutConfiguration": {
            "key": "layout_config",
            "type": "json",
            "description": "Lumino layout configuration according to how tabs are arranged."
        }
    },
    "editor": {
        "savedTheme": {
            "key": "theme",
            "default": "ace/theme/monokai",
            "elementId": "theme",
            "description": "The visual theme layout package used to style the interactive Ace code editor window background and syntax colors."
        },
        "savedKeyBinding": {
            "key": "keybinding",
            "default": "ace/keybinding/vim",
            "elementId": "keybinding",
            "description": "Defines the keyboard mapping protocol (e.g., standard, Vim, or Emacs configurations) utilized inside the script editor workspace."
        }
    },
    "terminal": {
        "commandHistory": {
            "key": "history",
            "default": [],
            "type": "array",
            "description": "An indexed collection tracking sequential command strings typed into the text interface console for fast history scrolling."
        },
        "terminalLog": {
            "key": "terminal_log",
            "edit": false,
            "default": [],
            "type": "json",
            "description": "Persistent text logging buffer retaining runtime system updates, build logs, and standard out/error print operations."
        }
    },
    "paint": {
        "transparency": {
            "key": "paint_transparency",
            "default": true,
            "elementId": "pop_data_transparency",
            "type": "boolean",
            "description": "Toggles visibility transparent handling states inside the built-in textures/imaging application paint tools."
        },
        "transparencyType": {
            "key": "paint_transparency_type",
            "default": "squares",
            "elementId": "pop_data_transparency_type",
            "description": "The background grid visualization graphic style (e.g., standard checkerboard squares) representing empty transparent canvas regions."
        },
        "theme": {
            "key": "paint_theme",
            "default": "dark",
            "elementId": "pop_data_theme",
            "description": "Sets the user interface background aesthetic layout configuration choice for custom asset creation modules."
        },
        "units": {
            "key": "paint_units",
            "default": "pixels",
            "elementId": "pop_data_default_units",
            "description": "Establishes the default evaluation metric scaling standard used during positioning calculations (e.g., pixels or percentages)."
        },
        "resolution": {
            "key": "paint_resolution",
            "default": "72",
            "elementId": "pop_data_resolution",
            "description": "Target rasterization resolution value tracking pixel denseness outputs across generated texturing operations."
        },
        "enableSnap": {
            "key": "paint_snap",
            "default": true,
            "elementId": "pop_data_snap",
            "type": "boolean",
            "description": "Locks brush positions, vertex points, or element placement edges directly onto active layout grid thresholds."
        },
        "enableGuides": {
            "key": "paint_guides",
            "default": true,
            "elementId": "pop_data_guides",
            "type": "boolean",
            "description": "Displays vector overlay target alignment lines to assist canvas item configuration balancing structures."
        },
        "safeSearch": {
            "key": "paint_safe_search",
            "default": true,
            "elementId": "pop_data_safe_search",
            "type": "boolean",
            "description": "Filters external asset lookups and image integration components to enforce content security constraints."
        },
        "exitConfirm": {
            "key": "paint_exit_confirm",
            "default": true,
            "elementId": "pop_data_exit_confirm",
            "type": "boolean",
            "description": "Prompts users with confirmation modals to prevent unintended layout asset progress data loss when navigating away."
        },
        "thickGuides": {
            "key": "paint_thick_guides",
            "default": false,
            "elementId": "pop_data_thick_guides",
            "type": "boolean",
            "description": "Increases the contrast weight and visibility profile thickness lines of canvas coordinate target alignment helpers."
        },
        "enableAutoResize": {
            "key": "paint_autoresize",
            "default": true,
            "elementId": "pop_data_enable_autoresize",
            "type": "boolean",
            "description": "Automatically stretches or compresses the editing canvas frame sizes relative to shifts in screen display boundaries."
        },
        "quickSaveData": {
            "key": "quicksave_data",
            "default": "",
            "description": "Temporary serialization string containing emergency restore snapshots of the local design layout configuration state."
        }
    },
    "toji": {
        "preferredRenderer": {
            "key": "renderer_preference",
            "default": "toji",
            "description": "Specific configuration preferences passed to the WebGL vertex array and custom shading target context."
        }
    }
};
