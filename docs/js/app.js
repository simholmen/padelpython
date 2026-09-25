import { createPlayer } from "./player.js";
import { buildRound, buildLastRound, buildWaveRound, applyResults, matchScoreError, sortPlayers, podiumStartSeconds } from "./tournament.js";
import { createInitialState } from "./state.js";
import { saveState, loadState } from "./persistence.js";
import { makeConfetti } from "./confetti.js";
import { computeSpin, SPIN_DURATION_MS } from "./wheel.js";
import { renderScreen, renderModalContent, matchStatusBadgeHtml, confettiLayer } from "./views.js";
import { bindKeyboard } from "./keyboard.js";
import { isDevMode } from "./env.js";

const appEl = document.getElementById("app");
const screenEl = document.getElementById("screen-root");
const modalEl = document.getElementById("modal-root");

const loaded = loadState();
const state = loaded ? Object.assign(createInitialState(), loaded) : createInitialState();
// Not editable in the UI, so always take it from state.js rather than an older
// saved copy -- otherwise renaming it there never shows up in a running browser.
state.tournamentName = createInitialState().tournamentName;
state.selectedPlayerId = null; // the player popup is transient UI, never resume it on reload
state.confirmingReset = false; // ditto for the logo's "start over" confirm dialog
state.confirmingClearPlayers = false; // ditto for the "remove all players" confirm dialog
state.showAdminTable = false; // ditto for the admin table modal
state.removalTargetId = null; // ditto for the remove-player picker
state.adminRoundFilter = "total"; // ditto for the admin table's round dropdown
state.confirmingRevertRound = null; // ditto for the revert-round confirm
state.adminNewPlayerName = ""; // ditto for the admin table's add-player field
state.addPlayerError = ""; // ditto for the duplicate-name error under either add field

// A refresh mid-spin persists spinning:true, but the in-memory setTimeout that
// would ever clear it is gone -- spinWheel() would refuse to spin again
// forever. Reset to a clean, unspun wheel so the finale can continue normally.
if (state.spinning) {
  state.spinning = false;
  state.wheelRotation = 0;
}

function render() {
  screenEl.innerHTML = renderScreen(state);
}

function renderModal() {
  modalEl.innerHTML = renderModalContent(state);
}

// Re-rendering replaces the whole screen subtree, which would otherwise drop
// focus (and mid-word typing) out of whatever input the user was just typing
// into -- e.g. hitting Enter repeatedly to add several players in a row. Capture
// which field was focused before the re-render and restore focus (+ cursor
// position) to its replacement afterwards.
function captureFocus() {
  const el = document.activeElement;
  if (!el || !screenEl.contains(el) || !el.dataset || !el.dataset.bind) return null;
  return {
    bind: el.dataset.bind,
    idx: el.dataset.idx,
    matchId: el.dataset.matchId,
    selectionStart: typeof el.selectionStart === "number" ? el.selectionStart : null,
  };
}

function restoreFocus(info) {
  if (!info) return;
  let selector = `[data-bind="${info.bind}"]`;
  if (info.idx !== undefined) selector += `[data-idx="${info.idx}"]`;
  if (info.matchId !== undefined) selector += `[data-match-id="${info.matchId}"]`;
  const el = screenEl.querySelector(selector);
  if (!el) return;
  el.focus();
  if (info.selectionStart !== null && typeof el.setSelectionRange === "function") {
    try { el.setSelectionRange(info.selectionStart, info.selectionStart); } catch (_) {}
  }
}

function persistAndRender() {
  saveState(state);
  const focus = captureFocus();
  render();
  restoreFocus(focus);
}

function persistOnly() {
  saveState(state);
}

// Patches just the confetti overlay into (or out of) the current screen,
// never through persistAndRender(): that replaces the whole screen's
// innerHTML, which would restart every in-flight CSS animation on it from
// scratch (most visibly the finale's countdown-list/podium reveal, which is
// timed in seconds -- a mid-sequence confetti burst used to reset it back to
// its opening frame). Every other call site already renders whatever new
// content it needs itself before calling celebrate(); this only ever adds
// or removes the overlay on top of that.
function patchConfettiLayer() {
  const screen = screenEl.querySelector(".screen");
  if (!screen) return;
  const existing = screen.querySelector(".confetti-layer");
  if (existing) existing.remove();
  if (state.showConfetti) screen.insertAdjacentHTML("beforeend", confettiLayer(state));
}

function celebrate() {
  state.showConfetti = true;
  state.confettiPieces = makeConfetti();
  persistOnly();
  patchConfettiLayer();
  setTimeout(() => {
    state.showConfetti = false;
    persistOnly();
    patchConfettiLayer();
  }, 3000);
}

