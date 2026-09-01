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

window.addEventListener('keydown', (e) => { if (e.code === 'Space') spacePressed = true; });
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
            // Berechne passenden Zoom, damit das Bild komplett auf den Canvas passt
            const scaleX = (width * 0.8) / bgImage.width;
            const scaleY = (height * 0.8) / bgImage.height;
            scale = Math.min(scaleX, scaleY);

            // Zentriere das Bild auf der Arbeitsfläche
            offsetX = (width - bgImage.width * scale) / 2;
            offsetY = (height - bgImage.height * scale) / 2;

            document.getElementById('val-zoom').innerText = `${Math.round(scale * 100)}%`;
            
            // Wechsel direkt in den Maßstab-Ziehen-Modus
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

// Event-Listener für Buttons (Sicherheitschecks für dynamische/neue Buttons)
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
            draw();
        }
    };
}

// Canvas Mouse Interactions
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return; // Nur Links- oder Mittelklick
    const rect = canvas.getBoundingClientRect();
    const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (spacePressed || e.button === 1) {
        isPanning = true; startPanX = e.clientX - offsetX; startPanY = e.clientY - offsetY;
        return;
    }

    // 1. Maßstab ziehen
    if (currentTool === 'scale') {
        if (!scaleStartPoint) {
            scaleStartPoint = world;
        } else {
            scaleEndPoint = world;
            const distPx = Math.hypot(scaleEndPoint.x - scaleStartPoint.x, scaleEndPoint.y - scaleStartPoint.y);
            const inputMeters = prompt("Wie lang ist diese gezogene Strecke in Metern?", "5");
            if (inputMeters && !isNaN(parseFloat(inputMeters)) && parseFloat(inputMeters) > 0) {
                pixelsPerMeter = distPx / parseFloat(inputMeters);
                document.getElementById('val-px-m').innerText = `${pixelsPerMeter.toFixed(1)} px/m`;
            }
            scaleStartPoint = null;
            scaleEndPoint = null;
            setTool('select');
        }
        draw();
        return;
    }

    // 2. Kontrollmessung
    if (currentTool === 'measure') {
        if (!measureStartPoint) {
            measureStartPoint = world;
        } else {
            measureStartPoint = null; // Zurücksetzen nach 2. Klick
        }
        draw();
        return;
    }

    // 3. Flächen zeichnen (Rasen / Tropfzone)
    if (currentTool === 'draw-lawn' || currentTool === 'draw-drip') {
        // Auto-Snap zum ersten Punkt bei Annäherung zum Schließen der Fläche
        if (polygonPoints.length > 2) {
            const startP = polygonPoints[0];
            const distToStart = Math.hypot(world.x - startP.x, world.y - startP.y);
            if (distToStart < (15 / scale)) {
                finishPolygon();
                return;
            }
        }
        polygonPoints.push(world);
        draw(); 
        return;
    }

    // 4. Tropfzonen 16mm Einspeisepunkt setzen
    if (currentTool === 'add-drip-feed') {
        const feed = { type: 'drip-feed', x: world.x, y: world.y };
        objects.push(feed);
        selectedObj = feed;
        setTool('select');
        return;
    }

    // 5. Regner setzen
    if (currentTool === 'add-sprinkler') {
        const model = getHunterModel(3.5, 180);
        const spr = { type: 'sprinkler', x: world.x, y: world.y, radius: 3.5, startAngle: 0, arc: 180, model: model.name, flow: model.flow };
        objects.push(spr); selectedObj = spr; setTool('select'); return;
    }

    // 6. Select-Modus (Objekte / Knoten / Biegungen verschieben)
    if (currentTool === 'select') {
        activeHandle = null;

        // A. Flächen-Knotenpunkte & Biegungen prüfen
        if (selectedObj && (selectedObj.type === 'lawn' || selectedObj.type === 'drip')) {
            const hitIdx = selectedObj.points.findIndex(p => Math.hypot(p.x - world.x, p.y - world.y) < (12 / scale));
            if (hitIdx !== -1) {
                activeHandle = 'node-point'; activeNodeIndex = hitIdx; return;
            }
            
            const mids = getPolygonMidpoints(selectedObj.points);
            const midHit = mids.find(m => Math.hypot(m.x - world.x, m.y - world.y) < (12 / scale));
            if (midHit) {
                activeHandle = 'curve-point'; activeNodeIndex = midHit.index; return;
            }
        }

        // B. Regner-Handles prüfen
        if (selectedObj && selectedObj.type === 'sprinkler') {
            const h = getSprinklerHandles(selectedObj, pixelsPerMeter);
            if (Math.hypot(h.startHandle.x - world.x, h.startHandle.y - world.y) < (12 / scale)) { activeHandle = 'start-angle'; return; }
            if (Math.hypot(h.endHandle.x - world.x, h.endHandle.y - world.y) < (12 / scale)) { activeHandle = 'end-angle'; return; }
            if (Math.hypot(h.radiusHandle.x - world.x, h.radiusHandle.y - world.y) < (12 / scale)) { activeHandle = 'radius'; return; }
        }

        // C. Objekt-Auswahl (Regner, Einspeisungen, Quellen)
        selectedObj = objects.find(o => {
            if (o.type === 'sprinkler' || o.type === 'source' || o.type === 'drip-feed') return Math.hypot(o.x - world.x, o.y - world.y) < (18 / scale);
            return false;
        });

        // D. Flächen-Auswahl
        if (!selectedObj) {
            selectedObj = objects.find(o => o.type === 'lawn' || o.type === 'drip');
        }

        if (selectedObj) activeHandle = 'center';
        draw();
    }
});

