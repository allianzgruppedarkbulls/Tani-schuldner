// js/pipes.js - Rohrnetz & Hydraulik-Berechnung

// Spezifischer Widerstand für Standard-PE-Rohre (Bar-Verlust pro Meter bei 1 m³/h)
const PIPE_TYPES = {
    'pe25': { name: "PE-Rohr 25mm (3/4\")", innerDiaMm: 20.4, maxFlow: 1.8 },
    'pe32': { name: "PE-Rohr 32mm (1\")", innerDiaMm: 26.2, maxFlow: 3.2 }
};

// Berechnet den Druckverlust nach der Hazen-Williams-Formel (Näherung für Wasserleitung)
function calculatePressureDrop(lengthMeters, flowRateM3h, innerDiaMm) {
    if (lengthMeters <= 0 || flowRateM3h <= 0) return 0;
    
    // Umrechnung m³/h in l/min
    const flowLmin = flowRateM3h * 16.667;
    
    // Druckverlust in bar (Formel-Appoximation für PE-Rohr)
    const drop = 0.00001 * Math.pow(flowLmin, 1.75) / Math.pow(innerDiaMm / 10, 4.75) * lengthMeters;
    return Math.round(drop * 100) / 100; // Gerundet auf 2 Nachkommastellen
}

// Berechnet die Gesamtlänge eines Rohrpfads
function getPipeLength(points, pixelsPerMeter) {
    let totalPx = 0;
    for (let i = 0; i < points.length - 1; i++) {
        totalPx += Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y);
    }
    return totalPx / pixelsPerMeter;
}

// Zeichnet alle Rohre auf das Canvas
function drawPipes(ctx, objects, scale, pixelsPerMeter, selectedObj) {
    objects.filter(o => o.type === 'pipe').forEach(pipe => {
        if (pipe.points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(pipe.points[0].x, pipe.points[0].y);
        for (let i = 1; i < pipe.points.length; i++) {
            ctx.lineTo(pipe.points[i].x, pipe.points[i].y);
        }

        ctx.strokeStyle = pipe === selectedObj ? '#00fbff' : '#3498db';
        ctx.lineWidth = (pipe.pipeType === 'pe32' ? 5 : 3) / scale;
        ctx.setLineDash([6 / scale, 3 / scale]); // Gestrichelte Linie für Rohre
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // Anpack-Punkte bei Auswahl
        if (pipe === selectedObj) {
            pipe.points.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5 / scale, 0, Math.PI * 2);
                ctx.fillStyle = '#00fbff';
                ctx.fill();
            });
        }
    });
}
