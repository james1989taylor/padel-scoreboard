// ---- Dark / light mode ----
const THEME_STORAGE_KEY = "padel-theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "light";
applyTheme(savedTheme);

document.getElementById("themeToggle").addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
});

// ---- Match settings (team names, best-of-N sets) ----
const SETTINGS_STORAGE_KEY = "padel-settings";
const DEFAULT_SETTINGS = {
  teamAName: "TEAM A",
  teamBName: "TEAM B",
  bestOf: 3,
  teamAColor: "#2f6fed",
  teamBColor: "#1ea15a",
  font: "geist"
};

// Font choices: a mix of clear, easy-to-read faces plus one designed
// specifically to help with dyslexia (OpenDyslexic, self-hosted below).
const FONT_STACKS = {
  geist: '"Geist", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  verdana: 'Verdana, Geneva, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  opendyslexic: '"OpenDyslexicRegular", "Comic Sans MS", sans-serif'
};

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = loadSettings();

function setsToWin() {
  return Math.ceil(settings.bestOf / 2);
}

// Colors are applied as CSS custom properties on the root element, which
// override the theme's defaults regardless of light/dark mode.
function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
}

function applyTeamColors() {
  const root = document.documentElement;
  root.style.setProperty("--team-a", settings.teamAColor);
  root.style.setProperty("--team-a-soft", hexToRgba(settings.teamAColor, 0.14));
  root.style.setProperty("--team-b", settings.teamBColor);
  root.style.setProperty("--team-b-soft", hexToRgba(settings.teamBColor, 0.14));
}

function applyFont() {
  const stack = FONT_STACKS[settings.font] || FONT_STACKS.geist;
  document.documentElement.style.setProperty("--app-font", stack);
}

function applySettingsToUI() {
  document.getElementById("teamAName").textContent = settings.teamAName;
  document.getElementById("teamBName").textContent = settings.teamBName;
  document.getElementById("teamANameInput").value = settings.teamAName;
  document.getElementById("teamBNameInput").value = settings.teamBName;
  document.getElementById("bestOfSelect").value = String(settings.bestOf);
  document.getElementById("teamAColorInput").value = settings.teamAColor;
  document.getElementById("teamBColorInput").value = settings.teamBColor;
  document.getElementById("fontSelect").value = settings.font;
  applyTeamColors();
  applyFont();
}
applySettingsToUI();

document.getElementById("saveSettingsBtn").addEventListener("click", () => {
  const aName = document.getElementById("teamANameInput").value.trim().toUpperCase() || DEFAULT_SETTINGS.teamAName;
  const bName = document.getElementById("teamBNameInput").value.trim().toUpperCase() || DEFAULT_SETTINGS.teamBName;
  const bestOf = parseInt(document.getElementById("bestOfSelect").value, 10);
  const aColor = document.getElementById("teamAColorInput").value || DEFAULT_SETTINGS.teamAColor;
  const bColor = document.getElementById("teamBColorInput").value || DEFAULT_SETTINGS.teamBColor;
  const font = document.getElementById("fontSelect").value;
  settings = { teamAName: aName, teamBName: bName, bestOf, teamAColor: aColor, teamBColor: bColor, font };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  applySettingsToUI();
  render();
  settingsPopover.hidden = true;
});

document.getElementById("restoreDefaultsBtn").addEventListener("click", () => {
  if (!confirm("Restore default team names, colors, format and font?")) return;
  settings = { ...DEFAULT_SETTINGS };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  applySettingsToUI();
  render();
});

// ---- Match state ----
const state = {
  points: [0, 0],       // current game points, 0/1/2/3 = 0/15/30/40, "Ad" handled specially
  games: [0, 0],        // games won in current set
  sets: [[], []],       // completed set scores, e.g. sets[0] = [6,4,7] games won by A per set
  setWins: [0, 0],      // sets won
  advantage: null,      // 0 or 1 if that team has advantage, null otherwise
  tiebreak: false,      // true when playing a 6-6 tiebreak
  tiebreakPoints: [0, 0],
  matchOver: false,
  winner: null
};

let history = []; // stack of previous states, for Undo

function cloneState() {
  return JSON.parse(JSON.stringify(state));
}

function pushHistory() {
  history.push(cloneState());
  if (history.length > 50) history.shift();
}

const POINT_NAMES = ["0", "15", "30", "40"];

