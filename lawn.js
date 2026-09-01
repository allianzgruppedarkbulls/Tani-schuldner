// Berechnet Mittenpunkte zwischen zwei Punkten für Biegungen
function getPolygonMidpoints(points) {
    const mids = [];
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        // Falls Biegung existiert, nimm diese, sonst exakte Mitte
        const cp = p1.controlPoint || { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        mids.push({ index: i, x: cp.x, y: cp.y });
    }
    return mids;
}

// Zeichnet Flächen mit Bezier-Kurven für Biegungen
function drawPolygonPath(ctx, points) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length; i++) {
        const next = points[(i + 1) % points.length];
        if (points[i].controlPoint) {
            // Quadratische Bezier-Kurve zeichnen
            ctx.quadraticCurveTo(points[i].controlPoint.x, points[i].controlPoint.y, next.x, next.y);
        } else {
            ctx.lineTo(next.x, next.y);
        }
    }
    ctx.closePath();
}
