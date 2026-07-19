"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EffectsEngine = void 0;
const animations_js_1 = require("./animations.js");
class EffectsEngine {
    effects = new Map();
    activeEffectId = null;
    constructor() {
        // Register default effects
        this.registerEffect(new animations_js_1.FadeEffect());
        this.registerEffect(new animations_js_1.PulseEffect());
        this.registerEffect(new animations_js_1.RainbowEffect());
        this.registerEffect(new animations_js_1.ColorChaseEffect());
        this.registerEffect(new animations_js_1.RandomEffect());
        this.registerEffect(new animations_js_1.MusicReactiveEffect());
    }
    registerEffect(effect) {
        this.effects.set(effect.id, effect);
    }
    getEffect(id) {
        return this.effects.get(id);
    }
    getEffects() {
        return Array.from(this.effects.values());
    }
    activateEffect(id) {
        // Deactivate previous
        if (this.activeEffectId) {
            const prev = this.effects.get(this.activeEffectId);
            if (prev)
                prev.isActive = false;
        }
        this.activeEffectId = id;
        if (id) {
            const next = this.effects.get(id);
            if (next)
                next.isActive = true;
        }
    }
    getActiveEffectId() {
        return this.activeEffectId;
    }
    /**
     * Run the active effect update
     */
    update(time, dt, fixtures, universe, audioData) {
        if (!this.activeEffectId)
            return;
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
    configureEffect(id, config) {
        const effect = this.effects.get(id);
        if (!effect)
            return;
        if (config.speed !== undefined)
            effect.speed = config.speed;
        if (config.intensity !== undefined)
            effect.intensity = config.intensity;
        if (config.color !== undefined)
            effect.color = config.color;
    }
}
exports.EffectsEngine = EffectsEngine;
