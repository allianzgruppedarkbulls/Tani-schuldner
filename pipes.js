// pipes.js - Verwaltung und Rendering von Rohrleitungen
import { SYSTEM_CONFIG } from './config.js';

export function createPipe(points, diameter = 25) {
    return {
        type: 'pipe',
        points: [...points],
        diameter: Number(diameter), // mm (4.6, 16, 20, 25, 32)
        locked: false
    };
}

export function drawPipe(ctx, obj, scale, isSelected) {
    if (!obj.points || obj.points.length < 2) return;

    // Farb- und Breitenkonfiguration basierend auf dem Durchmesser holen
    const config = SYSTEM_CONFIG.pipes.find(p => p.outerDiameter === Number(obj.diameter)) || {
        color: '#38bdf8',
        defaultWidth: 3
    };

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(obj.points[0].x, obj.points[0].y);
    for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(obj.points[i].x, obj.points[i].y);
    }

    ctx.strokeStyle = isSelected ? '#f59e0b' : config.color;
    ctx.lineWidth = ((isSelected ? config.defaultWidth + 2 : config.defaultWidth)) / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Eckpunkte anzeigen bei Auswahl
    if (isSelected) {
        obj.points.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5 / scale, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2 / scale;
            ctx.fill();
            ctx.stroke();
        });
    }
    ctx.restore();
}

export function getPipeSidebarHTML(obj) {
    const lengthMeters = calculatePipeLength(obj.points);
    const currentDiameter = Number(obj.diameter) || 25;

    return `
        <div style="padding: 15px; color: #fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="color: #38bdf8; margin:0;">🛠️ Rohrleitung</h3>
                <button onclick="deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
            </div>
            <p style="font-size:12px; color:#94a3b8; margin-bottom:10px;">Gesamtlänge: approx. ${lengthMeters} m</p>
            
            <label style="display:block; margin-top:8px; font-size:12px; color:#94a3b8;">Rohr-Typ / Durchmesser:</label>
            <select id="pipe-diameter" onchange="updatePipeProp('diameter', this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                <option value="4.6" ${currentDiameter === 4.6 ? 'selected' : ''}>MicroDrip Kapillar (4.6 mm)</option>
                <option value="16" ${currentDiameter === 16 ? 'selected' : ''}>MicroDrip / Tropfrohr (16 mm)</option>
                <option value="20" ${currentDiameter === 20 ? 'selected' : ''}>Versorgungsleitung (20 mm)</option>
                <option value="25" ${currentDiameter === 25 ? 'selected' : ''}>PE-Rohr (25 mm)</option>
                <option value="32" ${currentDiameter === 32 ? 'selected' : ''}>PE-Rohr (32 mm)</option>
            </select>
        </div>`;
}

export function calculatePipeLength(points) {
    if (!points || points.length < 2) return 0;
    let totalPx = 0;
    for (let i = 1; i < points.length; i++) {
        totalPx += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
    }
    
    // Zugriff auf globalen MWR/PixelsPerMeter Fallback aus State oder Window
    const pxm = (typeof State !== 'undefined' && State.pixelsPerMeter) 
        ? State.pixelsPerMeter 
        : (typeof pixelsPerMeter !== 'undefined' ? pixelsPerMeter : 20);

    return Math.round((totalPx / pxm) * 100) / 100;
}

export function updatePipeProp(prop, val) {
    const targetObj = (typeof State !== 'undefined' && State.selectedObj) 
        ? State.selectedObj 
        : (typeof selectedObj !== 'undefined' ? selectedObj : null);

    if (targetObj && targetObj.type === 'pipe') {
        targetObj[prop] = prop === 'diameter' ? Number(val) : val;
        if (typeof draw === 'function') {
            draw();
        }
    }
}

// Window-Binding damit Inline-HTML Event-Listener (onchange/onclick) problemlos funktionieren
if (typeof window !== 'undefined') {
    window.updatePipeProp = updatePipeProp;
}
