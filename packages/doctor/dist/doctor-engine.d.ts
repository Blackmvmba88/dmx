import { DMXUniverse } from "@blackmamba/core";
import { FixtureInstance } from "@blackmamba/fixtures";
import { FixtureHealth, SensorData, FixtureHealthReport } from "./types.js";
export declare class DoctorEngine {
    private healthStates;
    private sensorFeeds;
    private activeSelfTests;
    constructor();
    /**
     * Inject sensor feedback for a fixture (called by simulated sensors or hardware APIs)
     */
    updateSensorFeed(fixtureId: string, data: SensorData): void;
    getSensorFeed(fixtureId: string): SensorData;
    getHealth(fixtureId: string): FixtureHealth | undefined;
    getAllHealthStates(): FixtureHealth[];
    /**
     * Core update tick called inside the main loop
     */
    update(fixtures: FixtureInstance[], universe: DMXUniverse, dt: number): void;
    /**
     * Start the autodiagnostic process for a fixture
     */
    triggerSelfTest(fixture: FixtureInstance, universe: DMXUniverse, onComplete: (report: FixtureHealthReport) => void): void;
    /**
     * Run the active step timer increments
     */
    private stepAccumulators;
    private runActiveSelfTestStep;
    getActiveSelfTestProgress(fixtureId: string): {
        step: number;
        total: number;
        currentStepName: string;
    } | null;
}
