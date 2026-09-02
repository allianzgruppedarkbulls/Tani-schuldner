// drip-renderer.js - Rendering-Logik für Tropfzonen (Mäander & Rahmen)

export function drawDripZone(ctx, obj, scale, pixelsPerMeter, isSelected) {
    if (!obj.points || obj.points.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(obj.points[0].x, obj.points[0].y);
    obj.points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();

    ctx.fillStyle = isSelected ? 'rgba(249, 115, 22, 0.45)' : 'rgba(249, 115, 22, 0.25)';
    ctx.fill();

    // Äußere Umrandung der Tropfzone
    ctx.strokeStyle = isSelected ? '#f97316' : '#c2410c';
    ctx.lineWidth = (isSelected ? 3 : 2) / scale;
    ctx.stroke();

    // Innenlayout (Schleife / Mäander oder durchgezeichneter Rahmen)
    ctx.save();
    let cx = obj.points.reduce((sum, p) => sum + p.x, 0) / obj.points.length;
    let cy = obj.points.reduce((sum, p) => sum + p.y, 0) / obj.points.length;
    
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

    const spacingPx = (obj.dripDistance || 33) * (pixelsPerMeter / 100) * 1.5;
    const edgeInset = pixelsPerMeter * 0.25;

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

    if (obj.layoutMode === 'loop' && rows.length > 0) {
        // Echte Endlos-Schleife (Mäander)
        for (let i = 0; i < rows.length; i++) {
            let r = rows[i];
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
        // Umlaufender Rahmen + Parallelen
        let frameMinX = Math.min(...rows.map(r => r.startX)) - 10/scale;
        let frameMaxX = Math.max(...rows.map(r => r.endX)) + 10/scale;
        let frameMinY = rows.length > 0 ? rows[0].y - 10/scale : minRotY;
        let frameMaxY = rows.length > 0 ? rows[rows.length-1].y + 10/scale : maxRotY;

        ctx.strokeRect(frameMinX, frameMinY, frameMaxX - frameMinX, frameMaxY - frameMinY);

        rows.forEach(r => {
            ctx.moveTo(r.startX, r.y);
            ctx.lineTo(r.endX, r.y);
            ctx.moveTo(r.startX - 3/scale, r.y - 3/scale); ctx.lineTo(r.startX + 3/scale, r.y + 3/scale);
            ctx.moveTo(r.endX - 3/scale, r.y - 3/scale); ctx.lineTo(r.endX + 3/scale, r.y + 3/scale);
        });
    }

    ctx.stroke();
    ctx.restore();
}

function getLinePolygonIntersections(p1, p2, polygon) {
    let intersections = [];
    for (let i = 0; i < polygon.length; i++) {
        let p3 = polygon[i];
        let p4 = polygon[(i + 1) % polygon.length];
        let pt = getIntersection(p1, p2, p3, p4);
        if (pt) intersections.push(pt.x);
    }
    intersections.sort((a, b) => a - b);
    return intersections.filter((val, index, arr) => index === 0 || Math.abs(val - arr[index - 1]) > 0.5);
}

function getIntersection(p1, p2, p3, p4) {
    let denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denom === 0) return null;
    let ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    let ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return { x: p1.x + ua * (p2.x - p1.x), y: p1.y + ua * (p2.y - p1.y) };
    }
    return null;
}
