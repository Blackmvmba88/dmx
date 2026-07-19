"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixtureManager = void 0;
const fixture_instance_js_1 = require("./fixture-instance.js");
class FixtureManager {
    profiles = new Map();
    fixtures = new Map();
    dmxUniverse;
    constructor(dmxUniverse) {
        this.dmxUniverse = dmxUniverse;
    }
    /**
     * Register a new fixture profile
     */
    registerProfile(name, profile) {
        this.profiles.set(name, profile);
    }
    /**
     * Get a registered profile by name
     */
    getProfile(name) {
        return this.profiles.get(name);
    }
    /**
     * Get all registered profile names
     */
    getRegisteredProfileNames() {
        return Array.from(this.profiles.keys());
    }
    /**
     * Instantiate a fixture in the DMX universe
     */
    addFixture(id, name, profileName, address, universe = 1) {
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
        const instance = new fixture_instance_js_1.FixtureInstance({
            id,
            name,
            universe,
            address,
            channels: profile.channels,
            profile
        }, this.dmxUniverse);
        this.fixtures.set(id, instance);
        return instance;
    }
    /**
     * Remove a fixture by ID
     */
    removeFixture(id) {
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
    getFixture(id) {
        return this.fixtures.get(id);
    }
    /**
     * Get list of all fixtures
     */
    getFixtures() {
        return Array.from(this.fixtures.values());
    }
    /**
     * Set color on a specific fixture by ID
     */
    setFixtureColor(id, r, g, b, extraColors) {
        const fixture = this.fixtures.get(id);
        if (!fixture)
            throw new Error(`Fixture ID "${id}" not found.`);
        fixture.setColor(r, g, b, extraColors);
    }
    /**
     * Set Master Dimmer on a specific fixture by ID
     */
    setDimmer(id, value) {
        const fixture = this.fixtures.get(id);
        if (!fixture)
            throw new Error(`Fixture ID "${id}" not found.`);
        fixture.setDimmer(value);
    }
    /**
     * Set Strobe speed on a specific fixture by ID
     */
    setStrobe(id, speed) {
        const fixture = this.fixtures.get(id);
        if (!fixture)
            throw new Error(`Fixture ID "${id}" not found.`);
        fixture.setStrobe(speed);
    }
}
exports.FixtureManager = FixtureManager;
