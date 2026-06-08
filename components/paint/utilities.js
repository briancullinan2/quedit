

function updatePainter() {
    if (imageEditor.classList.contains('not-hidden') && typeof window.GUI !== 'undefined') {
        //const height = getFullScreenFit(1)
        //window.GUI.set_size(window.innerWidth - 60, height);
        window.GUI.prepare_canvas()
        window.Layers.render();
        //window.GUI.render_main_gui()
    }

}


function hookMiniPaintIntercept() {
    const iframe = document.getElementById('myFrame');
    if (!iframe) return;

    const miniPaintWin = iframe.contentWindow;

    // Ensure miniPaint's module instances have finished setup on window load
    if (!miniPaintWin || !miniPaintWin.FileOpen) {
        setTimeout(hookMiniPaintIntercept, 100); // Poll briefly if not ready
        return;
    }

    // 1. Capture miniPaint's original file processor reference
    const originalLoadFileHandler = miniPaintWin.FileOpen.load_file_handler;

    console.log("Successfully intercepted miniPaint's FileOpen handler.");

    // 2. Overwrite the native method with your custom pipeline proxy
    miniPaintWin.FileOpen.load_file_handler = function (event) {
        // Handle variations of incoming events (File drop arrays vs native input changes)
        const files = event.target?.files || event.dataTransfer?.files;

        if (files && files.length > 0) {
            const file = files[0];
            const filename = file.name.toLowerCase();

            // Check A: Quick extension filter matching Quake 3 assets
            const isQuakeAsset = filename.endsWith('.bsp') ||
                filename.endsWith('.aas') ||
                filename.endsWith('.qvm') ||
                filename.endsWith('.md3') ||
                filename.endsWith('.dat');

            if (isQuakeAsset) {
                console.log(`Intercepted Quake 3 asset by extension: ${file.name}. Routing to custom engine...`);
                routeFileToQuakeEditor(file);
                return; // Stop execution here. miniPaint never touches it!
            }

            // Check B: Heavy verification via byte magic patterns (For files missing extensions)
            const reader = new FileReader();
            reader.onload = function (e) {
                const bytes = new Uint8Array(e.target.result);

                // Leverage your existing BINARY_DETECTOR block patterns
                if (isQuakeBinaryMagic(bytes)) {
                    console.log(`Intercepted Quake 3 asset by binary magic signature. Routing to custom engine...`);
                    routeFileToQuakeEditor(file);
                } else {
                    // It's a normal image! Hand it back down to miniPaint's native engine flow
                    originalLoadFileHandler.call(miniPaintWin.FileOpen, event);
                }
            };

            // Read just the first 16 bytes for checking headers
            reader.readAsArrayBuffer(file.slice(0, 16));

        } else {
            // Fallback for empty/unrecognized input event routing loops
            originalLoadFileHandler.call(miniPaintWin.FileOpen, event);
        }
    };
}





const DROPDOWN_MAX_HEIGHT_MARGIN = 20;

