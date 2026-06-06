

function updatePainter() {
    if (imageEditor.classList.contains('not-hidden') && typeof window.GUI !== 'undefined') {
        //const height = getFullScreenFit(1)
        //window.GUI.set_size(window.innerWidth - 60, height);
        window.GUI.prepare_canvas()
        window.Layers.render();
        //window.GUI.render_main_gui()
    }

}

