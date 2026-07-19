import { DMXUniverse } from "@blackmamba/core";
import { FixtureInstance } from "@blackmamba/fixtures";
import { Effect, EffectContext } from "./effect.js";
import {
  FadeEffect,
  PulseEffect,
  RainbowEffect,
  ColorChaseEffect,
  RandomEffect,
  MusicReactiveEffect
} from "./animations.js";

export class EffectsEngine {
  private effects = new Map<string, Effect>();
  private activeEffectId: string | null = null;

  constructor() {
    // Register default effects
    this.registerEffect(new FadeEffect());
    this.registerEffect(new PulseEffect());
    this.registerEffect(new RainbowEffect());
    this.registerEffect(new ColorChaseEffect());
    this.registerEffect(new RandomEffect());
    this.registerEffect(new MusicReactiveEffect());
  }

  public registerEffect(effect: Effect): void {
    this.effects.set(effect.id, effect);
  }

  public getEffect(id: string): Effect | undefined {
    return this.effects.get(id);
  }

  public getEffects(): Effect[] {
    return Array.from(this.effects.values());
  }

  public activateEffect(id: string | null): void {
    // Deactivate previous
    if (this.activeEffectId) {
      const prev = this.effects.get(this.activeEffectId);
      if (prev) prev.isActive = false;
    }

    this.activeEffectId = id;

    if (id) {
      const next = this.effects.get(id);
      if (next) next.isActive = true;
    }
  }

  public getActiveEffectId(): string | null {
    return this.activeEffectId;
  }

  /**
   * Run the active effect update
   */
  public update(
    time: number,
    dt: number,
    fixtures: FixtureInstance[],
    universe: DMXUniverse,
    audioData?: EffectContext["audioData"]
  ): void {
    if (!this.activeEffectId) return;
    
    const effect = this.effects.get(this.activeEffectId);
    if (effect && effect.isActive) {
      effect.update({
        time,
        dt,
        fixtures,
        universe,
        audioData
      });
    }
  }

  /**
   * Update parameters of an effect
   */
  public configureEffect(
    id: string,
    config: { speed?: number; intensity?: number; color?: [number, number, number] }
  ): void {
    const effect = this.effects.get(id);
    if (!effect) return;

    if (config.speed !== undefined) effect.speed = config.speed;
    if (config.intensity !== undefined) effect.intensity = config.intensity;
    if (config.color !== undefined) effect.color = config.color;
  }
}
