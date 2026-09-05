// js/tools.js - Werkzeugverwaltung, Snapping, Erstellung & Live-Messung
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
        
        if (typeof draw === 'function') draw();
    }
}

// Live-Berechnung von Strecke & Winkel beim Freihand-Zeichnen
export function calculateLineMetrics(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distancePx = Math.hypot(dx, dy);
    
    const pxm = State.pixelsPerMeter || 20;
    const distanceMeters = (distancePx / pxm).toFixed(2);
    
    let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;
    
    return {
        length: parseFloat(distanceMeters),
        angle: Math.round(angleDeg),
        midPoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
    };
}

// Live-Vorschau-Overlay beim Ziehen einer Linie
export function drawLiveLinePreview(ctx, p1, p2, scale = 1) {
    if (!p1 || !p2) return;
    const metrics = calculateLineMetrics(p1, p2);
    
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([6 / scale, 6 / scale]);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2 / scale;
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Text-Badge mit Längen- und Winkelangabe
    const text = `${metrics.length} m | ${metrics.angle}°`;
    ctx.font = `${12 / scale}px sans-serif`;
    
    const textWidth = ctx.measureText(text).width + (10 / scale);
    const boxHeight = 20 / scale;
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(
        metrics.midPoint.x - (textWidth / 2), 
        metrics.midPoint.y - (boxHeight / 2), 
        textWidth, 
        boxHeight
    );
    
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, metrics.midPoint.x, metrics.midPoint.y);
    ctx.restore();
}

// Global Bindings
if (typeof window !== 'undefined') {
    window.setTool = setTool;
    window.finishPolygon = finishPolygon;
}
