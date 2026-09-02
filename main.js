// main.js - CAD Hauptsteuerung & Event-Handling
import { State } from './state.js';
import { updateSidebar } from './sidebar.js';
import { drawLawn, calculatePolygonArea } from './lawn.js';
import { drawPipe } from './pipes.js';
import { drawSprinkler } from './sprinklers.js';
import { drawDripZone } from './drip-renderer.js';


const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

let width = container.clientWidth;
let height = container.clientHeight;
canvas.width = width; 
canvas.height = height;

let scale = 1.0, offsetX = 0, offsetY = 0;
let isPanning = false, startPanX = 0, startPanY = 0, spacePressed = false;
let polygonPoints = [];
let pipePoints = [];
let currentMouseWorld = null;
let activeHandleIndex = -1;
let scaleStartPoint = null;

function toWorld(sX, sY) {
    return { x: (sX - offsetX) / scale, y: (sY - offsetY) / scale };
}

// Globale Fenster-Funktionen für HTML/Sidebar-Event-Handler
window.selectObjectByIndex = function(index) {
    if (State.objects[index]) {
        State.selectedObj = State.objects[index];
        activeHandleIndex = -1;
        updateSidebar(State.selectedObj);
        draw();
    }
};

window.deselectCurrent = function() {
    State.selectedObj = null;
    activeHandleIndex = -1;
    updateSidebar(null);
    draw();
};

window.toggleLockSelected = function() {
    if (State.selectedObj) {
        State.selectedObj.locked = !State.selectedObj.locked;
        updateSidebar(State.selectedObj);
        draw();
    }
};

window.updateSystemMeta = function(prop, val) {
    State.systemMeta[prop] = val;
    updateSidebar(State.selectedObj);
    draw();
};

window.changeDripLayoutMode = function(mode) {
    if (State.selectedObj && State.selectedObj.type === 'drip') {
        State.selectedObj.layoutMode = mode;
        draw();
    }
};

window.changeDripDistance = function(dist) {
    if (State.selectedObj && State.selectedObj.type === 'drip') {
        State.selectedObj.dripDistance = parseFloat(dist);
        draw();
    }
};

// Event-Listener Tastatur
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') spacePressed = true;
    if (e.key === 'Escape') {
        window.deselectCurrent();
        polygonPoints = [];
        pipePoints = [];
        draw();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') spacePressed = false;
});

// Zoom per Mausrad
container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const mX = e.clientX - container.getBoundingClientRect().left;
    const mY = e.clientY - container.getBoundingClientRect().top;
    offsetX = mX - (mX - offsetX) * factor;
    offsetY = mY - (mY - offsetY) * factor;
    scale *= factor;
    const zoomEl = document.getElementById('val-zoom');
    if (zoomEl) zoomEl.innerText = `${Math.round(scale * 100)}%`;
    draw();
});

// Hintergrundbild Upload
document.getElementById('img-upload')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            State.backgroundImg = img;
            const scaleX = (width * 0.8) / img.width;
            const scaleY = (height * 0.8) / img.height;
            scale = Math.min(scaleX, scaleY);
            offsetX = (width - img.width * scale) / 2;
            offsetY = (height - img.height * scale) / 2;
            setTool('scale');
            draw();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Werkzeug-Auswahl
