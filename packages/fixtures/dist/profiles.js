"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROFILES = void 0;
exports.DEFAULT_PROFILES = {
    "par-rgb-6ch": {
        name: "PAR RGB (6 Canales)",
        channels: 6,
        mapping: {
            dimmer: 1,
            red: 2,
            green: 3,
            blue: 4,
            strobe: 5,
            macro: 6
        }
    },
    "par-rgb-3ch": {
        name: "PAR RGB Simple (3 Canales)",
        channels: 3,
        mapping: {
            red: 1,
            green: 2,
            blue: 3
        }
    },
    "dimmer-1ch": {
        name: "Atenuador Simple (1 Canal)",
        channels: 1,
        mapping: {
            dimmer: 1
        }
    },
    "moving-head-12ch": {
        name: "Cabeza Móvil (12 Canales)",
        channels: 12,
        mapping: {
            pan: 1,
            tilt: 2,
            dimmer: 3,
            red: 4,
            green: 5,
            blue: 6,
            strobe: 7,
            macro: 8,
            speed: 9
        }
    },
    "steren-par-040": {
        name: "Steren PAR-040 (8 Canales)",
        channels: 8,
        mapping: {
            mode: 1,
            macro: 2,
            speed: 3,
            dimmer: 4,
            red: 5,
            green: 6,
            blue: 7,
            uv: 8
        }
    }
};
