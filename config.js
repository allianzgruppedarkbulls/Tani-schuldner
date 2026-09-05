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
        { id: 'micro_4.6', name: 'MicroDrip Kapillar (4.6 mm)', innerDiameter: 0.0046, outerDiameter: 4.6, color: '#e67e22', defaultWidth: 2 },
        { id: 'micro_16',  name: 'MicroDrip / Tropfrohr (16 mm)', innerDiameter: 0.0136, outerDiameter: 16,  color: '#d35400', defaultWidth: 3 },
        { id: 'micro_20',  name: 'Versorgungsleitung (20 mm)',    innerDiameter: 0.0160, outerDiameter: 20,  color: '#f39c12', defaultWidth: 4 },
        { id: 'pe25',      name: 'PE-Rohr 25 mm',                innerDiameter: 0.0204, outerDiameter: 25,  color: '#38bdf8', defaultWidth: 4 },
        { id: 'pe32',      name: 'PE-Rohr 32 mm (Standard)',     innerDiameter: 0.0260, outerDiameter: 32,  color: '#0284c7', defaultWidth: 5 }
    ]
};
