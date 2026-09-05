// pipes.js - Hydraulik-Engine mit Snap-Nodes, Biegepunkten, Fittingen & Parallel-Trassen
import { SYSTEM_CONFIG } from './config.js';
import { State } from './state.js';

const PALETTE = ['#38bdf8', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

export function createPipe(points, diameter = 25, label = 'Hauptstrang', color = null) {
    return {
        id: `pipe_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        type: 'pipe',
        label: label,
        points: [...points],
        diameter: Number(diameter),
        assignedZone: 'Sektor 1',
        flowRateLh: 1200,
        customColor: color,
        locked: false
    };
}

// Snapping-Funktion: Prüft, ob der Cursor nah an einem bestehenden Knoten liegt
export function getSnappedPoint(cursorX, cursorY, snapRadius = 15) {
    let snapped = { x: cursorX, y: cursorY, isSnapped: false };
    const allObjects = State.objects || [];

    for (const obj of allObjects) {
        if (obj.points) {
            for (const p of obj.points) {
                const dist = Math.hypot(p.x - cursorX, p.y - cursorY);
                if (dist < snapRadius) {
                    return { x: p.x, y: p.y, isSnapped: true };
                }
            }
        }
    }
    return snapped;
}

export function drawPipe(ctx, obj, scale, isSelected) {
    if (!obj.points || obj.points.length < 2) return;

    const config = SYSTEM_CONFIG.pipes.find(p => p.outerDiameter === Number(obj.diameter)) || {
        color: '#38bdf8',
        defaultWidth: 3
    };

    const drawColor = obj.customColor || (isSelected ? '#f59e0b' : config.color);

    ctx.save();
    
    // 1. Hauptlinie zeichnen
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

    // 2. Teilstrecken-Längen (Dauerhafte Anzeige)
    const pxm = State.pixelsPerMeter || 20;

    for (let i = 1; i < obj.points.length; i++) {
        const p1 = obj.points[i - 1];
        const p2 = obj.points[i];

        const segDistPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const segMeters = (segDistPx / pxm).toFixed(2);

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // Label-Hintergrund
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(midX - (22 / scale), midY - (10 / scale), 44 / scale, 16 / scale);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${10 / scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${segMeters}m`, midX, midY);

        // Biegbare Zwischenpunkte (Mittelpunkte zum Ziehen im Auswahlmodus)
        if (isSelected) {
            ctx.beginPath();
            ctx.arc(midX, midY, 4 / scale, 0, Math.PI * 2);
            ctx.fillStyle = '#94a3b8';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1 / scale;
            ctx.fill();
            ctx.stroke();
        }
    }

    // 3. Verbindungsknoten / Kugelköpfe (Snap-Nodes) an jedem Hauptpunkt
    obj.points.forEach((p, index) => {
        const isEnd = index === 0 || index === obj.points.length - 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (isEnd ? 6 : 4) / scale, 0, Math.PI * 2);
        
        ctx.fillStyle = isSelected ? '#f59e0b' : (isEnd ? '#38bdf8' : '#64748b');
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 / scale;
        ctx.fill();
        ctx.stroke();
    });

    ctx.restore();
}

