// main.js - CAD Hauptsteuerung (Inkl. Maßstabs-Fix, Tools & Zonen-Berechnung)

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

let width = container.clientWidth;
let height = container.clientHeight;
canvas.width = width; canvas.height = height;

let scale = 1.0, offsetX = 0, offsetY = 0;
let isPanning = false, startPanX = 0, startPanY = 0, spacePressed = false;

let currentTool = 'select';
let pixelsPerMeter = 20;
let bgImage = null;
let objects = [];
let polygonPoints = [];
let selectedObj = null;
let activeHandleIndex = -1;

let scaleStartPoint = null;
let currentMouseWorld = null;

// Für Rohrleitungen / Linien-Tools
let pipePoints = [];

function toWorld(sX, sY) { return { x: (sX - offsetX) / scale, y: (sY - offsetY) / scale }; }

window.addEventListener('keydown', (e) => { 
    if (e.code === 'Space') spacePressed = true; 
    if (e.key === 'Escape') {
        selectedObj = null;
        activeHandleIndex = -1;
        polygonPoints = [];
        pipePoints = [];
        updateSidebar(null);
        draw();
    }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') spacePressed = false; });

container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const mX = e.clientX - container.getBoundingClientRect().left;
    const mY = e.clientY - container.getBoundingClientRect().top;
    offsetX = mX - (mX - offsetX) * factor;
    offsetY = mY - (mY - offsetY) * factor;
    scale *= factor;
    const zoomEl = document.getElementById('val-zoom');
    if(zoomEl) zoomEl.innerText = `${Math.round(scale * 100)}%`;
    draw();
});

document.getElementById('img-upload')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        bgImage = new Image();
        bgImage.onload = () => {
            const scaleX = (width * 0.8) / bgImage.width;
            const scaleY = (height * 0.8) / bgImage.height;
            scale = Math.min(scaleX, scaleY);
            offsetX = (width - bgImage.width * scale) / 2;
            offsetY = (height - bgImage.height * scale) / 2;
            const zoomEl = document.getElementById('val-zoom');
            if(zoomEl) zoomEl.innerText = `${Math.round(scale * 100)}%`;
            setTool('scale');
            draw();
        };
        bgImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

