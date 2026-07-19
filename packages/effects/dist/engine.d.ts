import { DMXUniverse } from "@blackmamba/core";
import { FixtureInstance } from "@blackmamba/fixtures";
import { Effect, EffectContext } from "./effect.js";
export declare class EffectsEngine {
    private effects;
    private activeEffectId;
    constructor();
    registerEffect(effect: Effect): void;
    getEffect(id: string): Effect | undefined;
    getEffects(): Effect[];
    activateEffect(id: string | null): void;
    getActiveEffectId(): string | null;
    /**
     * Run the active effect update
     */
    update(time: number, dt: number, fixtures: FixtureInstance[], universe: DMXUniverse, audioData?: EffectContext["audioData"]): void;
    /**
     * Update parameters of an effect
     */
    configureEffect(id: string, config: {
        speed?: number;
        intensity?: number;
        color?: [number, number, number];
    }): void;
}
