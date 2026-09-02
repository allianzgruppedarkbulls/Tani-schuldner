// js/sidebar.js - Dynamische Sidebar, Zisternen-Check & Zonenverwaltung
import { State } from './state.js';

export function updateSidebar(obj) {
    let sidebar = document.getElementById('sidebar-content') || document.getElementById('sidebar') || document.querySelector('.sidebar');
    if (!sidebar) return;
    let targetContainer = sidebar.id === 'sidebar-content' ? sidebar : (sidebar.querySelector('#sidebar-content') || sidebar);

    let allAreasList = '';
    let totalWaterWeekly = 0;

    State.objects.forEach((o, index) => {
        if (o.type === 'lawn' || o.type === 'drip') {
            const area = o.areaM2 || 0;
            const rate = o.waterRate || (o.type === 'lawn' ? 25 : 20);
            const subWater = Math.round(area * rate);
            totalWaterWeekly += subWater;
            const icon = o.type === 'lawn' ? '🟩' : '💧';
            const name = o.type === 'lawn' ? 'Rasen' : 'Tropfzone';
            allAreasList += `
                <div onclick="window.selectObjectByIndex(${index})" style="padding:6px 8px; margin-bottom:4px; background:#1e293b; border-radius:4px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-size:12px; border:1px solid ${o === State.selectedObj ? '#38bdf8' : 'transparent'};">
                    <span>${icon} <strong>${name} #${index+1}</strong></span>
                    <span style="color:#94a3b8;">${area} m² (${subWater} l/W)</span>
                </div>`;
        } else if (o.type === 'deadzone') {
            allAreasList += `
                <div onclick="window.selectObjectByIndex(${index})" style="padding:6px 8px; margin-bottom:4px; background:#291e1e; border-radius:4px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                    <span>⛔ <strong>Totzone #${index+1}</strong></span>
                    <span style="color:#94a3b8;">${o.areaM2 || 0} m²</span>
                </div>`;
        }
    });

    if (!obj) {
        targetContainer.innerHTML = `
            <div style="padding: 15px; color: #cbd5e1;">
                <h3 style="color: #fff; margin-bottom: 10px;">Übersicht & Zisterne</h3>
                
                <!-- Zisternen & Pumpen Setup -->
                <div style="background:#1e293b; padding:10px; border-radius:6px; margin-bottom:15px; border:1px solid #334155;">
                    <label style="display:flex; align-items:center; font-size:12px; cursor:pointer; margin-bottom:8px;">
                        <input type="checkbox" id="meta-has-cistern" ${State.systemMeta.hasCistern ? 'checked' : ''} onchange="window.updateSystemMeta('hasCistern', this.checked)" style="margin-right:8px;">
                        <strong>Zisterne vorhanden?</strong>
                    </label>
                    ${State.systemMeta.hasCistern ? `
                        <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:3px;">Zisternenvolumen (Liter):</label>
                        <input type="number" value="${State.systemMeta.cisternVolume}" onchange="window.updateSystemMeta('cisternVolume', parseInt(this.value))" style="width:100%; padding:4px; background:#0f172a; color:#fff; border:1px solid #475569; border-radius:4px; margin-bottom:8px;">
                    ` : ''}
                    <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:3px;">Pumpe / Quelle:</label>
                    <select onchange="window.updateSystemMeta('pumpType', this.value)" style="width:100%; padding:5px; background:#0f172a; color:#fff; border:1px solid #475569; border-radius:4px; font-size:11px;">
                        <option value="standard_3m3" ${State.systemMeta.pumpType==='standard_3m3'?'selected':''}>Standard-Pumpe (3 m³/h)</option>
                        <option value="pro_5m3" ${State.systemMeta.pumpType==='pro_5m3'?'selected':''}>Profi-Pumpe (5 m³/h)</option>
                        <option value="custom" ${State.systemMeta.pumpType==='custom'?'selected':''}>Individuell...</option>
                    </select>
                </div>

                <hr style="border:0; border-top:1px solid #334155; margin: 12px 0;">
                <div style="max-height:160px; overflow-y:auto; margin-bottom:15px;">
                    <p style="font-size:12px; font-weight:bold; color:#cbd5e1; margin-bottom:5px;">Erfasste Zonen:</p>
                    ${allAreasList || '<p style="font-size:12px; color:#64748b;">Noch keine Flächen gezeichnet.</p>'}
                </div>

                <hr style="border:0; border-top:1px solid #334155; margin: 12px 0;">
                <div>
                    <h4 style="color:#38bdf8; margin-bottom:5px;">Wasserbilanz</h4>
                    <p style="font-size:12px;">Wöchentlicher Bedarf: <strong>${Math.round(totalWaterWeekly)} Liter</strong></p>
                    ${State.systemMeta.hasCistern ? `
                        <p style="font-size:12px; color:${State.systemMeta.cisternVolume >= totalWaterWeekly ? '#4ade80' : '#f87171'};">
                            Reichweite Zisterne: <strong>~${(State.systemMeta.cisternVolume / (totalWaterWeekly || 1)).toFixed(1)} Wochen</strong>
                        </p>` : ''}
                </div>

                <div style="margin-top:20px; padding:8px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:4px; font-size:11px; color:#fcd34d;">
                    ℹ️ <strong>Richtwert-Hinweis:</strong> Alle Berechnungen sind Empfehlungen. Bauliche Anpassungen vor Ort vorbehalten.
                </div>
            </div>`;
        return;
    }

    // Detailansicht für ausgewähltes Objekt
    const isLocked = obj.locked !== false;
    targetContainer.innerHTML = `
        <div style="padding: 15px; color: #fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="color: ${obj.type==='lawn'?'#22c55e':obj.type==='drip'?'#fb923c':'#ef4444'}; margin:0;">
                    ${obj.type==='lawn'?'🟩 Rasen':obj.type==='drip'?'💧 Tropfzone':'⛔ Totzone'}
                </h3>
                <button onclick="window.deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
            </div>
            <p><strong>Fläche:</strong> ${obj.areaM2 || 0} m²</p>

            ${obj.type === 'drip' ? `
                <hr style="border:0; border-top:1px solid #334155; margin:10px 0;">
                <label style="display:block; font-size:12px; color:#94a3b8;">Verlegemodus:</label>
                <select id="drip-mode-select" onchange="window.changeDripLayoutMode(this.value)" style="width:100%; padding:6px; margin-bottom:8px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <option value="loop" ${obj.layoutMode === 'loop' ? 'selected' : ''}>Schleife (Mäander)</option>
                    <option value="frame" ${obj.layoutMode === 'frame' ? 'selected' : ''}>Beet-Rahmen + T-Stücke</option>
                </select>

                <label style="display:block; font-size:12px; color:#94a3b8;">Tropferabstand:</label>
                <select id="drip-dist-select" onchange="window.changeDripDistance(this.value)" style="width:100%; padding:6px; margin-bottom:8px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <option value="20" ${obj.dripDistance == 20 ? 'selected' : ''}>20 cm (Eng)</option>
                    <option value="33" ${obj.dripDistance == 33 ? 'selected' : ''}>33 cm (Standard)</option>
                    <option value="50" ${obj.dripDistance == 50 ? 'selected' : ''}>50 cm (Weit)</option>
                </select>

                <div style="background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.3); padding:8px; border-radius:4px; margin-top:10px; font-size:11px;">
                    📏 Schlauchbedarf: <strong>${obj.calculatedMeters || 0} m</strong><br>
                    🔄 Benötigte Kreise (max. 100m): <strong style="color:#38bdf8;">${obj.circuitCount || 1} Kreis(e)</strong>
                </div>
            ` : ''}

            <hr style="border:0; border-top:1px solid #334155; margin:15px 0;">
            <button onclick="window.toggleLockSelected()" style="width:100%; padding:8px; background:${isLocked ? '#334155' : '#0284c7'}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">
                ${isLocked ? '🔒 Verbunden (Klick zum Entsperren)' : '🔓 Entsperrt (Verschiebbar)'}
            </button>
        </div>`;
}