function setTool(tool) {
    currentTool = tool;
    polygonPoints = [];
    pipePoints = [];
    scaleStartPoint = null;
    activeHandleIndex = -1;
    document.querySelectorAll('#toolbar button').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-${tool}`);
    if (btn) btn.classList.add('active');
    draw();
}

const bindBtn = (id, toolName) => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = () => setTool(toolName);
};

bindBtn('btn-select', 'select');
bindBtn('btn-scale', 'scale');
bindBtn('btn-measure', 'measure');
bindBtn('btn-draw-lawn', 'draw-lawn');
bindBtn('btn-draw-drip', 'draw-drip');
bindBtn('btn-draw-deadzone', 'draw-deadzone');
bindBtn('btn-add-source', 'add-source');
bindBtn('btn-add-sprinkler', 'add-sprinkler');
bindBtn('btn-draw-pipe', 'draw-pipe');

const deleteBtn = document.getElementById('btn-delete');
if (deleteBtn) {
    deleteBtn.onclick = () => {
        if (selectedObj) {
            objects = objects.filter(o => o !== selectedObj);
            selectedObj = null;
            activeHandleIndex = -1;
            updateSidebar(null);
            draw();
        }
    };
}

// Maßstab aktualisieren und alle Zonen-Flächen direkt neu berechnen
function updatePixelsPerMeter(newPxM) {
    pixelsPerMeter = newPxM;
    const pxmEl = document.getElementById('val-px-m');
    if(pxmEl) pxmEl.innerText = `${pixelsPerMeter.toFixed(1)} px/m`;
    
    // Alle bestehenden Flächen sofort mit dem neuen Maßstab aktualisieren!
    objects.forEach(obj => {
        if ((obj.type === 'lawn' || obj.type === 'drip' || obj.type === 'deadzone') && obj.points) {
            obj.areaM2 = calculatePolygonArea(obj.points, pixelsPerMeter);
        }
    });
    updateSidebar(selectedObj);
    draw();
}

// ==========================================
// SIDEBAR & STEUERUNG
// ==========================================
function updateSidebar(obj) {
    let sidebar = document.getElementById('sidebar-content') || document.getElementById('sidebar') || document.querySelector('.sidebar');
    if (!sidebar) return;
    let targetContainer = sidebar.id === 'sidebar-content' ? sidebar : (sidebar.querySelector('#sidebar-content') || sidebar);

    let allAreasList = '';
    let totalWater = 0;
    objects.forEach((o, index) => {
        if (o.type === 'lawn' || o.type === 'drip') {
            const area = o.areaM2 || 0;
            const rate = o.waterRate || 25;
            const subWater = Math.round(area * rate);
            totalWater += subWater;
            const icon = o.type === 'lawn' ? '🟩' : '💧';
            const name = o.type === 'lawn' ? 'Rasenfläche' : 'Tropfzone';
            allAreasList += `
                <div onclick="selectObjectByIndex(${index})" style="padding:6px 8px; margin-bottom:4px; background:#1e293b; border-radius:4px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-size:12px; border:1px solid ${o === selectedObj ? '#38bdf8' : 'transparent'};">
                    <span>${icon} <strong>${name} #${index+1}</strong></span>
                    <span style="color:#94a3b8;">${area} m² (${subWater} l/W)</span>
                </div>`;
        }
    });

    if (!obj) {
        targetContainer.innerHTML = `
            <div style="padding: 15px; color: #cbd5e1;">
                <h3 style="color: #fff; margin-bottom: 10px;">Übersicht & Status</h3>
                <p style="font-size:12px; color:#94a3b8;">Klicke auf eine Fläche, um Details anzupassen. (ESC zum Abwählen)</p>
                <hr style="border:0; border-top:1px solid #334155; margin: 12px 0;">
                <div style="max-height:180px; overflow-y:auto; margin-bottom:15px;">
                    <p style="font-size:12px; font-weight:bold; color:#cbd5e1; margin-bottom:5px;">Erfasste Flächen (${objects.filter(o=>o.type==='lawn'||o.type==='drip').length}):</p>
                    ${allAreasList || '<p style="font-size:12px; color:#64748b;">Noch keine Flächen gezeichnet.</p>'}
                </div>
                <hr style="border:0; border-top:1px solid #334155; margin: 12px 0;">
                <div>
                    <h4 style="color:#38bdf8; margin-bottom:5px;">Zisternen-Gesamtcheck</h4>
                    <p>Gesamtbedarf: <strong>${Math.round(totalWater)} l / Woche</strong></p>
                </div>
                <div style="margin-top:20px; padding:8px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:4px; font-size:11px; color:#fcd34d;">
                    ℹ️ <strong>Hinweis:</strong> Alle Berechnungen und Pläne sind unverbindliche Richtwerte.
                </div>
            </div>`;
        return;
    }

    if (obj.type === 'lawn' || obj.type === 'drip' || obj.type === 'deadzone') {
        if (!obj.soilType) obj.soilType = 'normal';
        if (!obj.waterRate) obj.waterRate = obj.type === 'lawn' ? 25 : 20;
        if (obj.points) obj.areaM2 = calculatePolygonArea(obj.points, pixelsPerMeter);
        const area = obj.areaM2 || 0;
        const weeklyWaterLiters = Math.round(area * obj.waterRate);
        const titleColor = obj.type === 'lawn' ? '#22c55e' : (obj.type === 'drip' ? '#fb923c' : '#ef4444');
        const titleName = obj.type === 'lawn' ? 'Rasenfläche' : (obj.type === 'drip' ? 'Tropfzone' : 'Totzone / Schutzzone');

        targetContainer.innerHTML = `
            <div style="padding: 15px; color: #fff;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 style="color: ${titleColor}; margin:0;">${titleName}</h3>
                    <button onclick="deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
                </div>
                <p><strong>Fläche:</strong> ${area} m²</p>
                ${obj.type !== 'deadzone' ? `
                    <label style="display:block; margin-top:10px; font-size:12px; color:#94a3b8;">Wasserbedarf (l/m²/Woche):</label>
                    <input type="number" id="water-rate-input" value="${obj.waterRate}" onchange="changeWaterRate(this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <p><strong>Wöchentlicher Bedarf:</strong> ${weeklyWaterLiters} Liter</p>
                ` : ''}
                <button onclick="toggleLockSelected()" style="width:100%; padding:8px; margin-top:15px; background:#334155; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                    ${obj.locked ? '🔓 Fläche entsperren' : '🔒 Fläche sperren'}
                </button>
            </div>`;
    } else if (obj.type === 'source' || obj.type === 'sprinkler') {
        targetContainer.innerHTML = `
            <div style="padding: 15px; color: #fff;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 style="color: #38bdf8; margin:0;">${obj.type === 'source' ? '🚰 Wasserquelle' : '🎯 Regner'}</h3>
                    <button onclick="deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
                </div>
                <p>Position X: ${Math.round(obj.x)}, Y: ${Math.round(obj.y)}</p>
                <label style="display:block; margin-top:10px; font-size:12px; color:#94a3b8;">Bezeichnung / Details:</label>
                <input type="text" value="${obj.name || ''}" onchange="updateObjName(this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
            </div>`;
    }
}

function deselectCurrent() { selectedObj = null; activeHandleIndex = -1; updateSidebar(null); draw(); }
function selectObjectByIndex(index) { if (objects[index]) { selectedObj = objects[index]; activeHandleIndex = -1; updateSidebar(selectedObj); draw(); } }
function changeWaterRate(val) { if (!selectedObj) return; selectedObj.waterRate = parseFloat(val) || 0; updateSidebar(selectedObj); draw(); }
function updateObjName(val) { if (!selectedObj) return; selectedObj.name = val; }
function toggleLockSelected() { if (!selectedObj) return; selectedObj.locked = !selectedObj.locked; updateSidebar(selectedObj); draw(); }

function calculatePolygonArea(pts, pxm) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
        let j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
    }
    return Math.round(Math.abs(area / 2.0) / (pxm * pxm) * 100) / 100;
}

// ==========================================
// MOUSE & TOOL EVENTS
// ==========================================
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const rect = canvas.getBoundingClientRect();
    let world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (spacePressed || e.button === 1) {
        isPanning = true; startPanX = e.clientX - offsetX; startPanY = e.clientY - offsetY;
        return;
    }

    // 1. Maßstab setzen
    if (currentTool === 'scale') {
        if (!scaleStartPoint) { scaleStartPoint = world; } 
        else {
            const distPx = Math.hypot(world.x - scaleStartPoint.x, world.y - scaleStartPoint.y);
            const inputMeters = prompt("Strecke in Metern:", "5");
            if (inputMeters && !isNaN(parseFloat(inputMeters)) && parseFloat(inputMeters) > 0) {
                updatePixelsPerMeter(distPx / parseFloat(inputMeters));
            }
            scaleStartPoint = null; setTool('select');
        }
        draw();
        return;
    }

    // 2. Flächen zeichnen (Rasen, Tropfzone, Totzone)
    if (currentTool === 'draw-lawn' || currentTool === 'draw-drip' || currentTool === 'draw-deadzone') {
        const snapRadius = 15 / scale;
        for (let obj of objects) {
            if(obj.points) {
                for (let pt of obj.points) {
                    if (Math.hypot(world.x - pt.x, world.y - pt.y) < snapRadius) {
                        world = { x: pt.x, y: pt.y };
                        break;
                    }
                }
            }
        }

        if (polygonPoints.length > 2 && Math.hypot(world.x - polygonPoints[0].x, world.y - polygonPoints[0].y) < snapRadius) {
            finishPolygon(); return;
        }
        polygonPoints.push(world);
        draw();
        return;
    }

    // 3. Bauteile setzen (Wasserquelle, Regner)
    if (currentTool === 'add-source' || currentTool === 'add-sprinkler') {
        const newObj = {
            type: currentTool === 'add-source' ? 'source' : 'sprinkler',
            x: world.x,
            y: world.y,
            name: currentTool === 'add-source' ? 'Hauptanschluss' : 'Regner 1',
            locked: false
        };
        objects.push(newObj);
        selectedObj = newObj;
        updateSidebar(selectedObj);
        setTool('select');
        draw();
        return;
    }

    // 4. Rohrleitungen verlegen
    if (currentTool === 'draw-pipe') {
        pipePoints.push(world);
        if (pipePoints.length >= 2) {
            objects.push({
                type: 'pipe',
                points: [...pipePoints],
                locked: false
            });
            pipePoints = [world]; // Nahtloses Weiterzeichnen ermöglichen
        }
        draw();
        return;
    }

    // 5. Select / Bearbeiten Modus
    if (currentTool === 'select') {
        if (selectedObj && selectedObj.points && !selectedObj.locked) {
            const handleRadius = 12 / scale;
            for (let i = 0; i < selectedObj.points.length; i++) {
                if (Math.hypot(world.x - selectedObj.points[i].x, world.y - selectedObj.points[i].y) < handleRadius) {
                    activeHandleIndex = i;
                    return;
                }
            }
        }

        selectedObj = objects.slice().reverse().find(o => o.points && isPointInPolygon(world, o.points)) || 
                      objects.slice().reverse().find(o => o.type === 'source' || o.type === 'sprinkler' ? Math.hypot(world.x - o.x, world.y - o.y) < 15/scale : false) || null;
        activeHandleIndex = -1;
        updateSidebar(selectedObj);
        draw();
    }
});

function isPointInPolygon(point, vs) {
    let x = point.x, y = point.y, inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y, xj = vs[j].x, yj = vs[j].y;
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

function finishPolygon() {
    if (polygonPoints.length > 2) {
        let type = 'lawn';
        if (currentTool === 'draw-drip') type = 'drip';
        if (currentTool === 'draw-deadzone') type = 'deadzone';

        const newObj = { 
            type, 
            points: [...polygonPoints], 
            soilType: 'normal', 
            dripDistance: 33, 
            waterRate: type === 'lawn' ? 25 : (type === 'drip' ? 20 : 0), 
            layoutMode: 'loop', 
            rotationAngle: 0, 
            locked: false,
            areaM2: calculatePolygonArea(polygonPoints, pixelsPerMeter)
        };
        objects.push(newObj);
        selectedObj = newObj;
        polygonPoints = [];
        updateSidebar(selectedObj);
        setTool('select');
    }
}

canvas.addEventListener('dblclick', () => {
    if (currentTool === 'draw-lawn' || currentTool === 'draw-drip' || currentTool === 'draw-deadzone') {
        finishPolygon();
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    let world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (isPanning) { offsetX = (e.clientX - rect.left) - startPanX; offsetY = (e.clientY - rect.top) - startPanY; draw(); return; }

    if (activeHandleIndex !== -1 && selectedObj && selectedObj.points && !selectedObj.locked) {
        selectedObj.points[activeHandleIndex] = world;
        selectedObj.areaM2 = calculatePolygonArea(selectedObj.points, pixelsPerMeter);
        updateSidebar(selectedObj);
        draw();
        return;
    }

    currentMouseWorld = world;
    if (currentTool !== 'select') draw();
});

canvas.addEventListener('mouseup', () => { isPanning = false; activeHandleIndex = -1; });

// ==========================================
// ZEICHEN-LOOP 
// ==========================================
function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (bgImage) ctx.drawImage(bgImage, 0, 0);

    objects.forEach(obj => {
        if (obj.type === 'lawn' || obj.type === 'drip' || obj.type === 'deadzone') {
            if (!obj.points || obj.points.length < 3) return;

            ctx.beginPath();
            ctx.moveTo(obj.points[0].x, obj.points[0].y);
            obj.points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.closePath();

            if (obj.type === 'lawn') {
                ctx.fillStyle = obj === selectedObj ? 'rgba(34, 197, 94, 0.45)' : 'rgba(34, 197, 94, 0.25)';
                ctx.fill();
                ctx.strokeStyle = obj === selectedObj ? '#22c55e' : '#16a34a';
                ctx.lineWidth = (obj === selectedObj ? 3 : 2) / scale;
                ctx.stroke();
            } else if (obj.type === 'drip') {
                ctx.fillStyle = obj === selectedObj ? 'rgba(249, 115, 22, 0.45)' : 'rgba(249, 115, 22, 0.25)';
                ctx.fill();
                ctx.strokeStyle = obj === selectedObj ? '#f97316' : '#c2410c';
                ctx.lineWidth = (obj === selectedObj ? 3 : 2) / scale;
                ctx.stroke();
            } else if (obj.type === 'deadzone') {
                ctx.fillStyle = obj === selectedObj ? 'rgba(239, 68, 68, 0.45)' : 'rgba(239, 68, 68, 0.25)';
                ctx.fill();
                ctx.strokeStyle = obj === selectedObj ? '#ef4444' : '#b91c1c';
                ctx.lineWidth = (obj === selectedObj ? 3 : 2) / scale;
                ctx.stroke();
            }

            // Flächentext
            let cx = obj.points.reduce((sum, p) => sum + p.x, 0) / obj.points.length;
            let cy = obj.points.reduce((sum, p) => sum + p.y, 0) / obj.points.length;
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${12 / scale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(`${obj.areaM2 || 0} m²`, cx, cy);

            // Eckpunkte bei Auswahl
            if (obj === selectedObj) {
                obj.points.forEach((p) => {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 6 / scale, 0, Math.PI * 2);
                    ctx.fillStyle = '#38bdf8';
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2 / scale;
                    ctx.fill();
                    ctx.stroke();
                });
            }
        } else if (obj.type === 'source' || obj.type === 'sprinkler') {
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, 8 / scale, 0, Math.PI * 2);
            ctx.fillStyle = obj.type === 'source' ? '#3b82f6' : '#eab308';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / scale;
            ctx.fill();
            ctx.stroke();
        } else if (obj.type === 'pipe') {
            if (!obj.points || obj.points.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(obj.points[0].x, obj.points[0].y);
            for(let i = 1; i < obj.points.length; i++) {
                ctx.lineTo(obj.points[i].x, obj.points[i].y);
            }
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 3 / scale;
            ctx.stroke();
        }
    });

    // Aktives Zeichnen (Polygons)
    if (polygonPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
        polygonPoints.forEach(p => ctx.lineTo(p.x, p.y));
        if (currentMouseWorld) ctx.lineTo(currentMouseWorld.x, currentMouseWorld.y);
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2 / scale;
        ctx.stroke();
    }

    ctx.restore();
}

window.onload = () => { updateSidebar(null); draw(); };
