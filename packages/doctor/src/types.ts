export interface SensorData {
  r: number;    // Observed Red (0-255)
  g: number;    // Observed Green (0-255)
  b: number;    // Observed Blue (0-255)
  lux: number;  // Intensity
  temp: number; // Temperature in °C
}

export interface FixtureHealth {
  id: string;
  score: number;             // 0-100%
  temperature: number;       // °C
  lastResponseMs: number;    // latency in ms
  errorCount: number;
  status: "OK" | "WARNING" | "CRITICAL" | "SELF_TESTING";
  calibrationScale: [number, number, number]; // Current R-G-B scale multipliers
}

export interface TestChannelResult {
  expected: number;
  observed: number;
  accuracy: number; // 0-100
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
