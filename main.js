// main.js - CAD Hauptsteuerung

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
let activeHandle = null; // 'center', 'start-angle', 'end-angle', 'radius', 'node-point', 'curve-point'
let activeNodeIndex = -1;

// Variablen für Maßstab & Kontrollmessung
let scaleStartPoint = null;
let scaleEndPoint = null;
let measureStartPoint = null;
let currentMouseWorld = null;

function toWorld(sX, sY) { return { x: (sX - offsetX) / scale, y: (sY - offsetY) / scale }; }

window.addEventListener('keydown', (e) => { 
    if (e.code === 'Space') spacePressed = true; 
    // Taste 'L' (Lock) sperrt oder entsperrt die aktuell gewählte Fläche
    if (e.key === 'l' || e.key === 'L') {
        if (selectedObj && (selectedObj.type === 'lawn' || selectedObj.type === 'drip')) {
            selectedObj.locked = !selectedObj.locked;
            updateSidebar(selectedObj);
            draw();
        }
    }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') spacePressed = false; });

// Wheel Zoom
container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const mX = e.clientX - container.getBoundingClientRect().left;
    const mY = e.clientY - container.getBoundingClientRect().top;
    offsetX = mX - (mX - offsetX) * factor;
    offsetY = mY - (mY - offsetY) * factor;
    scale *= factor;
    document.getElementById('val-zoom').innerText = `${Math.round(scale * 100)}%`;
    draw();
});

