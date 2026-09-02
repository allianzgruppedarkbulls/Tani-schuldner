// js/config.js - Statische technische Daten (Quellen, Pumpen, Rohre)
export const SYSTEM_CONFIG = {
    waterSources: [
        { id: 'cistern', name: 'Zisterne / Speichertank' },
        { id: 'well', name: 'Brunnen / Tiefpumpe' },
        { id: 'surface', name: 'Offenes Gewässer / Fluss' },
        { id: 'tap', name: 'Hauswasseranschluss' }
    ],
    pumps: [
        { id: 'standard_3m3', name: 'Standard-Pumpe (3 m³/h, 3.5 bar)', flow: 3.0, pressure: 3.5 },
        { id: 'pro_5m3', name: 'Profi-Pumpe (5 m³/h, 4.5 bar)', flow: 5.0, pressure: 4.5 },
        { id: 'custom', name: 'Individuelle Pumpe...', flow: 0, pressure: 0 }
    ],
    pipes: [
        { id: 'pe25', name: 'PE-Rohr 25 mm', innerDiameter: 0.021 },
        { id: 'pe32', name: 'PE-Rohr 32 mm (Standard)', innerDiameter: 0.026 }
    ]
};
