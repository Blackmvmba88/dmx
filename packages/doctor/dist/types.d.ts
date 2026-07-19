export interface SensorData {
    r: number;
    g: number;
    b: number;
    lux: number;
    temp: number;
}
export interface FixtureHealth {
    id: string;
    score: number;
    temperature: number;
    lastResponseMs: number;
    errorCount: number;
    status: "OK" | "WARNING" | "CRITICAL" | "SELF_TESTING";
    calibrationScale: [number, number, number];
}
export interface TestChannelResult {
    expected: number;
    observed: number;
    accuracy: number;
    status: "OK" | "FAIL" | "WARN";
}
export interface FixtureHealthReport {
    fixtureId: string;
    timestamp: number;
    overallScore: number;
    channels: {
        red: TestChannelResult;
        green: TestChannelResult;
        blue: TestChannelResult;
        dimmer: TestChannelResult;
        strobe: TestChannelResult;
    };
    temperature: number;
    conclusion: string;
}
