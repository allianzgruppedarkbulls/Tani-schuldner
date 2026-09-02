// state.js - Verwaltung des globalen Anwendungsstatus

const state = {
    objects: [],          // Alle gezeichneten Elemente (Rasen, Regner, Rohre, Tropfzonen)
    selectedObj: null,    // Aktuell ausgewähltes Objekt
    currentTool: 'select',// Aktives Werkzeug (z.B. 'select', 'lawn', 'sprinkler', 'pipe', 'drip')
    pixelsPerMeter: 20,   // Maßstab: Pixel pro Meter
    gridSize: 1,          // Rastergröße in Metern
    showGrid: true,       // Raster anzeigen ja/nein
    backgroundImg: null   // Hintergrundbild (z.B. Plan/Skizze)
};

function addObject(obj) {
    state.objects.push(obj);
}

function removeObject(obj) {
    const index = state.objects.indexOf(obj);
    if (index > -1) {
        state.objects.splice(index, 1);
        if (state.selectedObj === obj) {
            state.selectedObj = null;
            if (typeof closeSidebar === 'function') closeSidebar();
        }
    }
}

function clearState() {
    state.objects = [];
    state.selectedObj = null;
    if (typeof closeSidebar === 'function') closeSidebar();
    if (typeof draw === 'function') draw();
}