// Rechtsklick: Punkt aus Fläche löschen
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (selectedObj && (selectedObj.type === 'lawn' || selectedObj.type === 'drip')) {
        const hitIdx = selectedObj.points.findIndex(p => Math.hypot(p.x - world.x, p.y - world.y) < (12 / scale));
        if (hitIdx !== -1 && selectedObj.points.length > 3) {
            selectedObj.points.splice(hitIdx, 1);
            draw();
        }
    }
});

function finishPolygon() {
    if (polygonPoints.length > 2) {
        const type = currentTool === 'draw-lawn' ? 'lawn' : 'drip';
        const newObj = { type: type, points: [...polygonPoints] };
        objects.push(newObj);
        selectedObj = newObj;
        polygonPoints = [];
        setTool('select');
    }
}

canvas.addEventListener('dblclick', finishPolygon);

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left, screenY = e.clientY - rect.top;

    if (isPanning) { offsetX = screenX - startPanX; offsetY = screenY - startPanY; draw(); return; }

    currentMouseWorld = toWorld(screenX, screenY);

    // Live-Update beim Zeichnen/Messen
    if (currentTool === 'scale' || currentTool === 'measure' || currentTool === 'draw-lawn' || currentTool === 'draw-drip') {
        draw();
    }

    if (!selectedObj || !activeHandle) return;

    if (activeHandle === 'node-point') {
        selectedObj.points[activeNodeIndex].x = currentMouseWorld.x;
        selectedObj.points[activeNodeIndex].y = currentMouseWorld.y;
        draw(); return;
    }

    if (activeHandle === 'curve-point') {
        selectedObj.points[activeNodeIndex].controlPoint = { x: currentMouseWorld.x, y: currentMouseWorld.y };
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

    // 1. Rasen/Tropfzonen & Einspeisepunkte zeichnen
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

        // Marker Handles
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

    // 4. Zeichne Maßstab-Ziehen-Linie
    if (currentTool === 'scale' && scaleStartPoint && currentMouseWorld) {
        ctx.beginPath();
        ctx.moveTo(scaleStartPoint.x, scaleStartPoint.y);
        ctx.lineTo(currentMouseWorld.x, currentMouseWorld.y);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3 / scale;
        ctx.stroke();
    }

    // 5. Zeichne Kontrollmessungs-Linie
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

// Beim Start auf gespeicherten Link prüfen
window.onload = () => {
    if (typeof importFromLink === 'function') {
        const loadedData = importFromLink();
        if (loadedData) {
            pixelsPerMeter = loadedData.ppm || 20;
            objects = loadedData.objs || [];
            document.getElementById('val-px-m').innerText = `${pixelsPerMeter.toFixed(1)} px/m`;
        }
    }
    draw();
};
