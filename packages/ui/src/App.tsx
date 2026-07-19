import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Trash2, 
  Plus, 
  Activity, 
  Volume2, 
  Layers, 
  Lightbulb, 
  Power,
  ShieldAlert,
  RotateCcw,
  Sparkles
} from "lucide-react";

interface FixtureProfile {
  name: string;
  channels: number;
  mapping: Record<string, number>;
}

interface Fixture {
  id: string;
  name: string;
  universe: number;
  address: number;
  channels: number;
  profile: FixtureProfile;
}

interface Effect {
  id: string;
  name: string;
  isActive: boolean;
  speed: number;
  intensity: number;
  color: [number, number, number];
}

interface FixtureHealth {
  id: string;
  score: number;
  temperature: number;
  lastResponseMs: number;
  errorCount: number;
  status: "OK" | "WARNING" | "CRITICAL" | "SELF_TESTING";
  calibrationScale: [number, number, number];
}

interface TestChannelResult {
  expected: number;
  observed: number;
  accuracy: number;
  status: "OK" | "FAIL" | "WARN";
}

interface FixtureHealthReport {
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

export default function App() {
  // Connection state
  const [connected, setConnected] = useState(false);
  const [usbConnected, setUsbConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  // DMX State
  const [dmxBuffer, setDmxBuffer] = useState<number[]>(new Array(512).fill(0));
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [profiles, setProfiles] = useState<Record<string, FixtureProfile>>({});
  const [effects, setEffects] = useState<Effect[]>([]);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  // Lighting Doctor State
  const [healthReports, setHealthReports] = useState<FixtureHealth[]>([]);
  const [selfTestProgress, setSelfTestProgress] = useState<{
    fixtureId: string;
    step: number;
    total: number;
    currentStepName: string;
  } | null>(null);
  const [lastSelfTestReport, setLastSelfTestReport] = useState<FixtureHealthReport | null>(null);

  // Fault Simulator State (fixtureId -> simulator values)
  const [simulatedSensors, setSimulatedSensors] = useState<Record<string, {
    rDrift: number;
    gDrift: number;
    bDrift: number;
    temp: number;
    isBroken: boolean;
  }>>({
    par1: { rDrift: 1.0, gDrift: 1.0, bDrift: 1.0, temp: 25, isBroken: false },
    par2: { rDrift: 1.0, gDrift: 1.0, bDrift: 1.0, temp: 25, isBroken: false },
    par3: { rDrift: 1.0, gDrift: 1.0, bDrift: 1.0, temp: 25, isBroken: false }
  });

  // Performance Stats
  const [fps, setFps] = useState(0);
  const [packetsSent, setPacketsSent] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);

  // UI Selection
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>("par1");
  const [activeTab, setActiveTab] = useState<"universe" | "console" | "doctor">("universe");

  // Add Fixture Modal Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFixId, setNewFixId] = useState("");
  const [newFixName, setNewFixName] = useState("");
  const [newFixProfile, setNewFixProfile] = useState("par-rgb-6ch");
  const [newFixAddress, setNewFixAddress] = useState(19);

  // Audio Processing for Music Reactive
  const [micActive, setMicActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [audioVolume, setAudioVolume] = useState(0);

  // Scenes list
  const [scenes, setScenes] = useState<{ id: string; name: string; buffer: number[] }[]>([
    { id: "scene1", name: "Azul Misterioso", buffer: [] },
    { id: "scene2", name: "Cálido Atardecer", buffer: [] }
  ]);

  // Connect to websocket backend
  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:3001`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      console.log("[WebSocket] Conectado al backend.");
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "init":
            setUsbConnected(msg.data.usbConnected);
            setDmxBuffer(msg.data.buffer);
            setFixtures(msg.data.fixtures);
            setProfiles(msg.data.profiles);
            setEffects(msg.data.effects);
            setActiveEffect(msg.data.activeEffect);
            setFps(msg.data.fps || 0);
            if (msg.data.healthStates) {
              setHealthReports(msg.data.healthStates);
            }
            break;
          case "update":
            setDmxBuffer(msg.data.buffer);
            if (msg.data.latencyMs !== undefined) {
              setLatencyMs(msg.data.latencyMs);
            }
            break;
          case "status":
            setUsbConnected(msg.data.usbConnected);
            setFps(msg.data.fps);
            setPacketsSent(msg.data.packetsSent);
            setTotalBytes(msg.data.totalBytes);
            if (msg.data.lastLatencyMs !== undefined) {
              setLatencyMs(msg.data.lastLatencyMs);
            }
            break;
          case "fixturesChanged":
            setFixtures(msg.data);
            break;
          case "activeEffectChanged":
            setActiveEffect(msg.data);
            break;
          case "effectConfigured": {
            const { id, speed, intensity, color } = msg.data;
            setEffects(prev => prev.map(e => e.id === id ? { ...e, speed, intensity, color } : e));
            break;
          }
          case "healthReportsChanged":
            setHealthReports(msg.data);
            break;
          case "selfTestProgress":
            if (selfTestProgress === null || selfTestProgress.fixtureId === msg.data.fixtureId) {
              setSelfTestProgress(msg.data);
            }
            break;
          case "selfTestComplete":
            setSelfTestProgress(null);
            setLastSelfTestReport(msg.data.report);
            break;
        }
      } catch (err) {
        console.error("Error al procesar mensaje websocket:", err);
      }
    };

    socket.onclose = () => {
      setConnected(false);
      setUsbConnected(false);
      console.warn("[WebSocket] Conexión cerrada.");
    };

    return () => {
      socket.close();
    };
  }, []);

  // Closed Loop Sensor Simulation Loop
  // Updates observed color on the server by computing expected color * simulator drifts
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      fixtures.forEach(f => {
        const sim = simulatedSensors[f.id] || { rDrift: 1.0, gDrift: 1.0, bDrift: 1.0, temp: 25, isBroken: false };
        
        // Read actual current DMX channels from the universe buffer (which includes AI Calibration scales already applied!)
        const rIdx = f.profile.mapping.red;
        const gIdx = f.profile.mapping.green;
        const bIdx = f.profile.mapping.blue;
        const dimIdx = f.profile.mapping.dimmer;

        const dimmer = dimIdx ? dmxBuffer[f.address + dimIdx - 2] || 0 : 255;
        const dimScale = dimmer / 255.0;

        const rawR = rIdx ? dmxBuffer[f.address + rIdx - 2] || 0 : 0;
        const rawG = gIdx ? dmxBuffer[f.address + gIdx - 2] || 0 : 0;
        const rawB = bIdx ? dmxBuffer[f.address + bIdx - 2] || 0 : 0;

        // Apply simulated physical drifts / faults (burned bulb, aging drift, high temperature)
        let rObs = rawR * dimScale * sim.rDrift;
        let gObs = rawG * dimScale * (sim.isBroken ? 0.0 : sim.gDrift);
        let bObs = rawB * dimScale * sim.bDrift;

        // Bound values
        rObs = Math.max(0, Math.min(255, Math.round(rObs)));
        gObs = Math.max(0, Math.min(255, Math.round(gObs)));
        bObs = Math.max(0, Math.min(255, Math.round(bObs)));

        const lux = Math.round((rObs + gObs + bObs) / 3);

        sendSocketMessage("sensorUpdate", {
          id: f.id,
          r: rObs,
          g: gObs,
          b: bObs,
          lux,
          temp: sim.temp
        });
      });
    }, 150);

    return () => clearInterval(interval);
  }, [fixtures, dmxBuffer, simulatedSensors, connected]);

  // Web Audio microphone processing loop
  const startMic = async () => {
    if (micActive) {
      stopMic();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // Small size for fast response
      analyserRef.current = analyser;

      source.connect(analyser);
      setMicActive(true);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAudio = () => {
        if (!analyserRef.current || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalizedVol = average / 255.0;
        setAudioVolume(normalizedVol);

        const frequencyData = Array.from(dataArray).map(val => val / 255.0);

        socketRef.current.send(JSON.stringify({
          type: "audioData",
          data: {
            volume: normalizedVol,
            frequencyData
          }
        }));

        animationFrameRef.current = requestAnimationFrame(updateAudio);
      };

      animationFrameRef.current = requestAnimationFrame(updateAudio);

      if (activeEffect !== "musicReactive") {
        sendSocketMessage("activateEffect", "musicReactive");
      }
    } catch (err) {
      console.error("No se pudo acceder al micrófono:", err);
      alert("Error al acceder al micrófono. Por favor permite los permisos.");
    }
  };

  const stopMic = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) audioContextRef.current.close();

    micStreamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    setMicActive(false);
    setAudioVolume(0);
  };

  const sendSocketMessage = (type: string, data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, data }));
    }
  };

  // Quick API wrappers
  const setChannel = (channel: number, value: number) => {
    sendSocketMessage("setChannel", { channel, value });
  };

  const setFixtureColor = (id: string, r: number, g: number, b: number, extra: { white?: number; amber?: number; uv?: number } = {}) => {
    sendSocketMessage("setFixtureColor", { id, r, g, b, ...extra });
  };

  const setFixtureFeature = (id: string, feature: string, value: number) => {
    sendSocketMessage("setFixtureFeature", { id, feature, value });
  };

  const setFixtureDimmer = (id: string, value: number) => {
    sendSocketMessage("setFixtureDimmer", { id, value });
  };

  const setFixtureStrobe = (id: string, speed: number) => {
    sendSocketMessage("setFixtureStrobe", { id, speed });
  };

  const triggerBlackout = () => {
    sendSocketMessage("blackout", null);
  };

  const triggerFullOn = () => {
    sendSocketMessage("fullOn", null);
  };

  const addFixture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFixId || !newFixName) return;

    sendSocketMessage("addFixture", {
      id: newFixId,
      name: newFixName,
      profileName: newFixProfile,
      address: Number(newFixAddress)
    });

    setSimulatedSensors(prev => ({
      ...prev,
      [newFixId]: { rDrift: 1.0, gDrift: 1.0, bDrift: 1.0, temp: 25, isBroken: false }
    }));

    setNewFixId("");
    setNewFixName("");
    setShowAddModal(false);
  };

  const removeFixture = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este fixture?")) {
      sendSocketMessage("removeFixture", { id });
      if (selectedFixtureId === id) setSelectedFixtureId(null);
    }
  };

  const configureEffect = (id: string, speed: number, intensity: number, color: [number, number, number]) => {
    sendSocketMessage("configureEffect", { id, speed, intensity, color });
  };

  // Scene triggers
  const saveScene = (name: string) => {
    const newScene = {
      id: "scene_" + Date.now(),
      name,
      buffer: [...dmxBuffer]
    };
    setScenes([...scenes, newScene]);
  };

  const loadScene = (scene: typeof scenes[0]) => {
    if (scene.buffer && scene.buffer.length > 0) {
      scene.buffer.forEach((val, idx) => {
        if (val !== dmxBuffer[idx]) {
          setChannel(idx + 1, val);
        }
      });
    } else {
      if (scene.id === "scene1") {
        fixtures.forEach(f => {
          setFixtureColor(f.id, 0, 0, 255);
          setFixtureDimmer(f.id, 255);
        });
      } else if (scene.id === "scene2") {
        fixtures.forEach(f => {
          setFixtureColor(f.id, 255, 80, 0);
          setFixtureDimmer(f.id, 255);
        });
      }
    }
  };

  // Doctor functions
  const triggerSelfTest = (fixtureId: string) => {
    setLastSelfTestReport(null);
    sendSocketMessage("triggerSelfTest", { id: fixtureId });
  };

  const updateSimulationSetting = (fixtureId: string, key: string, val: number | boolean) => {
    setSimulatedSensors(prev => {
      const current = prev[fixtureId] || { rDrift: 1.0, gDrift: 1.0, bDrift: 1.0, temp: 25, isBroken: false };
      return {
        ...prev,
        [fixtureId]: {
          ...current,
          [key]: val
        }
      };
    });
  };

  const selectedFixture = fixtures.find(f => f.id === selectedFixtureId);
  const selectedHealth = healthReports.find(h => h.id === selectedFixtureId);
  const selectedSim = selectedFixtureId ? simulatedSensors[selectedFixtureId] : null;
  
  // Calculate expected colors based on actual logical values (uncalibrated expected color)
  const getExpectedColor = (f: Fixture) => {
    const rIdx = f.profile.mapping.red;
    const gIdx = f.profile.mapping.green;
    const bIdx = f.profile.mapping.blue;
    const dimIdx = f.profile.mapping.dimmer;

    const dimmer = dimIdx ? dmxBuffer[f.address + dimIdx - 2] || 0 : 255;
    const dimScale = dimmer / 255.0;

    // To display expected color without calibration, we read logical values.
    // However, since dmxBuffer already contains the calibrated/adjusted value,
    // to find the true intended color we can divide by the calibration scale!
    const health = healthReports.find(h => h.id === f.id);
    const rScale = health ? health.calibrationScale[0] : 1.0;
    const gScale = health ? health.calibrationScale[1] : 1.0;
    const bScale = health ? health.calibrationScale[2] : 1.0;

    let r = rIdx ? dmxBuffer[f.address + rIdx - 2] || 0 : 0;
    let g = gIdx ? dmxBuffer[f.address + gIdx - 2] || 0 : 0;
    let b = bIdx ? dmxBuffer[f.address + bIdx - 2] || 0 : 0;

    r = Math.round(r / rScale);
    g = Math.round(g / gScale);
    b = Math.round(b / bScale);

    const uvIdx = f.profile.mapping.uv;
    const uv = uvIdx ? dmxBuffer[f.address + uvIdx - 2] || 0 : 0;

    // Mix UV value (CH8) into Red (x0.3) and Blue (x0.6) for indigo glow representation
    const finalR = Math.min(255, Math.round(r * dimScale) + Math.round(uv * 0.3));
    const finalG = Math.round(g * dimScale);
    const finalB = Math.min(255, Math.round(b * dimScale) + Math.round(uv * 0.6));

    return {
      r: finalR,
      g: finalG,
      b: finalB
    };
  };

  // Get observed sensor readings
  const getObservedColor = (f: Fixture) => {
    const expected = getExpectedColor(f);
    const sim = simulatedSensors[f.id] || { rDrift: 1.0, gDrift: 1.0, bDrift: 1.0, temp: 25, isBroken: false };
    
    // The expected is what DMX originally calculated before calibration.
    // The actual emitted DMX (with calibration) is:
    const health = healthReports.find(h => h.id === f.id);
    const rScale = health ? health.calibrationScale[0] : 1.0;
    const gScale = health ? health.calibrationScale[1] : 1.0;
    const bScale = health ? health.calibrationScale[2] : 1.0;

    let rObs = expected.r * rScale * sim.rDrift;
    let gObs = expected.g * gScale * (sim.isBroken ? 0.0 : sim.gDrift);
    let bObs = expected.b * bScale * sim.bDrift;

    return {
      r: Math.max(0, Math.min(255, Math.round(rObs))),
      g: Math.max(0, Math.min(255, Math.round(gObs))),
      b: Math.max(0, Math.min(255, Math.round(bObs)))
    };
  };

  const getMatchPercentage = (f: Fixture) => {
    const expected = getExpectedColor(f);
    const observed = getObservedColor(f);

    if (expected.r === 0 && expected.g === 0 && expected.b === 0) {
      return observed.r === 0 && observed.g === 0 && observed.b === 0 ? 100 : 0;
    }

    const diffR = Math.abs(expected.r - observed.r);
    const diffG = Math.abs(expected.g - observed.g);
    const diffB = Math.abs(expected.b - observed.b);

    const errorSum = (diffR + diffG + diffB) / (3 * 255);
    return Math.max(0, Math.round((1 - errorSum) * 100));
  };

  const getFixtureRGB = (f: Fixture) => {
    const exp = getExpectedColor(f);
    return `rgb(${exp.r}, ${exp.g}, ${exp.b})`;
  };

  const getFixtureDimmerVal = (f: Fixture) => {
    const dIdx = f.profile.mapping.dimmer;
    return dIdx ? dmxBuffer[f.address + dIdx - 2] || 0 : 255;
  };

  const getModePreset = (val: number): string => {
    if (val <= 10) return "0";
    if (val <= 50) return "30";
    if (val <= 100) return "75";
    if (val <= 150) return "125";
    if (val <= 200) return "175";
    return "230";
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-container">
          <Layers className="text-cyan-400" size={24} style={{ color: "#00f0ff" }} />
          <span className="logo-text">BlackMamba DMX</span>
        </div>

        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          {/* Audio Reactivity Toggle */}
          <button 
            className={`btn ${micActive ? 'btn-active' : ''}`}
            onClick={startMic}
            style={{ padding: "6px 12px", fontSize: "12px" }}
          >
            <Volume2 size={16} />
            {micActive ? "Micrófono Activo" : "Activar Audio"}
          </button>

          {/* Connection Status Badges */}
          <div className={`status-badge ${connected ? "status-online" : "status-offline"}`}>
            <span style={{ 
              width: "8px", 
              height: "8px", 
              borderRadius: "50%", 
              backgroundColor: "currentColor" 
            }}></span>
            WS: {connected ? "Conectado" : "Desconectado"}
          </div>

          <div className={`status-badge ${usbConnected ? "status-online" : "status-offline"}`}>
            <span style={{ 
              width: "8px", 
              height: "8px", 
              borderRadius: "50%", 
              backgroundColor: "currentColor" 
            }}></span>
            USB: {usbConnected ? "uDMX Listo" : "Modo Virtual"}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="app-main">
        
        {/* Sidebar Left: Fixtures */}
        <section className="sidebar">
          <div className="panel" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Lightbulb size={18} style={{ color: "#00f0ff" }} />
                Luminarias
              </h3>
              <button 
                className="btn" 
                style={{ padding: "4px 8px", borderRadius: "6px" }}
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", flex: 1 }}>
              {fixtures.map(f => {
                const health = healthReports.find(h => h.id === f.id);
                return (
                  <div 
                    key={f.id} 
                    className={`fixture-card ${selectedFixtureId === f.id ? "fixture-card-selected" : ""}`}
                    onClick={() => setSelectedFixtureId(f.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div 
                        className="fixture-card-color" 
                        style={{ 
                          backgroundColor: getFixtureRGB(f),
                          color: getFixtureRGB(f)
                        }}
                      ></div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "5px" }}>
                          {f.name}
                          {health && (
                            <span style={{ 
                              fontSize: "10px", 
                              color: health.status === "OK" ? "var(--accent-green)" : health.status === "WARNING" ? "var(--accent-yellow)" : "var(--accent-red)",
                              opacity: 0.8
                            }}>
                              ({health.score}%)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
                          CH{f.address} | {f.profile.name}
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFixture(f.id);
                      }}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scenes */}
          <div className="panel" style={{ height: "240px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "15px" }}>Escenas y Presets</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", flex: 1 }}>
              {scenes.map(s => (
                <button 
                  key={s.id} 
                  className="btn" 
                  style={{ justifyContent: "flex-start", fontSize: "13px", padding: "8px 12px" }}
                  onClick={() => loadScene(s)}
                >
                  <Play size={14} style={{ color: "#39ff14" }} />
                  {s.name}
                </button>
              ))}
            </div>
            
            <button 
              className="btn btn-primary" 
              style={{ marginTop: "10px", fontSize: "12px", padding: "8px" }}
              onClick={() => {
                const name = prompt("Introduce el nombre de la escena:");
                if (name) saveScene(name);
              }}
            >
              Guardar Escena Actual
            </button>
          </div>
        </section>

        {/* Center: Universe Grid or Master Console or Doctor Dashboard */}
        <section className="workspace-center">
          
          {/* Tabs */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <button 
                className={`btn ${activeTab === "universe" ? "btn-active" : ""}`}
                onClick={() => setActiveTab("universe")}
              >
                Visualizador Universo
              </button>
              <button 
                className={`btn ${activeTab === "console" ? "btn-active" : ""}`}
                onClick={() => setActiveTab("console")}
              >
                Consola Manual
              </button>
              <button 
                className={`btn ${activeTab === "doctor" ? "btn-active" : ""}`}
                onClick={() => setActiveTab("doctor")}
                style={{ borderColor: "var(--accent-magenta)", color: activeTab === "doctor" ? "var(--accent-magenta)" : undefined }}
              >
                Lighting Doctor 🩺
              </button>
            </div>

            {activeTab === "universe" ? (
              // Universe Viewer 512 Grid
              <div className="universe-grid">
                {dmxBuffer.map((val, idx) => {
                  const channelNum = idx + 1;
                  let colorValue = "rgba(255, 255, 255, 0.05)";
                  
                  for (const f of fixtures) {
                    if (channelNum >= f.address && channelNum < f.address + f.channels) {
                      const offset = channelNum - f.address + 1;
                      if (offset === f.profile.mapping.red) colorValue = "rgba(255, 0, 0, 0.25)";
                      else if (offset === f.profile.mapping.green) colorValue = "rgba(0, 255, 0, 0.25)";
                      else if (offset === f.profile.mapping.blue) colorValue = "rgba(0, 0, 255, 0.25)";
                      else if (offset === f.profile.mapping.dimmer) colorValue = "rgba(255, 255, 255, 0.15)";
                      else colorValue = "rgba(157, 78, 221, 0.25)";
                    }
                  }

                  const glowFactor = val / 255.0;
                  
                  return (
                    <div 
                      key={idx}
                      className={`channel-cell ${val > 0 ? "channel-cell-active" : ""}`}
                      style={{ 
                        background: val > 0 ? `rgba(0, 240, 255, ${0.05 + glowFactor * 0.15})` : colorValue,
                        borderColor: val > 0 ? `rgba(0, 240, 255, ${0.1 + glowFactor * 0.4})` : undefined,
                        boxShadow: val > 0 ? `0 0 8px rgba(0, 240, 255, ${glowFactor * 0.2})` : undefined
                      }}
                      title={`Canal ${channelNum}: ${val}`}
                      onClick={() => {
                        const newVal = prompt(`Modificar valor Canal ${channelNum} (0-255):`, val.toString());
                        if (newVal !== null) {
                          const parsed = parseInt(newVal);
                          if (!isNaN(parsed)) setChannel(channelNum, parsed);
                        }
                      }}
                    >
                      <div>{channelNum}</div>
                      <div className="channel-value" style={{ opacity: val > 0 ? 1 : 0.4 }}>{val}</div>
                    </div>
                  );
                })}
              </div>
            ) : activeTab === "console" ? (
              // Manual Faders Console
              <div className="faders-container">
                {Array.from({ length: 64 }).map((_, idx) => {
                  const channelNum = idx + 1;
                  const val = dmxBuffer[idx] || 0;
                  return (
                    <div key={idx} className="fader-strip">
                      <span className="fader-value">{val}</span>
                      <div className="fader-slider-container">
                        <input 
                          type="range" 
                          min="0" 
                          max="255" 
                          value={val}
                          className="fader-slider"
                          onChange={(e) => setChannel(channelNum, Number(e.target.value))}
                        />
                      </div>
                      <span className="fader-label">CH {channelNum}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              // LIGHTING DOCTOR OBSERVED vs EXPECTED Gemelo Digital View
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto", flex: 1 }}>
                
                {selectedFixture ? (
                  <>
                    {/* Digital Twin View */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                      <div className="panel" style={{ background: "rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                        <h4 style={{ color: "var(--text-secondary)" }}>Gemelo Virtual (Esperado)</h4>
                        <div style={{ 
                          width: "120px", 
                          height: "120px", 
                          borderRadius: "16px", 
                          backgroundColor: `rgb(${getExpectedColor(selectedFixture).r}, ${getExpectedColor(selectedFixture).g}, ${getExpectedColor(selectedFixture).b})`,
                          border: "2px solid var(--border-color)",
                          boxShadow: "0 0 20px rgba(255,255,255,0.05)"
                        }}></div>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>
                          RGB: {getExpectedColor(selectedFixture).r}, {getExpectedColor(selectedFixture).g}, {getExpectedColor(selectedFixture).b}
                        </div>
                      </div>

                      <div className="panel" style={{ background: "rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                        <h4 style={{ color: "var(--text-secondary)" }}>Luminaria Física (Observado)</h4>
                        <div style={{ 
                          width: "120px", 
                          height: "120px", 
                          borderRadius: "16px", 
                          backgroundColor: `rgb(${getObservedColor(selectedFixture).r}, ${getObservedColor(selectedFixture).g}, ${getObservedColor(selectedFixture).b})`,
                          border: "2px solid var(--border-color)",
                          boxShadow: `0 0 25px rgba(${getObservedColor(selectedFixture).r}, ${getObservedColor(selectedFixture).g}, ${getObservedColor(selectedFixture).b}, 0.2)`
                        }}></div>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>
                          RGB: {getObservedColor(selectedFixture).r}, {getObservedColor(selectedFixture).g}, {getObservedColor(selectedFixture).b}
                        </div>
                      </div>
                    </div>

                    {/* Calibration Metrics */}
                    <div className="panel" style={{ background: "rgba(0,0,0,0.15)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <h4 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Sparkles size={16} style={{ color: "var(--accent-cyan)" }} />
                          Matriz de Calibración en Tiempo Real (AI Auto-Calibration)
                        </h4>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent-cyan)" }}>
                          Coincidencia Gemela: {getMatchPercentage(selectedFixture)}%
                        </div>
                      </div>
                      
                      {selectedHealth && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "15px", fontSize: "12px" }}>
                          <div style={{ background: "rgba(255, 0, 0, 0.05)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255, 0, 0, 0.15)" }}>
                            <div style={{ color: "#ff6b6b", fontWeight: 700 }}>Canal Rojo (R)</div>
                            <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "5px" }}>
                              x{selectedHealth.calibrationScale[0].toFixed(3)}
                            </div>
                            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "2px" }}>
                              {selectedHealth.calibrationScale[0] > 1.01 ? "Compensando pérdida" : selectedHealth.calibrationScale[0] < 0.99 ? "Atenuando exceso" : "Calibrado nominal"}
                            </div>
                          </div>
                          
                          <div style={{ background: "rgba(0, 255, 0, 0.05)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0, 255, 0, 0.15)" }}>
                            <div style={{ color: "#51cf66", fontWeight: 700 }}>Canal Verde (G)</div>
                            <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "5px" }}>
                              x{selectedHealth.calibrationScale[1].toFixed(3)}
                            </div>
                            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "2px" }}>
                              {selectedHealth.calibrationScale[1] > 1.01 ? "Compensando pérdida" : selectedHealth.calibrationScale[1] < 0.99 ? "Atenuando exceso" : "Calibrado nominal"}
                            </div>
                          </div>

                          <div style={{ background: "rgba(0, 240, 255, 0.05)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0, 240, 255, 0.15)" }}>
                            <div style={{ color: "#339af0", fontWeight: 700 }}>Canal Azul (B)</div>
                            <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "5px" }}>
                              x{selectedHealth.calibrationScale[2].toFixed(3)}
                            </div>
                            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "2px" }}>
                              {selectedHealth.calibrationScale[2] > 1.01 ? "Compensando pérdida" : selectedHealth.calibrationScale[2] < 0.99 ? "Atenuando exceso" : "Calibrado nominal"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Autodiagnóstico (Self Test) orchestrator UI */}
                    <div className="panel" style={{ background: "rgba(0,0,0,0.15)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                        <h4>Autodiagnóstico (Self-Test Engine)</h4>
                        <button 
                          className="btn btn-primary"
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                          onClick={() => triggerSelfTest(selectedFixture.id)}
                          disabled={selectedHealth?.status === "SELF_TESTING"}
                        >
                          Comenzar Test Clínico (10s)
                        </button>
                      </div>

                      {selfTestProgress && selfTestProgress.fixtureId === selectedFixture.id ? (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                            <span>Paso {selfTestProgress.step} de {selfTestProgress.total}: <strong>{selfTestProgress.currentStepName}</strong></span>
                            <span>{Math.round((selfTestProgress.step / selfTestProgress.total) * 100)}%</span>
                          </div>
                          <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                            <div style={{ 
                              width: `${(selfTestProgress.step / selfTestProgress.total) * 100}%`, 
                              height: "100%", 
                              background: "linear-gradient(90deg, var(--accent-cyan), var(--accent-magenta))",
                              transition: "width 0.2s ease"
                            }}></div>
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "8px", animation: "pulse 1.5s infinite" }}>
                            ⏱ Ejecutando barrido físico y comparando lecturas del sensor...
                          </div>
                        </div>
                      ) : lastSelfTestReport && lastSelfTestReport.fixtureId === selectedFixture.id ? (
                        <div style={{ fontSize: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", marginBottom: "8px" }}>
                            <span style={{ fontWeight: 700, color: lastSelfTestReport.overallScore >= 90 ? "var(--accent-green)" : lastSelfTestReport.overallScore >= 70 ? "var(--accent-yellow)" : "var(--accent-red)" }}>
                              Resultado: {lastSelfTestReport.overallScore}% Salud
                            </span>
                            <span style={{ color: "var(--text-secondary)" }}>
                              {new Date(lastSelfTestReport.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", marginBottom: "10px" }}>
                            {Object.entries(lastSelfTestReport.channels).map(([chan, res]) => (
                              <div key={chan} style={{ background: "rgba(0,0,0,0.2)", padding: "8px", borderRadius: "6px", textAlign: "center" }}>
                                <div style={{ textTransform: "capitalize", fontWeight: 600 }}>{chan}</div>
                                <div style={{ 
                                  fontSize: "14px", 
                                  fontWeight: 800, 
                                  color: res.status === "OK" ? "var(--accent-green)" : res.status === "WARN" ? "var(--accent-yellow)" : "var(--accent-red)",
                                  margin: "4px 0"
                                }}>{res.accuracy}%</div>
                                <div style={{ fontSize: "9px", color: "var(--text-secondary)" }}>obs: {res.observed}</div>
                              </div>
                            ))}
                          </div>

                          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "8px" }}>
                            <strong>Conclusión clínica:</strong> {lastSelfTestReport.conclusion}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", textAlign: "center", padding: "15px 0" }}>
                          Presiona el botón para iniciar el barrido de calibración y verificar físicamente los emisores LED.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)" }}>
                    Selecciona una luminaria de la izquierda para ver su historial clínico y Gemelo Digital
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Global Controls */}
          <div className="panel" style={{ height: "130px", display: "flex", gap: "20px", alignItems: "center", justifyItems: "stretch" }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>Controles Globales</h4>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={triggerBlackout}>
                  <Power size={16} /> BLACKOUT
                </button>
                <button className="btn btn-success" style={{ flex: 1 }} onClick={triggerFullOn}>
                  FULL ON (255)
                </button>
              </div>
            </div>

            {/* Audio Indicator */}
            {micActive && (
              <div style={{ width: "160px" }}>
                <h4 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>Entrada Audio Mic</h4>
                <div className="audio-visualizer">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const hVal = Math.random() * audioVolume * 40;
                    return (
                      <div 
                        key={i} 
                        className="audio-bar" 
                        style={{ height: `${Math.max(2, hVal)}px` }}
                      ></div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Sidebar Right: Fixture Inspector & Effects & Doctor Fault Injector */}
        <section className="sidebar">
          
          {activeTab !== "doctor" ? (
            <>
              {/* Fixture Inspector */}
              <div className="panel" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontSize: "16px", marginBottom: "15px" }}>Inspector de Luminaria</h3>
                
                {selectedFixture ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "15px", flex: 1, overflowY: "auto" }}>
                    <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                      <div style={{ fontWeight: 700, fontSize: "15px" }}>{selectedFixture.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                        Dirección DMX: CH{selectedFixture.address} | Universo: {selectedFixture.universe}
                      </div>
                    </div>

                    {/* Color Picker for RGB */}
                    {selectedFixture.profile.mapping.red !== undefined && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div>
                          <h4 style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>Color Rápido</h4>
                          <div className="color-preset-grid">
                            {[
                              [255, 0, 0], [0, 255, 0], [0, 0, 255], 
                              [255, 255, 0], [0, 255, 255], [255, 0, 255],
                              [255, 255, 255], [255, 127, 0], [128, 0, 255],
                              [0, 255, 127], [255, 0, 127], [0, 0, 0]
                            ].map((rgb, idx) => {
                              const rgbString = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
                              return (
                                <div 
                                  key={idx}
                                  className="color-dot"
                                  style={{ backgroundColor: rgbString, color: rgbString }}
                                  onClick={() => {
                                    // Set direct control mode first on PAR-040
                                    if (selectedFixture.profile.mapping.mode !== undefined) {
                                      setFixtureFeature(selectedFixture.id, "mode", 0);
                                      setFixtureFeature(selectedFixture.id, "macro", 0);
                                    }
                                    setFixtureColor(selectedFixture.id, rgb[0], rgb[1], rgb[2]);
                                  }}
                                ></div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Steren PAR-040 Custom Presets */}
                        {selectedFixture.profile.name.includes("PAR-040") && (
                          <div>
                            <h4 style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "6px" }}>Presets Especiales Steren</h4>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                              <button 
                                type="button"
                                className="btn" 
                                style={{ fontSize: "10px", padding: "6px 8px", justifyContent: "center" }}
                                onClick={() => {
                                  setFixtureFeature(selectedFixture.id, "mode", 0);
                                  setFixtureFeature(selectedFixture.id, "macro", 0);
                                  setFixtureFeature(selectedFixture.id, "speed", 0);
                                  setFixtureDimmer(selectedFixture.id, 255);
                                  setFixtureColor(selectedFixture.id, 165, 0, 255, { uv: 30 });
                                }}
                              >
                                💜 BlackMamba (Morado)
                              </button>
                              <button 
                                type="button"
                                className="btn" 
                                style={{ fontSize: "10px", padding: "6px 8px", justifyContent: "center" }}
                                onClick={() => {
                                  setFixtureFeature(selectedFixture.id, "mode", 0);
                                  setFixtureFeature(selectedFixture.id, "macro", 0);
                                  setFixtureFeature(selectedFixture.id, "speed", 0);
                                  setFixtureDimmer(selectedFixture.id, 255);
                                  setFixtureColor(selectedFixture.id, 45, 255, 0, { uv: 15 });
                                }}
                              >
                                💚 Evangelion (Verde)
                              </button>
                              <button 
                                type="button"
                                className="btn" 
                                style={{ fontSize: "10px", padding: "6px 8px", justifyContent: "center" }}
                                onClick={() => {
                                  setFixtureFeature(selectedFixture.id, "mode", 0);
                                  setFixtureFeature(selectedFixture.id, "macro", 0);
                                  setFixtureFeature(selectedFixture.id, "speed", 0);
                                  setFixtureDimmer(selectedFixture.id, 255);
                                  setFixtureColor(selectedFixture.id, 0, 0, 0, { uv: 255 });
                                }}
                              >
                                🔮 Ultravioleta Puro
                              </button>
                              <button 
                                type="button"
                                className="btn" 
                                style={{ fontSize: "10px", padding: "6px 8px", justifyContent: "center" }}
                                onClick={() => {
                                  setFixtureFeature(selectedFixture.id, "mode", 0);
                                  setFixtureFeature(selectedFixture.id, "macro", 0);
                                  setFixtureFeature(selectedFixture.id, "speed", 0);
                                  setFixtureDimmer(selectedFixture.id, 255);
                                  setFixtureColor(selectedFixture.id, 255, 255, 255, { uv: 0 });
                                }}
                              >
                                ⚪ Blanco RGB
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dimmer Slider */}
                    {selectedFixture.profile.mapping.dimmer !== undefined && (
                      <div className="form-group">
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span className="form-label">Dimmer Maestro</span>
                          <span className="fader-value">{getFixtureDimmerVal(selectedFixture)}</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="255"
                          value={getFixtureDimmerVal(selectedFixture)}
                          onChange={(e) => setFixtureDimmer(selectedFixture.id, Number(e.target.value))}
                          style={{ accentColor: "var(--accent-cyan)" }}
                        />
                      </div>
                    )}

                    {/* Strobe Slider */}
                    {selectedFixture.profile.mapping.strobe !== undefined && (
                      <div className="form-group">
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span className="form-label">Estrobo (Strobe)</span>
                          <span className="fader-value">
                            {dmxBuffer[selectedFixture.address + selectedFixture.profile.mapping.strobe - 2] || 0}
                          </span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="255"
                          value={dmxBuffer[selectedFixture.address + selectedFixture.profile.mapping.strobe - 2] || 0}
                          onChange={(e) => setFixtureStrobe(selectedFixture.id, Number(e.target.value))}
                          style={{ accentColor: "var(--accent-magenta)" }}
                        />
                      </div>
                    )}

                    {/* UV Slider */}
                    {selectedFixture.profile.mapping.uv !== undefined && (
                      <div className="form-group">
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span className="form-label">Canal Ultravioleta (UV)</span>
                          <span className="fader-value">
                            {dmxBuffer[selectedFixture.address + selectedFixture.profile.mapping.uv - 2] || 0}
                          </span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="255"
                          value={dmxBuffer[selectedFixture.address + selectedFixture.profile.mapping.uv - 2] || 0}
                          onChange={(e) => setFixtureFeature(selectedFixture.id, "uv", Number(e.target.value))}
                          style={{ accentColor: "#9b5de5" }}
                        />
                      </div>
                    )}

                    {/* Mode, Macro & Speed Controls for PAR-040 */}
                    {selectedFixture.profile.mapping.mode !== undefined && (
                      <div style={{ 
                        border: "1px solid var(--border-color)", 
                        padding: "12px", 
                        borderRadius: "8px", 
                        background: "rgba(0,0,0,0.15)", 
                        display: "flex", 
                        flexDirection: "column", 
                        gap: "10px",
                        marginTop: "5px",
                        marginBottom: "10px"
                      }}>
                        <h4 style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Efectos Hardware (PAR-040)
                        </h4>
                        
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: "9px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Modo de Funcionamiento (CH1)</label>
                          <select
                            className="input-field"
                            style={{ fontSize: "11px", padding: "6px", width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-main)" }}
                            value={getModePreset(dmxBuffer[selectedFixture.address + selectedFixture.profile.mapping.mode - 2] || 0)}
                            onChange={(e) => setFixtureFeature(selectedFixture.id, "mode", Number(e.target.value))}
                          >
                            <option value="0">Control Directo DMX (RGBUV)</option>
                            <option value="30">Dimmer por CH2 (11-50)</option>
                            <option value="75">Efecto JUMP (51-100)</option>
                            <option value="125">Efecto PULSO (101-150)</option>
                            <option value="175">Modo Audiorrítmico (151-200)</option>
                            <option value="230">Estrobo Automático (201-255)</option>
                          </select>
                        </div>

                        {selectedFixture.profile.mapping.macro !== undefined && (
                          <div className="form-group" style={{ margin: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "var(--text-muted)" }}>
                              <span>Selección de Color CH2 (Si CH1 &gt; 10)</span>
                              <span>{dmxBuffer[selectedFixture.address + selectedFixture.profile.mapping.macro - 2] || 0}</span>
                            </div>
                            <input 
                              type="range"
                              min="0"
                              max="255"
                              value={dmxBuffer[selectedFixture.address + selectedFixture.profile.mapping.macro - 2] || 0}
                              onChange={(e) => setFixtureFeature(selectedFixture.id, "macro", Number(e.target.value))}
                            />
                          </div>
                        )}

                        {selectedFixture.profile.mapping.speed !== undefined && (
                          <div className="form-group" style={{ margin: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "var(--text-muted)" }}>
                              <span>Velocidad de Efecto CH3</span>
                              <span>{dmxBuffer[selectedFixture.address + selectedFixture.profile.mapping.speed - 2] || 0}</span>
                            </div>
                            <input 
                              type="range"
                              min="0"
                              max="255"
                              value={dmxBuffer[selectedFixture.address + selectedFixture.profile.mapping.speed - 2] || 0}
                              onChange={(e) => setFixtureFeature(selectedFixture.id, "speed", Number(e.target.value))}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* General Inspector Values */}
                    <div>
                      <h4 style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>Mapa de Canales</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {Object.entries(selectedFixture.profile.mapping).map(([feature, offset]) => {
                          if (offset === undefined) return null;
                          const ch = selectedFixture.address + offset - 1;
                          return (
                            <div key={feature} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", background: "rgba(0,0,0,0.1)", padding: "4px 8px", borderRadius: "4px" }}>
                              <span style={{ textTransform: "capitalize" }}>{feature} (CH {ch})</span>
                              <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>{dmxBuffer[ch - 1] || 0}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", fontSize: "13px" }}>
                    Selecciona una luminaria para inspeccionarla
                  </div>
                )}
              </div>

              {/* Effects Selector */}
              <div className="panel" style={{ height: "300px", display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontSize: "16px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Activity size={18} style={{ color: "var(--accent-magenta)" }} />
                  Efectos Automáticos
                </h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", flex: 1 }}>
                  <button 
                    className={`btn ${activeEffect === null ? "btn-active" : ""}`}
                    style={{ justifyContent: "flex-start", fontSize: "13px" }}
                    onClick={() => sendSocketMessage("activateEffect", null)}
                  >
                    🔴 Sin Efecto (Manual)
                  </button>

                  {effects.map(e => (
                    <div key={e.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <button 
                        className={`btn ${activeEffect === e.id ? "btn-active" : ""}`}
                        style={{ justifyContent: "flex-start", fontSize: "13px" }}
                        onClick={() => sendSocketMessage("activateEffect", e.id)}
                      >
                        ✨ {e.name}
                      </button>

                      {activeEffect === e.id && (
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "8px", margin: "4px 0 8px 0" }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                              <span>Velocidad</span>
                              <span>{e.speed.toFixed(1)}x</span>
                            </div>
                            <input 
                              type="range"
                              min="0.1"
                              max="8"
                              step="0.1"
                              value={e.speed}
                              onChange={(el) => configureEffect(e.id, Number(el.target.value), e.intensity, e.color)}
                            />
                          </div>
                          <div className="form-group" style={{ margin: "6px 0 0 0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                              <span>Intensidad</span>
                              <span>{Math.round(e.intensity * 100)}%</span>
                            </div>
                            <input 
                              type="range"
                              min="0.0"
                              max="1.0"
                              step="0.05"
                              value={e.intensity}
                              onChange={(el) => configureEffect(e.id, e.speed, Number(el.target.value), e.color)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            // LIGHTING DOCTOR: FAULT INJECTOR (Inyector de fallas simuladas)
            <div className="panel" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldAlert size={18} style={{ color: "var(--accent-yellow)" }} />
                Inyector de Fallas
              </h3>
              <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "15px", lineHeight: "1.4" }}>
                Modifica los valores del sensor físico simulado para probar cómo reacciona el <strong>Lighting Doctor</strong> y calibra la señal la IA.
              </p>

              {selectedFixture && selectedSim ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1, overflowY: "auto" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                    Simulador: {selectedFixture.name}
                  </div>

                  {/* Red bulb aging */}
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                      <span>Degradación Canal Rojo (R)</span>
                      <span style={{ color: selectedSim.rDrift !== 1.0 ? "var(--accent-yellow)" : "var(--text-secondary)" }}>
                        x{selectedSim.rDrift.toFixed(2)}
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0.4"
                      max="1.4"
                      step="0.05"
                      value={selectedSim.rDrift}
                      onChange={(e) => updateSimulationSetting(selectedFixture.id, "rDrift", Number(e.target.value))}
                    />
                    <div style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                      {selectedSim.rDrift < 1.0 ? "Emisión baja (Bulbo viejo)" : selectedSim.rDrift > 1.0 ? "Emisión excesiva (Bulbo saturado)" : "Normal (100%)"}
                    </div>
                  </div>

                  {/* Green bulb aging */}
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                      <span>Degradación Canal Verde (G)</span>
                      <span style={{ color: selectedSim.gDrift !== 1.0 ? "var(--accent-yellow)" : "var(--text-secondary)" }}>
                        x{selectedSim.gDrift.toFixed(2)}
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0.4"
                      max="1.4"
                      step="0.05"
                      value={selectedSim.gDrift}
                      onChange={(e) => updateSimulationSetting(selectedFixture.id, "gDrift", Number(e.target.value))}
                      disabled={selectedSim.isBroken}
                    />
                  </div>

                  {/* Blue bulb aging */}
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                      <span>Degradación Canal Azul (B)</span>
                      <span style={{ color: selectedSim.bDrift !== 1.0 ? "var(--accent-yellow)" : "var(--text-secondary)" }}>
                        x{selectedSim.bDrift.toFixed(2)}
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0.4"
                      max="1.4"
                      step="0.05"
                      value={selectedSim.bDrift}
                      onChange={(e) => updateSimulationSetting(selectedFixture.id, "bDrift", Number(e.target.value))}
                    />
                  </div>

                  {/* Temperature */}
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                      <span>Temperatura del Fixture</span>
                      <span style={{ 
                        color: selectedSim.temp > 75 ? "var(--accent-red)" : selectedSim.temp > 55 ? "var(--accent-yellow)" : "var(--text-secondary)",
                        fontWeight: 600
                      }}>
                        {selectedSim.temp}°C
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="20"
                      max="95"
                      value={selectedSim.temp}
                      onChange={(e) => updateSimulationSetting(selectedFixture.id, "temp", Number(e.target.value))}
                    />
                    <div style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                      {selectedSim.temp > 75 ? "🚨 ¡Sobrecarga térmica! (Peligro de apagado)" : selectedSim.temp > 55 ? "Aviso: Fixture caliente" : "Operación estable (<55°)"}
                    </div>
                  </div>

                  {/* Burn out toggle */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "rgba(255,0,0,0.05)", border: "1px solid rgba(255,0,0,0.15)", borderRadius: "8px" }}>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#ff6b6b" }}>Bulbo Verde Fundido</div>
                      <div style={{ fontSize: "9px", color: "var(--text-secondary)" }}>Apaga el LED verde por completo</div>
                    </div>
                    <input 
                      type="checkbox"
                      checked={selectedSim.isBroken}
                      onChange={(e) => updateSimulationSetting(selectedFixture.id, "isBroken", e.target.checked)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                  </div>

                  {/* Reset defaults button */}
                  <button 
                    className="btn" 
                    style={{ fontSize: "12px", padding: "8px", display: "flex", alignItems: "center", gap: "6px" }}
                    onClick={() => {
                      setSimulatedSensors(prev => ({
                        ...prev,
                        [selectedFixture.id]: { rDrift: 1.0, gDrift: 1.0, bDrift: 1.0, temp: 25, isBroken: false }
                      }));
                    }}
                  >
                    <RotateCcw size={14} /> Restaurar Sensores Nominales
                  </button>

                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", fontSize: "13px" }}>
                  Selecciona una luminaria para inyectar fallas
                </div>
              )}
            </div>
          )}

          {/* Performance Frame Logger */}
          <div className="panel" style={{ height: "130px" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "10px", color: "var(--text-secondary)" }}>Telemetría DMX</h3>
            <div style={{ fontSize: "12px" }}>
              <div className="metrics-row">
                <span>Frecuencia de Cuadro (FPS)</span>
                <span className="metrics-value">{fps} / 40 Hz</span>
              </div>
              <div className="metrics-row">
                <span>Latencia de Cálculo Buffer</span>
                <span className="metrics-value">{latencyMs.toFixed(3)} ms</span>
              </div>
              <div className="metrics-row">
                <span>Paquetes Transmitidos</span>
                <span className="metrics-value">{packetsSent}</span>
              </div>
              <div className="metrics-row">
                <span>Datos Transmitidos</span>
                <span className="metrics-value">{totalBytes} bytes</span>
              </div>
            </div>
          </div>

        </section>
      </main>

      {/* Add Fixture Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div className="panel panel-glowing" style={{ width: "380px" }}>
            <h3 style={{ marginBottom: "15px", fontSize: "18px" }}>Añadir Luminaria DMX</h3>
            
            <form onSubmit={addFixture}>
              <div className="form-group">
                <label className="form-label">ID Único (ej. par4)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={newFixId} 
                  onChange={(e) => setNewFixId(e.target.value)} 
                  placeholder="par4" 
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={newFixName} 
                  onChange={(e) => setNewFixName(e.target.value)} 
                  placeholder="PAR LED Suelo" 
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Perfil de Fixture</label>
                <select 
                  className="input-field"
                  value={newFixProfile}
                  onChange={(e) => setNewFixProfile(e.target.value)}
                >
                  {Object.keys(profiles).map(name => (
                    <option key={name} value={name}>{profiles[name].name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Dirección DMX Inicial (1-512)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="512" 
                  className="input-field" 
                  value={newFixAddress} 
                  onChange={(e) => setNewFixAddress(Number(e.target.value))} 
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Añadir</button>
                <button 
                  type="button" 
                  className="btn" 
                  style={{ flex: 1 }}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
