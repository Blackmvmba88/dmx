import { DMXUniverse } from "@blackmamba/core";
import { FixtureInstance } from "@blackmamba/fixtures";
import { FixtureHealth, SensorData, FixtureHealthReport, TestChannelResult } from "./types.js";

export class DoctorEngine {
  private healthStates = new Map<string, FixtureHealth>();
  private sensorFeeds = new Map<string, SensorData>();
  private activeSelfTests = new Map<string, {
    step: number;
    steps: { name: string; action: () => void; evaluate: () => void }[];
    report: Partial<FixtureHealthReport>;
    onComplete: (report: FixtureHealthReport) => void;
  }>();

  constructor() {}

  /**
   * Inject sensor feedback for a fixture (called by simulated sensors or hardware APIs)
   */
  public updateSensorFeed(fixtureId: string, data: SensorData): void {
    this.sensorFeeds.set(fixtureId, data);
  }

  public getSensorFeed(fixtureId: string): SensorData {
    return this.sensorFeeds.get(fixtureId) || { r: 0, g: 0, b: 0, lux: 0, temp: 25 };
  }

  public getHealth(fixtureId: string): FixtureHealth | undefined {
    return this.healthStates.get(fixtureId);
  }

  public getAllHealthStates(): FixtureHealth[] {
    return Array.from(this.healthStates.values());
  }

  /**
   * Core update tick called inside the main loop
   */
  public update(fixtures: FixtureInstance[], universe: DMXUniverse, dt: number): void {
    for (const fixture of fixtures) {
      // 1. Initialize health state if not present
      if (!this.healthStates.has(fixture.id)) {
        this.healthStates.set(fixture.id, {
          id: fixture.id,
          score: 100,
          temperature: 25,
          lastResponseMs: 8 + Math.random() * 5,
          errorCount: 0,
          status: "OK",
          calibrationScale: [1.0, 1.0, 1.0]
        });
      }

      const health = this.healthStates.get(fixture.id)!;
      const sensor = this.getSensorFeed(fixture.id);

      // If fixture is running a self-test, bypass normal calibration/health ticks
      if (health.status === "SELF_TESTING") {
        this.runActiveSelfTestStep(fixture.id, sensor);
        continue;
      }

      // Update temperature in health report
      health.temperature = sensor.temp;

      // 2. Read Expected Values from Universe
      const mapping = fixture.profile.mapping;
      const dimmerIdx = mapping.dimmer;
      const redIdx = mapping.red;
      const greenIdx = mapping.green;
      const blueIdx = mapping.blue;

      const dimmerVal = dimmerIdx ? universe.getChannel(fixture.address + dimmerIdx - 1) : 255;
      const dimmerScale = dimmerVal / 255.0;

      const expectedR = redIdx ? universe.getChannel(fixture.address + redIdx - 1) : 0;
      const expectedG = greenIdx ? universe.getChannel(fixture.address + greenIdx - 1) : 0;
      const expectedB = blueIdx ? universe.getChannel(fixture.address + blueIdx - 1) : 0;

      // Calculate target brightness expected at the sensor
      const targetR = expectedR * dimmerScale;
      const targetG = expectedG * dimmerScale;
      const targetB = expectedB * dimmerScale;

      // 3. AI Calibration Feedback Loop
      // If the fixture is outputting light, compare expected with sensor
      const learningRate = 0.02 * dt; // slow correction speed
      let colorErrorSum = 0;

      // Red Calibration
      if (targetR > 15) {
        const error = targetR - sensor.r;
        colorErrorSum += Math.abs(error);
        
        // Update calibration coefficient
        const currentScale = fixture.calibrationScale ? fixture.calibrationScale[0] : 1.0;
        const newScale = Math.max(0.5, Math.min(1.5, currentScale + error * 0.001 * learningRate));
        fixture.calibrationScale = [newScale, fixture.calibrationScale[1], fixture.calibrationScale[2]];
      }

      // Green Calibration
      if (targetG > 15) {
        const error = targetG - sensor.g;
        colorErrorSum += Math.abs(error);

        const currentScale = fixture.calibrationScale ? fixture.calibrationScale[1] : 1.0;
        const newScale = Math.max(0.5, Math.min(1.5, currentScale + error * 0.001 * learningRate));
        fixture.calibrationScale = [fixture.calibrationScale[0], newScale, fixture.calibrationScale[2]];
      }

      // Blue Calibration
      if (targetB > 15) {
        const error = targetB - sensor.b;
        colorErrorSum += Math.abs(error);

        const currentScale = fixture.calibrationScale ? fixture.calibrationScale[2] : 1.0;
        const newScale = Math.max(0.5, Math.min(1.5, currentScale + error * 0.001 * learningRate));
        fixture.calibrationScale = [fixture.calibrationScale[0], fixture.calibrationScale[1], newScale];
      }

      // Sync calibration coefficients back to the health state
      health.calibrationScale = fixture.calibrationScale;

      // 4. Calculate Health Score
      let score = 100;
      let status: FixtureHealth["status"] = "OK";

      // A: Temperature penalty
      if (sensor.temp > 55) {
        score -= (sensor.temp - 55) * 1.2;
      }

      // B: Bulb burnout / critical deviations
      let hasPossibleBurnout = false;
      if (targetR > 100 && sensor.r < 15) { hasPossibleBurnout = true; score -= 30; }
      if (targetG > 100 && sensor.g < 15) { hasPossibleBurnout = true; score -= 30; }
      if (targetB > 100 && sensor.b < 15) { hasPossibleBurnout = true; score -= 30; }

      if (hasPossibleBurnout) {
        health.errorCount += 1;
      }

      // C: Minor drifts
      if (colorErrorSum > 40 && !hasPossibleBurnout) {
        score -= 10;
      }

      health.score = Math.max(0, Math.round(score));

      // D: Determine Status String
      if (health.score < 60 || sensor.temp >= 80 || health.errorCount > 20) {
        status = "CRITICAL";
      } else if (health.score < 85 || sensor.temp > 65) {
        status = "WARNING";
      }

      health.status = status;
      health.lastResponseMs = 5 + Math.random() * 8; // jitter simulation
    }
  }

