// pipes.js - Verwaltung und Rendering von Rohrleitungen

function createPipe(points) {
    return {
        type: 'pipe',
        points: [...points],
        diameter: 25, // mm
        locked: false
    };
}

function drawPipe(ctx, obj, scale, isSelected) {
    if (!obj.points || obj.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(obj.points[0].x, obj.points[0].y);
    for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(obj.points[i].x, obj.points[i].y);
    }
    ctx.strokeStyle = isSelected ? '#f59e0b' : '#38bdf8';
    ctx.lineWidth = (isSelected ? 4 : 3) / scale;
    ctx.stroke();

    // Eckpunkte anzeigen bei Auswahl
    if (isSelected) {
        obj.points.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5 / scale, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2 / scale;
            ctx.fill();
            ctx.stroke();
        });
    }
}

function getPipeSidebarHTML(obj) {
    const lengthMeters = calculatePipeLength(obj.points);
    return `
        <div style="padding: 15px; color: #fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="color: #38bdf8; margin:0;">🛠️ Rohrleitung</h3>
                <button onclick="deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
            </div>
            <p style="font-size:12px; color:#94a3b8; margin-bottom:10px;">Gesamtlänge: approx. ${lengthMeters} m</p>
            
            <label style="display:block; margin-top:8px; font-size:12px; color:#94a3b8;">Rohr-Durchmesser (mm):</label>
            <select id="pipe-diameter" onchange="updatePipeProp('diameter', this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                <option value="20" ${obj.diameter == 20 ? 'selected' : ''}>20 mm</option>
                <option value="25" ${obj.diameter == 25 ? 'selected' : ''}>25 mm</option>
                <option value="32" ${obj.diameter == 32 ? 'selected' : ''}>32 mm</option>
            </select>
        </div>`;
}

function calculatePipeLength(points) {
    if (!points || points.length < 2) return 0;
    let totalPx = 0;
    for (let i = 1; i < points.length; i++) {
        totalPx += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
    }
    const pxm = typeof pixelsPerMeter !== 'undefined' ? pixelsPerMeter : 20;
    return Math.round((totalPx / pxm) * 100) / 100;
}

function updatePipeProp(prop, val) {
    if (selectedObj && selectedObj.type === 'pipe') {
        selectedObj[prop] = val;
        draw();
    }
}
