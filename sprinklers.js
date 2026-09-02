// sprinklers.js - Rendering und Bearbeitung von Regnern (z.B. Hunter MP Rotator)

export function drawSprinkler(ctx, obj, scale, isSelected) {
    const r = (obj.radius || 5) * 20; // Beispiel: Skalierung auf Pixel (angenommen 20px pro Meter)
    const angle = obj.angle || 0;
    const arc = obj.arc || 90; // Öffnungswinkel in Grad

    ctx.save();
    ctx.translate(obj.x, obj.y);

    // 1. Sektor-Fächer zeichnen (Wurfsektor des MP Rotators)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r / scale, (angle * Math.PI) / 180, ((angle + arc) * Math.PI) / 180);
    ctx.closePath();
    ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.1)';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 / scale;
    ctx.stroke();

    // 2. Regner-Kopf (Mittelpunkt)
    ctx.beginPath();
    ctx.arc(0, 0, 6 / scale, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#1d4ed8' : '#3b82f6';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / scale;
    ctx.fill();
    ctx.stroke();

    // Beschriftung im Mittelpunkt: Name & Wasserbedarf
    ctx.fillStyle = '#ffffff';
    ctx.font = `${10 / scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(obj.name || 'Regner', 0, -10 / scale);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${obj.rate || 0} l/h`, 0, 16 / scale);

    // 3. Interaktive Griffpunkte bei Auswahl (Radius & Öffnungswinkel)
    if (isSelected) {
        // Linker Griffpunkt: Radius verändern (auf dem Außenkreis)
        const radiusHandleX = (r / scale) * Math.cos((angle * Math.PI) / 180);
        const radiusHandleY = (r / scale) * Math.sin((angle * Math.PI) / 180);
        
        ctx.beginPath();
        ctx.arc(radiusHandleX, radiusHandleY, 5 / scale, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.stroke();

        // Rechter Griffpunkt: Sektor / Winkel öffnen & schließen (am Ende des Bogen-Winkels)
        const arcHandleX = (r / scale) * Math.cos(((angle + arc) * Math.PI) / 180);
        const arcHandleY = (r / scale) * Math.sin(((angle + arc) * Math.PI) / 180);

        ctx.beginPath();
        ctx.arc(arcHandleX, arcHandleY, 5 / scale, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.stroke();
    }

    ctx.restore();
}
