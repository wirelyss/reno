import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";

const CW = 960;
const CH = 640;

const C = {
  floor1: "#f0e4d0", floor2: "#e6d8c0", floorLine: "#ddd0b8",
  wall: "#faf6f0", wallBot: "#f0ebe0", ceiling: "#fefcf8",
  trim: "#ffffff", trimShadow: "#e0dcd4", baseboard: "#e8e2d8",
  door: "#5a9eaa", doorNew: "#3dbad1", doorOld: "#a09888",
  window: "#b8dce8", windowNew: "#d0eef6", windowOld: "#b8b0a4",
  windowFrame: "#f5f5f5", shutter: "#7fb5b0",
  sky: "#87ceeb", skyTop: "#c8e8f4", ocean: "#6ec0d4", sand: "#f0deb8",
  palm: "#5a9a4a", palmTrunk: "#c0a070",
  coral: "#f0a090", peach: "#f8c8a0", seafoam: "#a0dcd0",
  accent: "#e8907a", gold: "#e8c060",
  text: "#3a5a6a", textLight: "#6a8a9a",
  rug1: "#c8ddd8", rug2: "#b0ccc6",
  furniture: "#d4c4a8", furnitureDark: "#baa888",
};

const BACK_L = 180, BACK_R = 780, BACK_T = 100, BACK_B = 420;
const SIDE_T = 30;

const BACK_WINDOWS = [
  { id: "w1", fx: 0.02, fy: 0.08, fw: 0.22, fh: 0.6, type: "window" },
  { id: "w2", fx: 0.28, fy: 0.05, fw: 0.18, fh: 0.65, type: "window" },
  { id: "w3", fx: 0.55, fy: 0.05, fw: 0.18, fh: 0.65, type: "window" },
  { id: "w4", fx: 0.78, fy: 0.08, fw: 0.2, fh: 0.6, type: "window" },
];
const BACK_DOORS = [
  { id: "d1", fx: 0.48, fy: 0.2, fw: 0.08, fh: 0.78, type: "door" },
];
const LEFT_FIXTURES = [
  { id: "lw1", type: "window", side: "left", sy: 0.1, sh: 0.55, sx: 0.3, sw: 0.35 },
  { id: "ld1", type: "door", side: "left", sy: 0.2, sh: 0.75, sx: 0.7, sw: 0.2 },
];
const RIGHT_FIXTURES = [
  { id: "rw1", type: "window", side: "right", sy: 0.1, sh: 0.55, sx: 0.3, sw: 0.35 },
  { id: "rd1", type: "door", side: "right", sy: 0.2, sh: 0.75, sx: 0.7, sw: 0.2 },
];

const PLAYER_SPEED = 3.8;
const HAMMER_SPEED = 10;
const PAPARAZZI_PHOTO_TIME = 3000;
const RENO_DIST = 60;

// Chair obstacles that spawn as difficulty increases
const FURNITURE_POOL = [
  { id: "f1", x: 340, y: 485, w: 36, h: 36, label: "Chair", chairColor: "#d4c4a8", cushion: C.seafoam },
  { id: "f2", x: 560, y: 505, w: 36, h: 36, label: "Chair", chairColor: "#c8b898", cushion: C.coral },
  { id: "f3", x: 240, y: 535, w: 38, h: 38, label: "Chair", chairColor: "#d4c4a8", cushion: C.peach },
  { id: "f4", x: 690, y: 475, w: 34, h: 34, label: "Chair", chairColor: "#baa888", cushion: "#88bbdd" },
  { id: "f5", x: 440, y: 555, w: 38, h: 38, label: "Chair", chairColor: "#c8b898", cushion: C.seafoam },
  { id: "f6", x: 160, y: 495, w: 34, h: 34, label: "Chair", chairColor: "#d4c4a8", cushion: C.gold },
  { id: "f7", x: 770, y: 535, w: 36, h: 36, label: "Chair", chairColor: "#baa888", cushion: C.coral },
  { id: "f8", x: 310, y: 570, w: 38, h: 38, label: "Chair", chairColor: "#c8b898", cushion: C.peach },
];

function dst(x1, y1, x2, y2) { return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2); }
function lerp(a, b, t) { return a + (b - a) * t; }

function backRect(fx, fy, fw, fh) {
  const ww = BACK_R - BACK_L, wh = BACK_B - BACK_T;
  return { x: BACK_L + fx * ww, y: BACK_T + fy * wh, w: fw * ww, h: fh * wh };
}

function leftWallRect(sx, sy, sw, sh) {
  const x0 = lerp(BACK_L, 20, sx), x1 = lerp(BACK_L, 20, sx + sw);
  const t0 = lerp(BACK_T, SIDE_T, sx), t1 = lerp(BACK_T, SIDE_T, sx + sw);
  const b0 = lerp(BACK_B, CH, sx), b1 = lerp(BACK_B, CH, sx + sw);
  const h0 = b0 - t0, h1 = b1 - t1;
  return {
    tl: { x: x1, y: t1 + sy * h1 }, tr: { x: x0, y: t0 + sy * h0 },
    br: { x: x0, y: t0 + (sy + sh) * h0 }, bl: { x: x1, y: t1 + (sy + sh) * h1 },
    cx: (x0 + x1) / 2, cy: (t0 + sy * h0 + t0 + (sy + sh) * h0) / 2,
    approxW: Math.abs(x0 - x1), approxH: sh * h0,
  };
}

function rightWallRect(sx, sy, sw, sh) {
  const x0 = lerp(BACK_R, CW - 20, sx), x1 = lerp(BACK_R, CW - 20, sx + sw);
  const t0 = lerp(BACK_T, SIDE_T, sx), t1 = lerp(BACK_T, SIDE_T, sx + sw);
  const b0 = lerp(BACK_B, CH, sx), b1 = lerp(BACK_B, CH, sx + sw);
  const h0 = b0 - t0, h1 = b1 - t1;
  return {
    tl: { x: x0, y: t0 + sy * h0 }, tr: { x: x1, y: t1 + sy * h1 },
    br: { x: x1, y: t1 + (sy + sh) * h1 }, bl: { x: x0, y: t0 + (sy + sh) * h0 },
    cx: (x0 + x1) / 2, cy: (t0 + sy * h0 + t0 + (sy + sh) * h0) / 2,
    approxW: Math.abs(x1 - x0), approxH: sh * h0,
  };
}

function getFixtureInfo(f) {
  if (f.side === "left") { const r = leftWallRect(f.sx, f.sy, f.sw, f.sh); return { cx: r.cx, cy: r.cy, shape: r, isTrape: true }; }
  if (f.side === "right") { const r = rightWallRect(f.sx, f.sy, f.sw, f.sh); return { cx: r.cx, cy: r.cy, shape: r, isTrape: true }; }
  const r = backRect(f.fx, f.fy, f.fw, f.fh);
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, shape: r, isTrape: false };
}

function fixtureGroundPos(f) {
  if (f.side === "left") {
    const p = (f.sx + f.sw / 2);
    return { x: lerp(BACK_L + 10, 100, p), y: lerp(BACK_B + 30, CH - 40, Math.min(p * 1.3, 1)) };
  }
  if (f.side === "right") {
    const p = (f.sx + f.sw / 2);
    return { x: lerp(BACK_R - 10, CW - 100, p), y: lerp(BACK_B + 30, CH - 40, Math.min(p * 1.3, 1)) };
  }
  const info = getFixtureInfo(f);
  return { x: info.cx, y: BACK_B + 30 };
}

// Walk boundary: the floor trapezoid. Given a Y, return the valid X range.
function getFloorBounds(py) {
  const t = Math.max(0, Math.min(1, (py - BACK_B) / (CH - BACK_B)));
  const leftX = lerp(BACK_L + 15, 60, t);
  const rightX = lerp(BACK_R - 15, CW - 60, t);
  return { minX: leftX, maxX: rightX };
}

const WALK_MIN_Y = BACK_B + 12;
const WALK_MAX_Y = CH - 25;

