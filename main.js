// main.js - CAD Hauptsteuerung (Erweitert für Tropfzonen, Boden & Pflanzenbedarf)

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
let activeHandle = null; 
let activeNodeIndex = -1;

let scaleStartPoint = null;
let scaleEndPoint = null;
let measureStartPoint = null;
let currentMouseWorld = null;

function toWorld(sX, sY) { return { x: (sX - offsetX) / scale, y: (sY - offsetY) / scale }; }

window.addEventListener('keydown', (e) => { 
    if (e.code === 'Space') spacePressed = true; 
    if (e.key === 'l' || e.key === 'L') {
        if (selectedObj && (selectedObj.type === 'lawn' || selectedObj.type === 'drip')) {
            selectedObj.locked = !selectedObj.locked;
            updateSidebar(selectedObj);
            draw();
        }
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
    scaleEndPoint = null;
    measureStartPoint = null;
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
// SIDEBAR & LIVE-BERECHNUNG (ERWEITERT)
// ==========================================
function updateSidebar(obj) {
    let sidebar = document.getElementById('sidebar-content') || document.getElementById('sidebar') || document.querySelector('.sidebar');
    if (!sidebar) return;
    let targetContainer = sidebar.id === 'sidebar-content' ? sidebar : (sidebar.querySelector('#sidebar-content') || sidebar);

    if (!obj) {
        targetContainer.innerHTML = `
            <div style="padding: 15px; color: #cbd5e1;">
                <h3 style="color: #fff; margin-bottom: 10px;">System-Status</h3>
                <p>Maßstab: <span id="val-px-m">${pixelsPerMeter.toFixed(1)} px/m</span></p>
                <p>Zoom: <span id="val-zoom">${Math.round(scale * 100)}%</span></p>
                <hr style="border:0; border-top:1px solid #334155; margin: 15px 0;">
                <p style="color: #94a3b8; text-align: center; margin-top: 20px;">Kein Objekt ausgewählt.<br>Klicke auf Rasen oder Tropfzonen.</p>
                <div id="global-water-summary" style="margin-top: 20px;"></div>
            </div>`;
        updateGlobalWaterBalance();
        return;
    }

    if (obj.type === 'lawn') {
        if (!obj.soilType) obj.soilType = 'normal';
        if (!obj.waterRate) obj.waterRate = 25;
        
        if (typeof calculatePolygonArea === 'function' && obj.points) {
            obj.areaM2 = calculatePolygonArea(obj.points, pixelsPerMeter);
        }
        const area = obj.areaM2 || 0;
        const weeklyWaterLiters = Math.round(area * obj.waterRate);

        targetContainer.innerHTML = `
            <div style="padding: 15px; color: #fff;">
                <h3 style="color: #38bdf8; margin-bottom: 10px;">🟩 Rasenfläche</h3>
                <p><strong>Fläche:</strong> ${area} m²</p>
                
                <label style="display:block; margin-top:10px; font-size:12px; color:#94a3b8;">Bodenart:</label>
                <select id="soil-type-select" onchange="changeSoilType(this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <option value="sand" ${obj.soilType === 'sand' ? 'selected' : ''}>Sandiger Boden (hoher Durchlässigkeit)</option>
                    <option value="normal" ${obj.soilType === 'normal' ? 'selected' : ''}>Mutterboden (Standard)</option>
                    <option value="clay" ${obj.soilType === 'clay' ? 'selected' : ''}>Lehm-/Tonboden (speichert Feuchtigkeit)</option>
                </select>

                <label style="display:block; font-size:12px; color:#94a3b8;">Wasserbedarf (l/m²/Woche):</label>
                <input type="number" id="water-rate-input" value="${obj.waterRate}" onchange="changeWaterRate(this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">

                <hr style="border:0; border-top:1px solid #334155; margin:15px 0;">
                <p><strong>Wöchentlicher Bedarf:</strong> <span id="weekly-water-sum">${weeklyWaterLiters}</span> Liter</p>
                
                <button onclick="toggleLockSelected()" style="width:100%; padding:8px; margin-top:15px; background:#334155; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                    ${obj.locked ? '🔓 Fläche entsperren' : '🔒 Fläche sperren'}
                </button>
            </div>
        `;
    } else if (obj.type === 'drip') {
        if (!obj.soilType) obj.soilType = 'normal';
        if (!obj.plantType) obj.plantType = 'normal'; // standard, low, high (z.B. Hortensien)
        if (!obj.dripDistance) obj.dripDistance = 33; // cm
        if (!obj.waterRate) obj.waterRate = 20; // l/m²/Woche basis

        if (typeof calculatePolygonArea === 'function' && obj.points) {
            obj.areaM2 = calculatePolygonArea(obj.points, pixelsPerMeter);
        }
        const area = obj.areaM2 || 0;
        const weeklyWaterLiters = Math.round(area * obj.waterRate);

        targetContainer.innerHTML = `
            <div style="padding: 15px; color: #fff;">
                <h3 style="color: #fb923c; margin-bottom: 10px;">💧 Tropfzone (Pflanzen)</h3>
                <p><strong>Fläche:</strong> ${area} m²</p>
                
                <label style="display:block; margin-top:10px; font-size:12px; color:#94a3b8;">Bodenart:</label>
                <select id="drip-soil-select" onchange="changeDripSoil(this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <option value="sand" ${obj.soilType === 'sand' ? 'selected' : ''}>Sandiger Boden (schnell trocken)</option>
                    <option value="normal" ${obj.soilType === 'normal' ? 'selected' : ''}>Mutterboden (Standard)</option>
                    <option value="clay" ${obj.soilType === 'clay' ? 'selected' : ''}>Lehm-/Tonboden (Achtung Staunässe!)</option>
                </select>

                <label style="display:block; margin-top:10px; font-size:12px; color:#94a3b8;">Pflanzentyp / Wasserbedarf:</label>
                <select id="drip-plant-select" onchange="changeDripPlant(this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <option value="low" ${obj.plantType === 'low' ? 'selected' : ''}>Wenig Wasser (z.B. Lavendel, Steingarten)</option>
                    <option value="normal" ${obj.plantType === 'normal' ? 'selected' : ''}>Normaler Bedarf (Sträucher, Hecken)</option>
                    <option value="high" ${obj.plantType === 'high' ? 'selected' : ''}>Sehr hohem Bedarf (z.B. Hortensien, Stauden)</option>
                </select>

                <label style="display:block; margin-top:10px; font-size:12px; color:#94a3b8;">Tropferabstand im Rohr:</label>
                <select id="drip-dist-select" onchange="changeDripDistance(this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <option value="20" ${obj.dripDistance == 20 ? 'selected' : ''}>20 cm (eng bei sandigem Boden)</option>
                    <option value="30" ${obj.dripDistance == 30 ? 'selected' : ''}>30 cm (Standard)</option>
                    <option value="33" ${obj.dripDistance == 33 ? 'selected' : ''}>33 cm (Standard)</option>
                    <option value="50" ${obj.dripDistance == 50 ? 'selected' : ''}>50 cm (weit bei Lehm / geringer Bedarf)</option>
                </select>

                <hr style="border:0; border-top:1px solid #334155; margin:15px 0;">
                <p><strong>Wöchentlicher Bedarf:</strong> ${weeklyWaterLiters} Liter</p>
                
                <button onclick="toggleLockSelected()" style="width:100%; padding:8px; margin-top:15px; background:#334155; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                    ${obj.locked ? '🔓 Zone entsperren' : '🔒 Zone sperren'}
                </button>
            </div>
        `;
    } else if (obj.type === 'sprinkler') {
        targetContainer.innerHTML = `
            <div style="padding: 15px; color: #fff;">
                <h3 style="color: #38bdf8; margin-bottom: 10px;">💦 Regner (${obj.model})</h3>
                <p><strong>Reichweite:</strong> ${obj.radius} m</p>
                <p><strong>Winkel:</strong> ${obj.arc}°</p>
                <p><strong>Durchfluss:</strong> ${obj.flow} m³/h</p>
            </div>
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

function changeDripSoil(type) {
    if (!selectedObj || selectedObj.type !== 'drip') return;
    selectedObj.soilType = type;
    updateDripWaterCalculation();
}

function changeDripPlant(type) {
    if (!selectedObj || selectedObj.type !== 'drip') return;
    selectedObj.plantType = type;
    // Automatischen Tropferabstand je nach Pflanze/Boden vorschlagen
    if (type === 'high') selectedObj.dripDistance = 20;
    else if (type === 'low') selectedObj.dripDistance = 50;
    else selectedObj.dripDistance = 33;
    
    updateDripWaterCalculation();
}

function changeDripDistance(val) {
    if (!selectedObj || selectedObj.type !== 'drip') return;
    selectedObj.dripDistance = parseInt(val);
    updateSidebar(selectedObj);
}

function updateDripWaterCalculation() {
    if (!selectedObj || selectedObj.type !== 'drip') return;
    // Multiplikatoren für Pflanzentyp
    const plantMultipliers = { low: 0.6, normal: 1.0, high: 1.5 };
    const baseRate = 20; // l/m² standard
    selectedObj.waterRate = baseRate * (plantMultipliers[selectedObj.plantType] || 1.0);
    
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
        if (obj.type === 'lawn' || obj.type === 'drip') {
            totalWeeklyLiters += (obj.areaM2 || 0) * (obj.waterRate || 25);
        }
    });
    const cisternVolume = window.cisternSize || 5000; 
    const weeksRemaining = totalWeeklyLiters > 0 ? (cisternVolume / totalWeeklyLiters).toFixed(1) : '∞';
    
    const summaryEl = document.getElementById('global-water-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <h4 style="color:#38bdf8; margin-bottom:5px;">Zisternen-Gesamtcheck</h4>
            <p>Gesamtbedarf: <strong>${Math.round(totalWeeklyLiters)} l / Woche</strong></p>
            <p>Reichweite (${cisternVolume}L): ca. <strong>${weeksRemaining} Wochen</strong></p>
        `;
    }
}

// ==========================================
// MOUSE & CANVAS EVENTS
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
        if (!scaleStartPoint) {
            scaleStartPoint = world;
        } else {
            scaleEndPoint = world;
            const distPx = Math.hypot(scaleEndPoint.x - scaleStartPoint.x, scaleEndPoint.y - scaleStartPoint.y);
            const inputMeters = prompt("Wie lang ist diese gezogene Strecke in Metern?", "5");
            if (inputMeters && !isNaN(parseFloat(inputMeters)) && parseFloat(inputMeters) > 0) {
                pixelsPerMeter = distPx / parseFloat(inputMeters);
                const pxmEl = document.getElementById('val-px-m');
                if(pxmEl) pxmEl.innerText = `${pixelsPerMeter.toFixed(1)} px/m`;
            }
            scaleStartPoint = null; scaleEndPoint = null;
            setTool('select');
        }
        draw();
        return;
    }

    if (currentTool === 'measure') {
        if (!measureStartPoint) { measureStartPoint = world; } 
        else { measureStartPoint = null; }
        draw();
        return;
    }

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

    if (currentTool === 'add-drip-feed') {
        const feed = { type: 'drip-feed', x: world.x, y: world.y };
        objects.push(feed);
        selectedObj = feed;
        updateSidebar(selectedObj);
        setTool('select');
        return;
    }

    if (currentTool === 'add-sprinkler') {
        const model = typeof getHunterModel === 'function' ? getHunterModel(3.5, 180) : { name: 'Rotator', flow: 0.2 };
        const spr = { type: 'sprinkler', x: world.x, y: world.y, radius: 3.5, startAngle: 0, arc: 180, model: model.name, flow: model.flow };
        objects.push(spr); 
        selectedObj = spr; 
        updateSidebar(selectedObj);
        setTool('select'); 
        return;
    }

    if (currentTool === 'select') {
        activeHandle = null;

        if (selectedObj && (selectedObj.type === 'lawn' || selectedObj.type === 'drip') && !selectedObj.locked) {
            const hitIdx = selectedObj.points.findIndex(p => Math.hypot(p.x - world.x, p.y - world.y) < (12 / scale));
            if (hitIdx !== -1) {
                activeHandle = 'node-point'; activeNodeIndex = hitIdx; return;
            }
        }

        selectedObj = objects.find(o => {
            if (o.type === 'sprinkler' || o.type === 'source' || o.type === 'drip-feed') {
                return Math.hypot(o.x - world.x, o.y - world.y) < (18 / scale);
            }
            return false;
        });

        if (!selectedObj) {
            selectedObj = objects.find(o => (o.type === 'lawn' || o.type === 'drip'));
        }

        if (selectedObj) activeHandle = 'center';
        updateSidebar(selectedObj);
        draw();
    }
});

