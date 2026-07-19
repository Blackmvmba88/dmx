import { Effect, EffectContext } from "./effect.js";
export declare class FadeEffect implements Effect {
    id: string;
    name: string;
    isActive: boolean;
    speed: number;
    intensity: number;
    color: [number, number, number];
    private colors;
    update(ctx: EffectContext): void;
}
export declare class PulseEffect implements Effect {
    id: string;
    name: string;
    isActive: boolean;
    speed: number;
    intensity: number;
    color: [number, number, number];
    update(ctx: EffectContext): void;
}
export declare class RainbowEffect implements Effect {
    id: string;
    name: string;
    isActive: boolean;
    speed: number;
    intensity: number;
    color: [number, number, number];
    update(ctx: EffectContext): void;
}
export declare class ColorChaseEffect implements Effect {
    id: string;
    name: string;
    isActive: boolean;
    speed: number;
    intensity: number;
    color: [number, number, number];
    update(ctx: EffectContext): void;
}
export declare class RandomEffect implements Effect {
    id: string;
    name: string;
    isActive: boolean;
    speed: number;
    intensity: number;
    color: [number, number, number];
    private lastChangeTime;
    private fixtureColors;
    update(ctx: EffectContext): void;
}
export declare class MusicReactiveEffect implements Effect {
    id: string;
    name: string;
    isActive: boolean;
    speed: number;
    intensity: number;
    color: [number, number, number];
    update(ctx: EffectContext): void;
}
