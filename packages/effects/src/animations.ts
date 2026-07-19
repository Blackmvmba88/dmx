import { Effect, EffectContext } from "./effect.js";

// Helper to convert HSV to RGB
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export class FadeEffect implements Effect {
  public id = "fade";
  public name = "Atenuación Suave (Fade)";
  public isActive = false;
  public speed = 0.5; // Hz
  public intensity = 1.0;
  public color: [number, number, number] = [255, 0, 0];

  private colors: [number, number, number][] = [
    [255, 0, 0],     // Red
    [0, 255, 0],     // Green
    [0, 0, 255],     // Blue
    [255, 255, 0],   // Yellow
    [0, 255, 255],   // Cyan
    [255, 0, 255]    // Magenta
  ];

  public update(ctx: EffectContext): void {
    if (!this.isActive || ctx.fixtures.length === 0) return;

    // Cycle through colors
    const totalColors = this.colors.length;
    const rawIndex = (ctx.time * this.speed) % totalColors;
    const currentIndex = Math.floor(rawIndex);
    const nextIndex = (currentIndex + 1) % totalColors;
    const fract = rawIndex - currentIndex;

    const c1 = this.colors[currentIndex];
    const c2 = this.colors[nextIndex];

    // Linear interpolation
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * fract);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * fract);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * fract);

    for (const fixture of ctx.fixtures) {
      fixture.setDimmer(Math.round(this.intensity * 255));
      fixture.setColor(r, g, b);
    }
  }
}

export class PulseEffect implements Effect {
  public id = "pulse";
  public name = "Pulso de Intensidad";
  public isActive = false;
  public speed = 1.0; // Hz
  public intensity = 1.0;
  public color: [number, number, number] = [0, 255, 255]; // Cyan default

  public update(ctx: EffectContext): void {
    if (!this.isActive || ctx.fixtures.length === 0) return;

    const sineVal = Math.sin(ctx.time * this.speed * Math.PI * 2);
    const pulseIntensity = (sineVal + 1) / 2; // scale to 0.0 - 1.0

    const r = Math.round(this.color[0] * this.intensity);
    const g = Math.round(this.color[1] * this.intensity);
    const b = Math.round(this.color[2] * this.intensity);

    for (const fixture of ctx.fixtures) {
      fixture.setDimmer(Math.round(pulseIntensity * 255));
      fixture.setColor(r, g, b);
    }
  }
}

export class RainbowEffect implements Effect {
  public id = "rainbow";
  public name = "Arcoíris Fluyente";
  public isActive = false;
  public speed = 0.2; // Hz
  public intensity = 1.0;
  public color: [number, number, number] = [255, 255, 255];

  public update(ctx: EffectContext): void {
    if (!this.isActive || ctx.fixtures.length === 0) return;

    for (let i = 0; i < ctx.fixtures.length; i++) {
      const fixture = ctx.fixtures[i];
      // Offset hue along the fixture list to create a moving gradient
      const hue = (ctx.time * this.speed + i / ctx.fixtures.length) % 1;
      const [r, g, b] = hsvToRgb(hue, 1.0, this.intensity);
      
      fixture.setDimmer(255);
      fixture.setColor(r, g, b);
    }
  }
}

export class ColorChaseEffect implements Effect {
  public id = "colorChase";
  public name = "Persecución de Color (Chase)";
  public isActive = false;
  public speed = 2.0; // speed of chase (steps per second)
  public intensity = 1.0;
  public color: [number, number, number] = [255, 255, 0]; // Yellow default

  public update(ctx: EffectContext): void {
    if (!this.isActive || ctx.fixtures.length === 0) return;

    const n = ctx.fixtures.length;
    // Calculate the active index
    const activeIndex = Math.floor(ctx.time * this.speed) % n;

    for (let i = 0; i < n; i++) {
      const fixture = ctx.fixtures[i];
      if (i === activeIndex) {
        fixture.setDimmer(Math.round(this.intensity * 255));
        fixture.setColor(this.color[0], this.color[1], this.color[2]);
      } else {
        // Fade out inactive fixtures gradually
        const currentDim = fixture.getFeature("dimmer");
        const nextDim = Math.max(0, currentDim - 15);
        fixture.setDimmer(nextDim);
        
        // Decay colors slowly
        const r = Math.max(0, fixture.getFeature("red") - 15);
        const g = Math.max(0, fixture.getFeature("green") - 15);
        const b = Math.max(0, fixture.getFeature("blue") - 15);
        fixture.setColor(r, g, b);
      }
    }
  }
}