// Beachy dance-pop melody — sunny major key, disco/funk inspired like Poolsuite
const MELODY_NOTES = [
  ["C5","8n"],["C5","8n"],["E5","8n"],["G5","8n"],["A5","4n"],["G5","8n"],["E5","8n"],
  ["F5","8n"],["F5","8n"],["A5","8n"],["C6","8n"],["A5","4n"],["G5","4n"],
  ["E5","8n"],["D5","8n"],["C5","8n"],["D5","8n"],["E5","4n"],["G5","4n"],
  ["A5","8n"],["G5","8n"],["E5","8n"],["C5","8n"],["D5","4n"],["C5","4n"],
  ["C5","8n"],["E5","8n"],["G5","8n"],["C6","8n"],["B5","4n"],["A5","8n"],["G5","8n"],
  ["F5","8n"],["A5","8n"],["G5","4n"],["E5","8n"],["D5","8n"],["C5","2n"],
];

const BASS_NOTES = [
  ["C2","8n"],["C2","8n"],["C3","8n"],["C2","8n"],
  ["F2","8n"],["F2","8n"],["F3","8n"],["F2","8n"],
  ["G2","8n"],["G2","8n"],["G3","8n"],["G2","8n"],
  ["A1","8n"],["A1","8n"],["E2","8n"],["A1","8n"],
  ["F2","8n"],["F2","8n"],["C3","8n"],["F2","8n"],
  ["G2","8n"],["G2","8n"],["D3","8n"],["G2","8n"],
  ["C2","8n"],["E2","8n"],["G2","8n"],["C3","4n"],
];

// Chord stabs for that disco/funk rhythm
const CHORD_NOTES = [
  [["C4","E4","G4"],"8n"], [null,"8n"], [["C4","E4","G4"],"16n"], [null,"16n"],
  [["F4","A4","C5"],"8n"], [null,"8n"], [["F4","A4","C5"],"16n"], [null,"16n"],
  [["G4","B4","D5"],"8n"], [null,"8n"], [["G4","B4","D5"],"16n"], [null,"16n"],
  [["A3","C4","E4"],"8n"], [null,"4n"],
  [["F4","A4","C5"],"8n"], [null,"8n"], [["G4","B4","D5"],"8n"], [null,"8n"],
  [["C4","E4","G4"],"4n"], [null,"4n"],
];

