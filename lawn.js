// js/lawn.js - Flächen (Rasen & Tropfzonen) + Tropfzonen-Berechnung

// Berechnet die Fläche eines Polygons in m²
function calculatePolygonArea(points, pixelsPerMeter) {
    if (points.length < 3) return 0;
    let areaPx = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        areaPx += points[i].x * points[j].y;
        areaPx -= points[j].x * points[i].y;
    }
    const areaM2 = Math.abs(areaPx / 2) / (pixelsPerMeter * pixelsPerMeter);
    return Math.round(areaM2 * 100) / 100;
}

// Tropfrohr-Berechnung für Tropfzonen (16mm)
function calculateDripRequirements(areaM2) {
    // Ca. 3.3 Meter Tropfrohr pro m² (30cm Reihenabstand)
    const pipeMeters = Math.ceil(areaM2 * 3.3);
    // Ca. 1 Einspeisung pro 40m Tropfrohr / max 100m²
    const feedPoints = Math.max(1, Math.ceil(pipeMeters / 40));
    // Wasserverbrauch ca. 2.3 l/h pro Tropfer bei 30cm Abstand (~7.6 l/h pro m²)
    const waterDemandLh = Math.round(areaM2 * 7.6);

    return {
        pipeMeters: pipeMeters,
        feedPoints: feedPoints,
        waterDemandLh: waterDemandLh
    };
}

// Hilfsfunktion: Mittenpunkte für Kurven/Biegungen
function getPolygonMidpoints(points) {
    const mids = [];
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const cp = p1.controlPoint || { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        mids.push({ index: i, x: cp.x, y: cp.y });
    }
    return mids;
}

// Pfad mit Bezier-Kurven zeichnen
function drawPolygonPath(ctx, points) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length; i++) {
        const next = points[(i + 1) % points.length];
        if (points[i].controlPoint) {
            ctx.quadraticCurveTo(points[i].controlPoint.x, points[i].controlPoint.y, next.x, next.y);
        } else {
            ctx.lineTo(next.x, next.y);
        }
    }
    ctx.closePath();
}

// Zeichnet Flächen inklusive Infoboxen und Handles
function drawPolygons(ctx, objects, scale, pixelsPerMeter, selectedObj) {
    objects.filter(o => o.type === 'lawn' || o.type === 'drip').forEach(obj => {
        drawPolygonPath(ctx, obj.points);
        
        ctx.fillStyle = obj.type === 'lawn' ? 'rgba(46, 204, 113, 0.35)' : 'rgba(230, 126, 34, 0.35)';
        ctx.fill();
        ctx.strokeStyle = obj.type === 'lawn' ? '#2ecc71' : '#e67e22';
        ctx.lineWidth = 2 / scale;
        ctx.stroke();

        const area = calculatePolygonArea(obj.points, pixelsPerMeter);
        obj.areaM2 = area;

        // Beschriftung in der Flächenmitte
        let cx = 0, cy = 0;
        obj.points.forEach(p => { cx += p.x; cy += p.y; });
        cx /= obj.points.length; cy /= obj.points.length;

        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.max(12, 14 / scale)}px sans-serif`;
        ctx.textAlign = "center";
        
        if (obj.type === 'drip') {
            const dripInfo = calculateDripRequirements(area);
            obj.dripInfo = dripInfo;
            ctx.fillText(`💧 Tropfzone: ${area} m²`, cx, cy);
            ctx.fillText(`(Rohr: ~${dripInfo.pipeMeters}m | Einspeisung: ${dripInfo.feedPoints}x)`, cx, cy + (18 / scale));
        } else {
            ctx.fillText(`🟩 Rasen: ${area} m²`, cx, cy);
        }

        // Anpack-Handles zeichnen, wenn ausgewählt
        if (obj === selectedObj) {
            // 1. Eckpunkte (Weiß)
            obj.points.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6 / scale, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1 / scale;
                ctx.stroke();
            });

            // 2. Biegungs-Kantenpunkte (Gelb)
            const mids = getPolygonMidpoints(obj.points);
            mids.forEach(m => {
                ctx.beginPath();
                ctx.arc(m.x, m.y, 5 / scale, 0, Math.PI * 2);
                ctx.fillStyle = '#f1c40f';
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1 / scale;
                ctx.stroke();
            });
        }
    });

    // Einspeisepunkte der Tropfzonen zeichnen
    objects.filter(o => o.type === 'drip-feed').forEach(feed => {
        ctx.beginPath();
        ctx.arc(feed.x, feed.y, 8 / scale, 0, Math.PI * 2);
        ctx.fillStyle = '#e67e22';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / scale;
        ctx.stroke();
        
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${10 / scale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("16mm", feed.x, feed.y + (3 / scale));
    });
}
