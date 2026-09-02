// sprinklers.js - Verwaltung und Rendering von Regnern

function createSprinkler(x, y, name = 'Regner') {
    return {
        type: 'sprinkler',
        x: x,
        y: y,
        name: name,
        radius: 5, // Wurfweite in Metern (Standard)
        rate: 540,  // Liter pro Stunde
        locked: false
    };
}

export function drawSprinkler(ctx, obj, scale, isSelected) {
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, 8 / scale, 0, Math.PI * 2);
    ctx.fillStyle = '#eab308';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / scale;
    ctx.fill();
    ctx.stroke();

    // Wurfweiten-Kreis bei Auswahl anzeigen (unter Berücksichtigung des Maßstabs in Pixeln)
    // Angenommen, pixelsPerMeter wird global übergeben oder aus state gelesen
    const pxm = typeof pixelsPerMeter !== 'undefined' ? pixelsPerMeter : 20;
    const radiusPx = (obj.radius || 5) * pxm;

    ctx.beginPath();
    ctx.arc(obj.x, obj.y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? 'rgba(234, 179, 8, 0.2)' : 'rgba(234, 179, 8, 0.08)';
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = (isSelected ? 2 : 1) / scale;
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash
}

function getSprinklerSidebarHTML(obj) {
    return `
        <div style="padding: 15px; color: #fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="color: #eab308; margin:0;">🎯 Regner-Details</h3>
                <button onclick="deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
            </div>
            <p style="font-size:12px; color:#94a3b8; margin-bottom:10px;">Position X: ${Math.round(obj.x)}, Y: ${Math.round(obj.y)}</p>
            
            <label style="display:block; margin-top:8px; font-size:12px; color:#94a3b8;">Bezeichnung:</label>
            <input type="text" id="sprinkler-name" value="${obj.name || ''}" onchange="updateSprinklerProp('name', this.value)" style="width:100%; padding:6px; margin-bottom:8px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
            
            <label style="display:block; margin-top:8px; font-size:12px; color:#94a3b8;">Wurfweite / Radius (Meter):</label>
            <input type="number" id="sprinkler-radius" value="${obj.radius || 5}" step="0.5" onchange="updateSprinklerProp('radius', parseFloat(this.value))" style="width:100%; padding:6px; margin-bottom:8px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
            
            <label style="display:block; margin-top:8px; font-size:12px; color:#94a3b8;">Wassermenge (l/h):</label>
            <input type="number" id="sprinkler-rate" value="${obj.rate || 540}" onchange="updateSprinklerProp('rate', parseFloat(this.value))" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
        </div>`;
}

function updateSprinklerProp(prop, val) {
    if (selectedObj && selectedObj.type === 'sprinkler') {
        selectedObj[prop] = val;
        draw();
    }
}