export default function Game() {
  const canvasRef = useRef(null);
  const gsRef = useRef(null);
  const keysRef = useRef({});
  const rafRef = useRef(null);
  const soundsRef = useRef(null);
  const musicRef = useRef(null);
  const touchRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });
  const [screen, setScreen] = useState("title");
  const [score, setScore] = useState(0);
  const [showHow, setShowHow] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [username, setUsername] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);

  const initSounds = useCallback(async () => {
    if (soundsRef.current) return;
    try {
      await Tone.start();
      const vol = new Tone.Volume(-8).toDestination();

      const renoSynth = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.2 } }).connect(vol);
      const hammerSynth = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.05 } }).connect(new Tone.Filter(3000, "lowpass").connect(vol));
      const hitSynth = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 3, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 } }).connect(vol);
      const flashSynth = new Tone.MetalSynth({ frequency: 400, envelope: { attack: 0.001, decay: 0.06, release: 0.05 }, harmonicity: 8, modulationIndex: 16, resonance: 2000, octaves: 0.5 }).connect(new Tone.Volume(-14).connect(vol));
      const warnSynth = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.05, decay: 0.2, sustain: 0, release: 0.3 } }).connect(new Tone.Volume(-10).connect(vol));
      const gameOverSynth = new Tone.Synth({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.05, decay: 0.4, sustain: 0.1, release: 0.5 } }).connect(new Tone.Volume(-6).connect(vol));

      soundsRef.current = {
        renovate: () => { const n = Tone.now(); renoSynth.triggerAttackRelease("C6","16n",n); renoSynth.triggerAttackRelease("E6","16n",n+0.07); renoSynth.triggerAttackRelease("G6","16n",n+0.14); },
        hammer: () => { hammerSynth.triggerAttackRelease("16n"); },
        hit: () => { hitSynth.triggerAttackRelease("C2","8n"); },
        flash: () => { flashSynth.triggerAttackRelease("16n"); },
        warn: () => { const n = Tone.now(); warnSynth.triggerAttackRelease("A4","16n",n); warnSynth.triggerAttackRelease("F4","16n",n+0.12); },
        gameOver: () => { const n = Tone.now(); gameOverSynth.triggerAttackRelease("E4","8n",n); gameOverSynth.triggerAttackRelease("C4","8n",n+0.25); gameOverSynth.triggerAttackRelease("A3","8n",n+0.5); gameOverSynth.triggerAttackRelease("F3","4n",n+0.75); },
      };
    } catch (e) { console.log("Sound init:", e); }
  }, []);

  const startMusic = useCallback(async () => {
    if (musicRef.current) {
      musicRef.current.started = true;
      try { musicRef.current.staticNoise?.start(); musicRef.current.waveNoise?.start(); } catch(e) {}
      return;
    }
    try {
      await Tone.start();
      const vol = new Tone.Volume(-10).toDestination();

      // Radio speaker chain — bandpass for that warm vintage feel
      const radioFilter = new Tone.Filter({ frequency: 2200, type: "bandpass", Q: 0.6 }).connect(vol);
      const warmth = new Tone.Distortion(0.05).connect(radioFilter);
      const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.15 }).connect(warmth);
      const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3, depth: 0.3, wet: 0.2 }).connect(reverb);

      // Subtle vinyl static
      const staticNoise = new Tone.Noise("brown").connect(
        new Tone.Volume(-30).connect(new Tone.Filter({ frequency: 2500, type: "lowpass" }).connect(vol))
      );
      staticNoise.start();

      // Crackle pops
      const crackleSynth = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.015, sustain: 0, release: 0.01 },
      }).connect(new Tone.Volume(-20).connect(radioFilter));
      const crackleLoop = new Tone.Loop((time) => {
        if (!musicRef.current?.started) return;
        if (Math.random() < 0.25) crackleSynth.triggerAttackRelease("32n", time);
      }, "8n");

      // --- AMBIENT OCEAN WAVES ---
      const waveNoise = new Tone.Noise("pink").connect(
        new Tone.Volume(-22).connect(
          new Tone.AutoFilter({ frequency: 0.08, baseFrequency: 200, octaves: 2, wet: 1 }).connect(vol).start()
        )
      );
      waveNoise.start();

      // --- SEAGULL SOUNDS --- (high pitched sine swoops)
      const seagullSynth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.2, release: 0.3 },
      }).connect(new Tone.Volume(-16).connect(new Tone.Filter({ frequency: 4000, type: "lowpass" }).connect(vol)));

      const seagullLoop = new Tone.Loop((time) => {
        if (!musicRef.current?.started) return;
        if (Math.random() < 0.12) {
          const baseNote = 1200 + Math.random() * 600;
          seagullSynth.triggerAttackRelease(baseNote, "16n", time);
          seagullSynth.triggerAttackRelease(baseNote * 1.15, "16n", time + 0.12);
          if (Math.random() < 0.5) {
            seagullSynth.triggerAttackRelease(baseNote * 0.9, "16n", time + 0.25);
          }
        }
      }, "2n");

      // --- MELODY: bright, dancey, poolside ---
      const melodySynth = new Tone.Synth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.2 },
      }).connect(new Tone.Filter({ frequency: 3500, type: "lowpass" }).connect(chorus));

      // --- BASS: punchy disco bass ---
      const bassSynth = new Tone.Synth({
        oscillator: { type: "square" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.15, release: 0.15 },
      }).connect(new Tone.Volume(-6).connect(new Tone.Filter({ frequency: 800, type: "lowpass" }).connect(reverb)));

      // --- CHORD STABS: funky rhythm guitar feel ---
      const chordSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.05, release: 0.1 },
      }).connect(new Tone.Volume(-10).connect(chorus));

      // --- HIHAT: disco hihat ---
      const hihatSynth = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.03 },
      }).connect(new Tone.Volume(-18).connect(new Tone.Filter({ frequency: 8000, type: "highpass" }).connect(radioFilter)));

      // --- KICK: four on the floor ---
      const kickSynth = new Tone.MembraneSynth({
        pitchDecay: 0.03, octaves: 4,
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.15 },
      }).connect(new Tone.Volume(-12).connect(reverb));

      let melodyIdx = 0, bassIdx = 0, chordIdx = 0;

      const melodyLoop = new Tone.Loop((time) => {
        if (!musicRef.current?.started) return;
        const [note, dur] = MELODY_NOTES[melodyIdx % MELODY_NOTES.length];
        melodySynth.triggerAttackRelease(note, dur, time);
        melodyIdx++;
      }, "8n");

      const bassLoop = new Tone.Loop((time) => {
        if (!musicRef.current?.started) return;
        const [note, dur] = BASS_NOTES[bassIdx % BASS_NOTES.length];
        bassSynth.triggerAttackRelease(note, dur, time);
        bassIdx++;
      }, "8n");

      const chordLoop = new Tone.Loop((time) => {
        if (!musicRef.current?.started) return;
        const [notes, dur] = CHORD_NOTES[chordIdx % CHORD_NOTES.length];
        if (notes) chordSynth.triggerAttackRelease(notes, dur, time);
        chordIdx++;
      }, "8n");

      const hihatLoop = new Tone.Loop((time) => {
        if (!musicRef.current?.started) return;
        hihatSynth.triggerAttackRelease("32n", time);
      }, "8n");

      const kickLoop = new Tone.Loop((time) => {
        if (!musicRef.current?.started) return;
        kickSynth.triggerAttackRelease("C1", "8n", time);
      }, "4n");

      Tone.Transport.bpm.value = 110;
      Tone.Transport.swing = 0.1;
      melodyLoop.start(0);
      bassLoop.start(0);
      chordLoop.start(0);
      hihatLoop.start(0);
      kickLoop.start(0);
      crackleLoop.start(0);
      seagullLoop.start(0);
      Tone.Transport.start();
      musicRef.current = { started: true, melodyLoop, bassLoop, chordLoop, hihatLoop, kickLoop, crackleLoop, seagullLoop, staticNoise, waveNoise };
    } catch (e) { console.log("Music init:", e); }
  }, []);

  const stopMusic = useCallback(() => {
    if (musicRef.current) {
      musicRef.current.started = false;
      try { musicRef.current.staticNoise?.stop(); musicRef.current.waveNoise?.stop(); } catch(e) {}
    }
  }, []);

  useEffect(() => {
    if (musicOn && screen === "playing") startMusic();
    else stopMusic();
  }, [musicOn, screen, startMusic, stopMusic]);

  const playSoundRef = useRef(null);
  const playSound = useCallback((name) => {
    if (!soundOn || !soundsRef.current?.[name]) return;
    try { soundsRef.current[name](); } catch(e) {}
  }, [soundOn]);
  useEffect(() => { playSoundRef.current = playSound; }, [playSound]);

  const initGame = useCallback(() => {
    const all = [
      ...BACK_WINDOWS.map(f => ({ ...f })), ...BACK_DOORS.map(f => ({ ...f })),
      ...LEFT_FIXTURES.map(f => ({ ...f })), ...RIGHT_FIXTURES.map(f => ({ ...f })),
    ].map(f => ({ ...f, outdated: false, renovated: false, glowT: 0, renoTimer: 0 }));

    gsRef.current = {
      player: { x: 480, y: 530, facing: 0 },
      fixtures: all,
      paparazzi: [],
      hammers: [],
      photos: 0,
      score: 0,
      time: 0,
      nextOutdated: 800,
      nextPap: 4500,
      flashFx: [],
      renoFx: [],
      hitFx: [],
      difficulty: 1,
      palmSway: 0,
      furniture: [],
      nextFurniture: 5,
      seagulls: [],
      nextSeagull: 2000,
    };
  }, []);

  const start = useCallback(() => {
    initSounds(); initGame(); keysRef.current = {};
    setScreen("playing");
  }, [initGame, initSounds]);

  // Keyboard
  useEffect(() => {
    const kd = (e) => { keysRef.current[e.key.toLowerCase()] = true; if (e.key === " ") e.preventDefault(); };
    const ku = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  // Touch controls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ts = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      touchRef.current = { active: true, startX: t.clientX, startY: t.clientY, dx: 0, dy: 0 };
    };
    const tm = (e) => {
      e.preventDefault();
      if (!touchRef.current.active) return;
      const t = e.touches[0];
      touchRef.current.dx = t.clientX - touchRef.current.startX;
      touchRef.current.dy = t.clientY - touchRef.current.startY;
    };
    const te = (e) => {
      e.preventDefault();
      // Short tap = throw hammer
      if (touchRef.current.active && Math.abs(touchRef.current.dx) < 10 && Math.abs(touchRef.current.dy) < 10) {
        // Trigger hammer throw
        const gs = gsRef.current;
        if (gs && gs.paparazzi.length > 0) {
          let nearest = null, nd = Infinity;
          gs.paparazzi.forEach(p => { const d = dst(gs.player.x, gs.player.y, p.x, p.y); if (d < nd) { nd = d; nearest = p; } });
          if (nearest) {
            const a = Math.atan2(nearest.y - (gs.player.y - 25), nearest.x - gs.player.x);
            gs.hammers.push({ x: gs.player.x, y: gs.player.y - 25, vx: Math.cos(a) * HAMMER_SPEED, vy: Math.sin(a) * HAMMER_SPEED, rot: 0 });
            if (playSoundRef.current) playSoundRef.current("hammer");
          }
        }
      }
      touchRef.current = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
    };
    canvas.addEventListener("touchstart", ts, { passive: false });
    canvas.addEventListener("touchmove", tm, { passive: false });
    canvas.addEventListener("touchend", te, { passive: false });
    return () => { canvas.removeEventListener("touchstart", ts); canvas.removeEventListener("touchmove", tm); canvas.removeEventListener("touchend", te); };
  }, [screen]);

  // Main game loop
  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let last = performance.now();

    const loop = (now) => {
      const dt = Math.min(now - last, 50);
      last = now;
      const gs = gsRef.current;
      if (!gs) return;

      gs.time += dt;
      gs.palmSway = Math.sin(gs.time * 0.0012) * 5;
      gs.difficulty = 1 + gs.score * 0.08;

      // Speed up the radio as things get intense
      if (musicRef.current?.started) {
        try { Tone.Transport.bpm.value = Math.min(150, 110 + gs.score * 1.5); } catch(e) {}
      }

      // --- MOVEMENT ---
      const keys = keysRef.current;
      let dx = 0, dy = 0;
      if (keys["a"] || keys["arrowleft"]) dx -= PLAYER_SPEED;
      if (keys["d"] || keys["arrowright"]) dx += PLAYER_SPEED;
      if (keys["w"] || keys["arrowup"]) dy -= PLAYER_SPEED;
      if (keys["s"] || keys["arrowdown"]) dy += PLAYER_SPEED;

      // Touch joystick
      if (touchRef.current.active) {
        const tdx = touchRef.current.dx, tdy = touchRef.current.dy;
        const mag = Math.sqrt(tdx * tdx + tdy * tdy);
        if (mag > 15) {
          dx += (tdx / mag) * PLAYER_SPEED;
          dy += (tdy / mag) * PLAYER_SPEED;
        }
      }

      if (dx !== 0) gs.player.facing = dx > 0 ? 1 : -1;

      let newX = gs.player.x + dx;
      let newY = Math.max(WALK_MIN_Y, Math.min(WALK_MAX_Y, gs.player.y + dy));

      // Clamp X to floor trapezoid bounds
      const bounds = getFloorBounds(newY);
      newX = Math.max(bounds.minX, Math.min(bounds.maxX, newX));

      // Furniture collision
      gs.furniture.forEach(f => {
        const fx = f.x, fy = f.y, fw = f.w, fh = f.h;
        if (newX > fx - 15 && newX < fx + fw + 15 && newY > fy - 10 && newY < fy + fh + 10) {
          // Push out
          const cx = fx + fw / 2, cy = fy + fh / 2;
          if (Math.abs(newX - cx) / fw > Math.abs(newY - cy) / fh) {
            newX = newX < cx ? fx - 16 : fx + fw + 16;
          } else {
            newY = newY < cy ? fy - 11 : fy + fh + 11;
          }
        }
      });

      gs.player.x = newX;
      gs.player.y = newY;

      // Auto-renovate
      gs.fixtures.forEach(f => {
        if (!f.outdated || f.renovated) return;
        const gp = fixtureGroundPos(f);
        if (dst(gs.player.x, gs.player.y, gp.x, gp.y) < RENO_DIST) {
          f.renovated = true; f.outdated = false; f.renoTimer = 0;
          gs.score++;
          const info = getFixtureInfo(f);
          gs.renoFx.push({ x: info.cx, y: info.cy, t: 0 });
          if (playSoundRef.current) playSoundRef.current("renovate");
        }
      });

      // Hammer throw
      if (keys["e"] || keys[" "]) {
        keys["e"] = false; keys[" "] = false;
        let nearest = null, nd = Infinity;
        gs.paparazzi.forEach(p => { const d = dst(gs.player.x, gs.player.y, p.x, p.y); if (d < nd) { nd = d; nearest = p; } });
        if (nearest) {
          const a = Math.atan2(nearest.y - gs.player.y, nearest.x - gs.player.x);
          gs.hammers.push({ x: gs.player.x, y: gs.player.y - 25, vx: Math.cos(a) * HAMMER_SPEED, vy: Math.sin(a) * HAMMER_SPEED, rot: 0 });
          if (playSoundRef.current) playSoundRef.current("hammer");
        }
      }

      // Spawn outdated
      if (gs.time > gs.nextOutdated) {
        const avail = gs.fixtures.filter(f => !f.outdated && !f.renovated);
        if (avail.length > 0) {
          avail[Math.floor(Math.random() * avail.length)].outdated = true;
          if (playSoundRef.current) playSoundRef.current("warn");
        }
        gs.nextOutdated = gs.time + Math.max(1200, 3000 - gs.difficulty * 200);
      }

      // Re-age
      gs.fixtures.forEach(f => {
        if (f.renovated) { f.renoTimer += dt; if (f.renoTimer > Math.max(5000, 10000 - gs.score * 400)) { f.renovated = false; f.renoTimer = 0; } }
        if (f.outdated) f.glowT += dt * 0.005;
      });

      // Spawn paparazzi — more frequent and can spawn multiples at high difficulty
      if (gs.time > gs.nextPap) {
        const wins = gs.fixtures.filter(f => f.type === "window");
        const spawnCount = gs.difficulty > 2.5 ? (Math.random() < 0.4 ? 2 : 1) : 1;
        for (let s = 0; s < spawnCount; s++) {
          const pick = wins[Math.floor(Math.random() * wins.length)];
          const info = getFixtureInfo(pick);
          const gp = fixtureGroundPos(pick);
          gs.paparazzi.push({ x: info.cx + (s * 15), y: info.cy, dx: gp.x, dy: gp.y, windowId: pick.id, timer: 0, flashT: 0, state: "aiming", side: pick.side || "back" });
        }
        gs.nextPap = gs.time + Math.max(1500, 4000 - gs.difficulty * 350);
      }

      // Spawn furniture as difficulty increases
      if (gs.score >= gs.nextFurniture && gs.furniture.length < FURNITURE_POOL.length) {
        const available = FURNITURE_POOL.filter(fp => !gs.furniture.find(gf => gf.id === fp.id));
        if (available.length > 0) {
          gs.furniture.push({ ...available[Math.floor(Math.random() * available.length)] });
        }
        gs.nextFurniture += 4;
      }

      // Spawn seagulls
      if (gs.time > gs.nextSeagull) {
        const winIdx = Math.floor(Math.random() * BACK_WINDOWS.length);
        const wr = backRect(BACK_WINDOWS[winIdx].fx, BACK_WINDOWS[winIdx].fy, BACK_WINDOWS[winIdx].fw, BACK_WINDOWS[winIdx].fh);
        const dir = Math.random() < 0.5 ? 1 : -1;
        gs.seagulls.push({
          x: dir > 0 ? wr.x - 10 : wr.x + wr.w + 10,
          y: wr.y + wr.h * (0.1 + Math.random() * 0.3),
          vx: dir * (0.8 + Math.random() * 0.6),
          vy: Math.sin(Math.random() * 3) * 0.2,
          wingT: Math.random() * 6,
          winRect: wr,
        });
        gs.nextSeagull = gs.time + 3000 + Math.random() * 5000;
      }

      // Update seagulls
      gs.seagulls = gs.seagulls.filter(sg => {
        sg.x += sg.vx; sg.y += sg.vy; sg.wingT += 0.15;
        return sg.x > sg.winRect.x - 20 && sg.x < sg.winRect.x + sg.winRect.w + 20;
      });

      // Update paparazzi
      gs.paparazzi = gs.paparazzi.filter(p => {
        if (p.state === "aiming") {
          p.timer += dt; p.flashT += dt;
          const photoTime = PAPARAZZI_PHOTO_TIME / gs.difficulty;
          if (p.timer > photoTime) {
            p.state = "flash"; p.timer = 0;
            gs.flashFx.push({ x: p.x, y: p.y, t: 0 });
            if (playSoundRef.current) playSoundRef.current("flash");
            gs.photos++;
            if (gs.photos >= 3) { if (playSoundRef.current) playSoundRef.current("gameOver"); setScore(gs.score); setScreen("gameover"); }
          }
          return true;
        }
        if (p.state === "flash") { p.timer += dt; return p.timer < 600; }
        return false;
      });

      // Update hammers
      gs.hammers = gs.hammers.filter(h => {
        h.x += h.vx; h.y += h.vy; h.rot += 0.3;
        for (let i = gs.paparazzi.length - 1; i >= 0; i--) {
          if (dst(h.x, h.y, gs.paparazzi[i].x, gs.paparazzi[i].y) < 30) {
            gs.hitFx.push({ x: gs.paparazzi[i].x, y: gs.paparazzi[i].y, t: 0 });
            if (playSoundRef.current) playSoundRef.current("hit");
            gs.paparazzi.splice(i, 1);
            return false;
          }
        }
        return h.x > -40 && h.x < CW + 40 && h.y > -40 && h.y < CH + 40;
      });

      gs.flashFx = gs.flashFx.filter(e => { e.t += dt; return e.t < 500; });
      gs.renoFx = gs.renoFx.filter(e => { e.t += dt; return e.t < 800; });
      gs.hitFx = gs.hitFx.filter(e => { e.t += dt; return e.t < 500; });

      // ===================== DRAW =====================
      ctx.fillStyle = C.ceiling;
      ctx.fillRect(0, 0, CW, CH);

      // Back wall
      ctx.fillStyle = C.wall;
      ctx.fillRect(BACK_L, BACK_T, BACK_R - BACK_L, BACK_B - BACK_T);
      const wainY = BACK_T + (BACK_B - BACK_T) * 0.65;
      ctx.fillStyle = C.wallBot;
      ctx.fillRect(BACK_L, wainY, BACK_R - BACK_L, BACK_B - wainY);
      ctx.strokeStyle = C.trimShadow; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(BACK_L, wainY); ctx.lineTo(BACK_R, wainY); ctx.stroke();

      // Left wall
      ctx.fillStyle = C.wall;
      ctx.beginPath(); ctx.moveTo(BACK_L, BACK_T); ctx.lineTo(0, SIDE_T); ctx.lineTo(0, CH); ctx.lineTo(BACK_L, BACK_B); ctx.closePath(); ctx.fill();
      const lwG = ctx.createLinearGradient(0, 0, BACK_L, 0);
      lwG.addColorStop(0, "rgba(0,0,0,0.04)"); lwG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lwG;
      ctx.beginPath(); ctx.moveTo(BACK_L, BACK_T); ctx.lineTo(0, SIDE_T); ctx.lineTo(0, CH); ctx.lineTo(BACK_L, BACK_B); ctx.closePath(); ctx.fill();

      // Right wall
      ctx.fillStyle = C.wall;
      ctx.beginPath(); ctx.moveTo(BACK_R, BACK_T); ctx.lineTo(CW, SIDE_T); ctx.lineTo(CW, CH); ctx.lineTo(BACK_R, BACK_B); ctx.closePath(); ctx.fill();
      const rwG = ctx.createLinearGradient(CW, 0, BACK_R, 0);
      rwG.addColorStop(0, "rgba(0,0,0,0.04)"); rwG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rwG;
      ctx.beginPath(); ctx.moveTo(BACK_R, BACK_T); ctx.lineTo(CW, SIDE_T); ctx.lineTo(CW, CH); ctx.lineTo(BACK_R, BACK_B); ctx.closePath(); ctx.fill();

      // Ceiling
      ctx.fillStyle = C.ceiling;
      ctx.beginPath(); ctx.moveTo(0, SIDE_T); ctx.lineTo(BACK_L, BACK_T); ctx.lineTo(BACK_R, BACK_T); ctx.lineTo(CW, SIDE_T); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.trim; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, SIDE_T + 2); ctx.lineTo(BACK_L, BACK_T + 2); ctx.lineTo(BACK_R, BACK_T + 2); ctx.lineTo(CW, SIDE_T + 2); ctx.stroke();

      // Floor
      ctx.fillStyle = C.floor1;
      ctx.beginPath(); ctx.moveTo(BACK_L, BACK_B); ctx.lineTo(BACK_R, BACK_B); ctx.lineTo(CW, CH); ctx.lineTo(0, CH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.floorLine; ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) {
        ctx.beginPath(); ctx.moveTo(lerp(BACK_L, BACK_R, i/12), BACK_B); ctx.lineTo(lerp(0, CW, i/12), CH); ctx.stroke();
      }
      for (let py = BACK_B + 20; py < CH; py += 30) {
        const t = (py - BACK_B) / (CH - BACK_B);
        ctx.beginPath(); ctx.moveTo(lerp(BACK_L, 0, t), py); ctx.lineTo(lerp(BACK_R, CW, t), py); ctx.stroke();
      }
      ctx.strokeStyle = C.baseboard; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, CH); ctx.lineTo(BACK_L, BACK_B); ctx.lineTo(BACK_R, BACK_B); ctx.lineTo(CW, CH); ctx.stroke();

      // Rug
      ctx.fillStyle = C.rug1;
      ctx.beginPath(); ctx.moveTo(320,460); ctx.lineTo(640,460); ctx.lineTo(680,580); ctx.lineTo(280,580); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.rug2; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(340,470); ctx.lineTo(620,470); ctx.lineTo(660,570); ctx.lineTo(300,570); ctx.closePath(); ctx.stroke();

      // Outdoor scene helper
      const drawOutdoor = (x, y, w, h) => {
        const sg = ctx.createLinearGradient(x, y, x, y + h * 0.5);
        sg.addColorStop(0, C.skyTop); sg.addColorStop(1, C.sky);
        ctx.fillStyle = sg; ctx.fillRect(x, y, w, h * 0.55);
        ctx.fillStyle = C.ocean; ctx.fillRect(x, y + h * 0.45, w, h * 0.15);
        ctx.fillStyle = C.sand; ctx.fillRect(x, y + h * 0.58, w, h * 0.42);
        const px = x + w * 0.7, pb = y + h * 0.58;
        ctx.strokeStyle = C.palmTrunk; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(px, pb); ctx.quadraticCurveTo(px + gs.palmSway * 0.3, pb - h * 0.2, px + gs.palmSway * 0.5, pb - h * 0.38); ctx.stroke();
        const tpx = px + gs.palmSway * 0.5, tpy = pb - h * 0.38;
        ctx.strokeStyle = C.palm; ctx.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) {
          const a = (i/5) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(tpx, tpy); ctx.quadraticCurveTo(tpx + Math.cos(a)*12, tpy + Math.sin(a)*6-5, tpx + Math.cos(a)*20, tpy + Math.sin(a)*10+2); ctx.stroke();
        }
      };

      // Draw fixtures
      gs.fixtures.forEach(f => {
        const info = getFixtureInfo(f);
        const isDoor = f.type === "door", isWindow = f.type === "window";
        let fillColor;
        if (f.outdated) fillColor = isDoor ? C.doorOld : C.windowOld;
        else if (f.renovated) fillColor = isDoor ? C.doorNew : C.windowNew;
        else fillColor = isDoor ? C.door : C.window;

        if (info.isTrape) {
          const s = info.shape;
          if (isWindow) {
            ctx.save();
            ctx.beginPath(); ctx.moveTo(s.tl.x,s.tl.y); ctx.lineTo(s.tr.x,s.tr.y); ctx.lineTo(s.br.x,s.br.y); ctx.lineTo(s.bl.x,s.bl.y); ctx.closePath(); ctx.clip();
            drawOutdoor(Math.min(s.tl.x,s.bl.x), Math.min(s.tl.y,s.tr.y), s.approxW, s.approxH);
            if (f.outdated) {
              ctx.fillStyle = "rgba(180,170,150,0.35)"; ctx.fillRect(Math.min(s.tl.x,s.bl.x)-5, Math.min(s.tl.y,s.tr.y)-5, s.approxW+10, s.approxH+10);
              ctx.strokeStyle = "rgba(140,130,110,0.25)"; ctx.lineWidth = 3;
              for (let k=0;k<3;k++) { const sx=Math.min(s.tl.x,s.bl.x)+s.approxW*(0.2+k*0.3); ctx.beginPath(); ctx.moveTo(sx,Math.min(s.tl.y,s.tr.y)+5); ctx.lineTo(sx-2,Math.min(s.tl.y,s.tr.y)+s.approxH-5); ctx.stroke(); }
            }
            ctx.restore();
          }
          if (f.outdated) { const glow=Math.sin(f.glowT)*0.5+0.5; ctx.shadowColor=`rgba(232,144,122,${0.4+glow*0.5})`; ctx.shadowBlur=15+glow*12; }
          if (isDoor) { ctx.fillStyle=fillColor; ctx.beginPath(); ctx.moveTo(s.tl.x,s.tl.y); ctx.lineTo(s.tr.x,s.tr.y); ctx.lineTo(s.br.x,s.br.y); ctx.lineTo(s.bl.x,s.bl.y); ctx.closePath(); ctx.fill(); }
          ctx.shadowColor="transparent"; ctx.shadowBlur=0;
          ctx.strokeStyle=f.outdated?"#a09080":C.windowFrame; ctx.lineWidth=f.outdated?4:3;
          ctx.beginPath(); ctx.moveTo(s.tl.x,s.tl.y); ctx.lineTo(s.tr.x,s.tr.y); ctx.lineTo(s.br.x,s.br.y); ctx.lineTo(s.bl.x,s.bl.y); ctx.closePath(); ctx.stroke();
          if (f.outdated) { ctx.fillStyle=C.accent; ctx.font="bold 20px sans-serif"; ctx.textAlign="center"; ctx.fillText("⚠",s.cx,Math.min(s.tl.y,s.tr.y)-8); }
          if (f.renovated) { ctx.fillStyle=C.seafoam; ctx.font="bold 18px sans-serif"; ctx.textAlign="center"; ctx.fillText("✓",s.cx,Math.min(s.tl.y,s.tr.y)-8); }
        } else {
          const r = info.shape;
          if (isWindow) {
            ctx.save(); ctx.beginPath(); ctx.rect(r.x,r.y,r.w,r.h); ctx.clip();
            drawOutdoor(r.x,r.y,r.w,r.h);
            // Seagulls in this window
            gs.seagulls.forEach(sg => {
              if (sg.x > r.x && sg.x < r.x + r.w && sg.y > r.y && sg.y < r.y + r.h) {
                const wing = Math.sin(sg.wingT) * 5;
                ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(sg.x-8, sg.y+wing); ctx.lineTo(sg.x, sg.y); ctx.lineTo(sg.x+8, sg.y+wing); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(sg.x-5, sg.y+wing*0.5); ctx.lineTo(sg.x, sg.y+1); ctx.lineTo(sg.x+5, sg.y+wing*0.5); ctx.stroke();
              }
            });
            if (f.outdated) {
              ctx.fillStyle="rgba(180,170,150,0.35)"; ctx.fillRect(r.x,r.y,r.w,r.h);
              ctx.strokeStyle="rgba(140,130,110,0.25)"; ctx.lineWidth=3;
              for(let k=0;k<4;k++){const sx=r.x+r.w*(0.12+k*0.22); ctx.beginPath(); ctx.moveTo(sx,r.y+r.h*0.05); ctx.quadraticCurveTo(sx+4,r.y+r.h*0.5,sx-3,r.y+r.h*0.95); ctx.stroke();}
              ctx.fillStyle="rgba(160,150,130,0.2)"; ctx.beginPath(); ctx.arc(r.x+r.w*0.3,r.y+r.h*0.25,r.w*0.08,0,Math.PI*2); ctx.arc(r.x+r.w*0.7,r.y+r.h*0.6,r.w*0.06,0,Math.PI*2); ctx.fill();
            }
            ctx.restore();
          }
          if (f.outdated) { const glow=Math.sin(f.glowT)*0.5+0.5; ctx.shadowColor=`rgba(232,144,122,${0.4+glow*0.5})`; ctx.shadowBlur=15+glow*12; }
          if (isDoor) { ctx.fillStyle=fillColor; ctx.fillRect(r.x,r.y,r.w,r.h); }
          ctx.shadowColor="transparent"; ctx.shadowBlur=0;
          if (isWindow) { ctx.strokeStyle=f.outdated?"#a09080":C.windowFrame; ctx.lineWidth=f.outdated?4:3; ctx.beginPath(); ctx.moveTo(r.x+r.w/2,r.y); ctx.lineTo(r.x+r.w/2,r.y+r.h); ctx.moveTo(r.x,r.y+r.h/2); ctx.lineTo(r.x+r.w,r.y+r.h/2); ctx.stroke(); }
          ctx.strokeStyle=f.outdated?"#a09080":C.windowFrame; ctx.lineWidth=f.outdated?4:3; ctx.strokeRect(r.x,r.y,r.w,r.h);
          if (isWindow) { ctx.fillStyle=f.outdated?"#c8bfb0":C.trim; ctx.fillRect(r.x-4,r.y+r.h,r.w+8,5); }
          if (isDoor) { ctx.fillStyle=f.renovated?C.gold:"#999"; ctx.beginPath(); ctx.arc(r.x+r.w*0.8,r.y+r.h*0.55,4,0,Math.PI*2); ctx.fill(); }
          if (f.outdated) { ctx.strokeStyle=C.accent+"55"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(r.x+r.w*0.2,r.y+r.h*0.15); ctx.lineTo(r.x+r.w*0.5,r.y+r.h*0.4); ctx.lineTo(r.x+r.w*0.3,r.y+r.h*0.7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(r.x+r.w*0.65,r.y+r.h*0.1); ctx.lineTo(r.x+r.w*0.55,r.y+r.h*0.5); ctx.stroke(); }
          if (f.outdated) { ctx.fillStyle=C.accent; ctx.font="bold 20px sans-serif"; ctx.textAlign="center"; ctx.fillText("⚠",r.x+r.w/2,r.y-10); }
          if (f.renovated) { ctx.fillStyle=C.seafoam; ctx.font="bold 18px sans-serif"; ctx.textAlign="center"; ctx.fillText("✓",r.x+r.w/2,r.y-10); }
        }
      });

      // Back wall furniture
      ctx.fillStyle = C.furniture; ctx.fillRect(BACK_L+15, BACK_B-35, 80, 35);
      ctx.fillStyle = C.furnitureDark; ctx.fillRect(BACK_L+18, BACK_B-37, 74, 4);
      ctx.fillStyle = C.peach; ctx.fillRect(BACK_L+40, BACK_B-52, 18, 17);
      ctx.fillStyle = C.palm; ctx.beginPath(); ctx.arc(BACK_L+49, BACK_B-60, 12, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = C.furniture; ctx.fillRect(BACK_R-80, BACK_B-30, 60, 30);
      ctx.fillStyle = C.furnitureDark; ctx.fillRect(BACK_R-77, BACK_B-32, 54, 4);
      ctx.fillStyle = C.gold; ctx.fillRect(BACK_R-58, BACK_B-55, 6, 25);
      ctx.fillStyle = C.peach+"cc"; ctx.beginPath(); ctx.moveTo(BACK_R-68,BACK_B-55); ctx.lineTo(BACK_R-42,BACK_B-55); ctx.lineTo(BACK_R-48,BACK_B-72); ctx.lineTo(BACK_R-62,BACK_B-72); ctx.closePath(); ctx.fill();

      // Floor furniture obstacles — chairs
      gs.furniture.forEach(f => {
        const cx = f.x, cy = f.y, sz = f.w;
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.beginPath(); ctx.ellipse(cx + sz/2, cy + sz + 2, sz/2 + 2, 5, 0, 0, Math.PI*2); ctx.fill();
        // Chair legs (4 legs)
        ctx.fillStyle = f.chairColor || C.furniture;
        ctx.fillRect(cx + 2, cy + sz - 4, 4, 8);
        ctx.fillRect(cx + sz - 6, cy + sz - 4, 4, 8);
        ctx.fillRect(cx + 2, cy + sz * 0.5, 4, 8);
        ctx.fillRect(cx + sz - 6, cy + sz * 0.5, 4, 8);
        // Seat
        ctx.fillStyle = f.cushion || C.seafoam;
        ctx.beginPath(); ctx.roundRect(cx, cy + sz * 0.35, sz, sz * 0.45, 3); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(cx, cy + sz * 0.35, sz, sz * 0.45, 3); ctx.stroke();
        // Back rest
        ctx.fillStyle = f.chairColor || C.furniture;
        ctx.beginPath(); ctx.roundRect(cx + 2, cy, sz - 4, sz * 0.42, [4, 4, 0, 0]); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(cx + 2, cy, sz - 4, sz * 0.42, [4, 4, 0, 0]); ctx.stroke();
        // Back slats
        ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx + sz * 0.35, cy + 3); ctx.lineTo(cx + sz * 0.35, cy + sz * 0.38); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + sz * 0.65, cy + 3); ctx.lineTo(cx + sz * 0.65, cy + sz * 0.38); ctx.stroke();
      });

      // Paparazzi
      gs.paparazzi.forEach(p => {
        ctx.fillStyle="#222"; ctx.beginPath(); ctx.arc(p.x,p.y-6,12,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#333"; ctx.fillRect(p.x-14,p.y-18,28,5);
        ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(p.x-4,p.y-8,3,0,Math.PI*2); ctx.arc(p.x+4,p.y-8,3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(p.x-4,p.y-8,1.5,0,Math.PI*2); ctx.arc(p.x+4,p.y-8,1.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#444"; ctx.fillRect(p.x-10,p.y+3,20,14);
        ctx.fillStyle="#666"; ctx.beginPath(); ctx.arc(p.x,p.y+10,6,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#88bbdd"; ctx.beginPath(); ctx.arc(p.x,p.y+10,4,0,Math.PI*2); ctx.fill();
        const prog=p.timer/(PAPARAZZI_PHOTO_TIME/gs.difficulty);
        ctx.fillStyle="#00000044"; ctx.fillRect(p.x-16,p.y-26,32,5);
        ctx.fillStyle=prog<0.5?C.seafoam:prog<0.75?C.gold:C.accent;
        ctx.fillRect(p.x-16,p.y-26,32*prog,5);
        ctx.strokeStyle="#fff8"; ctx.lineWidth=0.5; ctx.strokeRect(p.x-16,p.y-26,32,5);
        if(prog>0.55&&Math.sin(p.flashT*0.02)>0){ctx.fillStyle=`rgba(232,144,122,${0.4+prog*0.4})`;ctx.beginPath();ctx.arc(p.x,p.y+10,5,0,Math.PI*2);ctx.fill();}
      });

      // Player
      const px=gs.player.x, py=gs.player.y, face=gs.player.facing||1;
      ctx.fillStyle="rgba(0,0,0,0.07)"; ctx.beginPath(); ctx.ellipse(px,py+18,18,5,0,0,Math.PI*2); ctx.fill();
      const pScale=lerp(0.7,1.2,(py-WALK_MIN_Y)/(WALK_MAX_Y-WALK_MIN_Y));
      ctx.save(); ctx.translate(px,py); ctx.scale(face>=0?pScale:-pScale,pScale);

      ctx.fillStyle="#e0ccb0"; ctx.fillRect(-5,2,4,14); ctx.fillRect(1,2,4,14);
      ctx.fillStyle="#e8e0d8"; ctx.fillRect(-6,14,6,3); ctx.fillRect(0,14,6,3);
      ctx.fillStyle="#f0f6f4"; ctx.fillRect(-9,-12,18,16);
      ctx.fillStyle=C.seafoam+"66"; ctx.beginPath(); ctx.arc(-3,-6,3,0,Math.PI*2); ctx.arc(4,-2,2.5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#e0e8e4"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-6,-12); ctx.quadraticCurveTo(0,-9,6,-12); ctx.stroke();
      ctx.fillStyle="#f5d0b0"; ctx.beginPath(); ctx.arc(0,-18,10,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#f0d060"; ctx.beginPath(); ctx.arc(0,-22,9,Math.PI*0.85,Math.PI*0.15,true); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-9,-20); ctx.quadraticCurveTo(-11,-10,-9,-4); ctx.lineTo(-7,-4); ctx.quadraticCurveTo(-9,-12,-8,-20); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(9,-20); ctx.quadraticCurveTo(11,-10,9,-4); ctx.lineTo(7,-4); ctx.quadraticCurveTo(9,-12,8,-20); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#f8e080"; ctx.beginPath(); ctx.arc(-2,-25,4,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#8a7a6a"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.roundRect(-8,-21,7,5,1); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(1,-21,7,5,1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1,-19); ctx.lineTo(1,-19); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8,-19); ctx.lineTo(-10,-19); ctx.moveTo(8,-19); ctx.lineTo(10,-19); ctx.stroke();
      ctx.fillStyle="#5a8a6a"; ctx.beginPath(); ctx.arc(-4.5,-19,1.5,0,Math.PI*2); ctx.arc(4.5,-19,1.5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#c88880"; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,-15,4,0.2,Math.PI-0.2); ctx.stroke();
      ctx.fillStyle="#e0908088"; ctx.beginPath(); ctx.ellipse(0,-13.5,3,1.2,0,0,Math.PI); ctx.fill();
      ctx.fillStyle="#c8a060"; ctx.fillRect(-10,-2,20,3);
      ctx.fillStyle="#888"; ctx.fillRect(7,-4,4,6);
      ctx.restore();

      // Hammers
      gs.hammers.forEach(h => { ctx.save(); ctx.translate(h.x,h.y); ctx.rotate(h.rot); ctx.fillStyle="#c8a060"; ctx.fillRect(-2,-9,4,18); ctx.fillStyle="#889"; ctx.fillRect(-8,-11,16,7); ctx.restore(); });

      // Effects
      gs.flashFx.forEach(e => { const a=1-e.t/500; ctx.fillStyle=`rgba(255,255,255,${a*0.8})`; ctx.fillRect(0,0,CW,CH); });
      gs.renoFx.forEach(e => {
        const a=1-e.t/800;
        for(let i=0;i<10;i++){const ang=(i/10)*Math.PI*2+e.t*0.005,sr=10+e.t*0.06; ctx.fillStyle=i%2===0?`rgba(160,220,208,${a})`:`rgba(232,192,96,${a*0.7})`; ctx.beginPath(); ctx.arc(e.x+Math.cos(ang)*sr,e.y+Math.sin(ang)*sr,3,0,Math.PI*2); ctx.fill();}
        ctx.fillStyle=`rgba(58,90,106,${a})`; ctx.font="bold 16px 'Trebuchet MS',sans-serif"; ctx.textAlign="center"; ctx.fillText("+1",e.x,e.y-15-e.t*0.03);
      });
      gs.hitFx.forEach(e => { const a=1-e.t/500; ctx.strokeStyle=`rgba(232,144,122,${a})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(e.x,e.y,12+e.t*0.1,0,Math.PI*2); ctx.stroke(); });

      // Proximity arrows
      gs.fixtures.forEach(f => {
        if(!f.outdated||f.renovated) return;
        const gp=fixtureGroundPos(f), d=dst(gs.player.x,gs.player.y,gp.x,gp.y);
        if(d<RENO_DIST+40&&d>=RENO_DIST){
          const angle=Math.atan2(gp.y-gs.player.y,gp.x-gs.player.x), ad=35;
          const ax=gs.player.x+Math.cos(angle)*ad, ay=gs.player.y+Math.sin(angle)*ad;
          const pulse=Math.sin(gs.time*0.008)*0.3+0.7;
          ctx.fillStyle=`rgba(232,144,122,${pulse})`;
          ctx.beginPath(); ctx.moveTo(ax+Math.cos(angle)*8,ay+Math.sin(angle)*8); ctx.lineTo(ax+Math.cos(angle+2.5)*6,ay+Math.sin(angle+2.5)*6); ctx.lineTo(ax+Math.cos(angle-2.5)*6,ay+Math.sin(angle-2.5)*6); ctx.closePath(); ctx.fill();
        }
      });

      // HUD
      ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.roundRect(16,14,235,68,12); ctx.fill();
      ctx.strokeStyle=C.seafoam; ctx.lineWidth=2; ctx.beginPath(); ctx.roundRect(16,14,235,68,12); ctx.stroke();
      ctx.fillStyle=C.text; ctx.font="bold 20px 'Trebuchet MS',sans-serif"; ctx.textAlign="left";
      ctx.fillText(`Renovated: ${gs.score}`,30,42);
      ctx.fillStyle=C.textLight; ctx.font="15px 'Trebuchet MS',sans-serif"; ctx.fillText("Photos: ",30,66);
      for(let i=0;i<3;i++){ctx.fillStyle=i<gs.photos?C.accent:"#ddd"; ctx.font="17px sans-serif"; ctx.fillText("📸",100+i*28,67);}

      ctx.fillStyle=C.textLight+"77"; ctx.font="11px 'Trebuchet MS',sans-serif"; ctx.textAlign="center";
      ctx.fillText("WASD: Move (auto-renovate) | SPACE/E/Click/Tap: Throw Hammer",CW/2,CH-10);

      // Mobile joystick indicator
      if (touchRef.current.active) {
        const mag = Math.sqrt(touchRef.current.dx**2 + touchRef.current.dy**2);
        if (mag > 15) {
          ctx.fillStyle = "rgba(160,220,208,0.3)";
          ctx.beginPath(); ctx.arc(gs.player.x, gs.player.y, 30, 0, Math.PI * 2); ctx.fill();
          const ndx = touchRef.current.dx / mag, ndy = touchRef.current.dy / mag;
          ctx.fillStyle = "rgba(160,220,208,0.6)";
          ctx.beginPath(); ctx.arc(gs.player.x + ndx * 20, gs.player.y + ndy * 20, 8, 0, Math.PI * 2); ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen]);

  const handleClick = (e) => {
    if (screen !== "playing") return;
    const gs = gsRef.current;
    if (!gs || gs.paparazzi.length === 0) return;
    let nearest = null, nd = Infinity;
    gs.paparazzi.forEach(p => { const d=dst(gs.player.x,gs.player.y,p.x,p.y); if(d<nd){nd=d;nearest=p;} });
    if (nearest) {
      const a = Math.atan2(nearest.y-(gs.player.y-25), nearest.x-gs.player.x);
      gs.hammers.push({ x:gs.player.x, y:gs.player.y-25, vx:Math.cos(a)*HAMMER_SPEED, vy:Math.sin(a)*HAMMER_SPEED, rot:0 });
      playSound("hammer");
    }
  };

  const bg = {
    width:"100%", minHeight:"100vh",
    background:`linear-gradient(180deg, ${C.skyTop} 0%, ${C.sky} 40%, ${C.sand} 100%)`,
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    fontFamily:"'Trebuchet MS','Gill Sans',sans-serif", color:C.text,
  };

  if (screen === "title") {
    return (
      <div style={bg}>
        <div style={{position:"absolute",top:25,right:55,width:75,height:75,borderRadius:"50%",background:`radial-gradient(circle at 50% 45%, ${C.gold}, #f0d060)`,boxShadow:`0 0 50px ${C.gold}55`}}/>
        <h1 style={{fontSize:"clamp(2rem,7vw,4.2rem)",fontWeight:900,color:C.door,textShadow:`0 2px 12px ${C.seafoam}88`,marginBottom:6,letterSpacing:2,textAlign:"center"}}>
          🌴 RENO REPORTERS 🌴
        </h1>
        <p style={{fontSize:"clamp(0.85rem,2vw,1.1rem)",color:C.textLight,textAlign:"center",maxWidth:500,lineHeight:1.7,marginBottom:20,padding:"0 20px"}}>
          You're inside a beachside fixer-upper! Walk up to glowing doors & windows to renovate them.
          Watch out — paparazzi peek through the windows!
        </p>

        {!showNameInput ? (
          <button onClick={() => setShowNameInput(true)} style={{
            padding:"16px 48px",fontSize:"1.3rem",fontWeight:800,fontFamily:"inherit",
            background:`linear-gradient(135deg, ${C.seafoam}, ${C.door})`,border:`3px solid ${C.white}`,
            borderRadius:10,color:C.white,cursor:"pointer",letterSpacing:2,
            boxShadow:`0 4px 20px ${C.seafoam}55`,transition:"transform 0.15s",
          }}
            onMouseOver={e=>e.target.style.transform="scale(1.05)"}
            onMouseOut={e=>e.target.style.transform="scale(1)"}
          >START GAME</button>
        ) : (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
            <label style={{color:C.textLight,fontSize:"0.9rem"}}>Enter your name (for the tabloids!):</label>
            <input
              type="text" value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && username.trim()) start(); }}
              placeholder="Your name..."
              autoFocus
              style={{
                padding:"10px 20px",fontSize:"1.1rem",fontFamily:"inherit",
                border:`2px solid ${C.seafoam}`,borderRadius:8,outline:"none",
                textAlign:"center",width:250,background:"#fff",color:C.text,
              }}
            />
            <button onClick={() => { if (username.trim()) start(); }} style={{
              padding:"12px 40px",fontSize:"1.1rem",fontWeight:800,fontFamily:"inherit",
              background:`linear-gradient(135deg, ${C.seafoam}, ${C.door})`,border:`3px solid ${C.white}`,
              borderRadius:10,color:C.white,cursor:"pointer",letterSpacing:2,
              opacity:username.trim()?1:0.5,
            }}>GO!</button>
          </div>
        )}

        <div style={{display:"flex",gap:10,marginTop:14}}>
          <button onClick={()=>setShowHow(!showHow)} style={{padding:"8px 22px",fontSize:"0.9rem",fontFamily:"inherit",background:"transparent",border:`1px solid ${C.textLight}55`,color:C.textLight,cursor:"pointer",borderRadius:6}}>{showHow?"HIDE":"HOW TO PLAY"}</button>
          <button onClick={()=>setSoundOn(!soundOn)} style={{padding:"8px 18px",fontSize:"0.85rem",fontFamily:"inherit",background:"transparent",border:`1px solid ${C.textLight}33`,color:C.textLight,cursor:"pointer",borderRadius:6}}>{soundOn?"🔊 SFX ON":"🔇 SFX OFF"}</button>
          <button onClick={()=>setMusicOn(!musicOn)} style={{padding:"8px 18px",fontSize:"0.85rem",fontFamily:"inherit",background:"transparent",border:`1px solid ${C.textLight}33`,color:C.textLight,cursor:"pointer",borderRadius:6}}>{musicOn?"🎵 Radio ON":"🎵 Radio OFF"}</button>
        </div>

        {showHow && (
          <div style={{marginTop:16,padding:22,background:"#ffffff99",border:`1px solid ${C.seafoam}44`,borderRadius:10,maxWidth:470,lineHeight:1.9,fontSize:"0.9rem"}}>
            <p><b style={{color:C.door}}>WASD / Arrows / Touch-drag</b> — Move around</p>
            <p><b style={{color:C.door}}>Walk to a glowing fixture</b> — Auto-renovates!</p>
            <p><b style={{color:C.door}}>SPACE / E / Click / Tap</b> — Throw hammer (auto-aims)</p>
            <p style={{marginTop:10,color:C.accent}}>It gets harder — more paparazzi, furniture obstacles appear, and windows age faster!</p>
          </div>
        )}
      </div>
    );
  }

  if (screen === "gameover") {
    const displayName = username.trim() || "Anonymous Renovator";
    return (
      <div style={{...bg, padding: 20}}>
        <div style={{
          maxWidth:440, width:"100%", background:"#fff", borderRadius:16,
          boxShadow:"0 8px 40px rgba(0,0,0,0.15)", overflow:"hidden",
        }}>
          {/* Tabloid header */}
          <div style={{background:"#1a1a2e",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#e8907a,#f0a090)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",fontWeight:900,color:"#fff"}}>W</div>
              <div>
                <div style={{color:"#fff",fontWeight:800,fontSize:"1rem",letterSpacing:1}}>WMZ</div>
                <div style={{color:"#888",fontSize:"0.7rem"}}>@WMZ · just now</div>
              </div>
            </div>
            <div style={{color:"#5a9eaa",fontSize:"0.85rem",fontWeight:700}}>EXCLUSIVE</div>
          </div>

          {/* Tweet body */}
          <div style={{padding:"20px 24px"}}>
            <p style={{fontSize:"1.05rem",lineHeight:1.6,color:"#1a1a2e",margin:0}}>
              🚨 <b>BREAKING</b>: WMZ has learned that <span style={{color:C.door,fontWeight:700}}>{displayName}</span> has been secretly renovating a beachside property and already completed <span style={{color:C.accent,fontWeight:900,fontSize:"1.3rem"}}>{score}</span> doors and windows before our photographers caught them in the act! 📸🏠
            </p>
            <p style={{fontSize:"0.9rem",color:"#666",marginTop:12,lineHeight:1.5}}>
              Sources say {displayName} was spotted in a Hawaiian shirt wielding a hammer and dodging cameras. More updates to follow...
            </p>

            {/* Engagement stats */}
            <div style={{display:"flex",gap:24,marginTop:16,paddingTop:12,borderTop:"1px solid #eee",color:"#888",fontSize:"0.8rem"}}>
              <span>💬 {Math.floor(score * 47 + 128)}</span>
              <span>🔁 {Math.floor(score * 203 + 1420)}</span>
              <span>❤️ {Math.floor(score * 891 + 5200)}</span>
              <span>📊 {(score * 12.4 + 89.2).toFixed(1)}K</span>
            </div>
          </div>

          {/* Play again + Share */}
          <div style={{padding:"16px 24px 24px",textAlign:"center",display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={start} style={{
              padding:"14px 40px",fontSize:"1.1rem",fontWeight:800,fontFamily:"inherit",
              background:`linear-gradient(135deg, ${C.seafoam}, ${C.door})`,border:`3px solid ${C.white}`,
              borderRadius:10,color:C.white,cursor:"pointer",letterSpacing:2,width:"100%",
            }}
              onMouseOver={e=>e.target.style.transform="scale(1.02)"}
              onMouseOut={e=>e.target.style.transform="scale(1)"}
            >PLAY AGAIN</button>
            <button onClick={() => {
              const text = `🚨 BREAKING: WMZ has learned that ${displayName} has been secretly renovating a beachside property and already completed ${score} doors and windows before photographers caught them! 📸🏠🌴 Can you beat my score? #RenoReporters`;
              const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
              window.open(url, '_blank');
            }} style={{
              padding:"14px 40px",fontSize:"1rem",fontWeight:800,fontFamily:"inherit",
              background:"#5a7d9a",border:"none",
              borderRadius:10,color:C.white,cursor:"pointer",letterSpacing:1,width:"100%",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            }}
              onMouseOver={e=>e.target.style.opacity="0.9"}
              onMouseOut={e=>e.target.style.opacity="1"}
            >📰 SHARE THE NEWS</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{width:"100%",minHeight:"100vh",background:"#f0e8d8",display:"flex",alignItems:"center",justifyContent:"center",padding:10,position:"relative"}}>
      <canvas ref={canvasRef} width={CW} height={CH} onClick={handleClick}
        style={{width:"100%",maxWidth:960,border:`3px solid ${C.seafoam}33`,borderRadius:8,cursor:"default",boxShadow:`0 4px 30px ${C.ocean}22`,touchAction:"none"}} />
      <div style={{position:"absolute",top:18,right:18,display:"flex",gap:6,zIndex:10}}>
        <button onClick={()=>setSoundOn(!soundOn)} style={{padding:"5px 10px",fontSize:"1.1rem",background:"rgba(255,255,255,0.8)",border:"1px solid #ccc",borderRadius:6,cursor:"pointer"}}>{soundOn?"🔊":"🔇"}</button>
        <button onClick={()=>setMusicOn(!musicOn)} style={{padding:"5px 10px",fontSize:"1.1rem",background:musicOn?"rgba(160,220,208,0.8)":"rgba(255,255,255,0.8)",border:"1px solid #ccc",borderRadius:6,cursor:"pointer"}}>{musicOn?"📻":"📻"}</button>
      </div>
    </div>
  );
}
