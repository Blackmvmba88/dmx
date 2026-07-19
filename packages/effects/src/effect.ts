import { DMXUniverse } from "@blackmamba/core";
import { FixtureInstance } from "@blackmamba/fixtures";

export interface EffectContext {
  time: number; // Time in seconds
  dt: number;   // Delta time in seconds
  fixtures: FixtureInstance[];
  universe: DMXUniverse;
  audioData?: {
    volume: number; // normalized 0 to 1
    frequencyData: number[]; // array of normalized values
  };
}

export interface Effect {
  id: string;
  name: string;
  isActive: boolean;
  speed: number;
  intensity: number;
  color: [number, number, number]; // [R, G, B]
  update(ctx: EffectContext): void;
}
