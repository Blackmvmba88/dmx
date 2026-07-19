import { Fixture, FixtureProfile, DMXUniverse } from "@blackmamba/core";

export class FixtureInstance implements Fixture {
  public id: string;
  public name: string;
  public universe: number;
  public address: number;
  public channels: number;
  public profile: FixtureProfile;
  public calibrationScale: [number, number, number] = [1.0, 1.0, 1.0];
  private dmxUniverse: DMXUniverse;

  // Store the logical values to recall them easily
  private state: Record<string, number> = {};

  constructor(fixture: Fixture, dmxUniverse: DMXUniverse) {
    this.id = fixture.id;
    this.name = fixture.name;
    this.universe = fixture.universe;
    this.address = fixture.address;
    this.channels = fixture.channels;
    this.profile = fixture.profile;
    this.dmxUniverse = dmxUniverse;

    // Initialize state cache
    for (const key of Object.keys(this.profile.mapping)) {
      this.state[key] = 0;
    }
  }

  /**
   * Helper to write to a mapped feature channel
   */
  public setFeature(feature: string, value: number): void {
    const channelOffset = this.profile.mapping[feature];
    if (channelOffset === undefined) {
      // Feature not supported by this fixture profile
      return;
    }

    if (channelOffset < 1 || channelOffset > this.channels) {
      console.warn(`[Fixture ${this.id}] Feature "${feature}" mapped to offset ${channelOffset} which is out of range (1-${this.channels})`);
      return;
    }

    const dmxChannel = this.address + channelOffset - 1;
    this.state[feature] = value;

    // Apply AI calibration scaling factors to color channels
    let finalValue = value;
    if (feature === "red") {
      finalValue = Math.max(0, Math.min(255, Math.round(value * this.calibrationScale[0])));
    } else if (feature === "green") {
      finalValue = Math.max(0, Math.min(255, Math.round(value * this.calibrationScale[1])));
    } else if (feature === "blue") {
      finalValue = Math.max(0, Math.min(255, Math.round(value * this.calibrationScale[2])));
    }

    this.dmxUniverse.setChannel(dmxChannel, finalValue);
  }

  /**
   * Helper to get a mapped feature value from the DMX universe
   */
  public getFeature(feature: string): number {
    const channelOffset = this.profile.mapping[feature];
    if (channelOffset === undefined) return 0;
    
    const dmxChannel = this.address + channelOffset - 1;
    return this.dmxUniverse.getChannel(dmxChannel);
  }

  /**
   * Set color on red, green, blue channels (and optionally white, amber, uv if mapped)
   */
  public setColor(r: number, g: number, b: number, extraColors: { white?: number; amber?: number; uv?: number } = {}): void {
    this.setFeature("red", r);
    this.setFeature("green", g);
    this.setFeature("blue", b);
    
    if (extraColors.white !== undefined) this.setFeature("white", extraColors.white);
    if (extraColors.amber !== undefined) this.setFeature("amber", extraColors.amber);
    if (extraColors.uv !== undefined) this.setFeature("uv", extraColors.uv);
  }

  /**
   * Set Master Dimmer
   */
  public setDimmer(value: number): void {
    this.setFeature("dimmer", value);
  }

  /**
   * Set Strobe channel
   */
  public setStrobe(speed: number): void {
    this.setFeature("strobe", speed);
  }

  /**
   * Get all logical states of the mapped features for the UI inspector
   */
  public getStates(): Record<string, number> {
    const currentStates: Record<string, number> = {};
    for (const key of Object.keys(this.profile.mapping)) {
      currentStates[key] = this.getFeature(key);
    }
    return currentStates;
  }
}
