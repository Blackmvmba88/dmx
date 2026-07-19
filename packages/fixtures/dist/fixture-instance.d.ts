import { Fixture, FixtureProfile, DMXUniverse } from "@blackmamba/core";
export declare class FixtureInstance implements Fixture {
    id: string;
    name: string;
    universe: number;
    address: number;
    channels: number;
    profile: FixtureProfile;
    calibrationScale: [number, number, number];
    private dmxUniverse;
    private state;
    constructor(fixture: Fixture, dmxUniverse: DMXUniverse);
    /**
     * Helper to write to a mapped feature channel
     */
    setFeature(feature: string, value: number): void;
    /**
     * Helper to get a mapped feature value from the DMX universe
     */
    getFeature(feature: string): number;
    /**
     * Set color on red, green, blue channels (and optionally white, amber, uv if mapped)
     */
    setColor(r: number, g: number, b: number, extraColors?: {
        white?: number;
        amber?: number;
        uv?: number;
    }): void;
    /**
     * Set Master Dimmer
     */
    setDimmer(value: number): void;
    /**
     * Set Strobe channel
     */
    setStrobe(speed: number): void;
    /**
     * Get all logical states of the mapped features for the UI inspector
     */
    getStates(): Record<string, number>;
}
