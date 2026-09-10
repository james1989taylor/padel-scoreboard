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

  if (state.setWins[team] === 2) {
    state.matchOver = true;
    state.winner = team;
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
  document.getElementById("setsA").textContent = state.sets[0].join(" · ");
  document.getElementById("setsB").textContent = state.sets[1].join(" · ");

  if (state.matchOver) {
    document.getElementById("matchStatus").textContent =
      "Match over — Team " + (state.winner === 0 ? "A" : "B") + " wins";
  } else if (state.tiebreak) {
    document.getElementById("matchStatus").textContent = "Tiebreak (first to 7, win by 2)";
  } else {
    document.getElementById("matchStatus").textContent = "Best of 3 sets";
  }
}

// ---- Manual tap buttons (fallback / testing without the physical remotes) ----
document.getElementById("tapA").addEventListener("click", () => pointFor(0));
document.getElementById("tapB").addEventListener("click", () => pointFor(1));
document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("resetBtn").addEventListener("click", () => {
  if (confirm("Reset the whole match?")) resetMatch();
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

let keyBindings = loadKeyBindings(); // { teamAKey: "AudioVolumeUp", teamBKey: "PageDown" }

function updateKeyBindStatus() {
  const el = document.getElementById("keyBindStatus");
  if (keyBindings) {
    el.textContent = "Buttons: A=" + keyBindings.teamAKey + "  B=" + keyBindings.teamBKey;
  } else {
    el.textContent = 'Buttons: not set — tap "Learn buttons"';
  }
}
updateKeyBindStatus();

let learning = false;
let learningTeam = null;

document.getElementById("learnBtn").addEventListener("click", () => {
  learning = true;
  learningTeam = 0;
  alert("Press the button you want to use for TEAM A now.");
});

window.addEventListener("keydown", (e) => {
  // Prevent the page from scrolling/zooming on keys like PageDown/space.
  e.preventDefault();

  if (learning) {
    if (learningTeam === 0) {
      keyBindings = keyBindings || {};
      keyBindings.teamAKey = e.code;
      learningTeam = 1;
      alert("Got it. Now press the button you want to use for TEAM B.");
    } else if (learningTeam === 1) {
      keyBindings.teamBKey = e.code;
      saveKeyBindings(keyBindings);
      updateKeyBindStatus();
      learning = false;
      learningTeam = null;
      alert("Both buttons learned and saved.");
    }
    return;
  }

  if (!keyBindings) return;
  if (e.code === keyBindings.teamAKey) pointFor(0);
  if (e.code === keyBindings.teamBKey) pointFor(1);
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

// ---- Register the offline service worker (see Part 4.5) ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

render();
