// sprinklers.js - Maßstabsgetreues Rendering von Regnern (Hunter MP Rotators)

export function drawSprinkler(ctx, obj, scale, pixelsPerMeter, isSelected) {
    // obj.radius ist der echte Wurfweiten-Radius in Metern (z.B. 4.5 Meter)
    // Multipliziert mit pixelsPerMeter ergibt das die exakten Pixel auf dem Plan
    const radiusMeters = obj.radius || 3.5; 
    const rPx = radiusMeters * pixelsPerMeter;
    
    const angle = obj.angle || 0;
    const arc = obj.arc || 90; // Sektor in Grad (z.B. 90, 180, 360)

    ctx.save();
    ctx.translate(obj.x, obj.y);

    // 1. Wurfsektor / Beregnungsfläche (skaliert maßstabsgetreu mit dem Zoom)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, rPx, (angle * Math.PI) / 180, ((angle + arc) * Math.PI) / 180);
    ctx.closePath();
    ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5 / scale;
    ctx.stroke();

    // 2. Regner-Kopf im Zentrum (Skalierung angepasst, damit er zoombar bleibt aber handlich ist)
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(4, 7 / scale), 0, Math.PI * 2);
    ctx.fillStyle = obj.model?.includes('MP3000') ? '#38bdf8' : (obj.model?.includes('MP2000') ? '#f97316' : '#22c55e');
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / scale;
    ctx.fill();
    ctx.stroke();

    // Text-Labels im Zentrum (Modellname & Wasserbedarf)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${11 / scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(obj.model || 'MP1000H', 0, -12 / scale);
    
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `${9 / scale}px sans-serif`;
    ctx.fillText(`${obj.rate || 0.1} m³/h`, 0, 16 / scale);

    // 3. Interaktive Griffpunkte bei Auswahl
    if (isSelected) {
        // Äußerer Griffpunkt zur Radius- / Wurfweiten-Anpassung
        const handleX = rPx * Math.cos(((angle + arc / 2) * Math.PI) / 180);
        const handleY = rPx * Math.sin(((angle + arc / 2) * Math.PI) / 180);

        ctx.beginPath();
        ctx.arc(handleX, handleY, 6 / scale, 0, Math.PI * 2);
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / scale;
        ctx.fill();
        ctx.stroke();
    }

    ctx.restore();
}