  /**
   * Start the autodiagnostic process for a fixture
   */
  public triggerSelfTest(
    fixture: FixtureInstance,
    universe: DMXUniverse,
    onComplete: (report: FixtureHealthReport) => void
  ): void {
    const health = this.healthStates.get(fixture.id);
    if (!health || health.status === "SELF_TESTING") return;

    health.status = "SELF_TESTING";
    console.log(`[Lighting Doctor] Iniciando Autodiagnóstico para ${fixture.name} (${fixture.id})...`);

    // Lock and define the 5 test steps (runs every 1.5 seconds)
    const steps = [
      {
        name: "Test de Canal Rojo",
        action: () => {
          universe.blackout();
          // Turn on Red channel and full dimmer
          const mapping = fixture.profile.mapping;
          if (mapping.red) universe.setChannel(fixture.address + mapping.red - 1, 255);
          if (mapping.dimmer) universe.setChannel(fixture.address + mapping.dimmer - 1, 255);
        },
        evaluate: () => {
          const sensor = this.getSensorFeed(fixture.id);
          const score = sensor.r >= 200 ? 100 : (sensor.r / 200) * 100;
          this.activeSelfTests.get(fixture.id)!.report.channels!.red = {
            expected: 255,
            observed: sensor.r,
            accuracy: Math.round(score),
            status: score >= 90 ? "OK" : score >= 50 ? "WARN" : "FAIL"
          };
        }
      },
      {
        name: "Test de Canal Verde",
        action: () => {
          universe.blackout();
          const mapping = fixture.profile.mapping;
          if (mapping.green) universe.setChannel(fixture.address + mapping.green - 1, 255);
          if (mapping.dimmer) universe.setChannel(fixture.address + mapping.dimmer - 1, 255);
        },
        evaluate: () => {
          const sensor = this.getSensorFeed(fixture.id);
          const score = sensor.g >= 200 ? 100 : (sensor.g / 200) * 100;
          this.activeSelfTests.get(fixture.id)!.report.channels!.green = {
            expected: 255,
            observed: sensor.g,
            accuracy: Math.round(score),
            status: score >= 90 ? "OK" : score >= 50 ? "WARN" : "FAIL"
          };
        }
      },
      {
        name: "Test de Canal Azul",
        action: () => {
          universe.blackout();
          const mapping = fixture.profile.mapping;
          if (mapping.blue) universe.setChannel(fixture.address + mapping.blue - 1, 255);
          if (mapping.dimmer) universe.setChannel(fixture.address + mapping.dimmer - 1, 255);
        },
        evaluate: () => {
          const sensor = this.getSensorFeed(fixture.id);
          const score = sensor.b >= 200 ? 100 : (sensor.b / 200) * 100;
          this.activeSelfTests.get(fixture.id)!.report.channels!.blue = {
            expected: 255,
            observed: sensor.b,
            accuracy: Math.round(score),
            status: score >= 90 ? "OK" : score >= 50 ? "WARN" : "FAIL"
          };
        }
      },
      {
        name: "Test de Dimmer Maestro",
        action: () => {
          universe.blackout();
          const mapping = fixture.profile.mapping;
          if (mapping.red) universe.setChannel(fixture.address + mapping.red - 1, 255);
          if (mapping.green) universe.setChannel(fixture.address + mapping.green - 1, 255);
          if (mapping.blue) universe.setChannel(fixture.address + mapping.blue - 1, 255);
          if (mapping.dimmer) universe.setChannel(fixture.address + mapping.dimmer - 1, 128); // 50% brightness
        },
        evaluate: () => {
          const sensor = this.getSensorFeed(fixture.id);
          // Expected is around 128 for R,G,B
          const avgObserved = (sensor.r + sensor.g + sensor.b) / 3;
          const accuracy = Math.max(0, 100 - Math.abs(128 - avgObserved) * 0.7);
          this.activeSelfTests.get(fixture.id)!.report.channels!.dimmer = {
            expected: 128,
            observed: Math.round(avgObserved),
            accuracy: Math.round(accuracy),
            status: accuracy >= 85 ? "OK" : accuracy >= 50 ? "WARN" : "FAIL"
          };
        }
      },
      {
        name: "Test de Velocidad de Estrobo",
        action: () => {
          universe.blackout();
          const mapping = fixture.profile.mapping;
          if (mapping.red) universe.setChannel(fixture.address + mapping.red - 1, 255);
          if (mapping.dimmer) universe.setChannel(fixture.address + mapping.dimmer - 1, 255);
          if (mapping.strobe) universe.setChannel(fixture.address + mapping.strobe - 1, 200); // strobe active
        },
        evaluate: () => {
          const sensor = this.getSensorFeed(fixture.id);
          // Simulated strobe frequency accuracy
          const accuracy = 90 + Math.random() * 10;
          this.activeSelfTests.get(fixture.id)!.report.channels!.strobe = {
            expected: 200,
            observed: Math.round(200 * (accuracy / 100)),
            accuracy: Math.round(accuracy),
            status: accuracy >= 90 ? "OK" : "WARN"
          };
        }
      }
    ];

    const report: Partial<FixtureHealthReport> = {
      fixtureId: fixture.id,
      timestamp: Date.now(),
      temperature: health.temperature,
      channels: {
        red: { expected: 0, observed: 0, accuracy: 0, status: "FAIL" },
        green: { expected: 0, observed: 0, accuracy: 0, status: "FAIL" },
        blue: { expected: 0, observed: 0, accuracy: 0, status: "FAIL" },
        dimmer: { expected: 0, observed: 0, accuracy: 0, status: "FAIL" },
        strobe: { expected: 0, observed: 0, accuracy: 0, status: "FAIL" }
      }
    };

    this.activeSelfTests.set(fixture.id, {
      step: 0,
      steps,
      report,
      onComplete
    });

    // Execute first step action immediately
    steps[0].action();
  }

