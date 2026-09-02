// lawn.js - Verwaltung und Rendering von Rasenflächen und Totzonen

export function createLawn(points, type = 'lawn') {
    return {
        type: type, // 'lawn' oder 'deadzone'
        points: [...points],
        locked: false
    };
}

export function drawLawn(ctx, obj, scale, pixelsPerMeter, isSelected) {
    if (!obj.points || obj.points.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(obj.points[0].x, obj.points[0].y);
    obj.points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();

    if (obj.type === 'deadzone') {
        ctx.fillStyle = isSelected ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.2)';
        ctx.strokeStyle = '#ef4444';
    } else {
        ctx.fillStyle = isSelected ? 'rgba(34, 197, 94, 0.35)' : 'rgba(34, 197, 94, 0.15)';
        ctx.strokeStyle = '#22c55e';
    }

    ctx.fill();
    ctx.lineWidth = (isSelected ? 3 : 1.5) / scale;
    ctx.stroke();

    // Eckpunkte bei Auswahl anzeigen
    if (isSelected) {
        obj.points.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = obj.type === 'deadzone' ? '#ef4444' : '#22c55e';
            ctx.lineWidth = 2 / scale;
            ctx.fill();
            ctx.stroke();
        });
    }
}

export function calculatePolygonArea(points, pixelsPerMeter) {
    if (!points || points.length < 3) return 0;
    let areaPx = 0;
    for (let i = 0; i < points.length; i++) {
        let j = (i + 1) % points.length;
        areaPx += points[i].x * points[j].y;
        areaPx -= points[j].x * points[i].y;
    }
    areaPx = Math.abs(areaPx) / 2;
    const pxm2 = pixelsPerMeter * pixelsPerMeter;
    return Math.round((areaPx / pxm2) * 100) / 100;
}

export function getLawnSidebarHTML(obj, pixelsPerMeter) {
    const areaM2 = calculatePolygonArea(obj.points, pixelsPerMeter);
    const title = obj.type === 'deadzone' ? '🚫 Totzone / Ausschluss' : '🌱 Rasenfläche';
    const color = obj.type === 'deadzone' ? '#ef4444' : '#22c55e';

    return `
        <div style="padding: 15px; color: #fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="color: ${color}; margin:0;">${title}</h3>
                <button onclick="deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
            </div>
            <p style="font-size:12px; color:#94a3b8; margin-bottom:10px;">Fläche: <b>${areaM2} m²</b></p>
            
            <button onclick="toggleLawnType()" style="width:100%; padding:8px; background:#334155; color:#fff; border:1px solid #475569; border-radius:4px; cursor:pointer; font-size:12px;">
                Typ wechseln (${obj.type === 'deadzone' ? 'Zu Rasen' : 'Zu Totzone'})
            </button>
        </div>`;
}

export function toggleLawnType() {
    if (selectedObj && (selectedObj.type === 'lawn' || selectedObj.type === 'deadzone')) {
        selectedObj.type = selectedObj.type === 'lawn' ? 'deadzone' : 'lawn';
        draw();
        openSidebar(selectedObj);
    }
}