// team = 0 for Team A, 1 for Team B
function pointFor(team) {
  if (state.matchOver) return;
  pushHistory();

  const other = team === 0 ? 1 : 0;

  if (state.tiebreak) {
    state.tiebreakPoints[team]++;
    checkTiebreakWin(team, other);
    render();
    return;
  }

  // Standard ad-scoring game
  if (state.advantage === other) {
    // opponent had advantage, this point cancels it back to deuce
    state.advantage = null;
    render();
    return;
  }
  if (state.advantage === team) {
    winGame(team);
    return;
  }
  if (state.points[team] === 3 && state.points[other] === 3) {
    // deuce -> advantage
    state.advantage = team;
    render();
    return;
  }
  if (state.points[team] === 3 && state.points[other] < 3) {
    winGame(team);
    return;
  }
  state.points[team]++;
  render();
}

function winGame(team) {
  state.points = [0, 0];
  state.advantage = null;
  state.games[team]++;
  checkSetWin(team);
  render();
}

function checkSetWin(team) {
  const other = team === 0 ? 1 : 0;
  const g = state.games;

  if (g[team] === 6 && g[other] === 6) {
    state.tiebreak = true;
    state.tiebreakPoints = [0, 0];
    return;
  }
  const wonSet = (g[team] >= 6 && g[team] - g[other] >= 2) || g[team] === 7;
  if (wonSet) {
    completeSet(team);
  }
}

function checkTiebreakWin(team, other) {
  const tp = state.tiebreakPoints;
  if (tp[team] >= 7 && tp[team] - tp[other] >= 2) {
    state.games[team]++; // tiebreak counts as one game, making the set score e.g. 7-6
    state.tiebreak = false;
    completeSet(team);
  }
}

function completeSet(team) {
  const other = team === 0 ? 1 : 0;
  state.sets[0].push(state.games[0]);
  state.sets[1].push(state.games[1]);
  state.setWins[team]++;
  state.games = [0, 0];
  state.points = [0, 0];
  state.advantage = null;

  if (state.setWins[team] === setsToWin()) {
    state.matchOver = true;
    state.winner = team;
    celebrate("MATCH WON", team, { big: true });
  } else {
    celebrate("SET WON", team);
  }
}

// ---- Set/match win celebration (confetti + colored banner) ----
// Triggered directly from completeSet() rather than from render(), so
// replaying a state via Undo/redo never re-plays the animation - only an
// actual new point that completes a set/match does.
const CELEBRATION_CONFETTI_COLORS = ["#2f6fed", "#1ea15a", "#ffce3d", "#ff6b60", "#a15be0"];

function spawnConfetti(count, colors) {
  const overlay = document.getElementById("celebration");
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    const duration = 1.8 + Math.random() * 1.4;
    const delay = Math.random() * 0.6;
    piece.style.animationDuration = duration + "s";
    piece.style.animationDelay = delay + "s";
    overlay.appendChild(piece);
    setTimeout(() => piece.remove(), (duration + delay) * 1000 + 100);
  }
}

function celebrate(text, team, { big = false } = {}) {
  const overlay = document.getElementById("celebration");
  const teamColor = team === 0 ? "var(--team-a)" : "var(--team-b)";

  const label = document.createElement("div");
  label.className = "celebration-text";
  label.textContent = text;
  label.style.color = teamColor;
  overlay.appendChild(label);
  setTimeout(() => label.remove(), 2400);

  spawnConfetti(big ? 140 : 60, big ? CELEBRATION_CONFETTI_COLORS : [teamColor, "#ffffff"]);
  if (big) {
    setTimeout(() => spawnConfetti(90, CELEBRATION_CONFETTI_COLORS), 350);
    setTimeout(() => spawnConfetti(90, CELEBRATION_CONFETTI_COLORS), 700);
  }

  playCelebrationSound(big);
}

// ---- Celebration sound (synthesized - no audio files to ship/license) ----
let celebrationAudioCtx = null;

function getCelebrationAudioCtx() {
  if (!celebrationAudioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    celebrationAudioCtx = new Ctx();
  }
  if (celebrationAudioCtx.state === "suspended") celebrationAudioCtx.resume();
  return celebrationAudioCtx;
}