// Hydraulik-Berechnung inklusive Fittingen (T-Stücke & Winkel)
export function calculateHydraulics(pipe) {
    const lengthMeters = calculatePipeLength(pipe.points);
    const pipeConfig = SYSTEM_CONFIG.pipes.find(p => p.outerDiameter === Number(pipe.diameter));
    
    const dInMeters = pipeConfig ? pipeConfig.innerDiameter : (pipe.diameter * 0.8) / 1000;
    const qM3s = (pipe.flowRateLh || 1200) / 3600000;
    const areaM2 = Math.PI * Math.pow(dInMeters / 2, 2);
    const velocityMs = areaM2 > 0 ? qM3s / areaM2 : 0;

    const fittings = analyzeFittings(pipe);
    
    const lambda = 0.025;
    const rho = 1000;
    const lossPipePascal = lambda * (lengthMeters / dInMeters) * (rho * Math.pow(velocityMs, 2) / 2);
    const lossFittingsPascal = fittings.totalZeta * (rho * Math.pow(velocityMs, 2) / 2);

    const totalLossBar = (lossPipePascal + lossFittingsPascal) / 100000;

    return {
        length: lengthMeters,
        velocity: velocityMs.toFixed(2),
        pressureLoss: totalLossBar.toFixed(2),
        pipeLossBar: (lossPipePascal / 100000).toFixed(2),
        fittingLossBar: (lossFittingsPascal / 100000).toFixed(2),
        anglesCount: fittings.anglesCount,
        teesCount: fittings.teesCount,
        isVelocityWarning: velocityMs > 2.0,
        isLossWarning: totalLossBar > 0.5
    };
}

function analyzeFittings(pipe) {
    let totalZeta = 0;
    let anglesCount = 0;
    let teesCount = 0;

    // 1. Winkel im Verlauf
    for (let i = 1; i < pipe.points.length - 1; i++) {
        const pPrev = pipe.points[i - 1];
        const pCurr = pipe.points[i];
        const pNext = pipe.points[i + 1];

        const v1 = { x: pCurr.x - pPrev.x, y: pCurr.y - pPrev.y };
        const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };

        const angleRad = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
        let angleDeg = Math.abs((angleRad * 180) / Math.PI);
        if (angleDeg > 180) angleDeg = 360 - angleDeg;

        if (angleDeg > 15) {
            anglesCount++;
            if (angleDeg > 75) totalZeta += 1.2;
            else if (angleDeg > 35) totalZeta += 0.6;
            else totalZeta += 0.3;
        }
    }

    // 2. T-Stücke / Schnittpunkte mit anderen Rohren
    const allObjects = State.objects || [];
    pipe.points.forEach(p => {
        allObjects.forEach(other => {
            if (other.type === 'pipe' && other.id !== pipe.id) {
                other.points.forEach(op => {
                    const dist = Math.hypot(p.x - op.x, p.y - op.y);
                    if (dist < 5) {
                        teesCount++;
                        totalZeta += 1.5;
                    }
                });
            }
        });
    });

    return { totalZeta, anglesCount, teesCount };
}

