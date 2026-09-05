// pipes.js - Erweiterte Hydraulik-Engine & Parallel-Trassen-System
import { SYSTEM_CONFIG } from './config.js';
import { State } from './state.js';

// Palette für automatische Farbvergabe bei Parallelrohren
const PALETTE = ['#38bdf8', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

export function createPipe(points, diameter = 25, label = 'Hauptstrang', color = null) {
    return {
        id: `pipe_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        type: 'pipe',
        label: label,
        points: [...points],
        diameter: Number(diameter), // in mm
        assignedZone: 'Sektor 1',   // Zuweisung zu Ventil/Regner-Gruppe
        flowRateLh: 1200,          // Durchflussmenge in l/h (Standardwert für Berechnungen)
        customColor: color,
        locked: false
    };
}

// Erstellt N parallele Leitungen neben der gezeichneten Trasse
export function createParallelPipes(basePoints, count = 2, spacingPx = 8, diameter = 25) {
    const generatedPipes = [];
    const halfCount = (count - 1) / 2;

    for (let i = 0; i < count; i++) {
        const offset = (i - halfCount) * spacingPx;
        const offsetPoints = offsetPolyline(basePoints, offset);
        const pipeColor = PALETTE[i % PALETTE.length];
        
        const pipe = createPipe(offsetPoints, diameter, `Strang #${i + 1}`, pipeColor);
        generatedPipes.push(pipe);
    }

    return generatedPipes;
}

export function drawPipe(ctx, obj, scale, isSelected) {
    if (!obj.points || obj.points.length < 2) return;

    const config = SYSTEM_CONFIG.pipes.find(p => p.outerDiameter === Number(obj.diameter)) || {
        color: '#38bdf8',
        defaultWidth: 3
    };

    const drawColor = obj.customColor || (isSelected ? '#f59e0b' : config.color);

    ctx.save();
    
    // Hauptleitung zeichnen
    ctx.beginPath();
    ctx.moveTo(obj.points[0].x, obj.points[0].y);
    for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(obj.points[i].x, obj.points[i].y);
    }

    ctx.strokeStyle = drawColor;
    ctx.lineWidth = (isSelected ? config.defaultWidth + 2 : config.defaultWidth) / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Segment-Bemaßung IMMER anzeigen
    const pxm = State.pixelsPerMeter || 20;

    for (let i = 1; i < obj.points.length; i++) {
        const p1 = obj.points[i - 1];
        const p2 = obj.points[i];

        // Teilstrecken-Länge
        const segDistPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const segMeters = (segDistPx / pxm).toFixed(2);

        // Segment-Label in der Mitte
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(midX - (22 / scale), midY - (10 / scale), 44 / scale, 16 / scale);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${10 / scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${segMeters}m`, midX, midY);
    }

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

        // Eckpunkte anzeigen
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

// Berechnung von Hydraulik-Kennzahlen (Geschwindigkeit & Druckverlust)
export function calculateHydraulics(pipe) {
    const lengthMeters = calculatePipeLength(pipe.points);
    const pipeConfig = SYSTEM_CONFIG.pipes.find(p => p.outerDiameter === Number(pipe.diameter));
    
    // Innendurchmesser in Meter (Standard-Fallback: 80% des Außendurchmessers)
    const dInMeters = pipeConfig ? pipeConfig.innerDiameter : (pipe.diameter * 0.8) / 1000;
    
    // Durchfluss Q in m³/s
    const qM3s = (pipe.flowRateLh || 1000) / 3600000;
    
    // Querschnittsfläche A in m²
    const areaM2 = Math.PI * Math.pow(dInMeters / 2, 2);
    
    // Fließgeschwindigkeit v in m/s
    const velocityMs = areaM2 > 0 ? qM3s / areaM2 : 0;

    // Druckverlust-Abschätzung in bar (Darcy-Weisbach Vereinfachung)
    const lambda = 0.025; // Reibungsbeiwert PE-Rohr
    const rho = 1000;      // Dichte Wasser kg/m³
    const lossPascal = lambda * (lengthMeters / dInMeters) * (rho * Math.pow(velocityMs, 2) / 2);
    const lossBar = lossPascal / 100000;

    return {
        length: lengthMeters,
        velocity: velocityMs.toFixed(2),
        pressureLoss: lossBar.toFixed(2),
        isVelocityWarning: velocityMs > 2.0,
        isLossWarning: lossBar > 0.5
    };
}

export function getPipeSidebarHTML(obj) {
    const hyd = calculateHydraulics(obj);
    const currentDiameter = Number(obj.diameter) || 25;

    return `
        <div style="padding: 15px; color: #fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="color: ${obj.customColor || '#38bdf8'}; margin:0;">🛠️ ${obj.label || 'Rohrleitung'}</h3>
                <button onclick="deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
            </div>

            <label style="display:block; font-size:12px; color:#94a3b8;">Bezeichnung:</label>
            <input type="text" value="${obj.label || ''}" onchange="updatePipeProp('label', this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">

            <label style="display:block; font-size:12px; color:#94a3b8;">Rohr-Typ / Durchmesser:</label>
            <select id="pipe-diameter" onchange="updatePipeProp('diameter', this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                <option value="4.6" ${currentDiameter === 4.6 ? 'selected' : ''}>MicroDrip Kapillar (4.6 mm)</option>
                <option value="16" ${currentDiameter === 16 ? 'selected' : ''}>MicroDrip / Tropfrohr (16 mm)</option>
                <option value="20" ${currentDiameter === 20 ? 'selected' : ''}>Versorgungsleitung (20 mm)</option>
                <option value="25" ${currentDiameter === 25 ? 'selected' : ''}>PE-Rohr (25 mm)</option>
                <option value="32" ${currentDiameter === 32 ? 'selected' : ''}>PE-Rohr (32 mm)</option>
            </select>

            <label style="display:block; font-size:12px; color:#94a3b8;">Zuweisung Ventil / Sektor:</label>
            <input type="text" value="${obj.assignedZone || 'Sektor 1'}" onchange="updatePipeProp('assignedZone', this.value)" style="width:100%; padding:6px; margin-bottom:15px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">

            <!-- Technical Data / Hydraulik Engine Box -->
            <div style="background:#0f172a; padding:12px; border-radius:6px; border:1px solid #334155;">
                <h4 style="margin:0 0 8px 0; color:#e2e8f0; font-size:13px;">📊 Hydraulische Daten</h4>
                <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>Gesamtlänge:</span> <strong>${hyd.length} m</strong>
                </div>
                <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:4px; color:${hyd.isVelocityWarning ? '#ef4444' : '#10b981'};">
                    <span>Fließgeschwindigkeit:</span> <strong>${hyd.velocity} m/s</strong>
                </div>
                <div style="font-size:12px; display:flex; justify-content:space-between; color:${hyd.isLossWarning ? '#ef4444' : '#10b981'};">
                    <span>Druckverlust ($\Delta p$):</span> <strong>~${hyd.pressureLoss} bar</strong>
                </div>
                ${hyd.isVelocityWarning ? '<p style="color:#ef4444; font-size:10px; margin:6px 0 0 0;">⚠️ Geschw. > 2.0 m/s: Druckstoßgefahr!</p>' : ''}
            </div>

            <!-- Parallel Trassen Generator UI -->
            <div style="margin-top:15px; border-top:1px solid #334155; padding-top:10px;">
                <label style="display:block; font-size:12px; color:#94a3b8;">Paralleltrasse erzeugen:</label>
                <div style="display:flex; gap:6px; margin-top:6px;">
                    <input type="number" id="parallel-count" value="3" min="2" max="10" style="width:60px; padding:6px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <button onclick="generateParallelFromSelected()" style="flex-1; background:#0284c7; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Trasse erstellen</button>
                </div>
            </div>
        </div>`;
}

export function calculatePipeLength(points) {
    if (!points || points.length < 2) return 0;
    let totalPx = 0;
    for (let i = 1; i < points.length; i++) {
        totalPx += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    const pxm = State.pixelsPerMeter || 20;
    return Math.round((totalPx / pxm) * 100) / 100;
}

export function updatePipeProp(prop, val) {
    const targetObj = State.selectedObj;
    if (targetObj && targetObj.type === 'pipe') {
        targetObj[prop] = prop === 'diameter' ? Number(val) : val;
        if (typeof draw === 'function') draw();
    }
}

// Vektor-Versatz-Algorithmus für parallele Polylinien
function offsetPolyline(points, offset) {
    if (points.length < 2) return points;
    const newPoints = [];

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        let dx = 0, dy = 0;

        if (i < points.length - 1) {
            dx += points[i + 1].x - p.x;
            dy += points[i + 1].y - p.y;
        }
        if (i > 0) {
            dx += p.x - points[i - 1].x;
            dy += p.y - points[i - 1].y;
        }

        const len = Math.hypot(dx, dy);
        if (len === 0) {
            newPoints.push({ x: p.x, y: p.y });
            continue;
        }

        // Normale-Vektor berechnen (90 Grad Drehung)
        const nx = -dy / len;
        const ny = dx / len;

        newPoints.push({
            x: Math.round(p.x + nx * offset),
            y: Math.round(p.y + ny * offset)
        });
    }

    return newPoints;
}

// Action Handler für die Sidebar
export function generateParallelFromSelected() {
    if (State.selectedObj && State.selectedObj.type === 'pipe') {
        const input = document.getElementById('parallel-count');
        const count = input ? parseInt(input.value) : 3;
        
        const parallelPipes = createParallelPipes(
            State.selectedObj.points, 
            count, 
            10, 
            State.selectedObj.diameter
        );

        // Altes Einzelrohr durch Parallel-Rohre ersetzen
        const index = State.objects.indexOf(State.selectedObj);
        if (index > -1) {
            State.objects.splice(index, 1, ...parallelPipes);
            State.selectedObj = parallelPipes[0];
        }

        if (typeof draw === 'function') draw();
        if (typeof updateSidebar === 'function') updateSidebar(State.selectedObj);
    }
}

// Global Bindings
if (typeof window !== 'undefined') {
    window.updatePipeProp = updatePipeProp;
    window.generateParallelFromSelected = generateParallelFromSelected;
}
