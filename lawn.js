// lawn.js - Flächen mit Kantenbemaßung & schraffierten Zwischenpunkten

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

function calculateDripRequirements(areaM2) {
    const pipeMeters = Math.ceil(areaM2 * 3.3);
    const feedPoints = Math.max(1, Math.ceil(pipeMeters / 40));
    const waterDemandLh = Math.round(areaM2 * 7.6);
    return { pipeMeters, feedPoints, waterDemandLh };
}

// Erstellt schraffierte/halbtransparente Plus-Punkte auf den Kanten zum Einfügen neuer Punkte
function getEdgeAddPoints(points) {
    const addPoints = [];
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        addPoints.push({
            index: i + 1, // Einfüge-Index
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        });
    }
    return addPoints;
}

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

        // 1. Kantenlängen (Abstände zwischen jedem Punkt) anzeigen
        for (let i = 0; i < obj.points.length; i++) {
            const p1 = obj.points[i];
            const p2 = obj.points[(i + 1) % obj.points.length];
            const distPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const distM = (distPx / pixelsPerMeter).toFixed(2);

            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2 / scale;
            ctx.font = `bold ${Math.max(10, 11 / scale)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.strokeText(`${distM} m`, midX, midY - (6 / scale));
            ctx.fillText(`${distM} m`, midX, midY - (6 / scale));
        }

        // 2. Beschriftung in der Mitte
        let cx = 0, cy = 0;
        obj.points.forEach(p => { cx += p.x; cy += p.y; });
        cx /= obj.points.length; cy /= obj.points.length;

        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.max(12, 14 / scale)}px sans-serif`;
        ctx.textAlign = "center";
        
        if (obj.type === 'drip') {
            const dripInfo = calculateDripRequirements(area);
            obj.dripInfo = dripInfo;
            ctx.fillText(`💧 Tropfzone: ${area} m²`, cx, cy);
            ctx.fillText(`(Rohr: ~${dripInfo.pipeMeters}m | Einspeisung: ${dripInfo.feedPoints}x)`, cx, cy + (16 / scale));
        } else {
            ctx.fillText(`🟩 Rasen: ${area} m²`, cx, cy);
        }

        // 3. Editier-Handles (wenn ausgewählt)
        if (obj === selectedObj) {
            // Eckpunkte (Weiß)
            obj.points.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6 / scale, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff'; ctx.fill();
                ctx.strokeStyle = '#000000'; ctx.lineWidth = 1 / scale; ctx.stroke();
            });

            // Schraffierte / Inaktive Zwischenpunkte (+) zum Punkte-Hinzufügen
            const addPoints = getEdgeAddPoints(obj.points);
            addPoints.forEach(ap => {
                ctx.beginPath();
                ctx.arc(ap.x, ap.y, 5 / scale, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fill();
                ctx.strokeStyle = '#2c3e50';
                ctx.lineWidth = 1 / scale;
                ctx.setLineDash([2 / scale, 2 / scale]);
                ctx.stroke();
                ctx.setLineDash([]); // Reset LineDash

                // Das Plus-Zeichen
                ctx.fillStyle = '#2c3e50';
                ctx.font = `bold ${10 / scale}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('+', ap.x, ap.y);
            });
        }
    });

    // Einspeisepunkte zeichnen
    objects.filter(o => o.type === 'drip-feed').forEach(feed => {
        ctx.beginPath();
        ctx.arc(feed.x, feed.y, 8 / scale, 0, Math.PI * 2);
        ctx.fillStyle = '#e67e22'; ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 / scale; ctx.stroke();
        
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${10 / scale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = 'alphabetic';
        ctx.fillText("16mm", feed.x, feed.y + (3 / scale));
    });
}
