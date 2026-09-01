// Hunter Katalog-Berechnung
function getHunterModel(radius, arc) {
    const flowFactor = (arc / 360);
    if (radius <= 3.5) return { name: "Hunter MP1000", flow: 0.16 * flowFactor };
    if (radius <= 4.5) return { name: "Hunter MP2000", flow: 0.26 * flowFactor };
    return { name: "Hunter MP3000", flow: 0.48 * flowFactor };
}

// Berechnet die Anpack-Punkte (Gelb, Grün, Rot)
function getSprinklerHandles(s, pixelsPerMeter) {
    const rPx = s.radius * pixelsPerMeter;
    const startRad = (s.startAngle * Math.PI) / 180;
    const endRad = ((s.startAngle + s.arc) * Math.PI) / 180;
    const midRad = startRad + ((s.arc * Math.PI) / 360);

    return {
        startHandle: { x: s.x + Math.cos(startRad) * rPx, y: s.y + Math.sin(startRad) * rPx },
        endHandle: { x: s.x + Math.cos(endRad) * rPx, y: s.y + Math.sin(endRad) * rPx },
        radiusHandle: { x: s.x + Math.cos(midRad) * rPx, y: s.y + Math.sin(midRad) * rPx }
    };
}