function renderMenuSystem(menuTreeData, targetWrapper) {
    if (!targetWrapper) return;
    targetWrapper.innerHTML = "";

    const output = {
        menuBarHtml: '<ul class="menu_bar" role="menubar" tabindex="0">',
        detachedPanelsHtml: ''
    };

    function buildBranch(nodes, level, pathPrefix) {
        let currentLevelHtml = '';

        nodes.forEach((node, idx) => {
            const currentPath = `${pathPrefix}_${idx}`;
            if (node.divider) {
                currentLevelHtml += '<li role="presentation"><hr></li>';
                return;
            }

            const hasChildren = !!(node.children && node.children.length > 0);
            const displayEllipsis = node.ellipsis ? '...' : '';
            const shortcutLabel = node.shortcut ? `<span class="shortcut"><span class="sr_only">Shortcut Key:</span> ${node.shortcut}</span>` : '';

            currentLevelHtml += `
                <li>
                    <a id="main_menu_${currentPath}" 
                       role="menuitem" 
                       tabindex="-1" 
                       aria-haspopup="${hasChildren}" 
                       aria-expanded="false" 
                       href="javascript:void(0)" 
                       data-level="${level}" 
                       data-index="${idx}"
                       ${node.target ? `data-target="${node.target}"` : ''}>
                        <span class="name"><span class="trn">${node.name}${displayEllipsis}</span></span>
                        ${shortcutLabel}
                    </a>
                </li>
            `;

            if (hasChildren) {
                const subClass = level === 0 ? 'menu_dropdown hidden' : 'menu_dropdown hidden sub_menu';

                // Recursively capture the inner level item strings first
                const childItemsHtml = buildBranch(node.children, level + 1, currentPath);

                // Append the wrapper out flatly to the global pool along with its items
                output.detachedPanelsHtml += `
                    <ul class="${subClass}" 
                        role="menu" 
                        tabindex="0" 
                        aria-labelledby="main_menu_${currentPath}" 
                        id="dropdown_menu_${currentPath}">
                        ${childItemsHtml}
                    </ul>
                `;
            }
        });

        return currentLevelHtml;
    }

    output.menuBarHtml += buildBranch(menuTreeData, 0, '0');
    output.menuBarHtml += '</ul>';

    targetWrapper.innerHTML = output.menuBarHtml + output.detachedPanelsHtml;
}


