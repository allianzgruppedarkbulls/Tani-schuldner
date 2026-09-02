// js/geometry.js - Geometrie, Flächen, Snapping & Schlösser
import { State } from './state.js';

export function calculatePolygonArea(pts, pxm) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
        let j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
    }
    return Math.round(Math.abs(area / 2.0) / (pxm * pxm) * 100) / 100;
}

export function isPointInPolygon(point, vs) {
    let x = point.x, y = point.y, inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y, xj = vs[j].x, yj = vs[j].y;
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

// Snapping: Prüft, ob ein Punkt nahe an einem bestehenden Eckpunkt liegt
export function getSnappedPoint(worldPt, snapRadius = 15) {
    const threshold = snapRadius / State.scale;
    for (let obj of State.objects) {
        if (!obj.points) continue;
        for (let pt of obj.points) {
            if (Math.hypot(worldPt.x - pt.x, worldPt.y - pt.y) < threshold) {
                return { x: pt.x, y: pt.y };
            }
        }
    }
    return worldPt;
}

// Schnittpunktprüfung für Linien & Polygone (für Mäander)
export function getLinePolygonIntersections(p1, p2, polygon) {
    let intersections = [];
    for (let i = 0; i < polygon.length; i++) {
        let p3 = polygon[i];
        let p4 = polygon[(i + 1) % polygon.length];
        let pt = getSegmentIntersection(p1, p2, p3, p4);
        if (pt) intersections.push(pt.x);
    }
    intersections.sort((a, b) => a - b);
    return intersections.filter((val, index, arr) => index === 0 || Math.abs(val - arr[index - 1]) > 0.5);
}

function getSegmentIntersection(p1, p2, p3, p4) {
    let denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denom === 0) return null;
    let ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    let ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return { x: p1.x + ua * (p2.x - p1.x), y: p1.y + ua * (p2.y - p1.y) };
    }
    return null;
}