// In deiner updateSidebar(obj) Funktion für Sprinkler:
if (obj.type === 'sprinkler') {
    return `
        <div style="padding: 15px; color: #fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="color: #3b82f6; margin:0;">💧 Regner (MP Rotator)</h3>
                <button onclick="deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
            </div>
            
            <label style="font-size:11px; color:#94a3b8;">Bezeichnung / Name:</label>
            <input type="text" value="${obj.name || ''}" onchange="updateSprinklerProp('name', this.value)" style="width:100%; padding:6px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:4px; margin-bottom:8px;">

            <label style="font-size:11px; color:#94a3b8;">Modell:</label>
            <select onchange="updateSprinklerProp('model', this.value)" style="width:100%; padding:6px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:4px; margin-bottom:8px;">
                <option value="MP800" ${obj.model === 'MP800' ? 'selected' : ''}>MP 800 (2.5 - 4.6 m)</option>
                <option value="MP1000" ${obj.model === 'MP1000' || !obj.model ? 'selected' : ''}>MP 1000 (2.5 - 4.5 m)</option>
                <option value="MP2000" ${obj.model === 'MP2000' ? 'selected' : ''}>MP 2000 (4.0 - 6.4 m)</option>
                <option value="MP3000" ${obj.model === 'MP3000' ? 'selected' : ''}>MP 3000 (6.7 - 9.1 m)</option>
            </select>

            <div style="display:flex; gap:10px; margin-bottom:8px;">
                <div style="flex:1;">
                    <label style="font-size:11px; color:#94a3b8;">Wurfweite (m):</label>
                    <input type="number" step="0.1" value="${obj.radius || 3.5}" onchange="updateSprinklerProp('radius', parseFloat(this.value))" style="width:100%; padding:6px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:4px;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:11px; color:#94a3b8;">Öffnung (°):</label>
                    <input type="number" step="5" value="${obj.arc || 90}" onchange="updateSprinklerProp('arc', parseFloat(this.value))" style="width:100%; padding:6px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:4px;">
                </div>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:12px;">
                <div style="flex:1;">
                    <label style="font-size:11px; color:#94a3b8;">Ausrichtung (°):</label>
                    <input type="number" step="5" value="${obj.angle || 0}" onchange="updateSprinklerProp('angle', parseFloat(this.value))" style="width:100%; padding:6px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:4px;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:11px; color:#94a3b8;">Wasserbedarf (m³/h):</label>
                    <input type="number" step="0.01" value="${obj.rate || 0.1}" onchange="updateSprinklerProp('rate', parseFloat(this.value))" style="width:100%; padding:6px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:4px;">
                </div>
            </div>

            <label style="font-size:11px; color:#94a3b8;">Rohrleitung / Strang:</label>
            <input type="text" value="${obj.strang || 'Nicht zugewiesen'}" disabled style="width:100%; padding:6px; background:#0f172a; border:1px solid #334155; color:#94a3b8; border-radius:4px; margin-bottom:12px;">

            <button onclick="toggleLockSelected()" style="width:100%; padding:8px; background:#334155; color:#fff; border:1px solid #475569; border-radius:4px; cursor:pointer;">
                ${obj.locked ? '🔓 Objekt entsperren' : '🔒 Objekt sperren'}
            </button>
        </div>`;
}