// ---- Setup actions ----

function setNewPlayerName(val) {
  state.newPlayerName = val;
  clearAddPlayerError();
  persistOnly();
}

// Player names must be unique -- case-insensitive and ignoring surrounding
// whitespace, so "Emma" and " emma " count as the same person. Shared by the
// setup list's add and the admin table's mid-tournament add.
function nameTaken(name) {
  const key = name.trim().toLocaleLowerCase("no");
  return state.players.some((p) => p.name.trim().toLocaleLowerCase("no") === key);
}

function duplicateNameError(name) {
  return `Dette navnet er tatt: «${name}»`;
}

// Typing in either add field clears a shown duplicate-name error. Patched out
// of the DOM directly (not a re-render) so the input keeps focus and caret,
// same reasoning as setNewPlayerName's persistOnly.
function clearAddPlayerError() {
  if (!state.addPlayerError) return;
  state.addPlayerError = "";
  appEl.querySelectorAll(".add-player-error").forEach((el) => el.remove());
}

function addPlayer() {
  const name = (state.newPlayerName || "").trim();
  if (!name) return;
  if (nameTaken(name)) {
    state.addPlayerError = duplicateNameError(name);
    persistAndRender();
    return;
  }
  const player = createPlayer(name);
  if (state.newPlayerCasual) player.points = -1;
  state.players.push(player);
  state.newPlayerName = "";
  persistAndRender();
}

// Dev-only convenience for testing big fields (see isDevMode) -- adds 26
// "Spiller N" placeholders in one click instead of typing them by hand.
// Guarded here too, not just by the button's own visibility, so it's a no-op
// if ever triggered outside dev mode.
const TEST_PLAYER_NAMES = [
  "Simen", "Emma", "Noah", "Nora", "Oskar", "Sofie", "Jakob", "Ella",
  "Lucas", "Maja", "William", "Ingrid", "Oliver", "Sara", "Filip", "Thea",
  "Henrik", "Emilie", "Aksel", "Frida", "Magnus", "Ida", "Elias", "Mathilde",
  "Tobias", "Live",
];

function addTestPlayers() {
  if (!isDevMode()) return;
  TEST_PLAYER_NAMES.filter((name) => !nameTaken(name)).forEach((name) => state.players.push(createPlayer(name)));
  persistAndRender();
}

function setNewPlayerCasual(val) {
  state.newPlayerCasual = val;
  persistAndRender();
}

function removePlayer(idx) {
  state.players.splice(idx, 1);
  persistAndRender();
}

// Editing a name in the setup list, mirroring setCourtName: persist only, no
// re-render, so the input the user is mid-typing in never loses focus/cursor.
function setPlayerName(idx, val) {
  if (!state.players[idx]) return;
  state.players[idx].name = val;
  persistOnly();
}

// Toggles a player already in the setup list between casual (-1 starting
// points, see addPlayer) and normal (0). Only meaningful pre-tournament --
// once live, points reflect actual results and this button isn't shown.
function toggleCasual(idx) {
  const p = state.players[idx];
  if (!p) return;
  p.points = p.points < 0 ? 0 : -1;
  persistAndRender();
}

function setCourtCount(delta) {
  const clamped = Math.max(1, Math.min(8, state.courtCount + delta));
  const names = [...state.courtNames];
  while (names.length < clamped) names.push("Bane " + (names.length + 1));
  while (names.length > clamped) names.pop();
  state.courtCount = clamped;
  state.courtNames = names;
  persistAndRender();
}

function setCourtName(idx, val) {
  state.courtNames[idx] = val;
  persistOnly();
}

function setLuckyLoserEnabled(val) {
  state.luckyLoserEnabled = val;
  persistAndRender();
}

function setWaveModeEnabled(val) {
  state.waveModeEnabled = val;
  persistAndRender();
}

// Builds a brand-new round, picking whichever strategy is active: the special
// last round, wave mode, or normal. Shared by startTournament and
// confirmRoundEnd so the three-way branch only exists in one place.
//
// Wave mode puts BOTH waves on screen at once as one flat list of matches --
// each tagged with its `wave` number, so renderMatchups can draw the
// "BØLGE 2" divider -- and the whole round is registered in one go, like a
// normal round. pendingWaves/waveNumber/waveTotal are therefore always their
// no-waves defaults for new rounds; the wave-by-wave branch in confirmRoundEnd
// only still runs for a tournament that was saved mid-wave by an older version.
function buildNewRound(useLastRound) {
  if (useLastRound) {
    const { matches, walkoverPlayerIds } = buildLastRound(state.players, state.courtCount, state.courtNames);
    return { matches, walkoverPlayerIds, pendingWaves: [], waveTotal: 1, waveRemainderIds: [] };
  }
  if (state.waveModeEnabled) {
    const { waves, walkoverPlayerIds } = buildWaveRound(state.players, state.courtCount, state.courtNames);
    const matches = waves.flatMap((wave, wi) => wave.map((m) => ({ ...m, wave: wi + 1 })));
    return { matches, walkoverPlayerIds, pendingWaves: [], waveTotal: 1, waveRemainderIds: [] };
  }
  const { matches, walkoverPlayerIds } = buildRound(state.players, state.courtCount, state.courtNames);
  return { matches, walkoverPlayerIds, pendingWaves: [], waveTotal: 1, waveRemainderIds: [] };
}

