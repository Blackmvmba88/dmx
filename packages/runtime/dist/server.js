import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { DMXUniverse } from "@blackmamba/core";
import { uDMXTransmitter } from "@blackmamba/usb";
import { FixtureManager, DEFAULT_PROFILES } from "@blackmamba/fixtures";
import { EffectsEngine } from "@blackmamba/effects";
import { DoctorEngine } from "@blackmamba/doctor";
const PORT = process.env.PORT || 3001;
// Initialize core components
const universe = new DMXUniverse();
const transmitter = new uDMXTransmitter({ verbose: true });
const fixtureManager = new FixtureManager(universe);
const effectsEngine = new EffectsEngine();
const doctor = new DoctorEngine();
// Register default profiles
for (const [name, profile] of Object.entries(DEFAULT_PROFILES)) {
    fixtureManager.registerProfile(name, profile);
}
// Pre-add a few demo fixtures for an out-of-the-box experience
fixtureManager.addFixture("par1", "Steren PAR-040 Central", "steren-par-040", 1);
fixtureManager.addFixture("par2", "Steren PAR-040 Izquierda", "steren-par-040", 9);
fixtureManager.addFixture("par3", "Steren PAR-040 Derecha", "steren-par-040", 17);
// Setup transmitter
transmitter.connect();
// Statistics
let lastTickTime = process.hrtime.bigint();
let frameCount = 0;
let lastFpsUpdate = process.hrtime.bigint();
let currentFps = 0;
let totalTransmittedBytes = 0;
let packetsSent = 0;
let lastLatencyMs = 0;
// Audio context from UI
let currentAudioData = null;
// WebSocket clients
const clients = new Set();
// Express Setup
const app = express();
app.use(cors());
app.use(express.json());
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });
// Broadcast helper
function broadcast(message, excludeClient) {
    const payload = JSON.stringify(message);
    for (const client of clients) {
        if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}
// HTTP API endpoints
app.get("/api/status", (req, res) => {
    res.json({
        usbConnected: transmitter.getIsConnected(),
        fps: currentFps,
        packetsSent,
        totalBytes: totalTransmittedBytes,
        activeEffect: effectsEngine.getActiveEffectId(),
        lastLatencyMs
    });
});
app.get("/api/fixtures", (req, res) => {
    res.json(fixtureManager.getFixtures());
});
app.get("/api/profiles", (req, res) => {
    res.json(DEFAULT_PROFILES);
});
// WebSocket Handlers
wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(`[WebSocket] Cliente conectado. Total: ${clients.size}`);
    // Send initial state
    ws.send(JSON.stringify({
        type: "init",
        data: {
            usbConnected: transmitter.getIsConnected(),
            buffer: Array.from(universe.getBuffer()),
            fixtures: fixtureManager.getFixtures(),
            profiles: DEFAULT_PROFILES,
            effects: effectsEngine.getEffects().map(e => ({
                id: e.id,
                name: e.name,
                isActive: e.isActive,
                speed: e.speed,
                intensity: e.intensity,
                color: e.color
            })),
            activeEffect: effectsEngine.getActiveEffectId(),
            fps: currentFps,
            healthStates: doctor.getAllHealthStates()
        }
    }));
    ws.on("message", (messageData) => {
        try {
            const msg = JSON.parse(messageData.toString());
            switch (msg.type) {
                case "setChannel": {
                    const { channel, value } = msg.data;
                    universe.setChannel(channel, value);
                    break;
                }
                case "setFixtureColor": {
                    const { id, r, g, b, white, amber, uv } = msg.data;
                    fixtureManager.setFixtureColor(id, r, g, b, { white, amber, uv });
                    break;
                }
                case "setFixtureFeature": {
                    const { id, feature, value } = msg.data;
                    const fix = fixtureManager.getFixture(id);
                    if (fix) {
                        fix.setFeature(feature, value);
                    }
                    break;
                }
                case "setFixtureDimmer": {
                    const { id, value } = msg.data;
                    fixtureManager.setDimmer(id, value);
                    break;
                }
                case "setFixtureStrobe": {
                    const { id, speed } = msg.data;
                    fixtureManager.setStrobe(id, speed);
                    break;
                }
                case "blackout": {
                    universe.blackout();
                    // Also reset active effect
                    effectsEngine.activateEffect(null);
                    broadcast({ type: "activeEffectChanged", data: null });
                    break;
                }
                case "fullOn": {
                    universe.fullOn();
                    effectsEngine.activateEffect(null);
                    broadcast({ type: "activeEffectChanged", data: null });
                    break;
                }
                case "activateEffect": {
                    const effectId = msg.data;
                    effectsEngine.activateEffect(effectId);
                    broadcast({ type: "activeEffectChanged", data: effectId });
                    break;
                }
                case "configureEffect": {
                    const { id, speed, intensity, color } = msg.data;
                    effectsEngine.configureEffect(id, { speed, intensity, color });
                    const effect = effectsEngine.getEffect(id);
                    if (effect) {
                        broadcast({
                            type: "effectConfigured",
                            data: {
                                id,
                                speed: effect.speed,
                                intensity: effect.intensity,
                                color: effect.color
                            }
                        });
                    }
                    break;
                }
                case "addFixture": {
                    const { id, name, profileName, address } = msg.data;
                    fixtureManager.addFixture(id, name, profileName, address);
                    broadcast({ type: "fixturesChanged", data: fixtureManager.getFixtures() });
                    break;
                }
                case "removeFixture": {
                    const { id } = msg.data;
                    fixtureManager.removeFixture(id);
                    broadcast({ type: "fixturesChanged", data: fixtureManager.getFixtures() });
                    break;
                }
                case "audioData": {
                    // Drive music reactive effect directly
                    currentAudioData = msg.data;
                    break;
                }
                case "sensorUpdate": {
                    const { id, r, g, b, lux, temp } = msg.data;
                    doctor.updateSensorFeed(id, { r, g, b, lux, temp });
                    break;
                }
                case "triggerSelfTest": {
                    const { id } = msg.data;
                    const fix = fixtureManager.getFixture(id);
                    if (fix) {
                        doctor.triggerSelfTest(fix, universe, (report) => {
                            broadcast({
                                type: "selfTestComplete",
                                data: {
                                    fixtureId: id,
                                    report
                                }
                            });
                            broadcast({
                                type: "healthReportsChanged",
                                data: doctor.getAllHealthStates()
                            });
                        });
                        broadcast({
                            type: "healthReportsChanged",
                            data: doctor.getAllHealthStates()
                        });
                    }
                    break;
                }
            }
        }
        catch (e) {
            console.error("[WebSocket] Error procesando mensaje:", e);
        }
    });
    ws.on("close", () => {
        clients.delete(ws);
        console.log(`[WebSocket] Cliente desconectado. Total: ${clients.size}`);
    });
});
// Runtime Loop at 40 FPS (25ms)
const TICK_RATE_MS = 25;
const startTime = Date.now();
const tickInterval = setInterval(() => {
    const now = process.hrtime.bigint();
    const dt = Number(now - lastTickTime) / 1e9; // convert to seconds
    lastTickTime = now;
    const elapsedTime = (Date.now() - startTime) / 1000.0;
    // 1. Update active effects
    effectsEngine.update(elapsedTime, dt, fixtureManager.getFixtures(), universe, currentAudioData);
    // Update doctor engine
    doctor.update(fixtureManager.getFixtures(), universe, dt);
    // Broadcast self test progress
    for (const f of fixtureManager.getFixtures()) {
        const progress = doctor.getActiveSelfTestProgress(f.id);
        if (progress) {
            broadcast({
                type: "selfTestProgress",
                data: {
                    fixtureId: f.id,
                    ...progress
                }
            });
        }
    }
    // 2. Commit double buffer and capture changes
    const startLatency = process.hrtime.bigint();
    const changes = universe.commit();
    const endLatency = process.hrtime.bigint();
    lastLatencyMs = Number(endLatency - startLatency) / 1e6;
    // 3. If there are changes, transmit to USB and notify UI
    if (changes.size > 0) {
        const fullBuffer = universe.getBuffer();
        // Transmit to hardware
        transmitter.transmitChanges(changes, fullBuffer);
        packetsSent++;
        totalTransmittedBytes += changes.size;
        // Send delta changes to WebSocket clients
        broadcast({
            type: "update",
            data: {
                changes: Array.from(changes.entries()),
                buffer: Array.from(fullBuffer),
                latencyMs: lastLatencyMs
            }
        });
    }
    // 4. Calculate FPS
    frameCount++;
    const elapsedFpsTime = Number(now - lastFpsUpdate) / 1e9;
    if (elapsedFpsTime >= 1.0) {
        currentFps = Math.round(frameCount / elapsedFpsTime);
        frameCount = 0;
        lastFpsUpdate = now;
        // Periodically sync full buffer and performance status to keep clients aligned
        broadcast({
            type: "status",
            data: {
                usbConnected: transmitter.getIsConnected(),
                fps: currentFps,
                packetsSent,
                totalBytes: totalTransmittedBytes,
                lastLatencyMs
            }
        });
        // Sync health states
        broadcast({
            type: "healthReportsChanged",
            data: doctor.getAllHealthStates()
        });
    }
}, TICK_RATE_MS);
// Cleanup
process.on("SIGINT", () => {
    console.log("\n[Server] Apagando...");
    clearInterval(tickInterval);
    universe.blackout();
    const changes = universe.commit();
    transmitter.transmitChanges(changes, universe.getBuffer());
    transmitter.disconnect();
    httpServer.close(() => {
        console.log("[Server] Parado con éxito.");
        process.exit(0);
    });
});
// Start Server
httpServer.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`   BLACKMAMBA LIGHTING RUNTIME INICIADO (40 FPS)   `);
    console.log(`   Servidor HTTP/WS escuchando en puerto ${PORT}   `);
    console.log(`===================================================`);
});
