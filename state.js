// state.js - Verwaltung des globalen Anwendungsstatus
export const State = {
    objects: [],          // Alle gezeichneten Elemente (Rasen, Regner, Rohre, Tropfzonen)
    selectedObj: null,    // Aktuell ausgewähltes Objekt
    currentTool: 'select',// Aktives Werkzeug (z.B. 'select', 'lawn', 'sprinkler', 'pipe', 'drip')
    pixelsPerMeter: 20,   // Maßstab: Pixel pro Meter
    gridSize: 1,          // Rastergröße in Metern
    showGrid: true,       // Raster anzeigen ja/nein
    backgroundImg: null,  // Hintergrundbild (z.B. Plan/Skizze)
    systemMeta: {
        hasCistern: false,
        cisternVolume: 5000,
        pumpType: 'standard_3m3'
    }
};

export function addObject(obj) {
    State.objects.push(obj);
}

export function removeObject(obj) {
    const index = State.objects.indexOf(obj);
    if (index > -1) {
        State.objects.splice(index, 1);
        if (State.selectedObj === obj) {
            State.selectedObj = null;
            if (typeof closeSidebar === 'function') closeSidebar();
        }
    }
}

export function clearState() {
    State.objects = [];
    State.selectedObj = null;
    if (typeof closeSidebar === 'function') closeSidebar();
    if (typeof draw === 'function') draw();
}