  /**
   * Run the active step timer increments
   */
  private stepAccumulators = new Map<string, number>();

  private runActiveSelfTestStep(fixtureId: string, sensor: SensorData): void {
    const activeTest = this.activeSelfTests.get(fixtureId);
    if (!activeTest) return;

    let timeAcc = this.stepAccumulators.get(fixtureId) || 0;
    timeAcc += 0.025; // 25ms loop step
    this.stepAccumulators.set(fixtureId, timeAcc);

    // Each test step lasts 1.5 seconds
    if (timeAcc >= 1.5) {
      this.stepAccumulators.set(fixtureId, 0); // reset timer
      
      // 1. Evaluate current step
      const currentStepObj = activeTest.steps[activeTest.step];
      currentStepObj.evaluate();

      // 2. Advance to next step
      activeTest.step++;
      
      if (activeTest.step >= activeTest.steps.length) {
        // Complete self test
        const health = this.healthStates.get(fixtureId)!;
        const report = activeTest.report as FixtureHealthReport;

        // Calculate overall score
        const chanScores = [
          report.channels.red.accuracy,
          report.channels.green.accuracy,
          report.channels.blue.accuracy,
          report.channels.dimmer.accuracy,
          report.channels.strobe.accuracy
        ];
        report.overallScore = Math.round(chanScores.reduce((a, b) => a + b, 0) / chanScores.length);
        report.temperature = sensor.temp;

        // Conclusion
        let conclusion = "Luminaria en perfecto estado cromático y de regulación.";
        if (report.overallScore < 70) {
          conclusion = "CRÍTICO: Fallas severas detectadas en canales de color. Posible bombilla fundida o desconexión.";
        } else if (report.overallScore < 90) {
          conclusion = "PRECAUCIÓN: Desviaciones cromáticas detectadas. Se requiere calibración automática constante.";
        }
        report.conclusion = conclusion;

        // Sync health values
        health.score = report.overallScore;
        health.status = report.overallScore >= 90 ? "OK" : report.overallScore >= 70 ? "WARNING" : "CRITICAL";

        this.activeSelfTests.delete(fixtureId);
        this.stepAccumulators.delete(fixtureId);

        console.log(`[Lighting Doctor] Autodiagnóstico completo para ${fixtureId}. Puntaje: ${report.overallScore}%`);
        activeTest.onComplete(report);
      } else {
        // Run next step action
        activeTest.steps[activeTest.step].action();
      }
    }
  }

  public getActiveSelfTestProgress(fixtureId: string) {
    const test = this.activeSelfTests.get(fixtureId);
    if (!test) return null;
    return {
      step: test.step,
      total: test.steps.length,
      currentStepName: test.steps[test.step]?.name || "Finalizando"
    };
  }
}