function initStaticMenu(containerId) {
    const menuContainer = document.getElementById(containerId);
    if (!menuContainer) return;

    menuContainer.addEventListener("click", function (e) {
        const anchor = e.target.closest("a");
        if (!anchor || anchor.tagName !== "A") {
            closeAllDropdowns(menuContainer);
            return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();

        const hasPopup = anchor.getAttribute("aria-haspopup") === "true";
        if (hasPopup) {
            toggleDropdown(menuContainer, anchor);
        } else {
            closeAllDropdowns(menuContainer);

            // Read execution data straight from the element attributes
            const target = anchor.getAttribute("data-target");
            const href = anchor.getAttribute("data-href");
            const rawParam = anchor.getAttribute("data-parameter");
            let parameter = null;

            if (rawParam) {
                try { parameter = JSON.parse(rawParam); } catch (err) { parameter = rawParam; }
            }

            if (href) {
                window.open(href, '_blank');
                return;
            }

            if (target) {
                const parts = target.split(".");
                const moduleName = parts[0];
                const methodName = parts[1];

                // Pull the application routing modules map context globally
                let appModules = window.GUI?.modules || window.modules;
                if (!appModules && window[moduleName]) {
                    appModules = window;
                }

                if (appModules && appModules[moduleName] && typeof appModules[moduleName][methodName] === "function") {
                    console.log(`Executing target directly: ${moduleName}.${methodName}`);
                    appModules[moduleName][methodName](parameter);
                } else {
                    console.error(`Method target not resolved on instance context: ${moduleName}.${methodName}`);
                }
            }
        }
    }, true);

    window.addEventListener("resize", function () {
        positionActiveDropdowns(menuContainer);
    });

    document.body.addEventListener("mousedown", function (e) {
        if (!menuContainer.contains(e.target)) {
            closeAllDropdowns(menuContainer);
        }
    }, true);
}


function toggleDropdown(menuContainer, anchor) {
    const level = parseInt(anchor.getAttribute("data-level"), 10) || 0;
    const pathId = anchor.id.replace("main_menu_", "");
    const dropdown = document.getElementById(`dropdown_menu_${pathId}`);

    if (anchor.getAttribute("aria-expanded") === "true") {
        closeDropdownBranch(menuContainer, level, dropdown);
    } else {
        // If clicking a level 0 menu, close ALL open menus first to switch cleanly
        if (level === 0) {
            closeAllDropdowns(menuContainer);
        } else {
            // If clicking a deeper submenu item, only close its immediate sibling items
            const hostUl = anchor.closest("ul.menu_dropdown");
            if (hostUl) {
                hostUl.querySelectorAll(`:scope > li > a`).forEach(function (a) {
                    if (a === anchor) return; // Skip the one we want to open
                    a.setAttribute("aria-expanded", "false");
                    const siblingPath = a.id.replace("main_menu_", "");
                    const siblingSub = document.getElementById(`dropdown_menu_${siblingPath}`);
                    if (siblingSub) {
                        siblingSub.classList.add("hidden");
                        siblingSub.classList.remove("visible");
                    }
                });
            }
        }

        // Open the target dropdown panel
        anchor.setAttribute("aria-expanded", "true");
        if (dropdown) {
            dropdown.classList.add("visible");
            dropdown.classList.remove("hidden");
            positionActiveDropdowns(menuContainer);
        }
    }
}

function positionActiveDropdowns(menuContainer) {
    const clientWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const clientHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const openDropdowns = menuContainer.querySelectorAll("ul.visible, .menu_dropdown.visible");

    openDropdowns.forEach(function (dropdown) {
        if (dropdown.classList.contains("menu_bar") || dropdown.getAttribute("role") === "menubar") return;

        const pathId = dropdown.id.replace("dropdown_menu_", "");
        const opener = document.getElementById(`main_menu_${pathId}`);
        if (!opener) return;

        const openerRect = opener.getBoundingClientRect();
        const level = parseInt(opener.getAttribute("data-level"), 10) || 0;

        const maxHeight = clientHeight - openerRect.height - DROPDOWN_MAX_HEIGHT_MARGIN;
        dropdown.style.maxHeight = maxHeight + "px";
        const dropdownRect = dropdown.getBoundingClientRect();

        if (level === 0) {
            // Position Tier 0 panels directly below top bar links
            dropdown.style.top = (openerRect.y + openerRect.height) + "px";
            let leftPos = openerRect.x;

            if (leftPos + dropdownRect.width > clientWidth) {
                leftPos = clientWidth - dropdownRect.width - 5;
            }
            dropdown.style.left = Math.max(0, leftPos) + "px";
        } else {
            // Position Tier 1+ flyouts out to the right of the active option row item
            let topPos = openerRect.y;
            if (topPos + dropdownRect.height > clientHeight - DROPDOWN_MAX_HEIGHT_MARGIN) {
                topPos = clientHeight - DROPDOWN_MAX_HEIGHT_MARGIN - dropdownRect.height;
            }
            dropdown.style.top = Math.max(0, topPos) + "px";

            let leftPos = openerRect.x + openerRect.width + 1;
            if (leftPos + dropdownRect.width > clientWidth) {
                leftPos = openerRect.x - dropdownRect.width - 1;
            }
            dropdown.style.left = Math.max(1, leftPos) + "px";
        }
    });
}

function triggerMenuLink(menuContainer, anchor) {
    // 1. Dismiss all open floating layout panels
    closeAllDropdowns(menuContainer);

    // 2. Extract the absolute structural path route (e.g., "0_0_2" out of "main_menu_0_0_2")
    const pathParts = anchor.id.replace("main_menu_", "").split("_");

    // 3. Walk down your configuration tree (e.g., SITE_MENU) using the explicit index path
    let currentBranch = SITE_MENU;
    let targetItem = null;

    // Skip the first root part ('0') and trace down to the selected item reference
    for (let i = 1; i < pathParts.length; i++) {
        const targetIndex = parseInt(pathParts[i], 10);
        targetItem = currentBranch[targetIndex];

        if (targetItem && targetItem.children) {
            currentBranch = targetItem.children;
        }
    }

    if (!targetItem) return;

    // 4. Emit the exact same core execution events miniPaint expects to receive
    if (targetItem.target) {
        // Acts exactly like miniPaint's: this.emit("select_target", i.target, i)
        const targetEvent = new CustomEvent("menu_action", {
            detail: { action: targetItem.target, item: targetItem, element: anchor },
            bubbles: true
        });
        menuContainer.dispatchEvent(targetEvent);
    } else if (targetItem.href) {
        // Acts exactly like miniPaint's: this.emit("select_href", i.href, null)
        window.open(targetItem.href, '_blank');
    }
}

function closeDropdownBranch(menuContainer, level, activeDropdown) {
    if (activeDropdown) {
        activeDropdown.classList.add("hidden");
        activeDropdown.classList.remove("visible");

        // Use the global wrapper container scope to accurately target the flatly detached children panels
        const activePathId = activeDropdown.id.replace("dropdown_menu_", "");
        menuContainer.querySelectorAll(`ul[id^="dropdown_menu_${activePathId}_"]`).forEach(function (sub) {
            sub.classList.add("hidden");
            sub.classList.remove("visible");
        });

        activeDropdown.querySelectorAll("a").forEach(function (a) {
            a.setAttribute("aria-expanded", "false");
        });

        // Synchronize the child anchors located inside the detached panels pool
        menuContainer.querySelectorAll(`a[id^="main_menu_${activePathId}_"]`).forEach(function (deepA) {
            deepA.setAttribute("aria-expanded", "false");
        });
    }

    const opener = menuContainer.querySelector(`a[aria-expanded="true"][data-level="${level}"]`);
    if (opener) {
        opener.setAttribute("aria-expanded", "false");
    }
}

function closeAllDropdowns(menuContainer) {
    menuContainer.querySelectorAll("ul.menu_dropdown").forEach(function (dropdown) {
        dropdown.classList.add("hidden");
        dropdown.classList.remove("visible");
    });
    menuContainer.querySelectorAll("a[aria-expanded]").forEach(function (a) {
        a.setAttribute("aria-expanded", "false");
    });
}






const SITE_MENU = [{
    name: "File",
    children: [{
        name: "New",
        target: "file/new.new"
    }, {
        divider: !0
    }, {
        name: "Open",
        children: [{
            name: "Open File",
            shortcut: "O",
            ellipsis: !0,
            target: "file/open.open_file"
        }, {
            name: "Open Directory",
            ellipsis: !0,
            target: "file/open.open_dir"
        }, {
            name: "Open from Webcam",
            target: "file/open.open_webcam"
        }, {
            name: "Open URL",
            ellipsis: !0,
            target: "file/open.open_url"
        }, {
            name: "Open Data URL",
            ellipsis: !0,
            target: "file/open.open_data_url"
        }, {
            name: "Open Test Template",
            target: "file/open.open_template_test"
        }]
    }, {
        name: "Search Images",
        ellipsis: !0,
        target: "file/open.search"
    }, {
        divider: !0
    }, {
        name: "Export",
        ellipsis: !0,
        shortcut: "S",
        target: "file/save.export"
    }, {
        name: "Save As",
        ellipsis: !0,
        shortcut: "Shift + S",
        target: "file/save.save"
    }, {
        name: "Save As Data URL",
        ellipsis: !0,
        target: "file/save.save_data_url"
    }, {
        name: "Print",
        ellipsis: !0,
        shortcut: "Ctrl+P",
        target: "file/print.print"
    }, {
        divider: !0
    },
    { name: "Settings", target: "file/settings" },
    { divider: true },
    {
        name: "Publish",
        children: [
            { name: "Web", target: "file/publish/web" },
            { name: "Windows", target: "file/publish/windows" },
            { name: "Linux", target: "file/publish/linux" },
            { name: "macOS", target: "file/publish/macos" }
        ]
    },
    { name: "Import", target: "file/import" },
    { divider: true },
    {
        name: "Quick Save",
        shortcut: "F9",
        target: "file/quicksave.quicksave"
    }, {
        name: "Quick Load",
        shortcut: "F10",
        target: "file/quickload.quickload"
    }]
}, {
    name: "Edit",
    children: [{
        name: "Undo",
        shortcut: "Ctrl+Z",
        target: "edit/undo.undo"
    }, {
        name: "Redo",
        shortcut: "Ctrl+Y",
        target: "edit/redo.redo"
    }, {
        divider: !0
    }, {
        name: "Delete Selection",
        shortcut: "Del",
        target: "edit/selection.delete"
    }, {
        name: "Copy Selection",
        target: "layer/new.new_selection"
    }, {
        name: "Copy to Clipboard",
        shortcut: "Ctrl+C",
        target: "edit/copy.copy_to_clipboard"
    },
    { name: "Cut", target: "edit/cut" },
    {
        name: "Paste",
        shortcut: "Ctrl+V",
        target: "edit/paste.paste"
    }, { name: "Delete", target: "edit/delete" },
    {
        divider: !0
    }, {
        name: "Select All",
        shortcut: "Ctrl+A",
        target: "edit/selection.select_all"
    },
    {
        divider: !0
    },
    {
        name: "CSG",
        children: [
            { name: "Intersect", target: "edit/csg/intersect" },
            { name: "Subtract", target: "edit/csg/subtract" },
            { name: "Union", target: "edit/csg/union" }
        ]
    },
    {
        name: "Modifiers",
        children: [
            { name: "Simplify", ellipsis: true, target: "edit/modifiers/simplify" },
            { name: "Subdivide", target: "edit/modifiers/subdivide" },
            { name: "Twist", target: "edit/modifiers/twist" }
        ]
    },
    { name: "Compute Normals", target: "edit/compute_normals" },
    { name: "Apply Transformation", target: "edit/apply_transformation" },
    { name: "Merge Geometries", target: "edit/merge_geometries" }]
}, {
    name: "View",
    children: [{
        name: "Zoom",
        children: [{
            name: "Zoom In",
            target: "view/zoom.in"
        }, {
            name: "Zoom Out",
            target: "view/zoom.out"
        }, {
            divider: !0
        }, {
            name: "Original Size",
            target: "view/zoom.original"
        }, {
            name: "Fit Window",
            target: "view/zoom.auto"
        }]
    }, {
        name: "Grid",
        shortcut: "G",
        target: "view/grid.grid"
    }, {
        name: "Guides",
        children: [{
            name: "Insert",
            ellipsis: !0,
            target: "view/guides.insert"
        }, {
            name: "Update",
            target: "view/guides.update"
        }, {
            name: "Remove all",
            target: "view/guides.remove"
        }]
    }, {
        name: "Ruler",
        target: "view/ruler.ruler"
    }, {
        divider: !0
    }, {
        name: "Full Screen",
        target: "view/full_screen.fs"
    }]
}, {
    name: "Image",
    children: [{
        name: "Information",
        shortcut: "I",
        ellipsis: !0,
        target: "image/information.information"
    }, {
        name: "Canvas Size",
        ellipsis: !0,
        target: "image/size.size"
    }, {
        name: "Trim",
        ellipsis: !0,
        shortcut: "T",
        target: "image/trim.trim"
    }, {
        divider: !0
    }, {
        name: "Resize",
        ellipsis: !0,
        shortcut: "R",
        target: "image/resize.resize"
    }, {
        name: "Rotate",
        ellipsis: !0,
        target: "image/rotate.rotate"
    }, {
        name: "Flip",
        children: [{
            name: "Vertical",
            target: "image/flip.vertical"
        }, {
            name: "Horizontal",
            target: "image/flip.horizontal"
        }]
    }, {
        name: "Translate",
        ellipsis: !0,
        target: "image/translate.translate"
    }, {
        name: "Opacity",
        ellipsis: !0,
        target: "image/opacity.opacity"
    }, {
        divider: !0
    }, {
        name: "Color Corrections",
        ellipsis: !0,
        target: "image/color_corrections.color_corrections"
    }, {
        name: "Auto Adjust Colors",
        shortcut: "F",
        target: "image/auto_adjust.auto_adjust"
    }, {
        name: "Decrease Color Depth",
        target: "image/decrease_colors.decrease_colors"
    }, {
        name: "Color Palette",
        ellipsis: !0,
        target: "image/palette.palette"
    }, {
        divider: !0
    }, {
        name: "Histogram",
        ellipsis: !0,
        target: "image/histogram.histogram"
    }]
}, {
    name: "Layer",
    children: [{
        name: "New",
        shortcut: "N",
        target: "layer/new.new"
    }, {
        name: "New from Selection",
        target: "layer/new.new_selection"
    }, {
        divider: !0
    }, {
        name: "Duplicate",
        shortcut: "D",
        target: "layer/duplicate.duplicate"
    }, {
        name: "Show / Hide",
        target: "layer/visibility.toggle"
    }, {
        name: "Delete",
        target: "layer/delete.delete"
    }, {
        name: "Convert to Raster",
        target: "layer/raster.raster"
    }, {
        divider: !0
    }, {
        name: "Move",
        children: [{
            name: "Up",
            target: "layer/move.up"
        }, {
            name: "Down",
            target: "layer/move.down"
        }]
    }, {
        name: "Composition",
        ellipsis: !0,
        target: "layer/composition.composition"
    }, {
        name: "Rename",
        ellipsis: !0,
        target: "layer/rename.rename"
    }, {
        name: "Clear",
        target: "layer/clear.clear"
    }, {
        divider: !0
    }, {
        name: "Differences Down",
        target: "layer/differences.differences"
    }, {
        name: "Merge Down",
        target: "layer/merge.merge"
    }, {
        name: "Flatten Image",
        target: "layer/flatten.flatten"
    }]
}, {
    name: "Effects",
    children: [{
        name: "Effect browser",
        ellipsis: !0,
        target: "effects/browser.browser"
    }, {
        divider: !0
    }, {
        name: "Common Filters",
        children: [{
            name: "Gaussian Blur",
            ellipsis: !0,
            target: "effects/common/blur.blur"
        }, {
            name: "Brightness",
            ellipsis: !0,
            target: "effects/common/brightness.brightness"
        }, {
            name: "Contrast",
            ellipsis: !0,
            target: "effects/common/contrast.contrast"
        }, {
            name: "Grayscale",
            ellipsis: !0,
            target: "effects/common/grayscale.grayscale"
        }, {
            name: "Hue Rotate",
            ellipsis: !0,
            target: "effects/common/hue-rotate.hue_rotate"
        }, {
            name: "Negative",
            ellipsis: !0,
            target: "effects/common/invert.invert"
        }, {
            name: "Saturate",
            ellipsis: !0,
            target: "effects/common/saturate.saturate"
        }, {
            name: "Sepia",
            ellipsis: !0,
            target: "effects/common/sepia.sepia"
        }, {
            name: "Shadow",
            ellipsis: !0,
            target: "effects/common/shadow.shadow"
        }]
    }, {
        name: "Instagram Filters",
        children: [{
            name: "1977",
            target: "effects/instagram/1977.1977"
        }, {
            name: "Aden",
            target: "effects/instagram/aden.aden"
        }, {
            name: "Clarendon",
            target: "effects/instagram/clarendon.clarendon"
        }, {
            name: "Gingham",
            target: "effects/instagram/gingham.gingham"
        }, {
            name: "Inkwell",
            target: "effects/instagram/inkwell.inkwell"
        }, {
            name: "Lo-fi",
            target: "effects/instagram/lofi.lofi"
        }, {
            name: "Toaster",
            target: "effects/instagram/toaster.toaster"
        }, {
            name: "Valencia",
            target: "effects/instagram/valencia.valencia"
        }, {
            name: "X-Pro II",
            target: "effects/instagram/xpro2.xpro2"
        }]
    }, {
        name: "Black and White",
        ellipsis: !0,
        target: "effects/black_and_white.black_and_white"
    }, {
        name: "Borders",
        ellipsis: !0,
        target: "effects/borders.borders"
    }, {
        name: "Blueprint",
        target: "effects/blueprint.blueprint"
    }, {
        name: "Box Blur",
        ellipsis: !0,
        target: "effects/box_blur.box_blur"
    }, {
        name: "Denoise",
        ellipsis: !0,
        target: "effects/denoise.denoise"
    }, {
        name: "Dither",
        ellipsis: !0,
        target: "effects/dither.dither"
    }, {
        name: "Dot Screen",
        ellipsis: !0,
        target: "effects/dot_screen.dot_screen"
    }, {
        name: "Edge",
        target: "effects/edge.edge"
    }, {
        name: "Emboss",
        target: "effects/emboss.emboss"
    }, {
        name: "Enrich",
        ellipsis: !0,
        target: "effects/enrich.enrich"
    }, {
        name: "Grains",
        ellipsis: !0,
        target: "effects/grains.grains"
    }, {
        name: "Heatmap",
        target: "effects/heatmap.heatmap"
    }, {
        name: "Mosaic",
        ellipsis: !0,
        target: "effects/mosaic.mosaic"
    }, {
        name: "Night Vision",
        target: "effects/night_vision.night_vision"
    }, {
        name: "Oil",
        ellipsis: !0,
        target: "effects/oil.oil"
    }, {
        name: "Pencil",
        target: "effects/pencil.pencil"
    }, {
        name: "Sharpen",
        ellipsis: !0,
        target: "effects/sharpen.sharpen"
    }, {
        name: "Solarize",
        target: "effects/solarize.solarize"
    }, {
        name: "Tilt Shift",
        ellipsis: !0,
        target: "effects/tilt_shift.tilt_shift"
    }, {
        name: "Vignette",
        ellipsis: !0,
        target: "effects/vignette.vignette"
    }, {
        name: "Vibrance",
        ellipsis: !0,
        target: "effects/vibrance.vibrance"
    }, {
        name: "Vintage",
        ellipsis: !0,
        target: "effects/vintage.vintage"
    }, {
        name: "Zoom Blur",
        ellipsis: !0,
        target: "effects/zoom_blur.zoom_blur"
    }]
}, {
    name: "Tools",
    children: [{
        name: "Sprites",
        target: "tools/sprites.sprites"
    }, {
        name: "Key-Points",
        target: "tools/keypoints.keypoints"
    }, {
        name: "Content Fill",
        ellipsis: !0,
        target: "tools/content_fill.content_fill"
    }, {
        divider: !0
    }, {
        name: "Color Zoom",
        ellipsis: !0,
        target: "tools/color_zoom.color_zoom"
    }, {
        name: "Replace Color",
        ellipsis: !0,
        target: "tools/replace_color.replace_color"
    }, {
        name: "Restore Alpha",
        ellipsis: !0,
        target: "tools/restore_alpha.restore_alpha"
    }, {
        name: "External",
        children: [{
            name: "TINYPNG - Compress PNG and JPEG",
            href: "https://tinypng.com"
        }, {
            name: "REMOVE.BG - Remove Image Background",
            href: "https://www.remove.bg"
        }, {
            name: "PNGTOSVG - Convert Image to SVG",
            href: "https://www.pngtosvg.com"
        }, {
            name: "SQUOOSH - Compress and Compare Images",
            href: "https://squoosh.app"
        }]
    }, {
        divider: !0
    }, {
        name: "Language",
        children: [{
            name: "English",
            target: "tools/translate.translate",
            parameter: "en"
        }, {
            divider: !0
        }, {
            name: "عربي",
            target: "tools/translate.translate",
            parameter: "ar"
        }, {
            name: "简体中文",
            target: "tools/translate.translate",
            parameter: "zh"
        }, {
            name: "Deutsch",
            target: "tools/translate.translate",
            parameter: "de"
        }, {
            name: "Dutch",
            target: "tools/translate.translate",
            parameter: "nl"
        }, {
            name: "English (UK)",
            target: "tools/translate.translate",
            parameter: "uk"
        }, {
            name: "Español",
            target: "tools/translate.translate",
            parameter: "es"
        }, {
            name: "Français",
            target: "tools/translate.translate",
            parameter: "fr"
        }, {
            name: "Greek",
            target: "tools/translate.translate",
            parameter: "el"
        }, {
            name: "Italiano",
            target: "tools/translate.translate",
            parameter: "it"
        }, {
            name: "日本語",
            target: "tools/translate.translate",
            parameter: "ja"
        }, {
            name: "한국어",
            target: "tools/translate.translate",
            parameter: "ko"
        }, {
            name: "Lietuvių",
            target: "tools/translate.translate",
            parameter: "lt"
        }, {
            name: "Português",
            target: "tools/translate.translate",
            parameter: "pt"
        }, {
            name: "русский язык",
            target: "tools/translate.translate",
            parameter: "ru"
        }, {
            name: "Türkçe",
            target: "tools/translate.translate",
            parameter: "tr"
        }]
    }, {
        name: "Search",
        shortcut: "F3",
        ellipsis: !0,
        target: "tools/search.search"
    }, {
        name: "Settings",
        ellipsis: !0,
        target: "tools/settings.settings"
    }, {
        divider: !0
    },
    { name: "Create Scene", target: "project/create_scene" },
    { name: "Execute Script", target: "project/execute_script" }
    ]
}, {
    name: "Help",
    children: [{
        name: "Keyboard Shortcuts",
        ellipsis: !0,
        target: "help/shortcuts.shortcuts"
    }, {
        name: "Report Issues",
        href: "https://github.com/viliusle/miniPaint/issues"
    }, {
        divider: !0
    }, {
        name: "About",
        ellipsis: !0,
        target: "help/about.about"
    }]
}]


// Render the system out dynamically into your navigation shell
renderMenuSystem(SITE_MENU, document.getElementById("main_menu"));

// Activate interaction listeners
initStaticMenu("main_menu");

// Intercept routing tracks
document.getElementById("main_menu").addEventListener("menu_action", function (e) {
    console.log("Triggered Router Target Key:", e.detail.action); // Returns e.g. "file/open.open_file"
});


/**
 * Patches file input elements with structured, explicitly labeled file groupings.
 */
function patchFileGroupFilters() {
    // Define clean, structured type categories for the native dialog box
    const fileGroups = {
        // Standard Web/Texture assets
        'Images (*.png, *.jpg, *.tga, *.pcx)': [
            'image/png',
            'image/jpeg',
            'image/x-tga',
            '.tga',
            '.pcx'
        ],

        // Map geometry types
        'Quake 3 Maps (*.bsp, *.aas)': [
            'application/x-quake3-map',
            '.bsp',
            '.aas'
        ],

        // Scripts, Shaders, and Configuration plain text targets
        'Text & Scripts (*.shader, *.cfg, *.qvm)': [
            'text/plain',
            '.shader',
            '.cfg',
            '.qvm'
        ],

        // 3D Model asset packages
        '3D Models (*.md3, *.md4)': [
            'application/x-quake3-model',
            '.md3',
            '.md4'
        ],

        // Compressed pak collections
        'Game Archives (*.pk3)': [
            'application/zip',
            '.pk3'
        ]
    };

    // Flatten all defined groups into a single unified comma-separated lookup string
    const targetAcceptString = Object.values(fileGroups)
        .reduce((acc, currentGroup) => acc.concat(currentGroup), [])
        .join(',');

    // Locate standard inputs across both your parent window and iframe scope boundaries
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));

    const iframe = document.getElementById('myFrame');
    if (iframe && iframe.contentDocument) {
        inputs.push(...iframe.contentDocument.querySelectorAll('input[type="file"]'));
    }

    // Apply the multi-group string straight onto the accept fields
    inputs.forEach(input => {
        input.setAttribute('accept', targetAcceptString);
    });

    console.log("File pickers successfully updated with categorized asset grouping layouts.");
}

// Call the initialization hook sequence directly
patchFileGroupFilters();