function startTournament() {
  if (state.players.length < 4) return;
  const built = buildNewRound(false);
  state.phase = "live";
  state.matches = built.matches;
  state.walkoverPlayerIds = built.walkoverPlayerIds;
  state.pendingWaves = built.pendingWaves;
  state.waveNumber = 1;
  state.waveTotal = built.waveTotal;
  state.waveRemainderIds = built.waveRemainderIds;
  state.round = 1;
  state.view = 0;
  saveRoundSnapshot(1);
  persistAndRender();
}

// ---- Live actions ----

// Like setPlayerName/setCourtName: persist only, no re-render, so typing a
// score never rebuilds the input mid-keystroke (that caused laggy input,
// the caret jumping to the start on every character, and digits landing in
// the wrong order -- type="number" inputs don't support the selection-range
// restore captureFocus/restoreFocus rely on for text inputs). Scores are only
// checked when ending the round is attempted (see requestRoundEnd/
// requestLastRound), not while typing. The LIVE/FERDIG badge still updates
// live -- see refreshMatchStatusBadge, called right after this, which patches
// just that one badge element directly instead of re-rendering.
function setMatchScore(idx, field, val) {
  state.matches[idx][field] = val;
  persistOnly();
}

// Patches one match card's LIVE/FERDIG badge directly in the DOM, without
// touching (or re-rendering) the score inputs themselves -- a full
// persistAndRender() here would rebuild the inputs mid-keystroke (see
// setMatchScore) and, worse, could steal focus if triggered while the user
// is tabbing/clicking from one score field to another in the same re-render.
function refreshMatchStatusBadge(idx) {
  const m = state.matches[idx];
  if (!m) return;
  const card = screenEl.querySelector(`.match-card[data-match-idx="${idx}"]`);
  const holder = card && card.querySelector(".live-indicator, .finished-indicator");
  if (!card) return;
  const html = matchStatusBadgeHtml(m);
  if (holder) holder.outerHTML = html;
  else if (html) card.querySelector(".match-card-top").insertAdjacentHTML("beforeend", html);
}

function cycleView(delta) {
  if (state.confirmPending) return; // the confirm step isn't part of the view cycle
  state.view = (state.view + delta + 3) % 3;
  persistAndRender();
}

// True if any current match has an invalid score pair (see matchScoreError):
// not a whole 0-50 number, only one side filled in, or a tie. Blocks ending
// the round -- a blank match is fine (not scored yet), a broken one isn't.
function hasScoreErrors() {
  return state.matches.some((m) => matchScoreError(m.score1, m.score2) !== null);
}

// Enter, from any of the 3 live views: shows the "are you sure" confirm step.
// Nothing is applied yet -- this just flags confirmPending, leaving `view`
// untouched so "back" can return to exactly where the user was.
function requestRoundEnd() {
  if (state.confirmPending) return;
  // Scores are only checked here, when actually trying to end the round --
  // not while typing (see setMatchScore). Flip showScoreErrors so the red
  // highlighting appears as the reason nothing happened, rather than
  // silently doing nothing.
  if (hasScoreErrors()) { state.showScoreErrors = true; persistAndRender(); return; }
  state.confirmPending = true;
  persistAndRender();
}

// The "SISTE RUNDE" button: same confirm step as requestRoundEnd, but flags
// that confirming should build the special everyone-plays last round next
// (see buildLastRound) instead of a normal one. Never available once that
// last round is already the one on screen (isLastRound) -- there's no round
// after the last round.
function requestLastRound() {
  if (state.confirmPending || state.isLastRound) return;
  if (hasScoreErrors()) { state.showScoreErrors = true; persistAndRender(); return; }
  state.pendingLastRound = true;
  state.confirmPending = true;
  persistAndRender();
}