function finishPolygon() {
    if (polygonPoints.length > 2) {
        const type = currentTool === 'draw-lawn' ? 'lawn' : 'drip';
        const newObj = { 
            type: type, 
            points: [...polygonPoints], 
            soilType: 'normal', 
            plantType: 'normal',
            dripDistance: 33,
            waterRate: type === 'lawn' ? 25 : 20, 
            locked: false 
        };
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
});

canvas.addEventListener('mouseup', () => { isPanning = false; activeHandle = null; });

function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (bgImage) ctx.drawImage(bgImage, 0, 0);

    if (typeof drawPolygons === 'function') {
        drawPolygons(ctx, objects, scale, pixelsPerMeter, selectedObj);
    }

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

    if (currentTool === 'scale' && scaleStartPoint && currentMouseWorld) {
        ctx.beginPath();
        ctx.moveTo(scaleStartPoint.x, scaleStartPoint.y);
        ctx.lineTo(currentMouseWorld.x, currentMouseWorld.y);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3 / scale;
        ctx.stroke();
    }

    ctx.restore();
}

window.onload = () => {
    if (typeof importFromLink === 'function') {
        const loadedData = importFromLink();
        if (loadedData) {
            pixelsPerMeter = loadedData.ppm || 20;
            objects = loadedData.objs || [];
            const pxmEl = document.getElementById('val-px-m');
            if(pxmEl) pxmEl.innerText = `${pixelsPerMeter.toFixed(1)} px/m`;
        }
    }
    updateSidebar(null);
    draw();
};