export class RandomEffect implements Effect {
  public id = "random";
  public name = "Destellos Aleatorios (Random)";
  public isActive = false;
  public speed = 4.0; // Changes per second
  public intensity = 1.0;
  public color: [number, number, number] = [255, 0, 255]; // unused directly

  private lastChangeTime = 0;
  private fixtureColors: Record<string, [number, number, number]> = {};

  public update(ctx: EffectContext): void {
    if (!this.isActive || ctx.fixtures.length === 0) return;

    const interval = 1.0 / this.speed;
    const shouldChange = (ctx.time - this.lastChangeTime) >= interval;

    if (shouldChange) {
      this.lastChangeTime = ctx.time;
      for (const fixture of ctx.fixtures) {
        // Pick random color
        const r = Math.random() > 0.5 ? 255 : 0;
        const g = Math.random() > 0.5 ? 255 : 0;
        const b = Math.random() > 0.5 ? 255 : 0;
        this.fixtureColors[fixture.id] = [
          Math.round(r * this.intensity),
          Math.round(g * this.intensity),
          Math.round(b * this.intensity)
        ];
      }
    }

    for (const fixture of ctx.fixtures) {
      const colors = this.fixtureColors[fixture.id] || [0, 0, 0];
      fixture.setDimmer(255);
      fixture.setColor(colors[0], colors[1], colors[2]);
    }
  }
}

export class MusicReactiveEffect implements Effect {
  public id = "musicReactive";
  public name = "Audio-Rítmico (Music Reactive)";
  public isActive = false;
  public speed = 1.0; // sensitivity factor
  public intensity = 1.0;
  public color: [number, number, number] = [255, 0, 0];

  public update(ctx: EffectContext): void {
    if (!this.isActive || ctx.fixtures.length === 0) return;

    const n = ctx.fixtures.length;
    const volume = ctx.audioData?.volume ?? 0;
    const freqs = ctx.audioData?.frequencyData ?? [];

    if (freqs.length === 0) {
      // Fallback: simple pulse driven by elapsed time if no audio data is supplied
      const val = Math.round(Math.max(0, Math.sin(ctx.time * 2.0)) * 255 * this.intensity);
      for (const fixture of ctx.fixtures) {
        fixture.setDimmer(val);
        fixture.setColor(this.color[0], this.color[1], this.color[2]);
      }
      return;
    }

    // Split frequency bands across the fixtures
    // E.g., if we have 3 fixtures:
    // Fixture 0: Bass (low frequencies)
    // Fixture 1: Mids (mid frequencies)
    // Fixture 2: Treble (high frequencies)
    const bandSize = Math.floor(freqs.length / n) || 1;

    for (let i = 0; i < n; i++) {
      const fixture = ctx.fixtures[i];
      const startBin = i * bandSize;
      const endBin = Math.min(freqs.length, (i + 1) * bandSize);
      
      // Calculate average value in this frequency band
      let sum = 0;
      for (let bin = startBin; bin < endBin; bin++) {
        sum += freqs[bin];
      }
      const bandAvg = sum / (endBin - startBin || 1); // 0.0 to 1.0

      // Map band average to color intensity
      const amp = Math.min(1.0, bandAvg * this.speed * this.intensity);
      const dimmer = Math.round(amp * 255);

      // Give each band a distinct color theme if using default white,
      // or use the selected effect color scaled by amplitude.
      let r = this.color[0];
      let g = this.color[1];
      let b = this.color[2];

      if (r === 255 && g === 0 && b === 0) {
        // If default red is selected, assign colors based on band index
        // Low: Red, Mid: Green, High: Blue/Cyan
        const hue = i / n;
        const rgb = hsvToRgb(hue, 1.0, 1.0);
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];
      }

      fixture.setDimmer(dimmer);
      fixture.setColor(r, g, b);
    }
  }
}