// Enter again, from the confirm step: actually applies the current wave/
// round's results, then either advances to the next queued wave (wave mode,
// same round number), builds the next round (normal or, if requested, the
// special last round), or -- if the round just confirmed WAS the last round
// -- jumps straight to the finale instead.
function confirmRoundEnd() {
  if (!state.confirmPending) return;
  applyResults(state.players, state.matches, state.walkoverPlayerIds, state.round);

  // Wave mode: more waves queued for THIS round -- advance to the next one
  // without touching the round number or pendingLastRound/isLastRound at all
  // (those stay dormant until the round's actual last wave confirms).
  if (state.pendingWaves.length > 0) {
    state.matches = state.pendingWaves.shift();
    state.waveNumber += 1;
    state.walkoverPlayerIds = state.pendingWaves.length === 0 ? state.waveRemainderIds : [];
    state.confirmPending = false;
    state.showScoreErrors = false;
    persistAndRender();
    celebrate();
    return;
  }

  // Players marked "remove from next round" (see removePlayerNextRound) played
  // out the round whose results were just applied above; they drop out of the
  // pool before the next round -- or the finale, if this was the last round --
  // is built. Not run on the wave-continuation return above: that's still the
  // same round, not the "next" one.
  state.players = state.players.filter((p) => !p.pendingRemoval);

  if (state.isLastRound) {
    state.confirmPending = false;
    state.pendingLastRound = false;
    state.isLastRound = false;
    startFinale();
    return;
  }

  const buildingLastRound = state.pendingLastRound;
  const built = buildNewRound(buildingLastRound);
  state.matches = built.matches;
  state.walkoverPlayerIds = built.walkoverPlayerIds;
  state.pendingWaves = built.pendingWaves;
  state.waveNumber = 1;
  state.waveTotal = built.waveTotal;
  state.waveRemainderIds = built.waveRemainderIds;
  state.round += 1;
  state.view = 0;
  state.confirmPending = false;
  state.pendingLastRound = false;
  state.isLastRound = buildingLastRound;
  state.showScoreErrors = false;
  saveRoundSnapshot(state.round);
  persistAndRender();
  celebrate();
}

// Back arrow (or Escape/←) from the confirm step: discards nothing (no results
// were applied yet) and returns to the view the user came from.
function cancelRoundEnd() {
  if (!state.confirmPending) return;
  state.confirmPending = false;
  state.pendingLastRound = false;
  persistAndRender();
}

function startFinale() {
  const restIds = state.players.slice(3).map((p) => p.id);
  state.phase = "finale";
  state.finaleStep = 0;
  state.luckyPoolIds = restIds.length ? restIds : state.players.map((p) => p.id);
  state.luckyWinnerId = null;
  state.wheelRotation = 0;
  state.spinning = false;
  persistAndRender();
  celebrate();

  // The combined countdown-list-then-podium reveal (renderFinaleStandings in
  // views.js) is entirely CSS-timed, but confetti is triggered imperatively
  // here in JS -- so it needs its own timer to land a second burst at the
  // same moment the podium actually rises in, instead of firing with the
  // list at step-start like the celebrate() call just above. Guarded so a
  // quick "new tournament" / reset before the timer fires doesn't flash
  // confetti over whatever screen is showing by then.
  const podiumDelayMs = podiumStartSeconds(restIds.length) * 1000;
  setTimeout(() => {
    if (state.phase === "finale" && state.finaleStep === 0) celebrate();
  }, podiumDelayMs);
}

// ---- Finale actions ----

function advanceFinale() {
  const step = state.finaleStep;
  if (step === 0) {
    if (state.luckyLoserEnabled) {
      state.finaleStep = 1;
      persistAndRender();
    } else {
      // No wheel/result steps when it's off -- the combined standings+podium
      // reveal IS the last step (see renderFinaleStandings's own reset button).
      resetTournament();
    }
  } else if (step === 1) {
    spinWheel();
  } else if (step === 2) {
    resetTournament();
  }
}

function spinWheel() {
  if (state.spinning) return;
  const n = state.luckyPoolIds.length;
  if (!n) return;
  const { winnerIdx, rotation: spin } = computeSpin(n);
  // computeSpin's rotation assumes a wheel starting at 0deg. On a re-spin the
  // wheel is still sitting at the previous landing angle, so build on top of
  // the next full turn past it -- same landing segment, and the CSS transition
  // still spins forward instead of unwinding backwards.
  const base = Math.ceil(state.wheelRotation / 360) * 360;
  const rotation = base + spin;
  state.spinning = true;
  state.wheelRotation = rotation;

  // Mutate the wheel's own DOM node directly instead of going through
  // persistAndRender(): a full re-render would create a brand-new element with
  // the final rotation already baked into its initial style, so the CSS
  // transition would have no "from" value to animate and would just snap
  // straight to the end. Setting it on the existing, already-painted node lets
  // the transition actually play.
  const wheelEl = screenEl.querySelector(".wheel-circle");
  if (wheelEl) {
    // Force a layout flush first: on a re-spin the node was only just rendered
    // this same tick, and without a painted "from" value the transition snaps.
    void wheelEl.offsetWidth;
    wheelEl.style.transform = `rotate(${rotation}deg)`;
  }
  persistOnly();

  setTimeout(() => {
    state.spinning = false;
    state.luckyWinnerId = state.luckyPoolIds[winnerIdx];
    state.finaleStep = 2;
    persistAndRender();
    celebrate();
  }, SPIN_DURATION_MS);
}

