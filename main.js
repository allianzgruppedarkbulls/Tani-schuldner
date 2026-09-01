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

// Bild-Upload mit automatischer Skalierung & Zentrierung
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
            draw();
        };
        bgImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Toolbar Buttons
function setTool(tool) {
    currentTool = tool;
    polygonPoints = [];
    document.querySelectorAll('#toolbar button').forEach(b => b.classList.remove('active'));
    if(document.getElementById(`btn-${tool}`)) document.getElementById(`btn-${tool}`).classList.add('active');
    draw();
}

document.getElementById('btn-select').onclick = () => setTool('select');
document.getElementById('btn-draw-lawn').onclick = () => setTool('draw-lawn');
document.getElementById('btn-draw-drip').onclick = () => setTool('draw-drip');
document.getElementById('btn-add-sprinkler').onclick = () => setTool('add-sprinkler');
document.getElementById('btn-add-source').onclick = () => setTool('add-source');
document.getElementById('btn-share').onclick = () => exportToLink(objects, pixelsPerMeter);
document.getElementById('btn-delete').onclick = () => {
    if (selectedObj) {
        objects = objects.filter(o => o !== selectedObj);
        selectedObj = null;
        draw();
    }
};

// Canvas Mouse Interactions
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (spacePressed || e.button === 1) {
        isPanning = true; startPanX = e.clientX - offsetX; startPanY = e.clientY - offsetY;
        return;
    }

    if (currentTool === 'draw-lawn' || currentTool === 'draw-drip') {
        polygonPoints.push(world);
        draw(); return;
    }

    if (currentTool === 'add-sprinkler') {
        const model = getHunterModel(3.5, 180);
        const spr = { type: 'sprinkler', x: world.x, y: world.y, radius: 3.5, startAngle: 0, arc: 180, model: model.name, flow: model.flow };
        objects.push(spr); selectedObj = spr; setTool('select'); return;
    }

    if (currentTool === 'select') {
        activeHandle = null;

        // 1. Prüfe Klick auf Flächen-Knotenpunkte (Ecken verschieben)
        if (selectedObj && (selectedObj.type === 'lawn' || selectedObj.type === 'drip')) {
            const hitIdx = selectedObj.points.findIndex(p => Math.hypot(p.x - world.x, p.y - world.y) < (10 / scale));
            if (hitIdx !== -1) {
                activeHandle = 'node-point'; activeNodeIndex = hitIdx; return;
            }
            
            // 2. Prüfe Klick auf Biegungs-Marker
            const mids = getPolygonMidpoints(selectedObj.points);
            const midHit = mids.find(m => Math.hypot(m.x - world.x, m.y - world.y) < (10 / scale));
            if (midHit) {
                activeHandle = 'curve-point'; activeNodeIndex = midHit.index; return;
            }
        }

        // 3. Prüfe Klick auf Regner-Handles
        if (selectedObj && selectedObj.type === 'sprinkler') {
            const h = getSprinklerHandles(selectedObj, pixelsPerMeter);
            if (Math.hypot(h.startHandle.x - world.x, h.startHandle.y - world.y) < (12 / scale)) { activeHandle = 'start-angle'; return; }
            if (Math.hypot(h.endHandle.x - world.x, h.endHandle.y - world.y) < (12 / scale)) { activeHandle = 'end-angle'; return; }
            if (Math.hypot(h.radiusHandle.x - world.x, h.radiusHandle.y - world.y) < (12 / scale)) { activeHandle = 'radius'; return; }
        }

        // 4. Objekt-Auswahl
        selectedObj = objects.find(o => {
            if (o.type === 'sprinkler' || o.type === 'source') return Math.hypot(o.x - world.x, o.y - world.y) < (18 / scale);
            return false;
        });

        if (!selectedObj) {
            // Check Flächen-Klick
            selectedObj = objects.find(o => o.type === 'lawn' || o.type === 'drip');
        }

        if (selectedObj) activeHandle = 'center';
        draw();
    }
});

canvas.addEventListener('dblclick', () => {
    if (polygonPoints.length > 2) {
        const type = currentTool === 'draw-lawn' ? 'lawn' : 'drip';
        objects.push({ type: type, points: [...polygonPoints] });
        polygonPoints = [];
        setTool('select');
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left, screenY = e.clientY - rect.top;

    if (isPanning) { offsetX = screenX - startPanX; offsetY = screenY - startPanY; draw(); return; }

    const world = toWorld(screenX, screenY);
    if (!selectedObj || !activeHandle) return;

    if (activeHandle === 'node-point') {
        selectedObj.points[activeNodeIndex].x = world.x;
        selectedObj.points[activeNodeIndex].y = world.y;
        draw(); return;
    }

    if (activeHandle === 'curve-point') {
        selectedObj.points[activeNodeIndex].controlPoint = { x: world.x, y: world.y };
        draw(); return;
    }

    if (selectedObj.type === 'sprinkler') {
        const dx = world.x - selectedObj.x, dy = world.y - selectedObj.y;
        let mouseAngle = (Math.atan2(dy, dx) * 180 / Math.PI);
        if (mouseAngle < 0) mouseAngle += 360;

        if (activeHandle === 'center') { selectedObj.x = world.x; selectedObj.y = world.y; }
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

    // 1. Zeichne Rasen/Tropfzonen (inkl. Kurven)
    objects.filter(o => o.type === 'lawn' || o.type === 'drip').forEach(obj => {
        drawPolygonPath(ctx, obj.points);
        ctx.fillStyle = obj.type === 'lawn' ? 'rgba(46, 204, 113, 0.3)' : 'rgba(230, 126, 34, 0.3)';
        ctx.fill();
        ctx.strokeStyle = obj.type === 'lawn' ? '#2ecc71' : '#e67e22';
        ctx.lineWidth = 2 / scale;
        ctx.stroke();

        // Wenn ausgewählt: Anpack-Knotenpunkte & Biegungs-Marker zeichnen!
        if (obj === selectedObj) {
            obj.points.forEach(p => {
                ctx.beginPath(); ctx.arc(p.x, p.y, 6 / scale, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke();
            });

            const mids = getPolygonMidpoints(obj.points);
            mids.forEach(m => {
                ctx.beginPath(); ctx.arc(m.x, m.y, 5 / scale, 0, Math.PI * 2);
                ctx.fillStyle = '#f1c40f'; ctx.fill(); ctx.stroke();
            });
        }
    });

    // 2. Zeichne Regner
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

    // Aktueller Zeichen-Pfad
    if (polygonPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
        polygonPoints.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2 / scale;
        ctx.stroke();
    }

    ctx.restore();
}

// Beim Start auf gespeicherten Link prüfen
window.onload = () => {
    const loadedData = importFromLink();
    if (loadedData) {
        pixelsPerMeter = loadedData.ppm || 20;
        objects = loadedData.objs || [];
        document.getElementById('val-px-m').innerText = `${pixelsPerMeter.toFixed(1)} px/m`;
    }
    draw();
};
