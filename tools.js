// js/tools.js - Werkzeugverwaltung, Snapping & Erstellung
import { State } from './state.js';
import { calculatePolygonArea, getSnappedPoint } from './geometry.js';
import { updateSidebar } from './sidebar.js';

export function setTool(tool) {
    State.currentTool = tool;
    State.polygonPoints = [];
    State.scaleStartPoint = null;
    State.activeHandleIndex = -1;
    document.querySelectorAll('#toolbar button').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-${tool}`);
    if (btn) btn.classList.add('active');
}

export function finishPolygon() {
    if (State.polygonPoints.length > 2) {
        let type = 'lawn';
        if (State.currentTool === 'draw-drip') type = 'drip';
        if (State.currentTool === 'draw-deadzone') type = 'deadzone';

        const newObj = {
            type,
            points: [...State.polygonPoints],
            soilType: 'normal',
            dripDistance: 33,
            waterRate: type === 'lawn' ? 25 : type === 'drip' ? 20 : 0,
            layoutMode: 'loop',
            rotationAngle: 0,
            locked: true // Automatisch gesperrt beim Erstellen
        };
        newObj.areaM2 = calculatePolygonArea(newObj.points, State.pixelsPerMeter);
        State.objects.push(newObj);
        State.selectedObj = newObj;
        State.polygonPoints = [];
        updateSidebar(State.selectedObj);
        setTool('select');
    }
}