function playTone(ctx, freq, startTime, duration, peakGain) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function playCelebrationSound(big) {
  const ctx = getCelebrationAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Set win: a short 3-note ascending chime.
  const setNotes = [523.25, 659.25, 783.99]; // C5, E5, G5
  setNotes.forEach((freq, i) => playTone(ctx, freq, now + i * 0.12, 0.35, 0.25));

  if (big) {
    // Match win: a longer fanfare on top of the chime above.
    const fanfare = [783.99, 987.77, 1046.5, 1318.51]; // G5, B5, C6, E6
    fanfare.forEach((freq, i) => playTone(ctx, freq, now + 0.4 + i * 0.16, 0.5, 0.28));
  }
}

function undo() {
  if (history.length === 0) return;
  const prev = history.pop();
  Object.assign(state, prev);
  render();
}

function resetMatch() {
  pushHistory();
  state.points = [0, 0];
  state.games = [0, 0];
  state.sets = [[], []];
  state.setWins = [0, 0];
  state.advantage = null;
  state.tiebreak = false;
  state.tiebreakPoints = [0, 0];
  state.matchOver = false;
  state.winner = null;
  render();
}

// ---- Rendering ----
function pointLabel(team) {
  const other = team === 0 ? 1 : 0;
  if (state.tiebreak) return String(state.tiebreakPoints[team]);
  if (state.advantage === team) return "Ad";
  if (state.advantage === other) return "40";
  if (state.points[team] === 3 && state.points[other] === 3) return "40";
  return POINT_NAMES[state.points[team]];
}

function render() {
  document.getElementById("pointsA").textContent = pointLabel(0);
  document.getElementById("pointsB").textContent = pointLabel(1);
  document.getElementById("gamesA").textContent = state.games[0];
  document.getElementById("gamesB").textContent = state.games[1];
  document.getElementById("setWinsA").textContent = state.setWins[0];
  document.getElementById("setWinsB").textContent = state.setWins[1];

  const completedSets = state.sets[0].length;
  const setLabelEl = document.getElementById("setLabel");
  if (state.matchOver) {
    setLabelEl.textContent = (state.winner === 0 ? settings.teamAName : settings.teamBName) + " WINS";
  } else if (state.tiebreak) {
    setLabelEl.textContent = "TIEBREAK";
  } else {
    setLabelEl.textContent = "SET " + (completedSets + 1);
  }

  const dotsEl = document.getElementById("setDots");
  dotsEl.innerHTML = "";
  for (let i = 0; i < settings.bestOf; i++) {
    const dot = document.createElement("span");
    dot.className = "dot" + (i < completedSets ? " done" : i === completedSets && !state.matchOver ? " current" : "");
    dotsEl.appendChild(dot);
  }
}

// ---- Manual tap buttons (fallback / testing without the physical remotes) ----
document.getElementById("tapA").addEventListener("click", () => pointFor(0));
document.getElementById("tapB").addEventListener("click", () => pointFor(1));
document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("resetBtn").addEventListener("click", () => {
  if (confirm("Reset the whole match?")) resetMatch();
});

// ---- Settings gear popover ----
const settingsBtn = document.getElementById("settingsBtn");
const settingsPopover = document.getElementById("settingsPopover");
settingsBtn.addEventListener("click", () => {
  settingsPopover.hidden = !settingsPopover.hidden;
});

// ---- Bluetooth remote support ----
// The remotes pair as Bluetooth keyboards. Pressing them fires a normal
// browser "keydown" event with some keyCode. We let the user "teach" the
// app which keyCode belongs to which team, and save that in localStorage
// so it's remembered next time. See Part 7 and Part 8 of the build plan.

const KEY_BINDING_STORAGE_KEY = "padel-key-bindings";