export function getPipeSidebarHTML(obj) {
    const hyd = calculateHydraulics(obj);
    const currentDiameter = Number(obj.diameter) || 25;
    const orderLength = Math.ceil(hyd.length * 1.10); // +10% Verschnitt

    return `
        <div style="padding: 15px; color: #fff; font-family: sans-serif;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="color: ${obj.customColor || '#38bdf8'}; margin:0; font-size:16px;">🛠️ ${obj.label || 'Rohrleitung'}</h3>
                <button onclick="deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:18px;">✕</button>
            </div>

            <label style="display:block; font-size:11px; color:#94a3b8; margin-bottom:2px;">Bezeichnung:</label>
            <input type="text" value="${obj.label || ''}" onchange="updatePipeProp('label', this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">

            <label style="display:block; font-size:11px; color:#94a3b8; margin-bottom:2px;">Rohr-Durchmesser:</label>
            <select id="pipe-diameter" onchange="updatePipeProp('diameter', this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                <option value="4.6" ${currentDiameter === 4.6 ? 'selected' : ''}>MicroDrip (4.6 mm)</option>
                <option value="16" ${currentDiameter === 16 ? 'selected' : ''}>Tropfrohr (16 mm)</option>
                <option value="20" ${currentDiameter === 20 ? 'selected' : ''}>Versorgungsleitung (20 mm)</option>
                <option value="25" ${currentDiameter === 25 ? 'selected' : ''}>PE-Rohr (25 mm)</option>
                <option value="32" ${currentDiameter === 32 ? 'selected' : ''}>PE-Rohr (32 mm)</option>
            </select>

            <label style="display:block; font-size:11px; color:#94a3b8; margin-bottom:2px;">Ventil-Sektor Zuweisung:</label>
            <input type="text" value="${obj.assignedZone || 'Sektor 1'}" onchange="updatePipeProp('assignedZone', this.value)" style="width:100%; padding:6px; margin-bottom:12px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">

            <!-- Material & Bestellmengen-Box -->
            <div style="background:#0f172a; padding:12px; border-radius:6px; border:1px solid #334155; margin-bottom:15px;">
                <h4 style="margin:0 0 8px 0; color:#38bdf8; font-size:13px; border-bottom:1px solid #334155; padding-bottom:4px;">📦 Material & Bestellung</h4>
                
                <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#94a3b8;">Gesamtlänge (Netto):</span> <strong style="color:#fff;">${hyd.length} m</strong>
                </div>
                <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:#f59e0b;">Empfohlene Bestellmenge (+10%):</span> <strong style="color:#f59e0b;">${orderLength} m</strong>
                </div>

                <h4 style="margin:10px 0 6px 0; color:#e2e8f0; font-size:12px; border-bottom:1px solid #334155; padding-bottom:4px;">📊 Hydraulische Daten</h4>
                
                <div style="font-size:11px; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#94a3b8;">Erkannte Winkel / Bögen:</span> <strong>${hyd.anglesCount} Stk.</strong>
                </div>
                <div style="font-size:11px; display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:#94a3b8;">T-Stücke / Knoten:</span> <strong>${hyd.teesCount} Stk.</strong>
                </div>
                <div style="font-size:11px; display:flex; justify-content:space-between; margin-bottom:4px; color:${hyd.isVelocityWarning ? '#ef4444' : '#10b981'};">
                    <span>Fließgeschwindigkeit:</span> <strong>${hyd.velocity} m/s</strong>
                </div>
                <div style="font-size:11px; display:flex; justify-content:space-between; color:${hyd.isLossWarning ? '#ef4444' : '#10b981'};">
                    <span>Druckverlust ($\Delta p$):</span> <strong>~${hyd.pressureLoss} bar</strong>
                </div>
            </div>

            <!-- Parallel Trassen Generator -->
            <div style="border-top:1px solid #334155; padding-top:10px;">
                <label style="display:block; font-size:11px; color:#94a3b8;">Paralleltrasse erzeugen:</label>
                <div style="display:flex; gap:6px; margin-top:6px;">
                    <input type="number" id="parallel-count" value="3" min="2" max="10" style="width:50px; padding:6px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <button onclick="generateParallelFromSelected()" style="flex:1; background:#0284c7; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;">Trasse erstellen</button>
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

        const nx = -dy / len;
        const ny = dx / len;

        newPoints.push({
            x: Math.round(p.x + nx * offset),
            y: Math.round(p.y + ny * offset)
        });
    }

    return newPoints;
}

export function createParallelPipes(basePoints, count = 2, spacingPx = 10, diameter = 25) {
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

export function generateParallelFromSelected() {
    if (State.selectedObj && State.selectedObj.type === 'pipe') {
        const input = document.getElementById('parallel-count');
        const count = input ? parseInt(input.value) : 3;
        
        const parallelPipes = createParallelPipes(
            State.selectedObj.points, 
            count, 
            12, 
            State.selectedObj.diameter
        );

        const index = State.objects.indexOf(State.selectedObj);
        if (index > -1) {
            State.objects.splice(index, 1, ...parallelPipes);
            State.selectedObj = parallelPipes[0];
        }

        if (typeof draw === 'function') draw();
        if (typeof updateSidebar === 'function') updateSidebar(State.selectedObj);
    }
}

if (typeof window !== 'undefined') {
    window.updatePipeProp = updatePipeProp;
    window.generateParallelFromSelected = generateParallelFromSelected;
}
