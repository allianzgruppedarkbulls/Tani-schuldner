// config.js
export const SYSTEM_CONFIG = {
    waterSources: [
        { id: 'cistern', name: 'Zisterne (mit Volumen)', defaultVolume: 5000 },
        { id: 'well', name: 'Brunnen / Tiefpumpe', defaultPressure: 4.0 },
        { id: 'surface', name: 'Offenes Gewässer / Fluss', defaultPressure: 2.5 },
        { id: 'tap', name: 'Hauswasseranschluss', defaultPressure: 4.5 }
    ],
    pumps: [
        { id: 'standard_3m3', name: 'Standard-Pumpe (3 m³/h, 3.5 bar)', flow: 3.0, pressure: 3.5 },
        { id: 'pro_5m3', name: 'Profi-Pumpe (5 m³/h, 4.5 bar)', flow: 5.0, pressure: 4.5 },
        { id: 'custom', name: 'Individuelle Pumpe...', flow: 0, pressure: 0 }
    ],
    pipes: [
        { id: 'pe25', name: 'PE-Rohr 25 mm', innerDiameter: 0.021, frictionLoss: 0.05 },
        { id: 'pe32', name: 'PE-Rohr 32 mm (Standard)', innerDiameter: 0.026, frictionLoss: 0.02 }
    ]
};