// From the result step: back to the wheel (still resting where it landed,
// same pool) and straight into a fresh spin.
function spinAgain() {
  if (state.spinning || !state.luckyPoolIds.length) return;
  state.finaleStep = 1;
  state.luckyWinnerId = null;
  persistAndRender();
  spinWheel();
}

function resetTournament() {
  state.phase = "setup";
  state.players = [];
  state.matches = [];
  state.round = 1;
  state.view = 0;
  state.confirmPending = false;
  state.walkoverPlayerIds = [];
  state.showScoreErrors = false;
  state.pendingLastRound = false;
  state.isLastRound = false;
  state.pendingWaves = [];
  state.waveNumber = 1;
  state.waveTotal = 1;
  state.waveRemainderIds = [];
  state.finaleStep = 0;
  state.luckyPoolIds = [];
  state.luckyWinnerId = null;
  state.wheelRotation = 0;
  state.spinning = false;
  state.roundSnapshots = {};
  persistAndRender();
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  persistAndRender();
}

// ---- Player detail popup ----
// Not persisted: purely transient UI state, so render() only, no saveState().

function showPlayer(id) {
  state.selectedPlayerId = id;
  renderModal();
}

function hidePlayer() {
  state.selectedPlayerId = null;
  renderModal();
}

// ---- Logo "start over" confirm dialog ----
// Also transient UI: render() only, no saveState().

function requestLogoReset() {
  state.confirmingReset = true;
  renderModal();
}

function cancelLogoReset() {
  state.confirmingReset = false;
  renderModal();
}

function confirmLogoReset() {
  state.confirmingReset = false;
  resetTournament();
  renderModal();
}

// ---- Admin table ----
// Also transient UI: render() only, no saveState() -- same as the player popup.

function showAdmin() {
  state.showAdminTable = true;
  renderModal();
}

function hideAdmin() {
  state.showAdminTable = false;
  state.adminRoundFilter = "total";
  state.addPlayerError = "";
  renderModal();
}

// ---- Round snapshots & revert ----
// Captures round-scoped state the moment a round's matches are first built,
// so the admin table's round dropdown can later show what a round looked
// like at its start, and revert the whole tournament back to it. JSON
// round-trip is used for the deep clone (same as persistence.js) so the
// archived snapshot never aliases the live objects -- later gameplay
// (scores, admin edits, further rounds) can't reach back and corrupt it.
function captureRoundSnapshot() {
  return JSON.parse(JSON.stringify({
    players: state.players,
    matches: state.matches,
    walkoverPlayerIds: state.walkoverPlayerIds,
    pendingWaves: state.pendingWaves,
    waveNumber: state.waveNumber,
    waveTotal: state.waveTotal,
    waveRemainderIds: state.waveRemainderIds,
    isLastRound: state.isLastRound,
  }));
}

// Called right after a round's matches are (re)built for `roundNum` --
// startTournament, confirmRoundEnd's next-round build, and the admin
// remove-player rebuild/walkover-swap paths (which change the CURRENT
// round's matches and so must overwrite its existing snapshot, not leave a
// stale one behind referencing a player who no longer exists).
function saveRoundSnapshot(roundNum) {
  state.roundSnapshots[roundNum] = captureRoundSnapshot();
}

function setAdminRoundFilter(val) {
  state.adminRoundFilter = val;
  renderModal();
}

function requestRevertRound(roundNum) {
  state.confirmingRevertRound = roundNum;
  renderModal();
}

function cancelRevertRound() {
  state.confirmingRevertRound = null;
  renderModal();
}