function loadKeyBindings() {
  const raw = localStorage.getItem(KEY_BINDING_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveKeyBindings(bindings) {
  localStorage.setItem(KEY_BINDING_STORAGE_KEY, JSON.stringify(bindings));
}

let keyBindings = loadKeyBindings(); // { teamAKey, teamBKey, undoKey: string|null }

function updateKeyBindStatus() {
  const el = document.getElementById("keyBindStatus");
  if (keyBindings) {
    el.textContent =
      "Buttons: A=" + keyBindings.teamAKey +
      "  B=" + keyBindings.teamBKey +
      "  Undo=" + (keyBindings.undoKey || "none");
  } else {
    el.textContent = "Buttons: not set";
  }
}
updateKeyBindStatus();

// Learning steps in order: bind Team A, bind Team B, then optionally bind Undo.
let learning = false;
let learningStep = null; // "teamA" | "teamB" | "undo"
const skipUndoBtn = document.getElementById("skipUndoBtn");

function startLearning() {
  learning = true;
  learningStep = "teamA";
  skipUndoBtn.hidden = true;
  document.getElementById("keyBindStatus").textContent = "Press the button for TEAM A now...";
}

function finishLearning() {
  saveKeyBindings(keyBindings);
  learning = false;
  learningStep = null;
  skipUndoBtn.hidden = true;
  updateKeyBindStatus();
}

document.getElementById("learnBtn").addEventListener("click", startLearning);

skipUndoBtn.addEventListener("click", () => {
  if (!learning || learningStep !== "undo") return;
  keyBindings.undoKey = null;
  finishLearning();
});

window.addEventListener("keydown", (e) => {
  // Let normal typing work in text inputs/selects (e.g. the settings form) -
  // only treat keys as scoreboard/remote-button input outside of those.
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

  // Prevent the page from scrolling/zooming on keys like PageDown/space.
  e.preventDefault();

  if (learning) {
    if (learningStep === "teamA") {
      keyBindings = keyBindings || {};
      keyBindings.teamAKey = e.code;
      learningStep = "teamB";
      document.getElementById("keyBindStatus").textContent =
        "Got A=" + e.code + " — now press the button for TEAM B...";
    } else if (learningStep === "teamB") {
      keyBindings.teamBKey = e.code;
      learningStep = "undo";
      skipUndoBtn.hidden = false;
      document.getElementById("keyBindStatus").textContent =
        "Got B=" + e.code + " — optionally press a button for UNDO, or tap Skip.";
    } else if (learningStep === "undo") {
      keyBindings.undoKey = e.code;
      finishLearning();
    }
    return;
  }

  if (!keyBindings) return;
  if (keyBindings.undoKey && e.code === keyBindings.undoKey) {
    undo();
    return;
  }
  if (e.code === keyBindings.teamAKey) pointFor(0);
  if (e.code === keyBindings.teamBKey) pointFor(1);
});

// ---- Remote button debug overlay ----
// Bluetooth rings/clickers can pair as a keyboard (fires keydown), as a
// "consumer control" device (fires keydown with codes like AudioVolumeUp,
// MediaTrackNext, BrowserBack), or as a generic HID gamepad (no keydown at
// all - only visible via the Gamepad API). This overlay logs everything so
// we can see which of those a given remote actually sends.
const debugOverlay = document.getElementById("debugOverlay");
const debugLog = document.getElementById("debugLog");
const debugGamepadStatus = document.getElementById("debugGamepadStatus");
let debugGamepadRAF = null;
const debugLastButtonState = new Map(); // gamepad index -> array of pressed booleans

function debugLogLine(text) {
  const li = document.createElement("li");
  const time = new Date().toLocaleTimeString();
  li.textContent = "[" + time + "] " + text;
  debugLog.prepend(li);
  while (debugLog.children.length > 200) debugLog.removeChild(debugLog.lastChild);
}

function debugKeyHandler(e) {
  debugLogLine(
    e.type + " key=" + e.key + " code=" + e.code + " keyCode=" + e.keyCode +
    (e.repeat ? " (repeat)" : "")
  );
}

// Some remotes pair as a mouse/scroll-wheel HID device instead of a keyboard,
// which is why a press can scroll the page or trigger pull-to-refresh without
// ever firing a keydown. Log these too so we can tell the difference.
function debugWheelHandler(e) {
  debugLogLine("wheel deltaX=" + e.deltaX + " deltaY=" + e.deltaY + " deltaMode=" + e.deltaMode);
}

function debugMouseHandler(e) {
  debugLogLine(
    e.type + " button=" + e.button + " buttons=" + e.buttons +
    " isTrusted=" + e.isTrusted + " x=" + e.clientX + " y=" + e.clientY +
    " target=" + (e.target && e.target.id || e.target.tagName)
  );
}

// pointerType tells us whether a click came from a real finger touch or from
// a Bluetooth mouse/ring HID device pretending to click - the key signal we
// need to safely tell "player tapped the screen" apart from "ring clicked".
function debugPointerHandler(e) {
  debugLogLine(
    e.type + " pointerType=" + e.pointerType + " button=" + e.button + " isPrimary=" + e.isPrimary
  );
}

function debugPollGamepads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let connected = 0;
  for (const pad of pads) {
    if (!pad) continue;
    connected++;
    const prev = debugLastButtonState.get(pad.index) || [];
    pad.buttons.forEach((btn, i) => {
      const wasPressed = !!prev[i];
      if (btn.pressed && !wasPressed) {
        debugLogLine("gamepad[" + pad.index + "] button " + i + " pressed (" + pad.id + ")");
      }
    });
    debugLastButtonState.set(pad.index, pad.buttons.map((b) => b.pressed));
  }
  debugGamepadStatus.textContent = connected
    ? "Gamepad API: " + connected + " controller(s) connected"
    : "Gamepad API: no controller connected";
  debugGamepadRAF = requestAnimationFrame(debugPollGamepads);
}

function openDebugOverlay() {
  debugOverlay.hidden = false;
  window.addEventListener("keydown", debugKeyHandler, true);
  window.addEventListener("keyup", debugKeyHandler, true);
  window.addEventListener("wheel", debugWheelHandler, true);
  window.addEventListener("mousedown", debugMouseHandler, true);
  window.addEventListener("mouseup", debugMouseHandler, true);
  window.addEventListener("click", debugMouseHandler, true);
  window.addEventListener("pointerdown", debugPointerHandler, true);
  window.addEventListener("pointerup", debugPointerHandler, true);
  window.addEventListener("gamepadconnected", (e) => {
    debugLogLine("gamepadconnected: " + e.gamepad.id);
  });
  window.addEventListener("gamepaddisconnected", (e) => {
    debugLogLine("gamepaddisconnected: " + e.gamepad.id);
  });
  debugPollGamepads();
}

function closeDebugOverlay() {
  debugOverlay.hidden = true;
  window.removeEventListener("keydown", debugKeyHandler, true);
  window.removeEventListener("keyup", debugKeyHandler, true);
  window.removeEventListener("wheel", debugWheelHandler, true);
  window.removeEventListener("mousedown", debugMouseHandler, true);
  window.removeEventListener("mouseup", debugMouseHandler, true);
  window.removeEventListener("click", debugMouseHandler, true);
  window.removeEventListener("pointerdown", debugPointerHandler, true);
  window.removeEventListener("pointerup", debugPointerHandler, true);
  if (debugGamepadRAF) cancelAnimationFrame(debugGamepadRAF);
  debugGamepadRAF = null;
}

document.getElementById("debugRemoteBtn").addEventListener("click", () => {
  settingsPopover.hidden = true;
  debugLog.innerHTML = "";
  openDebugOverlay();
});
document.getElementById("debugCloseBtn").addEventListener("click", closeDebugOverlay);
document.getElementById("debugClearBtn").addEventListener("click", () => {
  debugLog.innerHTML = "";
});


// ---- Keep the screen awake ----
let wakeLock = null;

async function requestWakeLock() {
  const statusEl = document.getElementById("wakeLockStatus");
  if (!("wakeLock" in navigator)) {
    statusEl.textContent = "Screen lock: not supported on this browser";
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    statusEl.textContent = "Screen lock: active";
    wakeLock.addEventListener("release", () => {
      statusEl.textContent = "Screen lock: released";
    });
  } catch (err) {
    statusEl.textContent = "Screen lock: failed (" + err.message + ")";
  }
}

// Wake Lock is released automatically when the tab is hidden/backgrounded.
// Re-request it whenever the page becomes visible again.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") requestWakeLock();
});

// Browsers require a user gesture before Wake Lock can be granted the
// first time, so request it on the first tap anywhere on the page.
document.body.addEventListener("click", requestWakeLock, { once: true });

// ---- Fullscreen (hides the browser address bar on Android Chrome, even outside "Add to Home Screen") ----
function requestFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) {
    el.requestFullscreen().catch(() => {});
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    requestFullscreen();
  }
}

// Same first-tap gesture used for Wake Lock also triggers fullscreen.
document.body.addEventListener("click", requestFullscreen, { once: true });
document.getElementById("fullscreenBtn").addEventListener("click", toggleFullscreen);

// ---- Register the offline service worker (see Part 4.5) ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

render();
