// js/state.js - Globaler Anwendungsstatus
export const State = {
    canvas: null,
    ctx: null,
    container: null,
    width: 0,
    height: 0,
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
    isPanning: false,
    startPanX: 0,
    startPanY: 0,
    spacePressed: false,
    
    currentTool: 'select',
    pixelsPerMeter: 20,
    bgImage: null,
    
    objects: [], // Enthält Rasen, Tropfzonen, Totzonen, Quellen
    polygonPoints: [],
    selectedObj: null,
    activeHandleIndex: -1,
    scaleStartPoint: null,
    currentMouseWorld: null,

    // Zisternen- & Pumpen-Globaldaten
    systemMeta: {
        hasCistern: true,
        cisternVolume: 5000, // Liter
        waterSource: 'cistern',
        pumpType: 'standard_3m3',
        customFlow: 3.0,
        customPressure: 3.5
    }
};

export function toWorld(sX, sY) {
    return {
        x: (sX - State.offsetX) / State.scale,
        y: (sY - State.offsetY) / State.scale
    };
}