// Bild-Upload mit automatischer Skalierung, Zentrierung & Auto-Maßstab
document.getElementById('img-upload').addEventListener('change', (e) => {
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

            document.getElementById('val-zoom').innerText = `${Math.round(scale * 100)}%`;
            
            setTool('scale');
            draw();
            setTimeout(() => {
                alert("Bild hochgeladen! Bitte ziehe jetzt eine Linie über eine bekannte Strecke (z. B. 5m Hauswand), um den Maßstab einzustellen.");
            }, 100);
        };
        bgImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Toolbar Buttons
function setTool(tool) {
    currentTool = tool;
    polygonPoints = [];
    scaleStartPoint = null;
    scaleEndPoint = null;
    measureStartPoint = null;
    document.querySelectorAll('#toolbar button').forEach(b => b.classList.remove('active'));
    if (document.getElementById(`btn-${tool}`)) document.getElementById(`btn-${tool}`).classList.add('active');
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

const shareBtn = document.getElementById('btn-share');
if (shareBtn) shareBtn.onclick = () => exportToLink(objects, pixelsPerMeter);

const deleteBtn = document.getElementById('btn-delete');
if (deleteBtn) {
    deleteBtn.onclick = () => {
        if (selectedObj) {
            objects = objects.filter(o => o !== selectedObj);
            selectedObj = null;
            updateSidebar(null);
            draw();
            updateGlobalWaterBalance();
        }
    };
}

// ==========================================
// SIDEBAR & LIVE-BERECHNUNG (NEU)
// ==========================================
function updateSidebar(obj) {
    const sidebar = document.getElementById('sidebar-content');
    if (!sidebar) return;

    if (!obj) {
        sidebar.innerHTML = `<p style="color: #7f8c8d; text-align: center; margin-top: 20px;">Kein Objekt ausgewählt.<br>Klicke auf eine Fläche oder einen Regner.</p>`;
        return;
    }

    if (obj.type === 'lawn') {
        const soilRates = {
            sand: { name: 'Sandiger Boden (leicht)', rate: 32 },
            normal: { name: 'Mutterboden (standard)', rate: 25 },
            clay: { name: 'Lehm-/Tonboden (schwer)', rate: 18 }
        };

        if (!obj.soilType) obj.soilType = 'normal';
        if (!obj.waterRate) obj.waterRate = soilRates[obj.soilType].rate;
        
        // Fläche aktualisieren falls vorhanden
        if (typeof calculatePolygonArea === 'function' && obj.points) {
            obj.areaM2 = calculatePolygonArea(obj.points, pixelsPerMeter);
        }
        const area = obj.areaM2 || 0;
        const weeklyWaterLiters = Math.round(area * obj.waterRate);

        sidebar.innerHTML = `
            <h3>🟩 Rasenfläche</h3>
            <p><strong>Fläche:</strong> ${area} m²</p>
            
            <label style="display:block; margin-top:10px; font-size:12px;">Bodenart:</label>
            <select id="soil-type-select" onchange="changeSoilType(this.value)" style="width:100%; padding:5px; margin-bottom:10px;">
                <option value="sand" ${obj.soilType === 'sand' ? 'selected' : ''}>Sandiger Boden (~32 l/m²/Woche)</option>
                <option value="normal" ${obj.soilType === 'normal' ? 'selected' : ''}>Mutterboden (~25 l/m²/Woche)</option>
                <option value="clay" ${obj.soilType === 'clay' ? 'selected' : ''}>Lehmboden (~18 l/m²/Woche)</option>
            </select>

            <label style="display:block; font-size:12px;">Wasserbedarf (l/m²/Woche):</label>
            <input type="number" id="water-rate-input" value="${obj.waterRate}" onchange="changeWaterRate(this.value)" style="width:100%; padding:5px; margin-bottom:10px;">

            <hr style="border:0; border-top:1px solid #ddd; margin:10px 0;">
            <p><strong>Wöchentlicher Bedarf:</strong> <span id="weekly-water-sum">${weeklyWaterLiters}</span> Liter</p>
            
            <button onclick="toggleLockSelected()" style="width:100%; padding:8px; margin-top:10px; cursor:pointer;">
                ${obj.locked ? '🔓 Fläche entsperren' : '🔒 Fläche sperren'}
            </button>
        `;
    } else if (obj.type === 'sprinkler') {
        sidebar.innerHTML = `
            <h3>💧 Regner (${obj.model})</h3>
            <p><strong>Reichweite:</strong> ${obj.radius} m</p>
            <p><strong>Winkel:</strong> ${obj.arc}°</p>
            <p><strong>Durchfluss:</strong> ${obj.flow} m³/h</p>
        `;
    } else {
        sidebar.innerHTML = `
            <h3>Objekt-Details</h3>
            <p>Typ: ${obj.type}</p>
        `;
    }
}

function changeSoilType(type) {
    if (!selectedObj || selectedObj.type !== 'lawn') return;
    selectedObj.soilType = type;
    const soilRates = { sand: 32, normal: 25, clay: 18 };
    selectedObj.waterRate = soilRates[type];
    updateSidebar(selectedObj);
    updateGlobalWaterBalance();
}

function changeWaterRate(val) {
    if (!selectedObj || selectedObj.type !== 'lawn') return;
    selectedObj.waterRate = parseFloat(val) || 0;
    updateSidebar(selectedObj);
    updateGlobalWaterBalance();
}

function toggleLockSelected() {
    if (!selectedObj) return;
    selectedObj.locked = !selectedObj.locked;
    updateSidebar(selectedObj);
    draw();
}

function updateGlobalWaterBalance() {
    let totalWeeklyLiters = 0;

    objects.forEach(obj => {
        if (obj.type === 'lawn') {
            const area = obj.areaM2 || 0;
            const rate = obj.waterRate || 25;
            totalWeeklyLiters += area * rate;
        }
    });

    const cisternVolume = window.cisternSize || 5000; 
    const weeksRemaining = totalWeeklyLiters > 0 ? (cisternVolume / totalWeeklyLiters).toFixed(1) : '∞';
    
    const summaryEl = document.getElementById('global-water-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <h4>Zisternen-Check</h4>
            <p>Gesamtbedarf: <strong>${totalWeeklyLiters} l / Woche</strong></p>
            <p>Reichweite (${cisternVolume}L): ca. <strong>${weeksRemaining} Wochen</strong></p>
        `;
    }
}

// ==========================================
// CANVAS MOUSE INTERAKTIONEN
// ==========================================
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const rect = canvas.getBoundingClientRect();
    const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (spacePressed || e.button === 1) {
        isPanning = true; startPanX = e.clientX - offsetX; startPanY = e.clientY - offsetY;
        return;
    }

    // 1. Maßstab ziehen
    if (currentTool === 'scale') {
        if (!scaleStartPoint) {
            if (objects.length > 0) {
                const confirmChange = confirm("Achtung: Wenn du den Maßstab neu einstellst, verändern sich alle bisher gezeichneten Längen und Flächen! Möchtest du wirklich fortfahren?");
                if (!confirmChange) { setTool('select'); return; }
            }
            scaleStartPoint = world;
        } else {
            scaleEndPoint = world;
            const distPx = Math.hypot(scaleEndPoint.x - scaleStartPoint.x, scaleEndPoint.y - scaleStartPoint.y);
            const inputMeters = prompt("Wie lang ist diese gezogene Strecke in Metern?", "5");
            if (inputMeters && !isNaN(parseFloat(inputMeters)) && parseFloat(inputMeters) > 0) {
                pixelsPerMeter = distPx / parseFloat(inputMeters);
                document.getElementById('val-px-m').innerText = `${pixelsPerMeter.toFixed(1)} px/m`;
            }
            scaleStartPoint = null; scaleEndPoint = null;
            setTool('select');
        }
        draw();
        return;
    }

    // 2. Kontrollmessung / Maßband
    if (currentTool === 'measure') {
        if (!measureStartPoint) { measureStartPoint = world; } 
        else { measureStartPoint = null; }
        draw();
        return;
    }

    // 3. Flächen zeichnen
    if (currentTool === 'draw-lawn' || currentTool === 'draw-drip') {
        if (polygonPoints.length > 2) {
            const startP = polygonPoints[0];
            const distToStart = Math.hypot(world.x - startP.x, world.y - startP.y);
            if (distToStart < (15 / scale)) { finishPolygon(); return; }
        }
        polygonPoints.push(world);
        draw(); 
        return;
    }

    // 4. Tropfzonen 16mm Einspeisepunkt
    if (currentTool === 'add-drip-feed') {
        const feed = { type: 'drip-feed', x: world.x, y: world.y };
        objects.push(feed);
        selectedObj = feed;
        updateSidebar(selectedObj);
        setTool('select');
        return;
    }

    // 5. Regner setzen
    if (currentTool === 'add-sprinkler') {
        const model = getHunterModel(3.5, 180);
        const spr = { type: 'sprinkler', x: world.x, y: world.y, radius: 3.5, startAngle: 0, arc: 180, model: model.name, flow: model.flow };
        objects.push(spr); 
        selectedObj = spr; 
        updateSidebar(selectedObj);
        setTool('select'); 
        return;
    }

    // 6. Select-Modus
    if (currentTool === 'select') {
        activeHandle = null;

        // A. Flächen-Knotenpunkte & Zwischenpunkte (+)
        if (selectedObj && (selectedObj.type === 'lawn' || selectedObj.type === 'drip') && !selectedObj.locked) {
            const hitIdx = selectedObj.points.findIndex(p => Math.hypot(p.x - world.x, p.y - world.y) < (12 / scale));
            if (hitIdx !== -1) {
                activeHandle = 'node-point'; activeNodeIndex = hitIdx; return;
            }

            if (typeof getEdgeAddPoints === 'function') {
                const addPoints = getEdgeAddPoints(selectedObj.points);
                const addHit = addPoints.find(ap => Math.hypot(ap.x - world.x, ap.y - world.y) < (12 / scale));
                if (addHit) {
                    selectedObj.points.splice(addHit.index, 0, { x: addHit.x, y: addHit.y });
                    activeHandle = 'node-point';
                    activeNodeIndex = addHit.index;
                    draw();
                    return;
                }
            }
        }

        // B. Regner-Handles prüfen
        if (selectedObj && selectedObj.type === 'sprinkler') {
            const h = getSprinklerHandles(selectedObj, pixelsPerMeter);
            if (Math.hypot(h.startHandle.x - world.x, h.startHandle.y - world.y) < (12 / scale)) { activeHandle = 'start-angle'; return; }
            if (Math.hypot(h.endHandle.x - world.x, h.endHandle.y - world.y) < (12 / scale)) { activeHandle = 'end-angle'; return; }
            if (Math.hypot(h.radiusHandle.x - world.x, h.radiusHandle.y - world.y) < (12 / scale)) { activeHandle = 'radius'; return; }
        }

        // C. Objekt-Auswahl
        selectedObj = objects.find(o => {
            if (o.type === 'sprinkler' || o.type === 'source' || o.type === 'drip-feed') return Math.hypot(o.x - world.x, o.y - world.y) < (18 / scale);
            return false;
        });

        // D. Flächen-Auswahl (Gesperrte Flächen ignorieren, sofern andere klickbar sind)
        if (!selectedObj) {
            selectedObj = objects.find(o => (o.type === 'lawn' || o.type === 'drip'));
        }

        if (selectedObj) activeHandle = 'center';
        
        updateSidebar(selectedObj);
        draw();
    }
});

// Rechtsklick: Punkt aus Fläche löschen
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (selectedObj && (selectedObj.type === 'lawn' || selectedObj.type === 'drip') && !selectedObj.locked) {
        const hitIdx = selectedObj.points.findIndex(p => Math.hypot(p.x - world.x, p.y - world.y) < (12 / scale));
        if (hitIdx !== -1 && selectedObj.points.length > 3) {
            selectedObj.points.splice(hitIdx, 1);
            updateSidebar(selectedObj);
            draw();
            updateGlobalWaterBalance();
        }
    }
});

function finishPolygon() {
    if (polygonPoints.length > 2) {
        const type = currentTool === 'draw-lawn' ? 'lawn' : 'drip';
        const newObj = { type: type, points: [...polygonPoints], soilType: 'normal', waterRate: 25, locked: false };
        objects.push(newObj);
        selectedObj = newObj;
        polygonPoints = [];
        updateSidebar(selectedObj);
        updateGlobalWaterBalance();
        setTool('select');
    }
}

canvas.addEventListener('dblclick', finishPolygon);

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left, screenY = e.clientY - rect.top;

    if (isPanning) { offsetX = screenX - startPanX; offsetY = screenY - startPanY; draw(); return; }

    currentMouseWorld = toWorld(screenX, screenY);

    if (currentTool === 'scale' || currentTool === 'measure' || currentTool === 'draw-lawn' || currentTool === 'draw-drip') {
        draw();
    }

    if (!selectedObj || !activeHandle) return;

    if (activeHandle === 'node-point' && !selectedObj.locked) {
        selectedObj.points[activeNodeIndex].x = currentMouseWorld.x;
        selectedObj.points[activeNodeIndex].y = currentMouseWorld.y;
        updateSidebar(selectedObj);
        updateGlobalWaterBalance();
        draw(); return;
    }

    if (activeHandle === 'center' && (selectedObj.type === 'drip-feed' || selectedObj.type === 'source')) {
        selectedObj.x = currentMouseWorld.x;
        selectedObj.y = currentMouseWorld.y;
        draw(); return;
    }

    if (selectedObj.type === 'sprinkler') {
        const dx = currentMouseWorld.x - selectedObj.x, dy = currentMouseWorld.y - selectedObj.y;
        let mouseAngle = (Math.atan2(dy, dx) * 180 / Math.PI);
        if (mouseAngle < 0) mouseAngle += 360;

        if (activeHandle === 'center') { selectedObj.x = currentMouseWorld.x; selectedObj.y = currentMouseWorld.y; }
        else if (activeHandle === 'start-angle') {
            const diff = mouseAngle - selectedObj.startAngle;
            selectedObj.startAngle = mouseAngle;
            selectedObj.arc = Math.max(15, Math.min(360, selectedObj.arc - diff));
        } else if (activeHandle === 'end-angle') {
            let newArc = mouseAngle - selectedObj.startAngle;
            if (newArc < 0) newArc += 360;
            selectedObj.arc = Math.max(15, Math.min(360, newArc));
        } else if (activeHandle === 'radius') {
            const distPx = Math.hypot(dx, dy);
            selectedObj.radius = Math.max(0.5, Math.round((distPx / pixelsPerMeter) * 10) / 10);
        }

        const model = getHunterModel(selectedObj.radius, selectedObj.arc);
        selectedObj.model = model.name; selectedObj.flow = model.flow;
        draw();
    }
});

canvas.addEventListener('mouseup', () => { isPanning = false; activeHandle = null; });

function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (bgImage) ctx.drawImage(bgImage, 0, 0);

    // 1. Rasen/Tropfzonen zeichnen
    if (typeof drawPolygons === 'function') {
        drawPolygons(ctx, objects, scale, pixelsPerMeter, selectedObj);
    }

    // 2. Regner zeichnen
    objects.filter(o => o.type === 'sprinkler').forEach(obj => {
        const rPx = obj.radius * pixelsPerMeter;
        const startRad = (obj.startAngle * Math.PI) / 180;
        const endRad = ((obj.startAngle + obj.arc) * Math.PI) / 180;

        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y);
        ctx.arc(obj.x, obj.y, rPx, startRad, endRad);
        ctx.closePath();
        ctx.fillStyle = obj === selectedObj ? 'rgba(0, 173, 181, 0.35)' : 'rgba(52, 152, 219, 0.25)';
        ctx.fill();
        ctx.strokeStyle = obj === selectedObj ? '#00adb5' : '#3498db';
        ctx.lineWidth = 2 / scale;
        ctx.stroke();

        if (obj === selectedObj) {
            const h = getSprinklerHandles(obj, pixelsPerMeter);
            ctx.beginPath(); ctx.arc(h.startHandle.x, h.startHandle.y, 7 / scale, 0, Math.PI * 2); ctx.fillStyle = '#f1c40f'; ctx.fill();
            ctx.beginPath(); ctx.arc(h.endHandle.x, h.endHandle.y, 7 / scale, 0, Math.PI * 2); ctx.fillStyle = '#2ecc71'; ctx.fill();
            ctx.beginPath(); ctx.arc(h.radiusHandle.x, h.radiusHandle.y, 7 / scale, 0, Math.PI * 2); ctx.fillStyle = '#e74c3c'; ctx.fill();
        }
    });

    // 3. Zeichne laufenden Flächen-Pfad
    if (polygonPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
        polygonPoints.forEach(p => ctx.lineTo(p.x, p.y));
        if (currentMouseWorld) ctx.lineTo(currentMouseWorld.x, currentMouseWorld.y);
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2 / scale;
        ctx.stroke();

        polygonPoints.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2);
            ctx.fillStyle = '#f1c40f'; ctx.fill();
        });
    }

    // 4. Maßstab-Linie
    if (currentTool === 'scale' && scaleStartPoint && currentMouseWorld) {
        ctx.beginPath();
        ctx.moveTo(scaleStartPoint.x, scaleStartPoint.y);
        ctx.lineTo(currentMouseWorld.x, currentMouseWorld.y);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3 / scale;
        ctx.stroke();
    }

    // 5. Maßband
    if (currentTool === 'measure' && measureStartPoint && currentMouseWorld) {
        const distPx = Math.hypot(currentMouseWorld.x - measureStartPoint.x, currentMouseWorld.y - measureStartPoint.y);
        const distMeters = (distPx / pixelsPerMeter).toFixed(2);

        ctx.beginPath();
        ctx.moveTo(measureStartPoint.x, measureStartPoint.y);
        ctx.lineTo(currentMouseWorld.x, currentMouseWorld.y);
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 3 / scale;
        ctx.setLineDash([6 / scale, 4 / scale]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ff0055';
        ctx.font = `bold ${14 / scale}px sans-serif`;
        ctx.fillText(`📏 ${distMeters} m`, currentMouseWorld.x + (10 / scale), currentMouseWorld.y);
    }

    ctx.restore();
}

// Beim Start initialisieren
window.onload = () => {
    if (typeof importFromLink === 'function') {
        const loadedData = importFromLink();
        if (loadedData) {
            pixelsPerMeter = loadedData.ppm || 20;
            objects = loadedData.objs || [];
            document.getElementById('val-px-m').innerText = `${pixelsPerMeter.toFixed(1)} px/m`;
        }
    }
    updateGlobalWaterBalance();
    draw();
};
