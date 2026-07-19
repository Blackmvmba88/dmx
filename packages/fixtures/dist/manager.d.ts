import { FixtureProfile, DMXUniverse } from "@blackmamba/core";
import { FixtureInstance } from "./fixture-instance.js";
export declare class FixtureManager {
    private profiles;
    private fixtures;
    private dmxUniverse;
    constructor(dmxUniverse: DMXUniverse);
    /**
     * Register a new fixture profile
     */
    registerProfile(name: string, profile: FixtureProfile): void;
    /**
     * Get a registered profile by name
     */
    getProfile(name: string): FixtureProfile | undefined;
    /**
     * Get all registered profile names
     */
    getRegisteredProfileNames(): string[];
    /**
     * Instantiate a fixture in the DMX universe
     */
    addFixture(id: string, name: string, profileName: string, address: number, universe?: number): FixtureInstance;
    /**
     * Remove a fixture by ID
     */
    removeFixture(id: string): boolean;
    /**
     * Get fixture by ID
     */
    getFixture(id: string): FixtureInstance | undefined;
    /**
     * Get list of all fixtures
     */
    getFixtures(): FixtureInstance[];
    /**
     * Set color on a specific fixture by ID
     */
    setFixtureColor(id: string, r: number, g: number, b: number, extraColors?: {
        white?: number;
        amber?: number;
        uv?: number;
    }): void;
    /**
     * Set Master Dimmer on a specific fixture by ID
     */
    setDimmer(id: string, value: number): void;
    /**
     * Set Strobe speed on a specific fixture by ID
     */
    setStrobe(id: string, speed: number): void;
}