// Restores the tournament to exactly how `roundNum` looked when it started:
// its original matchups, and every player's stats as of right before that
// round was played. Snapshots for any later round are dropped -- once this
// commits, they no longer describe anything reachable. Works from either
// live or finale (the round title/matchups on screen update either way,
// since this always lands back in the live phase).
function revertToRound(roundNum) {
  const snap = state.roundSnapshots[roundNum];
  if (!snap) return;

  state.players = JSON.parse(JSON.stringify(snap.players));
  state.matches = JSON.parse(JSON.stringify(snap.matches));
  state.walkoverPlayerIds = [...snap.walkoverPlayerIds];
  state.pendingWaves = JSON.parse(JSON.stringify(snap.pendingWaves));
  state.waveNumber = snap.waveNumber;
  state.waveTotal = snap.waveTotal;
  state.waveRemainderIds = [...snap.waveRemainderIds];
  state.isLastRound = snap.isLastRound;
  state.round = roundNum;

  state.phase = "live";
  state.view = 0;
  state.confirmPending = false;
  state.pendingLastRound = false;
  state.showScoreErrors = false;
  state.finaleStep = 0;
  state.luckyPoolIds = [];
  state.luckyWinnerId = null;
  state.wheelRotation = 0;
  state.spinning = false;
  state.showConfetti = false;

  Object.keys(state.roundSnapshots).forEach((k) => {
    if (Number(k) > roundNum) delete state.roundSnapshots[k];
  });

  state.confirmingRevertRound = null;
  state.adminRoundFilter = "total";
  state.showAdminTable = false;
  persistAndRender();
  renderModal();
}

// Editing a name from the admin table: by id, not idx, since that table is
// sorted alphabetically (a different order than state.players). Persist only,
// no re-render -- same as setPlayerName/setCourtName -- so the row doesn't
// jump around (re-sorting by the name being typed) or drop focus mid-edit.
function setPlayerNameAdmin(id, val) {
  const p = state.players.find((p) => p.id === id);
  if (!p) return;
  p.name = val;
  persistOnly();
}

// Correcting a player's wins/points from the admin table -- e.g. fixing a
// mis-entered match score after the fact. Blank/non-numeric while typing is
// left as-is rather than snapped to 0, so clearing the field to type a new
// value doesn't fight back; only a real number is ever written to state.
// Re-sorts (order only, see sortPlayers in tournament.js) so the leaderboard
// reflects the correction next time the screen behind the modal re-renders,
// without touching the admin table's own always-alphabetical row order.
function setPlayerWinsAdmin(id, val) {
  const p = state.players.find((p) => p.id === id);
  if (!p) return;
  const n = Number(val);
  if (val === "" || Number.isNaN(n)) return;
  p.wins = n;
  sortPlayers(state.players);
  persistOnly();
}

function setPlayerPointsAdmin(id, val) {
  const p = state.players.find((p) => p.id === id);
  if (!p) return;
  const n = Number(val);
  if (val === "" || Number.isNaN(n)) return;
  p.points = n;
  sortPlayers(state.players);
  persistOnly();
}

// ---- Admin: add a player mid-tournament ----
// The new player sits out the rest of the current round (its matches/waves
// are already built) and joins from the next round on. satOutLastRound makes
// buildRound treat them like someone coming back from a walkover, so they're
// guaranteed a match in that first round instead of being benched again.
// walkoverScore starts at the field's average rather than 0: at 0 they'd be
// first in line for every walkover after that (pickBenched goes lowest-first).

function setAdminNewPlayerName(val) {
  state.adminNewPlayerName = val;
  clearAddPlayerError();
}

function focusAdminAddInput() {
  const input = modalEl.querySelector('[data-bind="admin-new-player-name"]');
  if (input) input.focus();
}

function addPlayerAdmin() {
  const name = (state.adminNewPlayerName || "").trim();
  if (!name || state.phase !== "live") return;
  if (nameTaken(name)) {
    state.addPlayerError = duplicateNameError(name);
    renderModal();
    focusAdminAddInput();
    return;
  }
  const player = createPlayer(name);
  const n = state.players.length;
  player.walkoverScore = n ? state.players.reduce((sum, p) => sum + p.walkoverScore, 0) / n : 0;
  player.satOutLastRound = true;
  state.players.push(player);
  sortPlayers(state.players);
  state.adminNewPlayerName = "";
  persistAndRender();
  renderModal();
  // Keep the cursor in the field so several late arrivals can be typed in a row.
  focusAdminAddInput();
}

// ---- Admin: remove a player mid-tournament ----
// Three modes offered by the picker (renderRemovePlayerConfirm in views.js):
// right now (rebuilding the round's teams if they were playing), from next
// round onward (they finish this round as normal), or right now with a
// benched walkover player stepping into their spot instead of a full rebuild.

function requestRemovePlayer(id) {
  state.removalTargetId = id;
  renderModal();
}

function cancelRemovePlayer() {
  state.removalTargetId = null;
  renderModal();
}

