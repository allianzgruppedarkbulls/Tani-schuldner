// js/drip-renderer.js - Tropfzonen, 100m-Limit & Mäander-Berechnung
import { State } from './state.js';
import { getLinePolygonIntersections } from './geometry.js';

export function renderDripZone(ctx, obj, scale) {
    // Äußere Umrandung
    ctx.strokeStyle = obj === State.selectedObj ? '#f97316' : '#c2410c';
    ctx.lineWidth = (obj === State.selectedObj ? 3 : 2) / scale;
    ctx.stroke();

    let cx = obj.points.reduce((sum, p) => sum + p.x, 0) / obj.points.length;
    let cy = obj.points.reduce((sum, p) => sum + p.y, 0) / obj.points.length;
    
    ctx.save();
    ctx.translate(cx, cy);
    let angleRad = (obj.rotationAngle || 0) * Math.PI / 180;
    ctx.rotate(angleRad);
    ctx.translate(-cx, -cy);

    let cos = Math.cos(-angleRad), sin = Math.sin(-angleRad);
    let rotPoints = obj.points.map(p => ({
        x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
        y: cy + (p.x - cx) * sin + (p.y - cy) * cos
    }));

    let minRotY = Math.min(...rotPoints.map(p => p.y));
    let maxRotY = Math.max(...rotPoints.map(p => p.y));
    let minRotX = Math.min(...rotPoints.map(p => p.x));
    let maxRotX = Math.max(...rotPoints.map(p => p.x));

    const spacingPx = (obj.dripDistance || 33) * (State.pixelsPerMeter / 100) * 1.5;
    const edgeInset = State.pixelsPerMeter * 0.25; // ca. 25cm Abstand zum Rand

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8 / scale;
    ctx.beginPath();

    let rows = [];
    for (let y = minRotY + edgeInset; y <= maxRotY - edgeInset; y += spacingPx) {
        let p1 = { x: minRotX - 100, y: y };
        let p2 = { x: maxRotX + 100, y: y };
        let xCoords = getLinePolygonIntersections(p1, p2, rotPoints);

        if (xCoords.length >= 2) {
            let startX = xCoords[0] + edgeInset;
            let endX = xCoords[xCoords.length - 1] - edgeInset;
            if (startX < endX) {
                rows.push({ y: y, startX: startX, endX: endX });
            }
        }
    }

    // 100-Meter-Limit Prüfung & Schlauchmeter-Berechnung
    let totalLengthPx = 0;
    if (obj.layoutMode === 'loop' && rows.length > 0) {
        for (let i = 0; i < rows.length; i++) {
            let r = rows[i];
            let rowLen = r.endX - r.startX;
            totalLengthPx += rowLen;
            if (i < rows.length - 1) {
                let nextY = rows[i+1].y;
                totalLengthPx += (Math.PI * (nextY - r.y)) / 2; // Bogenlänge
            }

            if (i % 2 === 0) {
                ctx.moveTo(r.startX, r.y);
                ctx.lineTo(r.endX, r.y);
                if (i < rows.length - 1) {
                    let nextY = rows[i+1].y;
                    ctx.arc(r.endX, (r.y + nextY)/2, (nextY - r.y)/2, -Math.PI/2, Math.PI/2, false);
                }
            } else {
                ctx.moveTo(r.endX, r.y);
                ctx.lineTo(r.startX, r.y);
                if (i < rows.length - 1) {
                    let nextY = rows[i+1].y;
                    ctx.arc(r.startX, (r.y + nextY)/2, (nextY - r.y)/2, Math.PI/2, 3*Math.PI/2, false);
                }
            }
        }
    } else if (obj.layoutMode === 'frame') {
        let frameMinX = Math.min(...rows.map(r => r.startX), 0) - 10/scale;
        let frameMaxX = Math.max(...rows.map(r => r.endX), 0) + 10/scale;
        let frameMinY = rows.length > 0 ? rows[0].y - 10/scale : minRotY;
        let frameMaxY = rows.length > 0 ? rows[rows.length-1].y + 10/scale : maxRotY;

        ctx.strokeRect(frameMinX, frameMinY, frameMaxX - frameMinX, frameMaxY - frameMinY);
        totalLengthPx += 2 * ((frameMaxX - frameMinX) + (frameMaxY - frameMinY));

        rows.forEach(r => {
            let rowLen = r.endX - r.startX;
            totalLengthPx += rowLen;
            ctx.moveTo(r.startX, r.y);
            ctx.lineTo(r.endX, r.y);
            ctx.moveTo(r.startX - 3/scale, r.y - 3/scale); ctx.lineTo(r.startX + 3/scale, r.y + 3/scale);
            ctx.moveTo(r.endX - 3/scale, r.y - 3/scale); ctx.lineTo(r.endX + 3/scale, r.y + 3/scale);
        });
    }

    ctx.stroke();
    ctx.restore();

    // Metadaten für Sidebar speichern
    obj.calculatedMeters = Math.round(totalLengthPx / State.pixelsPerMeter * 10) / 10;
    obj.circuitCount = Math.ceil(obj.calculatedMeters / 100); // Max 100m pro Kreis!
}
