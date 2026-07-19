import { DMXUniverse } from "@blackmamba/core";
import { FixtureInstance } from "@blackmamba/fixtures";
export interface EffectContext {
    time: number;
    dt: number;
    fixtures: FixtureInstance[];
    universe: DMXUniverse;
    audioData?: {
        volume: number;
        frequencyData: number[];
    };
}
export interface Effect {
    id: string;
    name: string;
    isActive: boolean;
    speed: number;
    intensity: number;
    color: [number, number, number];
    update(ctx: EffectContext): void;
}
