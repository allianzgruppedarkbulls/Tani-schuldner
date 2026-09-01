// main.js - CAD Hauptsteuerung (Mit Rotationswinkel, Ringleitung & Eckpunkten)

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
let scaleEndPoint = null;
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
// SIDEBAR & WINKEL-STEUERUNG
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
                <p style="font-size:12px; color:#94a3b8;">Klicke auf eine Fläche, um Punkte oder Winkel anzupassen. (ESC zum Abwählen)</p>
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
        if (obj.rotationAngle === undefined) obj.rotationAngle = 0; // Gradzahl für Tropfmuster
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
// MOUSE & EVENTS
// ==========================================
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const rect = canvas.getBoundingClientRect();
    const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

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
        if (polygonPoints.length > 2 && Math.hypot(world.x - polygonPoints[0].x, world.y - polygonPoints[0].y) < (15 / scale)) {
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
        const newObj = { type, points: [...polygonPoints], soilType: 'normal', dripDistance: 33, waterRate: type === 'lawn' ? 25 : 20, rotationAngle: 0, locked: false };
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
    const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (isPanning) { offsetX = (e.clientX - rect.left) - startPanX; offsetY = (e.clientY - rect.top) - startPanY; draw(); return; }
    
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
// ZEICHEN-LOOP MIT ROTIERTEM TROPFMUSTER
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

            ctx.save();
            ctx.clip(); 

            // Rotation anwenden (um den Mittelpunkt der Zone)
            let cx = obj.points.reduce((sum, p) => sum + p.x, 0) / obj.points.length;
            let cy = obj.points.reduce((sum, p) => sum + p.y, 0) / obj.points.length;
            
            ctx.translate(cx, cy);
            ctx.rotate((obj.rotationAngle || 0) * Math.PI / 180);
            ctx.translate(-cx, -cy);

            const spacingPx = (obj.dripDistance || 33) * (pixelsPerMeter / 100) * 1.5;
            let minX = Math.min(...obj.points.map(p => p.x));
            let maxX = Math.max(...obj.points.map(p => p.x));
            let minY = Math.min(...obj.points.map(p => p.y));
            let maxY = Math.max(...obj.points.map(p => p.y));

            // Umlaufende Frischwasser-Ringleitung
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 3 / scale;
            ctx.strokeRect(minX + 8/scale, minY + 8/scale, (maxX - minX) - 16/scale, (maxY - minY) - 16/scale);

            // Parallele Tropfschläuche im Inneren
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5 / scale;
            ctx.beginPath();
            
            for (let y = minY + 20; y <= maxY - 20; y += spacingPx) {
                ctx.moveTo(minX + 12/scale, y);
                ctx.lineTo(maxX - 12/scale, y);

                ctx.save();
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(minX + 10/scale, y - 3/scale, 5/scale, 6/scale);
                ctx.fillRect(maxX - 15/scale, y - 3/scale, 5/scale, 6/scale);
                ctx.restore();
            }
            ctx.stroke();
            ctx.restore(); // Ende Clip & Rotation

            // Äußere Polygon-Umrandung
            ctx.strokeStyle = obj === selectedObj ? '#f97316' : '#c2410c';
            ctx.lineWidth = (obj === selectedObj ? 3 : 2) / scale;
            ctx.stroke();
        }

        // Zentrierter Text
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