// Shared close-out for all three modes: both roots need a refresh -- the
// screen behind the modal (players/matches changed) and the modal itself
// (drops back to the admin table so several players can be removed in a row).
function finishRemoval() {
  state.removalTargetId = null;
  persistAndRender();
  renderModal();
}

// True if `id` is part of this round's match structure anywhere -- the
// currently displayed wave (state.matches) or one still queued (wave mode's
// state.pendingWaves). Used to decide whether removing them now needs a full
// round rebuild; without checking pendingWaves too, a player removed while
// queued in a future wave would leave a dangling id in that wave's teams.
function playerIsInRound(id) {
  const inCurrent = state.matches.some((m) => m.team1.includes(id) || m.team2.includes(id));
  const inPending = state.pendingWaves.some((wave) => wave.some((m) => m.team1.includes(id) || m.team2.includes(id)));
  return inCurrent || inPending;
}

// Mode 1: immediate removal. If they're actually part of the round's matches
// (now or in a queued wave), the whole round is rebuilt from the reduced
// player pool -- same court/wave settings, same round number -- so teams
// come out even again instead of leaving a broken match behind.
function removePlayerNow(id) {
  const isPlaying = state.phase === "live" && playerIsInRound(id);
  state.players = state.players.filter((p) => p.id !== id);
  state.walkoverPlayerIds = state.walkoverPlayerIds.filter((pid) => pid !== id);
  if (isPlaying) {
    const built = buildNewRound(state.isLastRound);
    state.matches = built.matches;
    state.walkoverPlayerIds = built.walkoverPlayerIds;
    state.pendingWaves = built.pendingWaves;
    state.waveNumber = 1;
    state.waveTotal = built.waveTotal;
    state.waveRemainderIds = built.waveRemainderIds;
    state.view = 0;
    state.confirmPending = false;
    state.showScoreErrors = false;
    saveRoundSnapshot(state.round);
  }
  finishRemoval();
}

// Mode 2: let them finish the round they're already in; only marked here,
// actually dropped from state.players in confirmRoundEnd once that round's
// results are applied.
function removePlayerNextRound(id) {
  const p = state.players.find((p) => p.id === id);
  if (p) p.pendingRemoval = true;
  finishRemoval();
}

// Mode 3: lighter alternative to a full rebuild when they're in the
// currently displayed match -- a player currently on walkover this round
// steps into their spot instead, so the match carries on as a real match
// with the other 3 players untouched, rather than being cancelled. The
// substitute is whichever benched player has the highest walkoverScore --
// they've banked the most "sat out" credit, so it's fairest to bring them on
// now rather than bench them again. Falls back to removePlayerNow (which
// itself rebuilds if needed) if there's no one on walkover to swap in, or
// they aren't actually in a currently-visible match (already on walkover
// themselves, or queued in a future wave).
function removePlayerWalkoverSwap(id) {
  const matchIdx = state.matches.findIndex((m) => m.team1.includes(id) || m.team2.includes(id));
  if (matchIdx === -1 || state.walkoverPlayerIds.length === 0) { removePlayerNow(id); return; }

  let subId = state.walkoverPlayerIds[0];
  let subScore = -Infinity;
  state.walkoverPlayerIds.forEach((pid) => {
    const p = state.players.find((p) => p.id === pid);
    const score = p ? p.walkoverScore : -Infinity;
    if (score > subScore) { subScore = score; subId = pid; }
  });

  const m = state.matches[matchIdx];
  if (m.team1.includes(id)) m.team1 = m.team1.map((pid) => (pid === id ? subId : pid));
  else m.team2 = m.team2.map((pid) => (pid === id ? subId : pid));
  m.score1 = "";
  m.score2 = "";

  state.walkoverPlayerIds = state.walkoverPlayerIds.filter((pid) => pid !== subId);
  const sub = state.players.find((p) => p.id === subId);
  if (sub) sub.satOutLastRound = false;

  state.players = state.players.filter((p) => p.id !== id);
  state.confirmPending = false;
  state.showScoreErrors = false;
  saveRoundSnapshot(state.round);
  finishRemoval();
}

// ---- "Remove all players" confirm dialog ----
// Also transient UI: render() only for the request/cancel steps. Unlike the
// logo reset, this only clears the player list -- court settings and other
// setup choices are left alone.

function requestClearPlayers() {
  if (!state.players.length) return;
  state.confirmingClearPlayers = true;
  renderModal();
}

function cancelClearPlayers() {
  state.confirmingClearPlayers = false;
  renderModal();
}

function confirmClearPlayers() {
  state.confirmingClearPlayers = false;
  state.players = [];
  persistAndRender();
  renderModal();
}

// ---- Event delegation ----