function setTool(tool) {
    State.currentTool = tool;
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
bindBtn('btn-draw-lawn', 'draw-lawn');
bindBtn('btn-draw-drip', 'draw-drip');
bindBtn('btn-draw-deadzone', 'draw-deadzone');
bindBtn('btn-add-source', 'add-source');
bindBtn('btn-add-sprinkler', 'add-sprinkler');
bindBtn('btn-draw-pipe', 'draw-pipe');

const deleteBtn = document.getElementById('btn-delete');
if (deleteBtn) {
    deleteBtn.onclick = () => {
        if (State.selectedObj) {
            State.objects = State.objects.filter(o => o !== State.selectedObj);
            window.deselectCurrent();
        }
    };
}

// Maßstab aktualisieren
function updatePixelsPerMeter(newPxM) {
    State.pixelsPerMeter = newPxM;
    const pxmEl = document.getElementById('val-px-m');
    if (pxmEl) pxmEl.innerText = `${State.pixelsPerMeter.toFixed(1)} px/m`;
    
    State.objects.forEach(obj => {
        if ((obj.type === 'lawn' || obj.type === 'drip' || obj.type === 'deadzone') && obj.points) {
            obj.areaM2 = calculatePolygonArea(obj.points, State.pixelsPerMeter);
        }
    });
    updateSidebar(State.selectedObj);
    draw();
}


// Maus-Events auf Canvas
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const rect = canvas.getBoundingClientRect();
    let world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (spacePressed || e.button === 1) {
        isPanning = true; 
        startPanX = e.clientX - offsetX; 
        startPanY = e.clientY - offsetY;
        return;
    }

    // 1. Maßstab-Tool
    if (State.currentTool === 'scale') {
        if (!scaleStartPoint) {
            scaleStartPoint = world;
        } else {
            const distPx = Math.hypot(world.x - scaleStartPoint.x, world.y - scaleStartPoint.y);
            const inputMeters = prompt("Strecke in Metern:", "5");
            if (inputMeters && !isNaN(parseFloat(inputMeters)) && parseFloat(inputMeters) > 0) {
                updatePixelsPerMeter(distPx / parseFloat(inputMeters));
            }
            scaleStartPoint = null;
            setTool('select');
        }
        draw();
        return;
    }

    // 2. Flächen zeichnen (Lawn, Drip, Deadzone)
    if (State.currentTool === 'draw-lawn' || State.currentTool === 'draw-drip' || State.currentTool === 'draw-deadzone') {
        const snapRadius = 15 / scale;
        for (let obj of State.objects) {
            if (obj.points) {
                for (let pt of obj.points) {
                    if (Math.hypot(world.x - pt.x, world.y - pt.y) < snapRadius) {
                        world = { x: pt.x, y: pt.y };
                        break;
                    }
                }
            }
        }

        if (polygonPoints.length > 2 && Math.hypot(world.x - polygonPoints[0].x, world.y - polygonPoints[0].y) < snapRadius) {
            finishPolygon();
            return;
        }
        polygonPoints.push(world);
        draw();
        return;
    }

    // 3. Bauteile setzen (Wasserquelle, Regner)
    if (State.currentTool === 'add-source' || State.currentTool === 'add-sprinkler') {
        const newObj = {
            type: State.currentTool === 'add-source' ? 'source' : 'sprinkler',
            x: world.x,
            y: world.y,
            name: State.currentTool === 'add-source' ? 'Hauptanschluss' : 'Regner 1',
            radius: 5,
            rate: 540,
            locked: false
        };
        State.objects.push(newObj);
        State.selectedObj = newObj;
        updateSidebar(State.selectedObj);
        setTool('select');
        draw();
        return;
    }

    // 4. Rohrleitungen verlegen
    if (State.currentTool === 'draw-pipe') {
        pipePoints.push(world);
        if (pipePoints.length >= 2) {
            State.objects.push({
                type: 'pipe',
                points: [...pipePoints],
                diameter: 25,
                locked: false
            });
            pipePoints = [world];
        }
        draw();
        return;
    }

    // 5. Auswahl & Verschieben
    if (State.currentTool === 'select') {
        if (State.selectedObj && State.selectedObj.points && !State.selectedObj.locked) {
            const handleRadius = 12 / scale;
            for (let i = 0; i < State.selectedObj.points.length; i++) {
                if (Math.hypot(world.x - State.selectedObj.points[i].x, world.y - State.selectedObj.points[i].y) < handleRadius) {
                    activeHandleIndex = i;
                    return;
                }
            }
        }

        State.selectedObj = State.objects.slice().reverse().find(o => o.points && isPointInPolygon(world, o.points)) || 
                            State.objects.slice().reverse().find(o => (o.type === 'source' || o.type === 'sprinkler') ? Math.hypot(world.x - o.x, world.y - o.y) < 15/scale : false) || null;
        activeHandleIndex = -1;
        updateSidebar(State.selectedObj);
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
        if (State.currentTool === 'draw-drip') type = 'drip';
        if (State.currentTool === 'draw-deadzone') type = 'deadzone';

        const newObj = {
            type,
            points: [...polygonPoints],
            dripDistance: 33,
            layoutMode: 'loop',
            rotationAngle: 0,
            locked: false,
            areaM2: calculatePolygonArea(polygonPoints, State.pixelsPerMeter)
        };
        State.objects.push(newObj);
        State.selectedObj = newObj;
        polygonPoints = [];
        updateSidebar(State.selectedObj);
        setTool('select');
    }
}

canvas.addEventListener('dblclick', () => {
    if (State.currentTool === 'draw-lawn' || State.currentTool === 'draw-drip' || State.currentTool === 'draw-deadzone') {
        finishPolygon();
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    let world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (isPanning) {
        offsetX = (e.clientX - rect.left) - startPanX;
        offsetY = (e.clientY - rect.top) - startPanY;
        draw();
        return;
    }

    if (activeHandleIndex !== -1 && State.selectedObj && State.selectedObj.points && !State.selectedObj.locked) {
        State.selectedObj.points[activeHandleIndex] = world;
        State.selectedObj.areaM2 = calculatePolygonArea(State.selectedObj.points, State.pixelsPerMeter);
        updateSidebar(State.selectedObj);
        draw();
        return;
    }

    currentMouseWorld = world;
    if (State.currentTool !== 'select') draw();
});

canvas.addEventListener('mouseup', () => {
    isPanning = false;
    activeHandleIndex = -1;
});

// Haupt-Zeichenschleife
function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (State.backgroundImg) {
        ctx.drawImage(State.backgroundImg, 0, 0);
    }

    State.objects.forEach(obj => {
        const isSelected = (obj === State.selectedObj);
        if (obj.type === 'lawn' || obj.type === 'deadzone') {
            drawLawn(ctx, obj, scale, State.pixelsPerMeter, isSelected);
        } else if (obj.type === 'drip') {
            drawDripZone(ctx, obj, scale, State.pixelsPerMeter, isSelected);
        } else if (obj.type === 'sprinkler') {
            drawSprinkler(ctx, obj, scale, State.pixelsPerMeter, isSelected);
        } else if (obj.type === 'pipe') {
            drawPipe(ctx, obj, scale, isSelected);
        } else if (obj.type === 'source') {
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, 8 / scale, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / scale;
            ctx.fill();
            ctx.stroke();
        }
    });

    // Aktives Polygon beim Zeichnen
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

window.onload = () => {
    updateSidebar(null);
    draw();
};
