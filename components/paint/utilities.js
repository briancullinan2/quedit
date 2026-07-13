

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




// Render the system out dynamically into your navigation shell
renderMenuSystem(SITE_MENU, document.getElementById("main_menu"));

// Activate interaction listeners
initStaticMenu("main_menu");

// Intercept routing tracks
document.getElementById("main_menu").addEventListener("menu_action", function (e) {
    console.log("Triggered Router Target Key:", e.detail.action); // Returns e.g. "file/open.open_file"
});