appEl.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const idx = el.dataset.idx !== undefined ? Number(el.dataset.idx) : undefined;
  switch (el.dataset.action) {
    case "add-player": addPlayer(); break;
    case "add-test-players": addTestPlayers(); break;
    case "remove-player": removePlayer(idx); break;
    case "toggle-casual": toggleCasual(idx); break;
    case "inc-court": setCourtCount(1); break;
    case "dec-court": setCourtCount(-1); break;
    case "start-tournament": startTournament(); break;
    case "toggle-theme": toggleTheme(); break;
    case "start-finale": startFinale(); break;
    case "request-last-round": requestLastRound(); break;
    case "reset-tournament": resetTournament(); break;
    case "spin-again": spinAgain(); break;
    case "logo-reset": requestLogoReset(); break;
    case "confirm-logo-reset": confirmLogoReset(); break;
    case "cancel-logo-reset": cancelLogoReset(); break;
    case "clear-players": requestClearPlayers(); break;
    case "confirm-clear-players": confirmClearPlayers(); break;
    case "cancel-clear-players": cancelClearPlayers(); break;
    case "show-player": showPlayer(el.dataset.playerId); break;
    case "close-player": hidePlayer(); break;
    case "show-admin": showAdmin(); break;
    case "close-admin": hideAdmin(); break;
    case "add-player-admin": addPlayerAdmin(); break;
    case "request-remove-player": requestRemovePlayer(el.dataset.playerId); break;
    case "cancel-remove-player": cancelRemovePlayer(); break;
    case "remove-player-now": removePlayerNow(el.dataset.playerId); break;
    case "remove-player-next-round": removePlayerNextRound(el.dataset.playerId); break;
    case "remove-player-walkover-swap": removePlayerWalkoverSwap(el.dataset.playerId); break;
    case "request-revert-round": requestRevertRound(Number(el.dataset.round)); break;
    case "cancel-revert-round": cancelRevertRound(); break;
    case "confirm-revert-round": revertToRound(Number(el.dataset.round)); break;
    case "confirm-round": confirmRoundEnd(); break;
    case "cancel-round": cancelRoundEnd(); break;
    case "cycle-view": cycleView(Number(el.dataset.dir)); break;
  }
});

appEl.addEventListener("input", (e) => {
  const el = e.target;
  const bind = el.dataset.bind;
  if (!bind) return;
  if (bind === "new-player-name") setNewPlayerName(el.value);
  else if (bind === "new-player-casual") setNewPlayerCasual(el.checked);
  else if (bind === "lucky-loser-enabled") setLuckyLoserEnabled(el.checked);
  else if (bind === "wave-mode-enabled") setWaveModeEnabled(el.checked);
  else if (bind === "player-name") setPlayerName(Number(el.dataset.idx), el.value);
  else if (bind === "court-name") setCourtName(Number(el.dataset.idx), el.value);
  else if (bind === "admin-player-name") setPlayerNameAdmin(el.dataset.playerId, el.value);
  else if (bind === "admin-player-wins") setPlayerWinsAdmin(el.dataset.playerId, el.value);
  else if (bind === "admin-player-points") setPlayerPointsAdmin(el.dataset.playerId, el.value);
  else if (bind === "admin-round-filter") setAdminRoundFilter(el.value);
  else if (bind === "admin-new-player-name") setAdminNewPlayerName(el.value);
  else if (bind === "score1") { setMatchScore(Number(el.dataset.matchId), "score1", el.value); refreshMatchStatusBadge(Number(el.dataset.matchId)); }
  else if (bind === "score2") { setMatchScore(Number(el.dataset.matchId), "score2", el.value); refreshMatchStatusBadge(Number(el.dataset.matchId)); }
});

appEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.bind === "new-player-name") {
    addPlayer();
  }
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.bind === "admin-new-player-name") {
    addPlayerAdmin();
  }
});

bindKeyboard({
  getPhase: () => state.phase,
  cycleView,
  requestRoundEnd,
  confirmRoundEnd,
  cancelRoundEnd,
  isConfirmPending: () => state.confirmPending,
  advanceFinale,
  isModalOpen: () => state.selectedPlayerId !== null || state.confirmingReset || state.confirmingClearPlayers || state.showAdminTable || state.removalTargetId !== null || state.confirmingRevertRound !== null,
  closeModal: () => {
    // Escape from the remove-player/revert-round pickers backs out to the
    // admin table underneath them, not all the way out -- matches their own
    // Avbryt buttons.
    if (state.confirmingRevertRound !== null) { cancelRevertRound(); return; }
    if (state.removalTargetId) { cancelRemovePlayer(); return; }
    hidePlayer();
    cancelLogoReset();
    cancelClearPlayers();
    hideAdmin();
  },
});

render();
