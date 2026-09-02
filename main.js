// main.js - CAD Hauptsteuerung (Snapping, Echte Schlauch-Mäander & Durchgezeichneter Rahmen)

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

function toWorld(sX, sY) { return { x: (sX - offsetX) / scale, y: (sY - offsetY) / scale }; }

window.addEventListener('keydown', (e) => { 
    if (e.code === 'Space') spacePressed = true; 
    if (e.key === 'Escape') {
        selectedObj = null;
        activeHandleIndex = -1;
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
bindBtn('btn-add-drip-feed', 'add-drip-feed');
bindBtn('btn-add-sprinkler', 'add-sprinkler');
bindBtn('btn-add-source', 'add-source');

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
                    ℹ️ <strong>Hinweis:</strong> Alle Berechnungen und Pläne sind unverbindliche Richtwerte/Empfehlungen für Material und Verlegung. Bauliche Abweichungen vor Ort vorbehalten.
                </div>
            </div>`;
        return;
    }

    if (obj.type === 'lawn') {
        if (!obj.soilType) obj.soilType = 'normal';
        if (!obj.waterRate) obj.waterRate = 25;
        if (obj.points) obj.areaM2 = calculatePolygonArea(obj.points, pixelsPerMeter);
        const area = obj.areaM2 || 0;
        const weeklyWaterLiters = Math.round(area * obj.waterRate);

        targetContainer.innerHTML = `
            <div style="padding: 15px; color: #fff;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 style="color: #38bdf8; margin:0;">🟩 Rasenfläche</h3>
                    <button onclick="deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
                </div>
                <p><strong>Fläche:</strong> ${area} m²</p>
                <label style="display:block; margin-top:10px; font-size:12px; color:#94a3b8;">Bodenart:</label>
                <select id="soil-type-select" onchange="changeSoilType(this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <option value="sand" ${obj.soilType === 'sand' ? 'selected' : ''}>Sandiger Boden</option>
                    <option value="normal" ${obj.soilType === 'normal' ? 'selected' : ''}>Mutterboden (Standard)</option>
                    <option value="clay" ${obj.soilType === 'clay' ? 'selected' : ''}>Lehm-/Tonboden</option>
                </select>
                <label style="display:block; margin-top:10px; font-size:12px; color:#94a3b8;">Wasserbedarf (l/m²/Woche):</label>
                <input type="number" id="water-rate-input" value="${obj.waterRate}" onchange="changeWaterRate(this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                <hr style="border:0; border-top:1px solid #334155; margin:15px 0;">
                <p><strong>Wöchentlicher Bedarf:</strong> ${weeklyWaterLiters} Liter</p>
                <button onclick="toggleLockSelected()" style="width:100%; padding:8px; margin-top:15px; background:#334155; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                    ${obj.locked ? '🔓 Fläche entsperren' : '🔒 Fläche sperren'}
                </button>
            </div>`;
    } else if (obj.type === 'drip') {
        if (!obj.soilType) obj.soilType = 'normal';
        if (!obj.dripDistance) obj.dripDistance = 33; 
        if (!obj.waterRate) obj.waterRate = 20;
        if (!obj.layoutMode) obj.layoutMode = 'loop'; 
        if (obj.rotationAngle === undefined) obj.rotationAngle = 0;
        if (obj.points) obj.areaM2 = calculatePolygonArea(obj.points, pixelsPerMeter);
        const area = obj.areaM2 || 0;
        const weeklyWaterLiters = Math.round(area * obj.waterRate);

        targetContainer.innerHTML = `
            <div style="padding: 15px; color: #fff;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 style="color: #fb923c; margin:0;">💧 Tropfzone</h3>
                    <button onclick="deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
                </div>
                <p><strong>Fläche:</strong> ${area} m²</p>
                
                <label style="display:block; margin-top:10px; font-size:12px; color:#94a3b8;">Verlegemodus:</label>
                <select id="drip-mode-select" onchange="changeDripLayoutMode(this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <option value="loop" ${obj.layoutMode === 'loop' ? 'selected' : ''}>Schleife / Schlenker (Mäander)</option>
                    <option value="frame" ${obj.layoutMode === 'frame' ? 'selected' : ''}>Beet-Rahmen + T-Stücke & Linien</option>
                </select>

                <label style="display:block; margin-top:10px; font-size:12px; color:#94a3b8;">Tropferabstand:</label>
                <select id="drip-dist-select" onchange="changeDripDistance(this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <option value="20" ${obj.dripDistance == 20 ? 'selected' : ''}>20 cm (Eng)</option>
                    <option value="33" ${obj.dripDistance == 33 ? 'selected' : ''}>33 cm (Standard)</option>
                    <option value="50" ${obj.dripDistance == 50 ? 'selected' : ''}>50 cm (Weit)</option>
                </select>
                
                <label style="display:block; margin-top:10px; font-size:12px; color:#94a3b8;">Muster-Drehung (Grad): <span id="val-rot">${obj.rotationAngle}°</span></label>
                <input type="range" id="drip-rotation-input" min="0" max="360" value="${obj.rotationAngle}" oninput="changeDripRotation(this.value)" style="width:100%; margin-bottom:10px; accent-color:#fb923c;">

                <hr style="border:0; border-top:1px solid #334155; margin:15px 0;">
                <p><strong>Wöchentlicher Bedarf:</strong> ${weeklyWaterLiters} Liter</p>
                <button onclick="toggleLockSelected()" style="width:100%; padding:8px; margin-top:15px; background:#334155; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                    ${obj.locked ? '🔓 Zone entsperren' : '🔒 Zone sperren'}
                </button>
            </div>`;
    }
}

function deselectCurrent() { selectedObj = null; activeHandleIndex = -1; updateSidebar(null); draw(); }
function selectObjectByIndex(index) { if (objects[index]) { selectedObj = objects[index]; activeHandleIndex = -1; updateSidebar(selectedObj); draw(); } }
function changeSoilType(type) { if (!selectedObj) return; selectedObj.soilType = type; updateSidebar(selectedObj); draw(); }
function changeWaterRate(val) { if (!selectedObj) return; selectedObj.waterRate = parseFloat(val) || 0; updateSidebar(selectedObj); draw(); }
function changeDripDistance(val) { if (!selectedObj) return; selectedObj.dripDistance = parseInt(val); updateSidebar(selectedObj); draw(); }
function changeDripLayoutMode(mode) { if (!selectedObj) return; selectedObj.layoutMode = mode; updateSidebar(selectedObj); draw(); }
function changeDripRotation(val) { 
    if (!selectedObj) return; 
    selectedObj.rotationAngle = parseInt(val) || 0; 
    const rotLabel = document.getElementById('val-rot');
    if(rotLabel) rotLabel.innerText = `${selectedObj.rotationAngle}°`;
    draw(); 
}
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
// MOUSE & SNAPPING EVENTS
// ==========================================
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const rect = canvas.getBoundingClientRect();
    let world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (spacePressed || e.button === 1) {
        isPanning = true; startPanX = e.clientX - offsetX; startPanY = e.clientY - offsetY;
        return;
    }

    if (currentTool === 'scale') {
        if (!scaleStartPoint) { scaleStartPoint = world; } 
        else {
            const distPx = Math.hypot(world.x - scaleStartPoint.x, world.y - scaleStartPoint.y);
            const inputMeters = prompt("Strecke in Metern:", "5");
            if (inputMeters && !isNaN(parseFloat(inputMeters))) pixelsPerMeter = distPx / parseFloat(inputMeters);
            scaleStartPoint = null; setTool('select');
        }
        draw();
        return;
    }

    if (currentTool === 'draw-lawn' || currentTool === 'draw-drip') {
        // SNAPPING AN BESTEHENDE ECKPUNKTE
        const snapRadius = 15 / scale;
        for (let obj of objects) {
            for (let pt of obj.points) {
                if (Math.hypot(world.x - pt.x, world.y - pt.y) < snapRadius) {
                    world = { x: pt.x, y: pt.y };
                    break;
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

    if (currentTool === 'select') {
        if (selectedObj && !selectedObj.locked) {
            const handleRadius = 12 / scale;
            for (let i = 0; i < selectedObj.points.length; i++) {
                if (Math.hypot(world.x - selectedObj.points[i].x, world.y - selectedObj.points[i].y) < handleRadius) {
                    activeHandleIndex = i;
                    return;
                }
            }
        }

        selectedObj = objects.slice().reverse().find(o => isPointInPolygon(world, o.points)) || null;
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
        const type = currentTool === 'draw-lawn' ? 'lawn' : 'drip';
        const newObj = { type, points: [...polygonPoints], soilType: 'normal', dripDistance: 33, waterRate: type === 'lawn' ? 25 : 20, layoutMode: 'loop', rotationAngle: 0, locked: false };
        objects.push(newObj);
        selectedObj = newObj;
        polygonPoints = [];
        updateSidebar(selectedObj);
        setTool('select');
    }
}

canvas.addEventListener('dblclick', finishPolygon);

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    let world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (isPanning) { offsetX = (e.clientX - rect.left) - startPanX; offsetY = (e.clientY - rect.top) - startPanY; draw(); return; }
    
    if (currentTool === 'draw-lawn' || currentTool === 'draw-drip') {
        const snapRadius = 15 / scale;
        for (let obj of objects) {
            for (let pt of obj.points) {
                if (Math.hypot(world.x - pt.x, world.y - pt.y) < snapRadius) {
                    world = { x: pt.x, y: pt.y };
                    break;
                }
            }
        }
    }

    if (activeHandleIndex !== -1 && selectedObj && !selectedObj.locked) {
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
// SCHNITTBERECHNUNG
// ==========================================
function getLinePolygonIntersections(p1, p2, polygon) {
    let intersections = [];
    for (let i = 0; i < polygon.length; i++) {
        let p3 = polygon[i];
        let p4 = polygon[(i + 1) % polygon.length];
        let pt = getIntersection(p1, p2, p3, p4);
        if (pt) intersections.push(pt.x);
    }
    intersections.sort((a, b) => a - b);
    return intersections.filter((val, index, arr) => index === 0 || Math.abs(val - arr[index - 1]) > 0.5);
}

function getIntersection(p1, p2, p3, p4) {
    let denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denom === 0) return null;
    let ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    let ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return { x: p1.x + ua * (p2.x - p1.x), y: p1.y + ua * (p2.y - p1.y) };
    }
    return null;
}

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

            // Äußere Umrandung der Tropfzone
            ctx.strokeStyle = obj === selectedObj ? '#f97316' : '#c2410c';
            ctx.lineWidth = (obj === selectedObj ? 3 : 2) / scale;
            ctx.stroke();

            // Innenlayout (Schleife / Mäander oder durchgezeichneter Rahmen)
            ctx.save();
            let cx = obj.points.reduce((sum, p) => sum + p.x, 0) / obj.points.length;
            let cy = obj.points.reduce((sum, p) => sum + p.y, 0) / obj.points.length;
            
            ctx.translate(cx, cy);
            let angleRad = (obj.rotationAngle || 0) * Math.PI / 180;
            ctx.rotate(angleRad);
            ctx.translate(-cx, -cy);

            let cos = Math.cos(-angleRad), sin = Math.sin(-angleRad);
            let rotPoints = obj.points.map(p => ({
                x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
                y: cy + (p.x - cx) * sin + (p.y - cy) * cos
            }));

            let minRotY = Math.min(...rotPoints.map(p => p.y));
            let maxRotY = Math.max(...rotPoints.map(p => p.y));
            let minRotX = Math.min(...rotPoints.map(p => p.x));
            let maxRotX = Math.max(...rotPoints.map(p => p.x));

            const spacingPx = (obj.dripDistance || 33) * (pixelsPerMeter / 100) * 1.5;
            // Ausreichender Abstand zum Rand (ca. 25cm / 0.25m)
            const edgeInset = pixelsPerMeter * 0.25;

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.8 / scale;
            ctx.beginPath();

            let rows = [];
            for (let y = minRotY + edgeInset; y <= maxRotY - edgeInset; y += spacingPx) {
                let p1 = { x: minRotX - 100, y: y };
                let p2 = { x: maxRotX + 100, y: y };
                let xCoords = getLinePolygonIntersections(p1, p2, rotPoints);

                if (xCoords.length >= 2) {
                    let startX = xCoords[0] + edgeInset;
                    let endX = xCoords[xCoords.length - 1] - edgeInset;
                    if (startX < endX) {
                        rows.push({ y: y, startX: startX, endX: endX });
                    }
                }
            }

            if (obj.layoutMode === 'loop' && rows.length > 0) {
                // Echte Endlos-Schleife (Mäander mit U-Bögen abwechselnd links und rechts)
                for (let i = 0; i < rows.length; i++) {
                    let r = rows[i];
                    if (i % 2 === 0) {
                        ctx.moveTo(r.startX, r.y);
                        ctx.lineTo(r.endX, r.y);
                        if (i < rows.length - 1) {
                            // Rechter U-Bogen zum nächsten
                            let nextY = rows[i+1].y;
                            ctx.arc(r.endX, (r.y + nextY)/2, (nextY - r.y)/2, -Math.PI/2, Math.PI/2, false);
                        }
                    } else {
                        ctx.moveTo(r.endX, r.y);
                        ctx.lineTo(r.startX, r.y);
                        if (i < rows.length - 1) {
                            // Linker U-Bogen zum nächsten
                            let nextY = rows[i+1].y;
                            ctx.arc(r.startX, (r.y + nextY)/2, (nextY - r.y)/2, Math.PI/2, 3*Math.PI/2, false);
                        }
                    }
                }
            } else if (obj.layoutMode === 'frame') {
                // Umlaufender Rahmen + durchgehende Parallellinien mit echten T-Stücken
                let frameMinX = Math.min(...rows.map(r => r.startX)) - 10/scale;
                let frameMaxX = Math.max(...rows.map(r => r.endX)) + 10/scale;
                let frameMinY = rows.length > 0 ? rows[0].y - 10/scale : minRotY;
                let frameMaxY = rows.length > 0 ? rows[rows.length-1].y + 10/scale : maxRotY;

                // Äußere Rahmenleitung
                ctx.strokeRect(frameMinX, frameMinY, frameMaxX - frameMinX, frameMaxY - frameMinY);

                // Parallele Innenlinien mit T-Stücken an den Anbindungen
                rows.forEach(r => {
                    ctx.moveTo(r.startX, r.y);
                    ctx.lineTo(r.endX, r.y);
                    // T-Stück Markierungen
                    ctx.moveTo(r.startX - 3/scale, r.y - 3/scale); ctx.lineTo(r.startX + 3/scale, r.y + 3/scale);
                    ctx.moveTo(r.endX - 3/scale, r.y - 3/scale); ctx.lineTo(r.endX + 3/scale, r.y + 3/scale);
                });
            }

            ctx.stroke();
            ctx.restore();
        }

        // Zentrierter Text & Flächeninfo
        let cx = obj.points.reduce((sum, p) => sum + p.x, 0) / obj.points.length;
        let cy = obj.points.reduce((sum, p) => sum + p.y, 0) / obj.points.length;
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${12 / scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${obj.type === 'lawn' ? 'Rasen' : 'Tropfzone'}: ${obj.areaM2 || 0} m²`, cx, cy);

        // Eckpunkte anzeigen
        if (obj === selectedObj) {
            obj.points.forEach((p, idx) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6 / scale, 0, Math.PI * 2);
                ctx.fillStyle = '#38bdf8';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2 / scale;
                ctx.fill();
                ctx.stroke();
            });
        }
    });

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
