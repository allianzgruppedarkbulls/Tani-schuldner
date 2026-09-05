// state.js - Verwaltung des globalen Anwendungsstatus
export const PHASES = {
    PROJECT_INIT: 1, // Start/Import
    AREAS: 2,        // Rasen & Tropfzonen
    COMPONENTS: 3   // Regner, Rohre, Zisterne, Ventile
};

export const State = {
    currentPhase: PHASES.AREAS, // Aktuelle Arbeitsphase
    objects: [],          // Alle gezeichneten Elemente (Rasen, Regner, Rohre, Tropfzonen)
    selectedObj: null,    // Aktuell ausgewähltes Objekt
    currentTool: 'select',// Aktives Werkzeug
    pixelsPerMeter: 20,   // Maßstab: Pixel pro Meter
    gridSize: 1,          // Rastergröße in Metern
    showGrid: true,       // Raster anzeigen ja/nein
    backgroundImg: null,  // Hintergrundbild (z.B. Plan/Skizze)
    
    // Temporäre Zeichen-Zustände
    polygonPoints: [],
    scaleStartPoint: null,
    activeHandleIndex: -1,

    systemMeta: {
        hasCistern: false,
        cisternVolume: 5000,
        pumpType: 'standard_3m3'
    }
};

export function setPhase(newPhase) {
    State.currentPhase = newPhase;
    // Benachrichtigung an die Anwendung senden, ohne Daten im State zu löschen
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('phaseChanged', { detail: { phase: newPhase } }));
    }
    if (typeof draw === 'function') draw();
}

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
    State.polygonPoints = [];
    if (typeof closeSidebar === 'function') closeSidebar();
    if (typeof draw === 'function') draw();
}

// Global Binding für Zugriffe aus HTML / inline Handlern
if (typeof window !== 'undefined') {
    window.State = State;
    window.setPhase = setPhase;
}
