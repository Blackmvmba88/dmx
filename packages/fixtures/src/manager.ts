import { FixtureProfile, DMXUniverse } from "@blackmamba/core";
import { FixtureInstance } from "./fixture-instance.js";

export class FixtureManager {
  private profiles = new Map<string, FixtureProfile>();
  private fixtures = new Map<string, FixtureInstance>();
  private dmxUniverse: DMXUniverse;

  constructor(dmxUniverse: DMXUniverse) {
    this.dmxUniverse = dmxUniverse;
  }

  /**
   * Register a new fixture profile
   */
  public registerProfile(name: string, profile: FixtureProfile): void {
    this.profiles.set(name, profile);
  }

  /**
   * Get a registered profile by name
   */
  public getProfile(name: string): FixtureProfile | undefined {
    return this.profiles.get(name);
  }

  /**
   * Get all registered profile names
   */
  public getRegisteredProfileNames(): string[] {
    return Array.from(this.profiles.keys());
  }

  /**
   * Instantiate a fixture in the DMX universe
   */
  public addFixture(id: string, name: string, profileName: string, address: number, universe = 1): FixtureInstance {
    const profile = this.profiles.get(profileName);
    if (!profile) {
      throw new Error(`Profile "${profileName}" not found in registry.`);
    }

    // Check overlaps
    for (const other of this.fixtures.values()) {
      if (other.universe === universe) {
        const startA = address;
        const endA = address + profile.channels - 1;
        const startB = other.address;
        const endB = other.address + other.channels - 1;

        if (startA <= endB && startB <= endA) {
          throw new Error(`Fixture address overlap! "${name}" (CH ${startA}-${endA}) overlaps with "${other.name}" (CH ${startB}-${endB})`);
        }
      }
    }

    const instance = new FixtureInstance(
      {
        id,
        name,
        universe,
        address,
        channels: profile.channels,
        profile
      },
      this.dmxUniverse
    );

    this.fixtures.set(id, instance);
    return instance;
  }

  /**
   * Remove a fixture by ID
   */
  public removeFixture(id: string): boolean {
    // Optionally blackout its channels before removing
    const fixture = this.fixtures.get(id);
    if (fixture) {
      for (let i = 0; i < fixture.channels; i++) {
        this.dmxUniverse.setChannel(fixture.address + i, 0);
      }
    }
    return this.fixtures.delete(id);
  }

  /**
   * Get fixture by ID
   */
  public getFixture(id: string): FixtureInstance | undefined {
    return this.fixtures.get(id);
  }

  /**
   * Get list of all fixtures
   */
  public getFixtures(): FixtureInstance[] {
    return Array.from(this.fixtures.values());
  }

  /**
   * Set color on a specific fixture by ID
   */
  public setFixtureColor(id: string, r: number, g: number, b: number, extraColors?: { white?: number; amber?: number; uv?: number }): void {
    const fixture = this.fixtures.get(id);
    if (!fixture) throw new Error(`Fixture ID "${id}" not found.`);
    fixture.setColor(r, g, b, extraColors);
  }

  /**
   * Set Master Dimmer on a specific fixture by ID
   */
  public setDimmer(id: string, value: number): void {
    const fixture = this.fixtures.get(id);
    if (!fixture) throw new Error(`Fixture ID "${id}" not found.`);
    fixture.setDimmer(value);
  }

  /**
   * Set Strobe speed on a specific fixture by ID
   */
  public setStrobe(id: string, speed: number): void {
    const fixture = this.fixtures.get(id);
    if (!fixture) throw new Error(`Fixture ID "${id}" not found.`);
    fixture.setStrobe(speed);
  }
}
